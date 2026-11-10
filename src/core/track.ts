// Modelo de pista sin tipos del navegador: el archivo o la URL viven en la capa de plataforma.

export type MetadataStatus = "loading" | "available" | "partial" | "error";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  fileName: string;
  coverUrl?: string;
  duration?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  codec?: string;
  lossless?: boolean;
  metadataStatus: MetadataStatus;
  /** El navegador no pudo decodificarla: se muestra marcada y se salta. */
  unplayable?: boolean;
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
