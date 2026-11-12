import { create } from "zustand";
import { defaultBackground, sanitizeBackground } from "../core/background";
import type { BackgroundSettings } from "../core/background";
import { storage } from "../platform";

// Ajustes del fondo del reproductor. Se guardan en IndexedDB (clave "background") como los de audio.
export const useBackground = create<BackgroundSettings>(() => defaultBackground);

export const background = {
  set(change: Partial<BackgroundSettings>) {
    const next = sanitizeBackground({ ...useBackground.getState(), ...change });
    useBackground.setState(next);
    void storage.set("background", next);
  },
};

export async function initBackground() {
  // AMOLED y HDR cambian el negro y los colores de toda la app: viven en <html> (data-bg, data-hdr) para que los vea el CSS (tokens.css).
  const reflect = ({ mode, hdr }: BackgroundSettings) => {
    document.documentElement.dataset.bg = mode;
    document.documentElement.toggleAttribute("data-hdr", hdr);
  };
  useBackground.subscribe(reflect);
  useBackground.setState(sanitizeBackground(await storage.get<BackgroundSettings>("background")));
  reflect(useBackground.getState());
}
