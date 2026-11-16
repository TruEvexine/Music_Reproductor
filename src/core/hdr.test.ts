import { describe, expect, it } from "vitest";
import { oklchToRgb, swatchColors } from "./palette";
import type { Gamut, Rgb } from "./palette";

// Las cifras salen de tokens.css (`--hdr-*`): si cambian allí, cambian aquí. Aquí se comprueba el peor caso del HDR simulado.
const looks: { name: string; gamut: Gamut; gain: number; cmax: number; peak: number }[] = [
  { name: "sRGB", gamut: "srgb", gain: 1.2, cmax: 0.15, peak: 0.86 },
  { name: "Display P3", gamut: "p3", gain: 1.5, cmax: 0.18, peak: 0.86 },
  { name: "Display P3 + HDR declarado", gamut: "p3", gain: 1.5, cmax: 0.18, peak: 0.9 },
];

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** Luminancia relativa (WCAG) con los coeficientes de la gama en que está el color. */
function luminance([r, g, b]: Rgb, gamut: Gamut): number {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  return gamut === "p3" ? 0.2289746 * lr + 0.6917385 * lg + 0.0792869 * lb : 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("HDR simulado: contraste y saturación en el peor caso", () => {
  for (const look of looks) {
    it(`${look.name}: el acento realzado se lee sobre el negro y con el texto sobre acento (≥ 4,5:1) en todos los tonos`, () => {
      for (let hue = 0; hue < 360; hue += 5) {
        for (const chroma of [0.07, 0.1, 0.14]) {
          // El acento de la portada llega con L 0,82 y croma 0,07–0.14; el CSS le aplica ganancia, tope de croma y techo de luminosidad.
          const accent = oklchToRgb(Math.min(0.82, look.peak), Math.min(chroma * look.gain, look.cmax), hue, look.gamut);
          const onAccent = oklchToRgb(0.2, 0.03, hue, look.gamut);
          const y = luminance(accent, look.gamut);
          expect(ratio(y, 0), `${look.name} h${hue} c${chroma} sobre negro`).toBeGreaterThanOrEqual(4.5);
          expect(ratio(y, luminance(onAccent, look.gamut)), `${look.name} h${hue} c${chroma} con --on-accent`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${look.name}: la mancha más clara del fondo realzada deja la tinta legible (≥ 4,5:1)`, () => {
      const ink = luminance(oklchToRgb(0.96, 0.006, 85, look.gamut), look.gamut);
      for (let hue = 0; hue < 360; hue += 5) {
        const [blob] = swatchColors([{ hue, chroma: 0.14 }], look.gamut, look.gain); // la primera mancha es la de L 0,46
        expect(ratio(ink, luminance(blob, look.gamut)), `${look.name} h${hue}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
