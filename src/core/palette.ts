// Paleta derivada de la portada, corregida en OKLCH para que nunca rompa el contraste.
// Entrada: píxeles RGBA (de un canvas pequeño). Salida: colores CSS listos para usar.

export interface Palette {
  /** Acento para la pista actual y el botón primario. Contraste ≥ 4.5:1 sobre el fondo de la app. */
  accent: string;
  /** Texto sobre el acento. */
  onAccent: string;
  /** Tinte oscuro para el ambiente del reproductor. */
  glow: string;
  /** Tono dominante (0–360), para derivar paletas analógicas. */
  hue: number;
  /** Colores del fondo animado (hasta 4, sRGB 0–1): tonos distintos de la portada, oscuros para que el texto se lea. */
  colors: Rgb[];
  /** Tono y croma de cada color anterior: el modo HDR los reconvierte a otra gama y con otra ganancia de croma. */
  swatches: Swatch[];
}

export interface Swatch {
  hue: number;
  chroma: number;
}

/** Gama en la que se pintan los colores del fondo: sRGB, o Display P3 (≈ 25 % más ancha) si la pantalla la tiene. */
export type Gamut = "srgb" | "p3";

/** sRGB con canales de 0 a 1. */
export type Rgb = [number, number, number];

export const APP_BACKGROUND_L = 0.145;

/** Luminosidad de cada mancha, de la más viva (dominante) a la más oscura: con ellas el texto claro sigue legible. */
const BLOB_LIGHTNESS = [0.46, 0.4, 0.34, 0.28];

export const fallbackPalette: Palette = {
  accent: "oklch(0.84 0.09 85)",
  onAccent: "oklch(0.2 0.03 85)",
  glow: "oklch(0.3 0.03 85)",
  hue: 85,
  colors: colorsFromHue(85, 0.05),
  swatches: hueSwatches(85, 0.05),
};

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** RGB lineal Display P3 → RGB lineal sRGB (puede salirse de 0–1: es un color que sRGB no alcanza). */
function p3ToLinearSrgb(r: number, g: number, b: number): Rgb {
  return [1.2249401 * r - 0.2249404 * g, -0.0420569 * r + 1.0420571 * g, -0.0196376 * r - 0.0786361 * g + 1.0982735 * b];
}

