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
  // AMOLED, HDR y movimiento reducido cambian toda la app: viven en <html> (data-bg, data-hdr, data-motion) para que los vea el CSS.
  const reflect = ({ mode, hdr, reduceMotion }: BackgroundSettings) => {
    const root = document.documentElement;
    root.dataset.bg = mode;
    root.toggleAttribute("data-hdr", hdr);
    if (reduceMotion) root.dataset.motion = "reduce";
    else delete root.dataset.motion;
  };
  useBackground.subscribe(reflect);
  useBackground.setState(sanitizeBackground(await storage.get<BackgroundSettings>("background")));
  reflect(useBackground.getState());
}
