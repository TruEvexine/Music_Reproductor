import { describe, expect, it } from "vitest";
import { PALETTE_VERSION, paletteFromPixels, paletteIsCurrent } from "./palette";

// Una portada de dos colores: tres cuartos naranja y un cuarto verde azulado.
const pixels = [...Array.from({ length: 96 }, () => [200, 100, 40, 255]), ...Array.from({ length: 32 }, () => [30, 130, 150, 255])].flat();

describe("versión del algoritmo de la paleta", () => {
  it("una paleta guardada solo vale si lleva la versión actual", () => {
    const palette = paletteFromPixels(pixels);
    expect(paletteIsCurrent({ palette, paletteVersion: PALETTE_VERSION })).toBe(true);
    expect(paletteIsCurrent({ palette, paletteVersion: PALETTE_VERSION - 1 })).toBe(false);
    expect(paletteIsCurrent({ palette })).toBe(false); // guardadas antes de que existiera la versión
    expect(paletteIsCurrent({ paletteVersion: PALETTE_VERSION })).toBe(false);
  });

  it("huella del algoritmo: si esta prueba falla, cambió el resultado; sube PALETTE_VERSION (core/palette.ts) y actualiza la huella", () => {
    const { accent, glow, hue, swatches } = paletteFromPixels(pixels);
    expect({ version: PALETTE_VERSION, accent, glow, hue: Math.round(hue), swatches }).toMatchInlineSnapshot(`
      {
        "accent": "oklch(0.675 0.182 47.9)",
        "glow": "oklch(0.320 0.090 47.9)",
        "hue": 48,
        "swatches": [
          {
            "chroma": 0.1457068762597102,
            "hue": 47.89930799948712,
          },
          {
            "chroma": 0.09116817161879621,
            "hue": 214.8716219238611,
          },
          {
            "chroma": 0.1457068762597102,
            "hue": 87.89930799948712,
          },
          {
            "chroma": 0.1457068762597102,
            "hue": 7.899307999487121,
          },
        ],
        "version": 2,
      }
    `);
  });
});
