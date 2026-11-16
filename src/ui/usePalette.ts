import { createContext } from "react";
import { fallbackPalette } from "../core/palette";
import type { Palette } from "../core/palette";

/** La paleta vigente, para quien dibuja el fondo sin recibirla por props (Shell la publica; se calcula en state/covers, fuera del hilo principal). */
export const PaletteContext = createContext<Palette>(fallbackPalette);
