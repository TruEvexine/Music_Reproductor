import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const defaultTint = "rgb(95 84 61 / 14%)";

export function useCoverPalette(coverUrl?: string): CSSProperties {
  const [tint, setTint] = useState(defaultTint);

  useEffect(() => {
    if (!coverUrl) {
      setTint(defaultTint);
      return;
    }

    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let samples = 0;

      for (let index = 0; index < pixels.length; index += 16) {
        const saturation =
          Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) -
          Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
        if (saturation < 20) continue;
        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        samples += 1;
      }

      if (samples === 0) return;
      const softened = [red, green, blue].map((channel) =>
        Math.min(140, Math.round((channel / samples) * 0.48)),
      );
      setTint(`rgb(${softened.join(" ")} / 20%)`);
    };
    image.onerror = () => {
      if (active) setTint(defaultTint);
    };
    image.src = coverUrl;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [coverUrl]);

  return { "--cover-tint": tint } as CSSProperties;
}
