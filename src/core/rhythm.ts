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

/** Sigue un valor con ataque rápido y caída lenta (constantes en ms): así las manchas "respiran" sin parpadear. */
export function follow(current: number, target: number, dtMs: number, attackMs = 60, releaseMs = 280): number {
  const tau = target > current ? attackMs : releaseMs;
  return current + (target - current) * (1 - Math.exp(-dtMs / tau));
}
