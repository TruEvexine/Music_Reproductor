import { describe, expect, it } from "vitest";
import { backgroundColors, defaultBackground, gradientCss, isAnimated, sanitizeBackground } from "./background";
import { colorsFromHue, fallbackPalette, paletteFromPixels, rgbToOklch } from "./palette";

describe("ajustes del fondo", () => {
  it("sin datos devuelve los valores por defecto", () => {
    expect(sanitizeBackground(undefined)).toEqual(defaultBackground);
  });

  it("corrige valores fuera de rango, desconocidos o corruptos", () => {
    const fixed = sanitizeBackground({
      mode: "visualizer" as never,
      intensity: 9,
      speed: -1,
      palette: "otra" as never,
      hue: -30,
      fps: 144 as never,
      batterySaver: "sí" as never,
      shortcuts: "no" as never,
    });
    expect(fixed).toEqual({ ...defaultBackground, intensity: 1, speed: 0.25, hue: 330, fps: "auto" });
    expect(sanitizeBackground({ intensity: NaN, hue: 725 })).toMatchObject({ intensity: 0, hue: 5 });
  });

  it("conserva ajustes válidos", () => {
    const ok = { mode: "rhythm", hdr: true, reduceMotion: true, shortcuts: false, intensity: 0.3, speed: 1.5, sensitivity: "high", palette: "custom", hue: 120, fps: 30, batterySaver: false } as const;
    expect(sanitizeBackground(ok)).toEqual(ok);
    expect(sanitizeBackground({ sensitivity: "máxima" } as never).sensitivity).toBe("auto");
  });

  it("solo cover y rhythm se mueven", () => {
    expect(["cover", "rhythm", "static", "amoled"].map((mode) => isAnimated(mode as never))).toEqual([true, true, false, false]);
  });

  it("el modo hdr guardado por versiones anteriores pasa a Portada con el interruptor HDR encendido", () => {
    expect(sanitizeBackground({ mode: "hdr" } as never)).toMatchObject({ mode: "cover", hdr: true });
    expect(sanitizeBackground({ mode: "static" })).toMatchObject({ mode: "static", hdr: false });
    expect(sanitizeBackground({ hdr: "sí" } as never).hdr).toBe(false);
  });

  it("reduceMotion solo acepta booleanos y por defecto está apagado", () => {
    expect(sanitizeBackground({ reduceMotion: "sí" } as never).reduceMotion).toBe(false);
    expect(sanitizeBackground({}).reduceMotion).toBe(false);
  });
});

describe("origen de la paleta", () => {
  it("portada → colores de la portada; acento → analógica del tono dominante; elegida → del tono elegido", () => {
    const palette = { ...fallbackPalette, hue: 200, colors: colorsFromHue(10) };
    expect(backgroundColors({ ...defaultBackground, palette: "cover" }, palette)).toBe(palette.colors);
    expect(backgroundColors({ ...defaultBackground, palette: "accent" }, palette)).toEqual(colorsFromHue(200));
    expect(backgroundColors({ ...defaultBackground, palette: "custom", hue: 90 }, palette)).toEqual(colorsFromHue(90));
  });
});

describe("modo HDR simulado", () => {
  const palette = paletteFromPixels(Uint8ClampedArray.from({ length: 4 * 64 }, (_, i) => [200, 40, 60, 255][i % 4]));
  const chroma = (colors: number[][], gamut: "srgb" | "p3") => colors.reduce((sum, [r, g, b]) => sum + rgbToOklch(r * 255, g * 255, b * 255, gamut).c, 0);
  const hdr = { ...defaultBackground, hdr: true };

  it("en sRGB sube la saturación respecto al modo Portada sin salirse de la gama", () => {
    const plain = backgroundColors({ ...defaultBackground, mode: "cover" }, palette);
    const boosted = backgroundColors(hdr, palette, { gamut: "srgb", chroma: 1.2, contrast: 0.35, glint: 0.6 });
    expect(boosted).toHaveLength(plain.length);
    expect(chroma(boosted, "srgb")).toBeGreaterThan(chroma(plain, "srgb"));
    for (const color of boosted) for (const channel of color) expect(channel >= 0 && channel <= 1).toBe(true);
  });

  it("en Display P3 las luces son aún más intensas que en sRGB con la misma ganancia", () => {
    const srgb = backgroundColors(hdr, palette, { gamut: "srgb", chroma: 1.5, contrast: 0.35, glint: 0.6 });
    const p3 = backgroundColors(hdr, palette, { gamut: "p3", chroma: 1.5, contrast: 0.35, glint: 0.6 });
    expect(chroma(p3, "p3")).toBeGreaterThan(chroma(srgb, "srgb"));
  });

  it("con el HDR apagado los colores no cambian aunque se pase la mirada HDR", () => {
    expect(backgroundColors({ ...defaultBackground, mode: "cover" }, palette, { gamut: "p3", chroma: 2, contrast: 1, glint: 1 })).toBe(palette.colors);
  });

  it("el respaldo CSS en P3 usa color(display-p3 …) y el de sRGB sigue en rgb()", () => {
    const colors = colorsFromHue(250);
    expect(gradientCss(colors, 0.6, "blobs", "p3")).toMatch(/color\(display-p3 [\d.]+ [\d.]+ [\d.]+ \/ [\d.]+\)/);
    expect(gradientCss(colors, 0.6)).not.toContain("display-p3");
    expect(gradientCss(colors, 0.6, "blobs", "p3").endsWith("var(--bg)")).toBe(true);
  });
});

describe("gradiente CSS de respaldo", () => {
  const colors = colorsFromHue(250);

  it("cuatro manchas y siempre termina en el fondo opaco de la app", () => {
    const css = gradientCss(colors, 0.6);
    expect(css.match(/radial-gradient/g)).toHaveLength(4);
    expect(css.endsWith("var(--bg)")).toBe(true);
  });

  it("la intensidad escala la opacidad y se acota a 0–1", () => {
    expect(gradientCss(colors, 0)).toContain("/ 0.000)");
    expect(gradientCss(colors, 5)).toContain("/ 1.000)");
  });

  it("el degradado estático usa dos colores y no tiene manchas", () => {
    const css = gradientCss(colors, 0.5, "linear");
    expect(css).toMatch(/^linear-gradient/);
    expect(css).not.toContain("radial");
  });
});
