import { describe, expect, it } from "vitest";
import { backgroundColors, defaultBackground, gradientCss, isAnimated, sanitizeBackground } from "./background";
import { colorsFromHue, fallbackPalette } from "./palette";

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
    });
    expect(fixed).toEqual({ ...defaultBackground, intensity: 1, speed: 0.25, hue: 330, fps: "auto" });
    expect(sanitizeBackground({ intensity: NaN, hue: 725 })).toMatchObject({ intensity: 0, hue: 5 });
  });

  it("conserva ajustes válidos", () => {
    const ok = { mode: "rhythm", intensity: 0.3, speed: 1.5, palette: "custom", hue: 120, fps: 30, batterySaver: false } as const;
    expect(sanitizeBackground(ok)).toEqual(ok);
  });

  it("solo cover y rhythm se mueven", () => {
    expect(["cover", "rhythm", "static", "amoled"].map((mode) => isAnimated(mode as never))).toEqual([true, true, false, false]);
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
