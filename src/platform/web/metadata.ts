import { safeCoverMime } from "../../core/coverMime";
import { titleFromFileName, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "../../core/track";
import type { Track } from "../../core/track";

export type TrackMetadata = Pick<
  Track,
  | "title"
  | "artist"
  | "album"
  | "albumArtist"
  | "coverUrl"
  | "duration"
  | "trackNumber"
  | "year"
  | "genre"
  | "bitrate"
  | "sampleRate"
  | "bitsPerSample"
  | "codec"
  | "lossless"
>;

const MAX_COVER_BYTES = 12 * 1024 * 1024;

function positive(value: number | undefined | null): number | undefined {
  return value !== undefined && value !== null && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Lee tags y portada. `source` es el archivo importado o, en desarrollo, la URL del catálogo local. */
export async function readTrackMetadata(fileName: string, source: Blob | string): Promise<TrackMetadata> {
  const { parseBlob, selectCover } = await import("music-metadata");
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const metadata = await parseBlob(blob);
  const tags = metadata.common;
  const picture = selectCover(tags.picture);
  const coverType = safeCoverMime(picture?.format);
  let coverUrl: string | undefined;
  if (picture && coverType && picture.data.byteLength <= MAX_COVER_BYTES) {
    const bytes = new Uint8Array(picture.data.byteLength);
    bytes.set(picture.data);
    coverUrl = URL.createObjectURL(new Blob([bytes.buffer], { type: coverType }));
  }
  return {
    title: tags.title?.trim() || titleFromFileName(fileName),
    artist: tags.artist?.trim() || UNKNOWN_ARTIST,
    album: tags.album?.trim() || UNKNOWN_ALBUM,
    albumArtist: tags.albumartist?.trim() || undefined,
    coverUrl,
    duration: positive(metadata.format.duration),
    trackNumber: positive(tags.track.no),
    year: positive(tags.year),
    genre: tags.genre?.join(", ") || undefined,
    bitrate: positive(metadata.format.bitrate),
    sampleRate: positive(metadata.format.sampleRate),
    bitsPerSample: positive(metadata.format.bitsPerSample),
    codec: metadata.format.codec,
    lossless: metadata.format.lossless,
  };
}

export function hasUsefulMetadata(metadata: TrackMetadata, fileName: string): boolean {
  return (
    metadata.title !== titleFromFileName(fileName) ||
    metadata.artist !== UNKNOWN_ARTIST ||
    metadata.album !== UNKNOWN_ALBUM ||
    Boolean(metadata.coverUrl)
  );
}
