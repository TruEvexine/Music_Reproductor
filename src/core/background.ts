// Ajustes del fondo del reproductor como datos puros. El render (WebGL / CSS) vive en src/ui/Backdrop.tsx.
import { colorsFromHue } from "./palette";
import type { Palette, Rgb } from "./palette";
import type { FpsSetting } from "./quality";

/**
 * - cover: gradiente multicolor animado con la paleta de la portada.
 * - rhythm: lo mismo, reactivo al audio (graves, golpes, agudos).
 * - static: gradiente fijo de dos colores.
 * - amoled: negro puro.
 */
export type BackgroundMode = "cover" | "rhythm" | "static" | "amoled";
export type PaletteSource = "cover" | "accent" | "custom";

export interface BackgroundSettings {
  mode: BackgroundMode;
  /** 0–1: fuerza del color. */
  intensity: number;
  /** Velocidad de la deriva (0,25–2×). */
  speed: number;
  palette: PaletteSource;
  /** Tono elegido (0–360) cuando `palette` es "custom". */
  hue: number;
  fps: FpsSetting;
  /** Baja la calidad sola con batería baja o ahorro de datos. */
  batterySaver: boolean;
}

export const defaultBackground: BackgroundSettings = {
  mode: "cover",
  intensity: 0.6,
  speed: 1,
  palette: "cover",
  hue: 250,
  fps: "auto",
  batterySaver: true,
};

export const SPEED_LIMITS = { min: 0.25, max: 2 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const modes: readonly BackgroundMode[] = ["cover", "rhythm", "static", "amoled"];
const sources: readonly PaletteSource[] = ["cover", "accent", "custom"];

/** Acepta ajustes guardados por cualquier versión (o corruptos) y devuelve unos válidos. */
export function sanitizeBackground(saved: Partial<BackgroundSettings> | undefined): BackgroundSettings {
  const s = { ...defaultBackground, ...saved };
  return {
    mode: modes.includes(s.mode) ? s.mode : defaultBackground.mode,
    intensity: clamp(s.intensity, 0, 1),
    speed: clamp(s.speed, SPEED_LIMITS.min, SPEED_LIMITS.max),
    palette: sources.includes(s.palette) ? s.palette : defaultBackground.palette,
    hue: Number.isFinite(s.hue) ? ((s.hue % 360) + 360) % 360 : defaultBackground.hue, // el tono da la vuelta, no se recorta
    fps: s.fps === 30 || s.fps === 60 ? s.fps : "auto",
    batterySaver: typeof s.batterySaver === "boolean" ? s.batterySaver : defaultBackground.batterySaver,
  };
}

/** Modos con movimiento: solo en ellos tienen sentido la velocidad, el tope de cuadros y el ahorro de batería. */
export const isAnimated = (mode: BackgroundMode) => mode === "cover" || mode === "rhythm";

/** Colores del fondo según el origen elegido: la portada, el tono del acento o un tono propio. */
export function backgroundColors(settings: BackgroundSettings, palette: Palette): Rgb[] {
  if (settings.palette === "custom") return colorsFromHue(settings.hue);
  if (settings.palette === "accent") return colorsFromHue(palette.hue);
  return palette.colors;
}

const rgb = ([r, g, b]: Rgb, alpha: number) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;

/**
 * Fondo en CSS puro: respaldo del lienzo (sin WebGL, contexto perdido, movimiento reducido), tinte sutil con el
 * reproductor colapsado y fondo "Estático". `blobs` = cuatro manchas fijas; `linear` = degradado de dos colores.
 * Siempre termina en `var(--bg)`, así que nunca queda transparente.
 */
export function gradientCss(colors: Rgb[], intensity: number, kind: "blobs" | "linear" = "blobs"): string {
  if (kind === "linear") return `linear-gradient(165deg, ${rgb(colors[0], intensity)} 0%, ${rgb(colors[1], intensity * 0.8)} 55%, transparent 100%), var(--bg)`;
  const spots = [
    ["60% 50%", "20% 22%", 1],
    ["55% 50%", "82% 30%", 0.9],
    ["60% 55%", "28% 88%", 0.8],
    ["50% 50%", "86% 82%", 0.7],
  ] as const;
  const layers = spots.map(([size, at, weight], i) => `radial-gradient(${size} at ${at}, ${rgb(colors[i % colors.length], intensity * weight)}, transparent 70%)`);
  return `${layers.join(", ")}, var(--bg)`;
}
