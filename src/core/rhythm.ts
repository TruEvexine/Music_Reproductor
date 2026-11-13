// Análisis del ritmo para el fondo reactivo (docs/LUCES_REACTIVAS.md): nivel de cada banda normalizado a la propia canción y ataques
// por flujo espectral con umbral relativo a la media móvil y a la variación. TypeScript puro: recibe el espectro de
// `AnalyserNode.getByteFrequencyData` (bytes 0–255), nada de DOM.

export interface Bands {
  bass: number;
  mid: number;
  treble: number;
}

/** Bandas sin solaparse: graves (bombo, 808, bajo), medios (voz e instrumentos) y agudos (platos, hi-hats). 150–250 Hz queda fuera: ahí se mezclan bajo y voz. */
const RANGES = { bass: [20, 150], mid: [250, 4000], treble: [4000, 16000] } as const;

/** Rango del analizador (dB) que fija el motor. Con el −30 de serie, los graves de un máster actual se saturaban en 255 y la banda quedaba plana. */
export const ANALYSER_DB = { min: -100, max: -10 } as const;

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

/** Energía media (sin normalizar) de graves, medios y agudos, de 0 a 1. */
export function bandEnergies(spectrum: ArrayLike<number>, sampleRate: number, fftSize: number): Bands {
  const at = (range: readonly [number, number]) => meanOf(spectrum, binsOf(range, spectrum.length, sampleRate, fftSize));
  return { bass: at(RANGES.bass), mid: at(RANGES.mid), treble: at(RANGES.treble) };
}

export type Sensitivity = "auto" | "low" | "high";

/** Constante de tiempo (ms) de las medias móviles de la normalización y de los umbrales: unos 4 s de memoria. */
export const NORM_MS = 4000;
/** `k`: desviaciones típicas sobre la media que debe superar el flujo para ser un ataque. `spread`: desviaciones típicas que recorre el nivel de 0 a 1. */
const LEVELS = { low: { k: 2, spread: 6 }, auto: { k: 1.6, spread: 4 }, high: { k: 1.3, spread: 2.5 } } as const;
/** Por debajo de este nivel la banda está en silencio (≈ −97 dB): ni nivel ni ataques, y las medias se congelan (una pausa no las arrastra a cero). */
const SILENCE = 0.03;
/** Desviaciones mínimas: un tono constante o un ruido de fondo no se amplifican hasta parecer música. Nivel ≈ 0,9 dB. */
const MIN_DEVIATION = 0.01;
const MIN_FLUX_DEVIATION = 0.002;
/** Flujo mínimo absoluto: subidas de menos de ~0,3 dB de media no son ataques aunque destaquen sobre un fondo muy quieto. */
const MIN_FLUX = 0.003;
/** Ataques de agudos por segundo con los que la velocidad llega al tope. */
const PACE_FULL = 6;

/** Una banda: su nivel normalizado (media móvil → 0,5; ±spread/2 desviaciones → 0 y 1) y si hay ataque en este cuadro. */
function createBand(range: readonly [number, number], minGapMs: number) {
  let previous: Float32Array | undefined;
  let frames = 0;
  let mean = 0;
  let variance = 0;
  let fluxMean = 0;
  let fluxVariance = 0;
  let lastOnset = -Infinity;
  return (spectrum: ArrayLike<number>, sampleRate: number, fftSize: number, now: number, dtMs: number, k: number, spread: number) => {
    const [from, to] = binsOf(range, spectrum.length, sampleRate, fftSize);
    const energy = meanOf(spectrum, [from, to]);
    if (!previous || previous.length !== to - from) previous = Float32Array.from({ length: to - from }, (_, i) => spectrum[from + i]);
    let rise = 0;
    for (let i = from; i < to; i++) {
      rise += Math.max(0, spectrum[i] - previous[i - from]);
      previous[i - from] = spectrum[i];
    }
    const flux = rise / ((to - from) * 255);
    if (energy < SILENCE) return { level: 0, onset: false };
    const level = frames === 0 ? 0.5 : Math.min(1, Math.max(0, 0.5 + (energy - mean) / (spread * Math.max(MIN_DEVIATION, Math.sqrt(variance)))));
    const onset = frames >= 30 && flux > MIN_FLUX && flux > fluxMean + k * Math.max(MIN_FLUX_DEVIATION, Math.sqrt(fluxVariance)) && now - lastOnset >= minGapMs;
    if (onset) lastOnset = now;
    // Al empezar es la media acumulada: se adapta en el primer segundo en vez de tardar 4.
    const a = Math.max(1 - Math.exp(-dtMs / NORM_MS), 1 / (frames + 1));
    if (frames === 0) mean = energy;
    variance += a * ((energy - mean) ** 2 - variance);
    mean += a * (energy - mean);
    fluxVariance += a * ((flux - fluxMean) ** 2 - fluxVariance);
    fluxMean += a * (flux - fluxMean);
    frames += 1;
    return { level, onset };
  };
}