/** RGB codificado (0–255) → OKLCH, en sRGB o en Display P3 (misma curva de transferencia). Fórmulas de Björn Ottosson. */
export function rgbToOklch(r: number, g: number, b: number, gamut: Gamut = "srgb"): { l: number; c: number; h: number } {
  const [lr, lg, lb] = gamut === "p3" ? p3ToLinearSrgb(toLinear(r), toLinear(g), toLinear(b)) : [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** Luminancia relativa aproximada de un gris OKLCH (croma bajo): Y ≈ L³. Suficiente para acotar contraste. */
export function contrastOfLightness(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi ** 3 + 0.05) / (lo ** 3 + 0.05);
}

function fromLinear(channel: number): number {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** RGB lineal sRGB → RGB lineal Display P3 (mismo blanco D65, primarios más separados). */
function toLinearP3([r, g, b]: Rgb): Rgb {
  return [0.8224621 * r + 0.177538 * g, 0.0331941 * r + 0.9668058 * g, 0.0170827 * r + 0.0723974 * g + 0.9105199 * b];
}

function linearRgb(l: number, c: number, h: number): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
}

/**
 * OKLCH → RGB codificado (0–1) en la gama pedida (Display P3 usa la misma curva de transferencia que sRGB).
 * Si el color cae fuera de la gama, baja el croma hasta que quepa (mismo tono y luminosidad).
 */
export function oklchToRgb(l: number, c: number, h: number, gamut: Gamut = "srgb"): Rgb {
  const linear = (chroma: number) => (gamut === "p3" ? toLinearP3(linearRgb(l, chroma, h)) : linearRgb(l, chroma, h));
  let chroma = c;
  let rgb = linear(chroma);
  while (chroma > 0.002 && rgb.some((v) => v < -0.001 || v > 1.001)) {
    chroma *= 0.92;
    rgb = linear(chroma);
  }
  return [fromLinear(rgb[0]), fromLinear(rgb[1]), fromLinear(rgb[2])];
}

/** Los cuatro tonos analógicos (tono, +38°, −38°, +76°) alrededor de un tono: son la paleta de "acento" y "elegida". */
export function hueSwatches(hue: number, chroma = 0.12): Swatch[] {
  return [0, 38, -38, 76].map((offset) => ({ hue: (hue + offset + 360) % 360, chroma }));
}

/** Pinta tonos con las luminosidades del fondo. `gain` multiplica el croma (el modo HDR lo sube; la gama recorta lo que no quepa). */
export function swatchColors(swatches: Swatch[], gamut: Gamut = "srgb", gain = 1): Rgb[] {
  return swatches.map(({ hue, chroma }, i) => oklchToRgb(BLOB_LIGHTNESS[i], chroma * gain, hue, gamut));
}

export function colorsFromHue(hue: number, chroma = 0.12): Rgb[] {
  return swatchColors(hueSwatches(hue, chroma));
}

/**
 * Hasta 4 colores de tonos distintos de la portada: agrupa los píxeles por tono (12 sectores de 30°, ponderados por
 * croma²), elige los sectores más pesados separados al menos 45° y completa con giros del dominante si faltan.
 * Devuelve null si la imagen es gris o transparente.
 */
export function paletteSwatches(rgba: ArrayLike<number>, count = 4): Swatch[] | null {
  const bins = Array.from({ length: 12 }, () => ({ a: 0, b: 0, weight: 0, chroma: 0, pixels: 0 }));
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const { l, c, h } = rgbToOklch(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (l < 0.12 || l > 0.97 || c < 0.02) continue;
    const bin = bins[Math.floor(h / 30) % 12];
    const w = c * c;
    const rad = (h * Math.PI) / 180;
    bin.a += Math.cos(rad) * c * w;
    bin.b += Math.sin(rad) * c * w;
    bin.weight += w;
    bin.chroma += c;
    bin.pixels += 1;
  }
  const ranked = bins.filter((bin) => bin.weight > 1e-4).sort((x, y) => y.weight - x.weight);
  if (ranked.length === 0) return null;
  const chosen: { hue: number; chroma: number }[] = [];
  for (const bin of ranked) {
    const hue = ((Math.atan2(bin.b, bin.a) * 180) / Math.PI + 360) % 360;
    const apart = chosen.every((other) => Math.min(Math.abs(other.hue - hue), 360 - Math.abs(other.hue - hue)) >= 45);
    if (apart) chosen.push({ hue, chroma: Math.min(Math.max(bin.chroma / bin.pixels, 0.07), 0.15) });
    if (chosen.length === count) break;
  }
  for (const turn of [40, -40, 80]) {
    if (chosen.length >= count) break;
    chosen.push({ hue: (chosen[0].hue + turn + 360) % 360, chroma: chosen[0].chroma });
  }
  return chosen;
}

export function paletteColors(rgba: ArrayLike<number>, count = 4): Rgb[] | null {
  const swatches = paletteSwatches(rgba, count);
  return swatches && swatchColors(swatches);
}

const css = (l: number, c: number, h: number) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

/**
 * Color dominante = media de los píxeles ponderada por croma (los grises casi no cuentan),
 * y después se fuerza a rangos seguros: el acento siempre claro, el ambiente siempre oscuro.
 */
export function paletteFromPixels(rgba: ArrayLike<number>): Palette {
  let a = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const { l, c, h } = rgbToOklch(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (l < 0.12 || l > 0.97) continue;
    const w = c * c;
    const rad = (h * Math.PI) / 180;
    a += Math.cos(rad) * c * w;
    b += Math.sin(rad) * c * w;
    weight += w;
  }
  if (weight < 1e-4) return fallbackPalette;
  const chroma = Math.hypot(a, b) / weight;
  if (chroma < 0.02) return fallbackPalette;
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const swatches = paletteSwatches(rgba);
  return {
    accent: css(0.82, Math.min(Math.max(chroma, 0.07), 0.14), hue),
    onAccent: css(0.2, 0.04, hue),
    glow: css(0.32, Math.min(chroma, 0.09), hue),
    hue,
    colors: swatches ? swatchColors(swatches) : colorsFromHue(hue),
    swatches: swatches ?? hueSwatches(hue),
  };
}
