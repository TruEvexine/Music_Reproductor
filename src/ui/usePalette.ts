import { createContext, useEffect, useState } from "react";
import { fallbackPalette, paletteFromPixels } from "../core/palette";
import type { Palette } from "../core/palette";

/** La paleta vigente, para quien dibuja el fondo sin recibirla por props (Shell la publica). */
export const PaletteContext = createContext<Palette>(fallbackPalette);

/** Paleta de la portada actual. La matemática vive en core/palette; aquí solo se leen los píxeles. */
export function usePalette(coverUrl?: string): Palette {
  const [palette, setPalette] = useState(fallbackPalette);

  useEffect(() => {
    if (!coverUrl) {
      setPalette(fallbackPalette);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, 32, 32);
      setPalette(paletteFromPixels(context.getImageData(0, 0, 32, 32).data));
    };
    image.onerror = () => active && setPalette(fallbackPalette);
    image.src = coverUrl;
    return () => {
      active = false;
    };
  }, [coverUrl]);

  return palette;
}
