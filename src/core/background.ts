// Ajustes del fondo del reproductor como datos puros. El render (WebGL / CSS) vive en src/ui/Backdrop.tsx.
import { colorsFromHue, hueSwatches, swatchColors } from "./palette";
import type { Gamut, Palette, Rgb } from "./palette";
import type { FpsSetting } from "./quality";
import type { Sensitivity } from "./rhythm";

/**
 * - cover: gradiente multicolor animado con la paleta de la portada.
 * - rhythm: lo mismo, reactivo al audio (graves, golpes, agudos).
 * - static: gradiente fijo de dos colores.
 * - amoled: negro puro.
 *
 * El «HDR simulado» ya no es un modo: es el interruptor `hdr` de abajo y afecta a toda la app (docs/DISENO_HDR.md).
 */
export type BackgroundMode = "cover" | "rhythm" | "static" | "amoled";
export type PaletteSource = "cover" | "accent" | "custom";

export interface BackgroundSettings {
  mode: BackgroundMode;
  /**
   * HDR simulado en toda la app: negro puro, más croma en acentos, portadas y luces (en Display P3 si la pantalla lo tiene) y reflejos con
   * techo de brillo. No es HDR real: la web no lo garantiza. Un solo interruptor; degrada a SDR según la pantalla.
   */
  hdr: boolean;
  /** Ajustes → Accesibilidad: movimiento reducido aunque el sistema no lo pida (el del sistema se respeta siempre). */
  reduceMotion: boolean;
  /** Ajustes → Accesibilidad: atajos de una sola tecla (WCAG 2.1.4: tienen que poder apagarse). */
  shortcuts: boolean;
  /** 0–1: fuerza del color. */
  intensity: number;
  /** Velocidad de la deriva (0,25–2×). */
  speed: number;
  /** Modo Ritmo: cuánto reacciona la luz. Las tres se adaptan a cada canción; cambian los umbrales y la amplitud (core/rhythm.ts). */
  sensitivity: Sensitivity;
  palette: PaletteSource;
  /** Tono elegido (0–360) cuando `palette` es "custom". */
  hue: number;
  fps: FpsSetting;
  /** Baja la calidad sola con batería baja o ahorro de datos. */
  batterySaver: boolean;
}

export const defaultBackground: BackgroundSettings = {
  mode: "cover",
  hdr: false,
  reduceMotion: false,
  shortcuts: true,
  intensity: 0.6,
  speed: 1,
  sensitivity: "auto",
  palette: "cover",
  hue: 250,
  fps: "auto",
  batterySaver: true,
};

