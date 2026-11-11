// Biblioteca como datos: qué archivos interesan, qué cambió entre escaneos y cómo se agrupan y ordenan las vistas.
import { searchKey } from "./format";
import { folderOf, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./track";
import type { Track } from "./track";

const audioTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: 'audio/ogg; codecs="opus"',
  webm: "audio/webm",
};

const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** MIME con el que se pregunta a `canPlayType` si el navegador sabe decodificar el archivo. */
export function audioTypeOf(name: string): string | undefined {
  return audioTypes[extension(name)];
}

export const isAudioFile = (name: string) => audioTypeOf(name) !== undefined;
export const isLyricsFile = (name: string) => extension(name) === "lrc";
/** cover.jpg, folder.png, front.webp, album.jpeg… en la carpeta del álbum. */
export const isFolderCover = (name: string) => /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i.test(name);

/** Mismo nombre sin extensión: "01 Tema.flac" ↔ "01 Tema.lrc". */
export const stemOf = (path: string) => path.replace(/\.[^./]+$/, "").toLowerCase();

// --- Re-escaneo por diferencias: ruta + tamaño + fecha. Solo lo nuevo o cambiado vuelve a leerse. ---

export interface FileStamp {
  path: string;
  size: number;
  lastModified: number;
}

export function diffScan<K extends FileStamp, F extends FileStamp>(known: K[], found: F[]): { added: F[]; removed: K[]; unchanged: K[] } {
  const seen = new Map(found.map((file) => [file.path, file]));
  const removed: K[] = [];
  const unchanged: K[] = [];
  for (const item of known) {
    const file = seen.get(item.path);
    if (file && file.size === item.size && file.lastModified === item.lastModified) {
      unchanged.push(item);
      seen.delete(item.path);
    } else removed.push(item); // cambiado = se quita y vuelve a entrar como nuevo
  }
  return { added: [...seen.values()], removed, unchanged };
}

// --- Vistas ---

export type GroupBy = "album" | "artist" | "folder" | "genre";
export type TrackSort = "title" | "artist" | "album" | "added" | "duration";
export type GroupSort = "name" | "artist" | "year" | "count";

export interface TrackGroup {
  key: string;
  label: string;
  subtitle: string;
  trackIds: string[];
  coverHash?: string;
  year?: number;
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const NO_GENRE = "Sin género";
export const LOOSE_FILES = "Archivos sueltos";

function keysOf(track: Track, by: GroupBy): { key: string; label: string; subtitle: string }[] {
  switch (by) {
    case "album": {
      const artist = track.albumArtist ?? track.artist;
      return [{ key: `${searchKey(artist)}\u0000${searchKey(track.album)}`, label: track.album, subtitle: artist }];
    }
    case "artist":
      return [{ key: searchKey(track.artist), label: track.artist, subtitle: "" }];
    case "folder": {
      const folder = folderOf(track.path);
      return [{ key: folder || "\u0000", label: folder.split("/").pop() || LOOSE_FILES, subtitle: folderOf(folder) }];
    }
    case "genre": {
      const genres = (track.genre ?? "").split(/[,;/]/).map((genre) => genre.trim()).filter(Boolean);
      return (genres.length > 0 ? genres : [NO_GENRE]).map((genre) => ({ key: searchKey(genre), label: genre, subtitle: "" }));
    }
  }
}

const plural = (count: number) => `${count} ${count === 1 ? "canción" : "canciones"}`;

/** Agrupa en una pasada. Las pistas de cada grupo quedan en el orden recibido (ordenar antes si importa). */
export function groupTracks(tracks: Track[], by: GroupBy): TrackGroup[] {
  const groups = new Map<string, TrackGroup>();
  for (const track of tracks) {
    for (const { key, label, subtitle } of keysOf(track, by)) {
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { key, label, subtitle, trackIds: [] }));
      group.trackIds.push(track.id);
      group.coverHash ??= track.coverHash;
      if (track.year && (!group.year || track.year < group.year)) group.year = track.year;
    }
  }
  for (const group of groups.values()) {
    const count = plural(group.trackIds.length);
    group.subtitle = group.subtitle ? `${group.subtitle} · ${count}` : count;
  }
  return [...groups.values()];
}

/** Lo desconocido va al final: "Artista desconocido" no debería encabezar la lista. */
const unknownLast = (a: string, b: string) => Number(a === UNKNOWN_ARTIST || a === UNKNOWN_ALBUM || a === NO_GENRE || a === LOOSE_FILES) - Number(b === UNKNOWN_ARTIST || b === UNKNOWN_ALBUM || b === NO_GENRE || b === LOOSE_FILES);

export function sortGroups(groups: TrackGroup[], sort: GroupSort): TrackGroup[] {
  const byName = (a: TrackGroup, b: TrackGroup) => unknownLast(a.label, b.label) || collator.compare(a.label, b.label);
  const compare: Record<GroupSort, (a: TrackGroup, b: TrackGroup) => number> = {
    name: byName,
    artist: (a, b) => collator.compare(a.subtitle, b.subtitle) || byName(a, b),
    year: (a, b) => (b.year ?? 0) - (a.year ?? 0) || byName(a, b),
    count: (a, b) => b.trackIds.length - a.trackIds.length || byName(a, b),
  };
  return [...groups].sort(compare[sort]);
}

const albumOrder = (a: Track, b: Track) =>
  unknownLast(a.album, b.album) ||
  collator.compare(a.album, b.album) ||
  (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity) ||
  collator.compare(a.title, b.title);

export function sortTracks(tracks: Track[], sort: TrackSort): Track[] {
  const compare: Record<TrackSort, (a: Track, b: Track) => number> = {
    title: (a, b) => collator.compare(a.title, b.title),
    artist: (a, b) => unknownLast(a.artist, b.artist) || collator.compare(a.artist, b.artist) || albumOrder(a, b),
    album: albumOrder,
    added: (a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0) || collator.compare(a.path, b.path),
    duration: (a, b) => (b.duration ?? 0) - (a.duration ?? 0),
  };
  return [...tracks].sort(compare[sort]);
}

export const RECENT_LIMIT = 200;

/** Recientes: lo último que sonó o que entró en la biblioteca, lo que haya pasado después. */
export function recentTracks(tracks: Track[], limit = RECENT_LIMIT): Track[] {
  const at = (track: Track) => Math.max(track.playedAt ?? 0, track.addedAt ?? 0);
  return tracks
    .filter((track) => at(track) > 0)
    .sort((a, b) => at(b) - at(a))
    .slice(0, limit);
}

/** Texto de búsqueda precalculado por pista (sin acentos ni mayúsculas): filtrar 5 000 pistas es un `includes`. */
export function searchTextOf(track: Track): string {
  return searchKey([track.title, track.artist, track.album, track.albumArtist, track.genre, track.path].filter(Boolean).join("\u0001"));
}

/** Todas las palabras de la búsqueda, en cualquier orden ("nandu marea" encuentra "Marea… · Ñandú…"). `key` ya pasó por searchKey. */
export function matchesAll(text: string, key: string): boolean {
  return key.split(/\s+/).every((word) => text.includes(word));
}
