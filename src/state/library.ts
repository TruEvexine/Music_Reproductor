import { create } from "zustand";
import { fileTrackId, titleFromFileName, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "../core/track";
import type { Track } from "../core/track";
import { hasUsefulMetadata, readTrackMetadata } from "../platform/web/metadata";

const supported = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"]);

// De dónde sale el audio de cada pista. Fuera del estado de React: no se pinta.
const sources = new Map<string, { url: string; blob?: Blob }>();

export function trackUrl(id: string): string | undefined {
  return sources.get(id)?.url;
}

interface LibraryState {
  tracks: Track[];
  /** Resultado de la última importación (archivos omitidos). */
  notice: string | null;
}

export const useLibrary = create<LibraryState>(() => ({ tracks: [], notice: null }));

function patch(id: string, change: Partial<Track>) {
  useLibrary.setState((state) => ({
    tracks: state.tracks.map((track) => (track.id === id ? { ...track, ...change } : track)),
  }));
}

const pending: string[] = [];
let running = 0;

// Dos lecturas a la vez: suficiente para no bloquear y sin saturar el hilo principal (worker en la Fase 3).
function pump() {
  while (running < 2 && pending.length > 0) {
    const id = pending.shift()!;
    const source = sources.get(id);
    const track = useLibrary.getState().tracks.find((item) => item.id === id);
    if (!source || !track) continue;
    running += 1;
    readTrackMetadata(track.fileName, source.blob ?? source.url)
      .then((metadata) =>
        patch(id, { ...metadata, metadataStatus: hasUsefulMetadata(metadata, track.fileName) ? "available" : "partial" }),
      )
      .catch(() => patch(id, { metadataStatus: "error" }))
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

function register(entries: { id: string; fileName: string; url: string; blob?: Blob }[]) {
  const tracks = entries.map(({ id, fileName, url, blob }): Track => {
    sources.set(id, { url, blob });
    pending.push(id);
    return { id, fileName, title: titleFromFileName(fileName), artist: UNKNOWN_ARTIST, album: UNKNOWN_ALBUM, metadataStatus: "loading" };
  });
  useLibrary.setState((state) => ({ tracks: [...state.tracks, ...tracks] }));
  pump();
}

export const library = {
  addFiles(files: File[]) {
    const known = new Set(useLibrary.getState().tracks.map((track) => track.id));
    const accepted: { id: string; fileName: string; url: string; blob: Blob }[] = [];
    let unsupported = 0;
    let duplicated = 0;
    for (const file of files) {
      const id = fileTrackId(file.name, file.size, file.lastModified);
      if (!supported.has(file.name.split(".").pop()?.toLowerCase() ?? "")) unsupported += 1;
      else if (known.has(id)) duplicated += 1;
      else {
        known.add(id);
        accepted.push({ id, fileName: file.name, url: URL.createObjectURL(file), blob: file });
      }
    }
    register(accepted);
    const notices = [
      unsupported > 0 && `${unsupported} ${unsupported === 1 ? "archivo omitido: no es" : "archivos omitidos: no son"} audio compatible.`,
      duplicated > 0 && `${duplicated} ya ${duplicated === 1 ? "estaba" : "estaban"} en tu biblioteca.`,
    ].filter(Boolean);
    useLibrary.setState({ notice: notices.length > 0 ? notices.join(" ") : null });
    return accepted.length;
  },
  markUnplayable(id: string) {
    patch(id, { unplayable: true });
  },
  dismissNotice() {
    useLibrary.setState({ notice: null });
  },
};

// Solo en desarrollo: carga src/assets/music/. El import dinámico desaparece del build de producción,
// así que ningún archivo de audio llega a dist/ (vite.config.ts lo comprueba además).
if (import.meta.env.DEV) {
  void import("./demoCatalog.dev").then(({ demoFiles }) =>
    register(demoFiles.map(({ path, url }) => ({ id: `demo:${path}`, fileName: path.split("/").pop() ?? path, url }))),
  );
}