export const SPEED_LIMITS = { min: 0.25, max: 2 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const modes: readonly BackgroundMode[] = ["cover", "rhythm", "static", "amoled"];
const sources: readonly PaletteSource[] = ["cover", "accent", "custom"];
const sensitivities: readonly Sensitivity[] = ["auto", "low", "high"];

/** Acepta ajustes guardados por cualquier versión (o corruptos) y devuelve unos válidos. */
export function sanitizeBackground(saved: Partial<BackgroundSettings> | undefined): BackgroundSettings {
  const s = { ...defaultBackground, ...saved };
  const legacyHdr = (s.mode as string) === "hdr"; // antes el HDR era un modo del fondo; ahora es el interruptor global y el fondo vuelve a Portada
  return {
    mode: modes.includes(s.mode) ? s.mode : defaultBackground.mode,
    hdr: typeof saved?.hdr === "boolean" ? saved.hdr : legacyHdr,
    reduceMotion: typeof s.reduceMotion === "boolean" ? s.reduceMotion : defaultBackground.reduceMotion,
    shortcuts: typeof s.shortcuts === "boolean" ? s.shortcuts : defaultBackground.shortcuts,
    intensity: clamp(s.intensity, 0, 1),
    speed: clamp(s.speed, SPEED_LIMITS.min, SPEED_LIMITS.max),
    sensitivity: sensitivities.includes(s.sensitivity) ? s.sensitivity : defaultBackground.sensitivity,
    palette: sources.includes(s.palette) ? s.palette : defaultBackground.palette,
    hue: Number.isFinite(s.hue) ? ((s.hue % 360) + 360) % 360 : defaultBackground.hue, // el tono da la vuelta, no se recorta
    fps: s.fps === 30 || s.fps === 60 ? s.fps : "auto",
    batterySaver: typeof s.batterySaver === "boolean" ? s.batterySaver : defaultBackground.batterySaver,
  };
}

/** Modos con movimiento: solo en ellos tienen sentido la velocidad, el tope de cuadros y el ahorro de batería. */
export const isAnimated = (mode: BackgroundMode) => mode === "cover" || mode === "rhythm";

/** Lo que el modo HDR pide a la pantalla. Sale de las variables `--hdr-*` de tokens.css, que cambian con `color-gamut` y `dynamic-range`. */
export interface HdrLook {
  gamut: Gamut;
  /** Ganancia del croma de las luces (curva de saturación). */
  chroma: number;
  /** 0–1: cuánto se aplica la curva en S de contraste (negros más hondos, medios más vivos). */
  contrast: number;
  /** 0–1: techo del brillo de los reflejos (núcleos de luz); más alto solo donde la pantalla lo declara HDR. */
  glint: number;
}

/** Colores del fondo según el origen elegido: la portada, el tono del acento o un tono propio. */
export function backgroundColors(settings: BackgroundSettings, palette: Palette, hdr?: HdrLook): Rgb[] {
  if (settings.hdr && hdr) {
    const swatches = settings.palette === "custom" ? hueSwatches(settings.hue) : settings.palette === "accent" ? hueSwatches(palette.hue) : palette.swatches;
    return swatchColors(swatches, hdr.gamut, hdr.chroma);
  }
  if (settings.palette === "custom") return colorsFromHue(settings.hue);
  if (settings.palette === "accent") return colorsFromHue(palette.hue);
  return palette.colors;
}

const rgb = ([r, g, b]: Rgb, alpha: number, gamut: Gamut) => {
  const a = Math.min(1, Math.max(0, alpha)).toFixed(3);
  return gamut === "p3" ? `color(display-p3 ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} / ${a})` : `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${a})`;
};

/**
 * Fondo en CSS puro: respaldo del lienzo (sin WebGL, contexto perdido, movimiento reducido), tinte sutil con el
 * reproductor colapsado y fondo "Estático". `blobs` = cuatro manchas fijas; `linear` = degradado de dos colores.
 * Siempre termina en `var(--bg)`, así que nunca queda transparente. Con `oklch` interpola en OKLCH: el medio entre dos tonos distintos
 * conserva el croma en vez de volverse gris. Lo decide quien llama según el navegador, porque uno viejo descartaría la declaración entera.
 */
export function gradientCss(colors: Rgb[], intensity: number, kind: "blobs" | "linear" = "blobs", gamut: Gamut = "srgb", oklch = false): string {
  const space = oklch ? "in oklch " : "";
  if (kind === "linear") return `linear-gradient(${space}165deg, ${rgb(colors[0], intensity, gamut)} 0%, ${rgb(colors[1], intensity * 0.8, gamut)} 55%, transparent 100%), var(--bg)`;
  const spots = [
    ["60% 50%", "20% 22%", 1],
    ["55% 50%", "82% 30%", 0.9],
    ["60% 55%", "28% 88%", 0.8],
    ["50% 50%", "86% 82%", 0.7],
  ] as const;
  const layers = spots.map(([size, at, weight], i) => `radial-gradient(${space}${size} at ${at}, ${rgb(colors[i % colors.length], intensity * weight, gamut)}, transparent 70%)`);
  return `${layers.join(", ")}, var(--bg)`;
}
