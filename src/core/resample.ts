// Reescalado de portadas como datos puros (sin canvas): Lanczos 3 separable y enfoque (unsharp mask) con tope.
// El canvas, el decodificado y el worker viven en platform/web/coverScale.ts. Ningún algoritmo clásico añade detalle que la imagen no tenga:
// esto evita el desenfoque del navegador al ampliar y el aliasing al reducir; no «inventa» nitidez.

export interface Raster {
  /** RGBA, 4 bytes por píxel. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const LOBES = 3;
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x: number) => (Math.abs(x) >= LOBES ? 0 : sinc(x) * sinc(x / LOBES));

interface Taps {
  start: Int32Array;
  count: Int32Array;
  weights: Float32Array;
  stride: number;
}

/** Pesos de cada píxel de salida. Al reducir, el filtro se ensancha por el factor de reducción (si no, hay aliasing). */
function tapsFor(from: number, to: number): Taps {
  const scale = from / to;
  const widen = Math.max(1, scale);
  const stride = Math.ceil(2 * LOBES * widen) + 2; // de floor(c − r) a ceil(c + r) caben hasta 2r + 2 muestras
  const start = new Int32Array(to);
  const count = new Int32Array(to);
  const weights = new Float32Array(to * stride);
  for (let i = 0; i < to; i++) {
    const center = (i + 0.5) * scale;
    const first = Math.max(0, Math.floor(center - LOBES * widen));
    const last = Math.min(from - 1, Math.ceil(center + LOBES * widen));
    let sum = 0;
    for (let j = first; j <= last; j++) sum += weights[i * stride + (j - first)] = lanczos((j + 0.5 - center) / widen);
    for (let j = first; j <= last; j++) weights[i * stride + (j - first)] /= sum;
    start[i] = first;
    count[i] = last - first + 1;
  }
  return { start, count, weights, stride };
}

/** Lanczos 3 separable (horizontal y luego vertical). En los bordes los pesos que sobran se descartan y el resto se renormaliza. */
export function resample(src: Raster, width: number, height: number): Raster {
  const { width: sw, height: sh } = src;
  const across = tapsFor(sw, width);
  const down = tapsFor(sh, height);
  const middle = new Float32Array(width * sh * 3);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      const base = x * across.stride;
      for (let k = 0, n = across.count[x]; k < n; k++) {
        const w = across.weights[base + k];
        const at = row + (across.start[x] + k) * 4;
        r += w * src.data[at];
        g += w * src.data[at + 1];
        b += w * src.data[at + 2];
      }
      const out = (y * width + x) * 3;
      middle[out] = r;
      middle[out + 1] = g;
      middle[out + 2] = b;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const base = y * down.stride;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0, n = down.count[y]; k < n; k++) {
        const w = down.weights[base + k];
        const at = ((down.start[y] + k) * width + x) * 3;
        r += w * middle[at];
        g += w * middle[at + 1];
        b += w * middle[at + 2];
      }
      const out = (y * width + x) * 4;
      data[out] = r;
      data[out + 1] = g;
      data[out + 2] = b;
      data[out + 3] = 255; // las portadas son opacas
    }
  }
  return { data, width, height };
}

export interface Unsharp {
  /** Cuánto de la diferencia con la versión desenfocada se suma (0,3 = ligero). */
  amount: number;
  /** Sigma del desenfoque gaussiano, en píxeles. */
  radius: number;
  /** Tope del realce por píxel (niveles de 0 a 255): lo que evita los halos junto a los bordes duros. */
  cap: number;
  /** Diferencias menores que esto no se tocan (ruido y artefactos JPEG no se realzan). */
  threshold: number;
}

/**
 * Enfoque de una ampliación (al reducir no hace falta: el último tramo lo resuelve el canvas). Medido sobre una portada sintética (ver resample.test.ts):
 * Lanczos ya devuelve casi toda la fidelidad que se puede recuperar y un enfoque mayor la baja (PSNR/SSIM) además de crear halos; por eso es ligero y con tope.
 */
export const ENLARGE_SHARPEN: Unsharp = { amount: 0.35, radius: 0.8, cap: 16, threshold: 3 };

/** Pasos de reducción: mitades exactas mientras la mitad aún sea ≥ al destino. Lo que sobra (de 1× a 2×) lo resuelve el canvas al reducir, o `resample` al ampliar. */
export function halvings(side: number, target: number): number[] {
  const steps: number[] = [];
  for (let current = side; Math.ceil(current / 2) >= target; ) steps.push((current = Math.ceil(current / 2)));
  return steps;
}

function blurred(values: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) sum += kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const pass = (input: Float32Array, horizontal: boolean) => {
    const output = new Float32Array(input.length);
    const [along, across] = horizontal ? [width, height] : [height, width];
    for (let line = 0; line < across; line++) {
      for (let i = 0; i < along; i++) {
        let total = 0;
        for (let k = -radius; k <= radius; k++) {
          const at = Math.min(along - 1, Math.max(0, i + k));
          total += kernel[k + radius] * input[horizontal ? line * width + at : at * width + line];
        }
        output[horizontal ? line * width + i : i * width + line] = total;
      }
    }
    return output;
  };
  return pass(pass(values, true), false);
}

/**
 * Unsharp mask sobre la luminancia (el mismo realce a R, G y B: no cambia el tono ni deja franjas de color), con umbral y tope.
 * Devuelve una imagen nueva; la de entrada no se modifica.
 */
export function unsharp(src: Raster, { amount, radius, cap, threshold }: Unsharp): Raster {
  const { width, height } = src;
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i++) luma[i] = 0.2126 * src.data[i * 4] + 0.7152 * src.data[i * 4 + 1] + 0.0722 * src.data[i * 4 + 2];
  const soft = blurred(luma, width, height, radius);
  const data = new Uint8ClampedArray(src.data);
  for (let i = 0; i < luma.length; i++) {
    const diff = luma[i] - soft[i];
    const lift = Math.sign(diff) * Math.max(0, Math.abs(diff) - threshold) * amount;
    const delta = Math.max(-cap, Math.min(cap, lift));
    data[i * 4] += delta;
    data[i * 4 + 1] += delta;
    data[i * 4 + 2] += delta;
  }
  return { data, width, height };
}

/** Lado máximo que se sirve de una portada: lo que ocupa el reproductor grande en una pantalla de 2× (34 rem ≈ 544 px). */
export const MAX_COVER_PX = 1280;

/** Píxeles reales de pantalla (ancho × densidad) redondeados hacia arriba a múltiplos de 64: pocas variantes que cachear y nunca menos de lo que se ve. */
export const coverBucket = (devicePx: number) => (devicePx > 0 ? Math.min(MAX_COVER_PX, Math.ceil(devicePx / 64) * 64) : 0);
