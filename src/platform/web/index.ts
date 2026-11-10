import type { AudioSession, Connectivity, Storage } from "../types";
import { openDatabase } from "./db";

// Una sola conexión, abierta la primera vez que se usa. Si IndexedDB no está disponible
// (modo privado de algunos navegadores) la app sigue funcionando sin persistencia.
let database: ReturnType<typeof openDatabase> | undefined;
const db = () => (database ??= openDatabase());

export const storage: Storage = {
  async get<T>(key: string) {
    try {
      return (await (await db()).get("kv", key)) as T | undefined;
    } catch {
      return undefined;
    }
  },
  async set(key, value) {
    try {
      await (await db()).put("kv", value, key);
    } catch {
      // Sin almacenamiento: el estado vive solo en memoria durante esta sesión.
    }
  },
  async delete(key) {
    try {
      await (await db()).delete("kv", key);
    } catch {
      // Igual que arriba.
    }
  },
};

export const connectivity: Connectivity = {
  isOnline: () => navigator.onLine,
  subscribe(listener) {
    const on = () => listener(true);
    const off = () => listener(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  },
};

// Media Session API: controles en pantalla de bloqueo, notificación y auriculares. Si el navegador no la tiene, no hace nada.
const media = "mediaSession" in navigator ? navigator.mediaSession : undefined;

function handle(action: MediaSessionAction, handler: MediaSessionActionHandler) {
  try {
    media?.setActionHandler(action, handler);
  } catch {
    // Acción no soportada por este navegador.
  }
}

export const audioSession: AudioSession = {
  setHandlers(handlers) {
    handle("play", handlers.play);
    handle("pause", handlers.pause);
    handle("nexttrack", handlers.next);
    handle("previoustrack", handlers.previous);
    handle("seekto", (details) => details.seekTime !== undefined && handlers.seekTo(details.seekTime));
    handle("seekforward", (details) => handlers.seekBy(details.seekOffset ?? 10));
    handle("seekbackward", (details) => handlers.seekBy(-(details.seekOffset ?? 10)));
  },
  setTrack(track) {
    if (!media) return;
    media.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : [],
        })
      : null;
  },
  setState({ playing, position, duration, rate = 1 }) {
    if (!media) return;
    media.playbackState = playing ? "playing" : "paused";
    try {
      if (duration > 0) media.setPositionState({ duration, position: Math.min(position, duration), playbackRate: rate });
    } catch {
      // Estado de posición no soportado o valores aún incoherentes durante un cambio de pista.
    }
  },
};
