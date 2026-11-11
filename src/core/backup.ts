// Copia de seguridad en JSON: playlists y ajustes. El archivo importado es entrada no confiable: se valida campo a campo
// y los ajustes pasan después por sanitizeAudioSettings / sanitizeBackground.

export const BACKUP_APP = "reproductor";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_PLAYLISTS = 1000;
const MAX_TRACKS = 10_000;

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  playlists: { name: string; tracks: string[] }[];
  settings: { audio?: unknown; background?: unknown };
}

export function buildBackup(
  playlists: { name: string; trackIdentifiers: string[] }[],
  settings: Backup["settings"],
  now = new Date(),
): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    playlists: playlists.map((playlist) => ({ name: playlist.name, tracks: [...playlist.trackIdentifiers] })),
    settings,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const identity = /^track:v[12]:[^\s]{1,2000}$/;

/** Devuelve la copia válida o un mensaje para el usuario. Descarta en silencio las pistas con identidad desconocida. */
export function parseBackup(text: string): { backup: Backup } | { error: string } {
  if (text.length > MAX_BACKUP_BYTES) return { error: "El archivo es demasiado grande para ser una copia de seguridad." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "El archivo no es una copia de seguridad válida." };
  }
  if (!isRecord(data) || data.app !== BACKUP_APP) return { error: "El archivo no es una copia de seguridad de este reproductor." };
  if (data.version !== BACKUP_VERSION) return { error: "La copia es de una versión que esta app no reconoce." };
  if (!Array.isArray(data.playlists)) return { error: "La copia no contiene playlists." };
  const playlists = data.playlists.slice(0, MAX_PLAYLISTS).flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string" || !Array.isArray(item.tracks)) return [];
    const name = item.name.trim().slice(0, 120);
    if (!name) return [];
    const tracks = item.tracks.filter((track): track is string => typeof track === "string" && identity.test(track)).slice(0, MAX_TRACKS);
    return [{ name, tracks: [...new Set(tracks)] }];
  });
  const settings = isRecord(data.settings) ? data.settings : {};
  return {
    backup: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
      playlists,
      settings: { audio: isRecord(settings.audio) ? settings.audio : undefined, background: isRecord(settings.background) ? settings.background : undefined },
    },
  };
}
