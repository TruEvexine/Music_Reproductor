// Modelo de pista sin tipos del navegador: el archivo o la URL viven en la capa de plataforma.
import type { Lyrics } from "./lyrics";

export type MetadataStatus = "loading" | "available" | "partial" | "error";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  fileName: string;
  /** Ruta relativa con la carpeta raíz ("Música/Álbum/01.flac"); en archivos sueltos, el nombre. */
  path: string;
  size?: number;
  lastModified?: number;
  /** Carpeta raíz de la que viene (LocalLibrary). Sin ella, la pista solo vive en esta sesión. */
  rootId?: string;
  /** Hash de la portada (embebida o cover.jpg de la carpeta); las miniaturas viven aparte. */
  coverHash?: string;
  /** Identidad por contenido: track:v2:<sha-256>. */
  v2?: string;
  lyrics?: Lyrics;
  addedAt?: number;
  playedAt?: number;
  duration?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  codec?: string;
  lossless?: boolean;
  /** ReplayGain leído de los tags, en dB. */
  gainTrackDb?: number;
  gainAlbumDb?: number;
  metadataStatus: MetadataStatus;
  /** El navegador no pudo decodificarla: se muestra marcada y se salta. */
  unplayable?: boolean;
  /** El navegador dice que no sabe decodificar el formato (canPlayType): se marca al importar, no al fallar. */
  unsupported?: boolean;
}

export const UNKNOWN_ARTIST = "Artista desconocido";
export const UNKNOWN_ALBUM = "Álbum desconocido";

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Id estable de un archivo importado: el mismo archivo da el mismo id en otra sesión. */
export function fileTrackId(name: string, size: number, lastModified: number): string {
  return `file:${name.toLocaleLowerCase()}:${size}:${lastModified}`;
}

/** Carpeta que contiene la ruta ("Música/Álbum/01.flac" → "Música/Álbum"); vacía si es un archivo suelto. */
export function folderOf(path: string): string {
  const at = path.lastIndexOf("/");
  return at > 0 ? path.slice(0, at) : "";
}

/**
 * Identidad `track:v1` para playlists: título|artista|álbum|duración.
 * No cambiar el algoritmo: las playlists guardadas dependen de él (track:v2 llegará como añadido, no como reemplazo).
 */
export function trackV1Id(track: { title: string; artist: string; album: string; duration?: number }): string {
  const normalized = [track.title, track.artist, track.album, track.duration ? Math.round(track.duration) : ""]
    .map((value) => String(value).trim().normalize("NFKC").toLocaleLowerCase())
    .join("|");
  return `track:v1:${encodeURIComponent(normalized)}`;
}

// --- track:v2: SHA-256 de tamaño (8 bytes LE) + primer MiB + último MiB. Se añade a v1, no lo sustituye. ---

export const V2_SAMPLE_BYTES = 1024 * 1024;

/** Rangos [inicio, fin) que entran en el hash; sin solaparse en archivos de menos de 2 MiB. */
export function v2Ranges(size: number): [number, number][] {
  const head = Math.min(V2_SAMPLE_BYTES, size);
  const tail = Math.max(size - V2_SAMPLE_BYTES, head);
  return tail < size ? [[0, head], [tail, size]] : [[0, head]];
}

export async function computeTrackV2(size: number, read: (start: number, end: number) => Promise<ArrayBuffer>): Promise<string> {
  const parts = [new Uint8Array(8)];
  new DataView(parts[0].buffer).setBigUint64(0, BigInt(size), true);
  for (const [start, end] of v2Ranges(size)) parts.push(new Uint8Array(await read(start, end)));
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return `track:v2:${await sha256Hex(joined)}`;
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
