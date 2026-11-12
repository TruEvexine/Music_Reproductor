import { useSyncExternalStore } from "react";
import type { HdrLook } from "../core/background";

// Lo que el modo HDR pide a esta pantalla. La política vive en tokens.css (variables `--hdr-*` bajo `@media (color-gamut: p3)` y
// `(dynamic-range: high)`): aquí solo se leen, así CSS y WebGL no pueden discrepar.
const queries = ["(color-gamut: p3)", "(dynamic-range: high)"];
const sdr: HdrLook = { gamut: "srgb", chroma: 1.2, contrast: 0.35, glint: 0.6 }; // respaldo si el navegador no devuelve las variables

export function readHdrLook(): HdrLook {
  const style = getComputedStyle(document.documentElement);
  const number = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    gamut: matchMedia(queries[0]).matches ? "p3" : "srgb",
    chroma: number("--hdr-chroma", sdr.chroma),
    contrast: number("--hdr-contrast", sdr.contrast),
    glint: number("--hdr-glint", sdr.glint),
  };
}

const key = (look: HdrLook) => `${look.gamut}/${look.chroma}/${look.contrast}/${look.glint}`;
let cached = { key: "", look: sdr };

/** Se actualiza si la pantalla cambia de gama o rango (por ejemplo, al arrastrar la ventana a otro monitor). */
export function useHdrLook(): HdrLook {
  return useSyncExternalStore(
    (listener) => {
      const lists = queries.map((query) => matchMedia(query));
      lists.forEach((list) => list.addEventListener("change", listener));
      return () => lists.forEach((list) => list.removeEventListener("change", listener));
    },
    () => {
      const look = readHdrLook();
      if (key(look) !== cached.key) cached = { key: key(look), look };
      return cached.look; // misma referencia mientras no cambie: useSyncExternalStore lo exige
    },
  );
}
