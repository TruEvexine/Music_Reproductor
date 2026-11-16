import type { Target } from "./types";

// Punto único de acceso a la plataforma. Hoy todo es la implementación web (también dentro del
// WebView de Capacitor: IndexedDB y navigator.onLine existen ahí). Cuando exista src/platform/native,
// aquí se elige por `target` qué implementación exportar para cada frontera.
export const target: Target = (import.meta.env.VITE_TARGET as Target | undefined) ?? "web";
export const isNative = target !== "web";

export { audioSession, connectivity, localLibrary, storage } from "./web";
