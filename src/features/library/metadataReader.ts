import type { Track } from "./model/Track";

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  coverUrl?: string;
  duration?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
}

type AudioTokenizer = Parameters<
  typeof import("music-metadata").parseFromTokenizer
>[0];

function positiveNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export async function readTrackMetadata(
  track: Track,
): Promise<TrackMetadata> {
  let tokenizer: AudioTokenizer | undefined;

  try {
    const { parseBlob, parseFromTokenizer, selectCover } = await import(
      "music-metadata"
    );
    const metadata = track.file
      ? await parseBlob(track.file)
      : await (async () => {
          const { makeTokenizer } = await import("@tokenizer/http");
          tokenizer = await makeTokenizer(track.url, {
            avoidHeadRequests: true,
          });
          return parseFromTokenizer(tokenizer);
        })();
    const tags = metadata.common;
    const picture = selectCover(tags.picture);
    const coverBytes =
      picture && picture.data.byteLength <= 12 * 1024 * 1024
        ? new Uint8Array(picture.data.byteLength)
        : undefined;
    if (coverBytes && picture) coverBytes.set(picture.data);
    const coverUrl =
      picture && coverBytes
        ? URL.createObjectURL(
            new Blob([coverBytes.buffer], {
              type: picture.format || "image/jpeg",
            }),
          )
        : undefined;
    const trackNumber = positiveNumber(tags.track.no ?? undefined);
    const duration = positiveNumber(metadata.format.duration);
    const bitrate = positiveNumber(metadata.format.bitrate);
    const sampleRate = positiveNumber(metadata.format.sampleRate);

    return {
      title: tags.title?.trim() || track.fileName.replace(/\.[^.]+$/, ""),
      artist: tags.artist?.trim() || "Artista desconocido",
      album: tags.album?.trim() || "Álbum desconocido",
      albumArtist: tags.albumartist?.trim() || undefined,
      coverUrl,
      duration,
      trackNumber,
      year: tags.year,
      genre: tags.genre?.join(", "),
      bitrate,
      sampleRate,
    };
  } finally {
    await tokenizer?.close();
  }
}

export function hasUsefulMetadata(
  metadata: TrackMetadata,
  track: Track,
): boolean {
  return Boolean(
    metadata.title !== track.fileName.replace(/\.[^.]+$/, "") ||
      metadata.artist !== "Artista desconocido" ||
      metadata.album !== "Álbum desconocido" ||
      metadata.coverUrl ||
      metadata.duration ||
      metadata.trackNumber ||
      metadata.year ||
      metadata.genre ||
      metadata.bitrate ||
      metadata.sampleRate,
  );
}
