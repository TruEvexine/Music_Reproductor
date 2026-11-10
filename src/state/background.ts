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
  // AMOLED también cambia el negro de toda la app: el modo vive en <html> para que lo vea el CSS (tokens.css).
  const reflect = (mode: string) => (document.documentElement.dataset.bg = mode);
  useBackground.subscribe((state) => reflect(state.mode));
  useBackground.setState(sanitizeBackground(await storage.get<BackgroundSettings>("background")));
  reflect(useBackground.getState().mode);
}