/**
 * Análisis por cuadro, adaptado a cada canción: el nivel de cada banda se mide contra su propia media y variación de los
 * últimos ~4 s, y un ataque es un flujo espectral (suma de subidas entre cuadros) por encima de media + k·σ de ese flujo.
 * Así una canción comprimida, con los graves siempre arriba, se mueve tanto como una con mucha dinámica.
 * - `beat`: ataque en los graves (bombo, 808), con 200 ms de separación mínima.
 * - `pace`: ataques de agudos por segundo (hi-hats, platos), de media en ~3 s, escalado a 0–1.
 */
export function createAnalysis() {
  const bass = createBand(RANGES.bass, 200);
  const mid = createBand(RANGES.mid, 200);
  const treble = createBand(RANGES.treble, 90);
  let last: number | undefined;
  let pace = 0;
  return {
    /** `now` en ms (monótono). */
    push(spectrum: ArrayLike<number>, sampleRate: number, fftSize: number, now: number, sensitivity: Sensitivity = "auto"): { bands: Bands; beat: boolean; pace: number } {
      const dtMs = last === undefined ? 1000 / 60 : Math.max(1, now - last);
      last = now;
      const { k, spread } = LEVELS[sensitivity] ?? LEVELS.auto;
      const low = bass(spectrum, sampleRate, fftSize, now, dtMs, k, spread);
      const voice = mid(spectrum, sampleRate, fftSize, now, dtMs, k, spread);
      const high = treble(spectrum, sampleRate, fftSize, now, dtMs, k, spread);
      pace += ((high.onset ? 1000 / dtMs : 0) - pace) * (1 - Math.exp(-dtMs / 3000));
      return { bands: { bass: low.level, mid: voice.level, treble: high.level }, beat: low.onset, pace: Math.min(1, pace / PACE_FULL) };
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
/**
 * Bajada máxima del brillo por segundo. Un destello que cuenta (5 % de luminancia = 0,18 de `swell`) tarda ≥ 72 ms en subir y ≥ 277 ms en bajar:
 * ≥ 349 ms por ciclo, así que ni el nivel de graves ni los golpes pueden pasar de 2,9 destellos por segundo, por construcción.
 */
export const SWELL_FALL = 0.65;
/** Energía de reposo: con ella la velocidad es la elegida por el usuario (×1). Sin ritmo, el fondo "Portada" la usa. */
export const REST_ENERGY = 0.25;
const RATE_PER_ENERGY = 2;
const RATE_LIMITS = [0.5, 2.5] as const;

export interface LightInput {
  /** Nivel de cada banda normalizado a la canción (0–1, media ≈ 0,5). `null` = fondo sin reacción al audio (modo Portada). */
  bands: Bands | null;
  /** Ataque en los graves en este cuadro. */
  beat: boolean;
  /** Densidad de ataques de agudos (0–1, `createAnalysis`): mueve la velocidad. */
  pace?: number;
  dtMs: number;
  /** Reloj monótono (ms). */
  now: number;
  /** Velocidad elegida por el usuario (0,25–2×). */
  speed: number;
}

/**
 * Convierte el análisis del audio en lo único que el fondo necesita para dibujar, ya suavizado:
 * - `swell` (0–1): hinchazón y brillo. Ataque 90 ms y caída 450 ms en los graves; los golpes sostienen un pulso de 100 ms,
 *   con separación mínima de `FLASH_GAP_MS`; y el resultado tiene tope de subida (`SWELL_SLEW`) y de bajada (`SWELL_FALL`): nunca más de 3 destellos por segundo.
 * - `rate`: multiplicador de velocidad, ligado a una envolvente lenta de la densidad de agudos (sube en ~2 s, baja en ~4 s).
 * - `drift`: fase de la deriva, integrada con `rate` cuadro a cuadro, de modo que cambiar la velocidad nunca la hace saltar.
 * - `flash`: empezó un destello en este cuadro (para las mediciones).
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
    push({ bands, beat, pace = REST_ENERGY, dtMs, now, speed }: LightInput) {
      bass = follow(bass, bands?.bass ?? 0, dtMs, 90, 450);
      mid = follow(mid, bands?.mid ?? 0, dtMs, 120, 500);
      const flash = !!bands && beat && now - lastFlash >= FLASH_GAP_MS;
      if (flash) {
        lastFlash = now;
        hold = 100;
      }
      hold = Math.max(0, hold - dtMs);
      pulse = follow(pulse, hold > 0 ? 1 : 0, dtMs, 70, 300);
      const target = Math.min(1, 0.6 * bass + 0.45 * pulse);
      swell = slew(swell, target, dtMs, target > swell ? SWELL_SLEW : SWELL_FALL);
      energy = follow(energy, bands ? pace : REST_ENERGY, dtMs, 2000, 4000);
      const rate = Math.min(RATE_LIMITS[1], Math.max(RATE_LIMITS[0], 1 + RATE_PER_ENERGY * (energy - REST_ENERGY)));
      drift += (dtMs / 1000) * speed * rate;
      return { swell, mid, rate, drift, flash };
    },
  };
}
