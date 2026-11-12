// Análisis del ritmo para el fondo reactivo: energía por bandas y detección de golpes (spectral flux con umbral adaptativo).
// TypeScript puro: recibe el espectro que entrega `AnalyserNode.getByteFrequencyData` (bytes 0–255), nada de DOM.

export interface Bands {
  bass: number;
  mid: number;
  treble: number;
}

const RANGES = { bass: [20, 150], mid: [150, 2000], treble: [2000, 16000] } as const;
/** Banda donde se busca el golpe del bombo: un poco más ancha que los graves para no perder bombos agudos. */
const KICK_RANGE = [30, 200] as const;

function binsOf(range: readonly [number, number], length: number, sampleRate: number, fftSize: number): [number, number] {
  const width = sampleRate / fftSize;
  const from = Math.max(1, Math.floor(range[0] / width));
  return [from, Math.max(from + 1, Math.min(length, Math.ceil(range[1] / width)))];
}

function meanOf(spectrum: ArrayLike<number>, [from, to]: [number, number]): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += spectrum[i];
  return sum / ((to - from) * 255);
}

/** Energía media de graves, medios y agudos, de 0 a 1. */
export function bandEnergies(spectrum: ArrayLike<number>, sampleRate: number, fftSize: number): Bands {
  const at = (range: readonly [number, number]) => meanOf(spectrum, binsOf(range, spectrum.length, sampleRate, fftSize));
  return { bass: at(RANGES.bass), mid: at(RANGES.mid), treble: at(RANGES.treble) };
}

export interface BeatDetectorOptions {
  /** Cuadros de historial para el umbral adaptativo (≈ 0,7 s a 60 fps). */
  history?: number;
  /** Cuántas desviaciones típicas por encima de la media debe estar el flujo para contar como golpe. */
  k?: number;
  /** Flujo mínimo absoluto (0–1): por debajo son fugas de hi-hats y ruido, aunque el historial sea de silencio. Un bombo real da ≈ 0,8. */
  floor?: number;
  /** Separación mínima entre golpes (ms): 200 ms admite hasta 300 BPM. */
  minGapMs?: number;
}

/**
 * Detector de golpes por flujo espectral: suma, en la banda del bombo, los aumentos de energía entre cuadros
 * consecutivos. Es golpe cuando ese flujo supera media + k·σ del historial reciente (se adapta solo al volumen
 * de la música) y el mínimo absoluto, respetando la separación mínima entre golpes.
 */
export function createBeatDetector({ history = 40, k = 1.6, floor = 0.25, minGapMs = 200 }: BeatDetectorOptions = {}) {
  let previous: Float32Array | undefined;
  const fluxes: number[] = [];
  let lastBeat = -Infinity;
  return {
    /** `now` en ms (monótono). Devuelve el flujo del cuadro y si hubo golpe. */
    push(spectrum: ArrayLike<number>, sampleRate: number, fftSize: number, now: number): { beat: boolean; flux: number } {
      const [from, to] = binsOf(KICK_RANGE, spectrum.length, sampleRate, fftSize);
      if (!previous || previous.length !== to - from) {
        previous = Float32Array.from({ length: to - from }, (_, i) => spectrum[from + i]);
        return { beat: false, flux: 0 };
      }
      let rise = 0;
      for (let i = from; i < to; i++) {
        rise += Math.max(0, spectrum[i] - previous[i - from]);
        previous[i - from] = spectrum[i];
      }
      const flux = rise / ((to - from) * 255);
      let mean = 0;
      for (const value of fluxes) mean += value;
      mean /= fluxes.length || 1;
      let variance = 0;
      for (const value of fluxes) variance += (value - mean) ** 2;
      const deviation = Math.sqrt(variance / (fluxes.length || 1));
      const beat = fluxes.length >= 10 && flux > floor && flux > mean + k * deviation && now - lastBeat >= minGapMs;
      if (beat) lastBeat = now;
      fluxes.push(flux);
      if (fluxes.length > history) fluxes.shift();
      return { beat, flux };
    },
  };
}

