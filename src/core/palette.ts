// Paleta derivada de la portada, corregida en OKLCH para que nunca rompa el contraste.
// Entrada: píxeles RGBA (de un canvas pequeño). Salida: colores CSS listos para usar.

export interface Palette {
  /** Acento para la pista actual y el botón primario. Contraste ≥ 4.5:1 sobre el fondo de la app. */
  accent: string;
  /** Texto sobre el acento. */
  onAccent: string;
  /** Tinte oscuro para el ambiente del reproductor. */
  glow: string;
}

export const APP_BACKGROUND_L = 0.145;

export const fallbackPalette: Palette = {
  accent: "oklch(0.84 0.09 85)",
  onAccent: "oklch(0.2 0.03 85)",
  glow: "oklch(0.3 0.03 85)",
};

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB (0–255) → OKLCH. Fórmulas de Björn Ottosson. */
export function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
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
  return {
    accent: css(0.82, Math.min(Math.max(chroma, 0.07), 0.14), hue),
    onAccent: css(0.2, 0.04, hue),
    glow: css(0.32, Math.min(chroma, 0.09), hue),
  };
}
