// Banco de pruebas de las luces reactivas, sin navegador: imita `AnalyserNode` y mide lo que llega al shader.
// Lo usan `rhythm.test.ts` (señales sintéticas) y `scripts/medir-luces.ts` (audio real decodificado con ffmpeg). La app no lo importa.

import { ANALYSER_DB } from "./rhythm.ts";

export const SIM_RATE = 44100;
export const SIM_FFT = 2048;

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/**
 * El mismo camino que `getByteFrequencyData`: ventana de Blackman, FFT, suavizado temporal (0,4, como el motor) y escala
 * dB → byte entre `minDb` y `maxDb` (los del motor, `ANALYSER_DB`). `frame(signal, end)` analiza los últimos 2048 muestreos hasta `end` (s).
 */
export function createAnalyserSim(smoothing = 0.4, minDb: number = ANALYSER_DB.min, maxDb: number = ANALYSER_DB.max) {
  const smooth = new Float64Array(SIM_FFT / 2);
  const window = Float64Array.from({ length: SIM_FFT }, (_, i) => 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / SIM_FFT) + 0.08 * Math.cos((4 * Math.PI * i) / SIM_FFT));
  return {
    frame(signal: (t: number) => number, end: number): Uint8Array {
      const re = new Float64Array(SIM_FFT);
      const im = new Float64Array(SIM_FFT);
      for (let i = 0; i < SIM_FFT; i++) re[i] = signal(end - (SIM_FFT - 1 - i) / SIM_RATE) * window[i];
      fft(re, im);
      const bytes = new Uint8Array(SIM_FFT / 2);
      for (let k = 0; k < bytes.length; k++) {
        smooth[k] = smoothing * smooth[k] + (1 - smoothing) * (Math.hypot(re[k], im[k]) / SIM_FFT);
        const db = 20 * Math.log10(Math.max(smooth[k], 1e-12));
        bytes[k] = Math.round(Math.min(255, Math.max(0, (255 * (db - minDb)) / (maxDb - minDb))));
      }
      return bytes;
    },
  };
}

/** Señal a partir de muestras PCM mono a `SIM_RATE` (fuera del rango, silencio). */
export const fromSamples = (samples: Float32Array) => (t: number) => samples[Math.round(t * SIM_RATE)] ?? 0;

/** Lo que el bucle del fondo entrega al shader en cada cuadro. */
export interface LightFrame {
  swell: number;
  mid: number;
  rate: number;
  /** Empezó un destello en este cuadro. */
  flash: boolean;
}

/** Brillo relativo (0–1) que pinta el shader con ese `swell`: `0.9 + swell·0.35`, sobre su máximo de 1,25. */
export const luminanceOf = (swell: number) => (0.9 + swell * 0.35) / 1.25;

/** Mayor cambio de brillo en `window` cuadros (6 a 60 fps = 100 ms). */
export function maxStep(series: number[], window = 6) {
  let worst = 0;
  for (let i = window; i < series.length; i++) worst = Math.max(worst, Math.abs(series[i] - series[i - window]));
  return worst;
}

/** Destellos por segundo en la peor ventana de 1 s: un destello = subida y bajada de al menos `minSwing` (5 %, el doble de exigente que el 10 % de WCAG). */
export function worstFlashesPerSecond(series: number[], minSwing = 0.05, fps = 60) {
  const swings: number[] = [];
  let extreme = series[0];
  let rising = true;
  series.forEach((value, i) => {
    if (rising ? value > extreme : value < extreme) extreme = value;
    else if (Math.abs(extreme - value) >= minSwing) {
      swings.push(i / fps);
      extreme = value;
      rising = !rising;
    }
  });
  return Math.max(0, ...swings.map((from) => swings.filter((t) => t >= from && t < from + 1).length)) / 2;
}

const std = (values: number[]) => {
  const mean = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length || 1));
};

/**
 * Métrica de actividad de la luz (docs/LUCES_REACTIVAS.md §5), sobre cuadros a 60 fps:
 * - `actividad`: desviación típica del brillo dentro de ventanas de 2 s, de media, en puntos (×100). Mide cuánto "late" la luz al ritmo;
 *   un fondo quieto da 0. Las ventanas cortas descartan los cambios lentos (de estrofa a estribillo).
 * - `destellos`: destellos por segundo de media. `velocidad`: desviación típica del multiplicador de velocidad.
 * - Topes: `peorDestellos` (destellos en la peor ventana de 1 s, ≤ 3) y `maxPaso` (mayor cambio de brillo en 100 ms, < 0,1).
 */
export function lightMetrics(frames: LightFrame[], fps = 60) {
  const luminance = frames.map((frame) => luminanceOf(frame.swell));
  const windows: number[] = [];
  for (let from = 0; from + 2 * fps <= luminance.length; from += 2 * fps) windows.push(std(luminance.slice(from, from + 2 * fps)));
  return {
    actividad: (100 * windows.reduce((sum, v) => sum + v, 0)) / (windows.length || 1),
    destellos: frames.filter((frame) => frame.flash).length / (frames.length / fps),
    velocidad: std(frames.map((frame) => frame.rate)),
    peorDestellos: worstFlashesPerSecond(luminance, 0.05, fps),
    maxPaso: maxStep(luminance, Math.round(fps / 10)),
  };
}