/** Mueve `current` hacia `target` sin superar `perSecond` unidades por segundo. */
export function slew(current: number, target: number, dtMs: number, perSecond: number): number {
  const step = (perSecond * dtMs) / 1000;
  return current + Math.max(-step, Math.min(step, target - current));
}

/** Sigue un valor con ataque rápido y caída lenta (constantes en ms): así las manchas "respiran" sin parpadear. */
export function follow(current: number, target: number, dtMs: number, attackMs = 60, releaseMs = 280): number {
  const tau = target > current ? attackMs : releaseMs;
  return current + (target - current) * (1 - Math.exp(-dtMs / tau));
}

/** Separación mínima entre destellos del fondo: 340 ms = 2,9 por segundo, bajo el límite de 3 de las pautas de fotosensibilidad (WCAG 2.3.1). */
export const FLASH_GAP_MS = 340;
/** Cuánto puede cambiar el brillo del fondo por segundo (0–1 de recorrido): en 100 ms, menos del 10 % de luminancia relativa. */
export const SWELL_SLEW = 2.5;
/** Energía de reposo: con ella la velocidad es la elegida por el usuario (×1). Sin ritmo, el fondo "Portada" la usa. */
export const REST_ENERGY = 0.25;
const RATE_PER_ENERGY = 2;
const RATE_LIMITS = [0.5, 2.5] as const;

export interface LightInput {
  /** Energía por bandas ya escalada (0–1). `null` = fondo sin reacción al audio (modo Portada). */
  bands: Bands | null;
  /** Golpe detectado en este cuadro. */
  beat: boolean;
  dtMs: number;
  /** Reloj monótono (ms). */
  now: number;
  /** Velocidad elegida por el usuario (0,25–2×). */
  speed: number;
}

/**
 * Convierte el análisis del audio en lo único que el fondo necesita para dibujar, ya suavizado:
 * - `swell` (0–1): hinchazón y brillo. Ataque 90 ms y caída 450 ms en los graves; los golpes sostienen un pulso de 100 ms,
 *   con separación mínima de `FLASH_GAP_MS` (nunca más de 3 destellos por segundo); y el resultado tiene tope de cambio (`SWELL_SLEW`).
 * - `rate`: multiplicador de velocidad, ligado a una envolvente de energía lenta (sube en ~2 s, baja en ~4 s).
 * - `drift`: fase de la deriva, integrada con `rate` cuadro a cuadro, de modo que cambiar la velocidad nunca la hace saltar.
 */
export function createLight() {
  let bass = 0;
  let mid = 0;
  let pulse = 0;
  let hold = 0;
  let swell = 0;
  let energy = REST_ENERGY;
  let drift = 0;
  let lastFlash = -Infinity;
  return {
    push({ bands, beat, dtMs, now, speed }: LightInput) {
      bass = follow(bass, bands?.bass ?? 0, dtMs, 90, 450);
      mid = follow(mid, bands?.mid ?? 0, dtMs, 120, 500);
      if (bands && beat && now - lastFlash >= FLASH_GAP_MS) {
        lastFlash = now;
        hold = 100;
      }
      hold = Math.max(0, hold - dtMs);
      pulse = follow(pulse, hold > 0 ? 1 : 0, dtMs, 70, 300);
      swell = slew(swell, Math.min(1, bass + 0.5 * pulse), dtMs, SWELL_SLEW);
      const loudness = bands ? Math.min(1, 0.5 * bands.bass + 0.3 * bands.mid + 0.2 * bands.treble) : REST_ENERGY;
      energy = follow(energy, loudness, dtMs, 2000, 4000);
      const rate = Math.min(RATE_LIMITS[1], Math.max(RATE_LIMITS[0], 1 + RATE_PER_ENERGY * (energy - REST_ENERGY)));
      drift += (dtMs / 1000) * speed * rate;
      return { swell, mid, rate, drift };
    },
  };
}
