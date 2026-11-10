import type { Track } from "./model/Track";

// La música local de src/assets/music/ solo existe en desarrollo: el import dinámico
// desaparece del build de producción, así que ningún archivo de audio llega a dist/.
export const demoTracks: Track[] = import.meta.env.DEV
  ? (await import("./demoCatalog.dev")).demoTracks
  : [];
