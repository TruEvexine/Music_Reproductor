// Lee tags, calcula track:v2 y genera las miniaturas de portada fuera del hilo principal.
import { parseBlob, selectCover } from "music-metadata";
import { safeCoverMime } from "../../core/coverMime";
import { lyricsFromTags } from "../../core/lyrics";
import type { LyricsTag } from "../../core/lyrics";
import { computeTrackV2, sha256Hex } from "../../core/track";
import type { MetadataJob, MetadataReply } from "./metadata";

const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(data: unknown): void };
const MAX_COVER_BYTES = 12 * 1024 * 1024;
const THUMB_SIZES = { small: 96, large: 600 } as const;
// Portadas ya guardadas (las envía el hilo principal) o hechas por este worker: no se vuelven a reducir.
const known = new Set<string>();

const positive = (value: number | undefined | null) => (value !== undefined && value !== null && Number.isFinite(value) && value > 0 ? value : undefined);

async function thumbnail(bitmap: ImageBitmap, size: number, original: Blob): Promise<Blob> {
  if (typeof OffscreenCanvas === "undefined") return original;
  const side = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(size, side);
  const canvas = new OffscreenCanvas(target, target);
  const context = canvas.getContext("2d");
  if (!context) return original;
  // Recorte cuadrado centrado: la portada siempre se pinta 1:1.
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.86 });
}

async function coverFrom(bytes: Uint8Array<ArrayBuffer>, type: string): Promise<MetadataReply["cover"]> {
  const hash = (await sha256Hex(bytes)).slice(0, 32);
  if (known.has(hash)) return { hash };
  const original = new Blob([bytes], { type });
  try {
    const bitmap = await createImageBitmap(original);
    const [small, large] = await Promise.all([thumbnail(bitmap, THUMB_SIZES.small, original), thumbnail(bitmap, THUMB_SIZES.large, original)]);
    bitmap.close();
    known.add(hash);
    return { hash, small, large };
  } catch {
    return undefined; // imagen corrupta: la pista queda con el degradado de respaldo
  }
}

async function read({ file, folderCover }: MetadataJob): Promise<Omit<MetadataReply, "id">> {
  const v2 = await computeTrackV2(file.size, (start, end) => file.slice(start, end).arrayBuffer()).catch(() => undefined);
  const metadata = await parseBlob(file, { duration: false });
  const tags = metadata.common;
  const picture = selectCover(tags.picture);
  const pictureType = safeCoverMime(picture?.format);
  let cover: MetadataReply["cover"];
  if (picture && pictureType && picture.data.byteLength <= MAX_COVER_BYTES) {
    const bytes = new Uint8Array(picture.data.byteLength);
    bytes.set(picture.data);
    cover = await coverFrom(bytes, pictureType);
  }
  const folderType = folderCover && safeCoverMime(folderCover.type || (/\.png$/i.test(folderCover.name) ? "image/png" : /\.webp$/i.test(folderCover.name) ? "image/webp" : "image/jpeg"));
  if (!cover && folderCover && folderType && folderCover.size <= MAX_COVER_BYTES) {
    cover = await coverFrom(new Uint8Array(await folderCover.arrayBuffer()), folderType);
  }
  return {
    ok: true,
    v2,
    cover,
    lyrics: lyricsFromTags(tags.lyrics as LyricsTag[] | undefined),
    metadata: {
      title: tags.title?.trim() || undefined,
      artist: tags.artist?.trim() || undefined,
      album: tags.album?.trim() || undefined,
      albumArtist: tags.albumartist?.trim() || undefined,
      duration: positive(metadata.format.duration),
      trackNumber: positive(tags.track.no),
      year: positive(tags.year),
      genre: tags.genre?.join(", ") || undefined,
      bitrate: positive(metadata.format.bitrate),
      sampleRate: positive(metadata.format.sampleRate),
      bitsPerSample: positive(metadata.format.bitsPerSample),
      codec: metadata.format.codec,
      lossless: metadata.format.lossless,
      gainTrackDb: tags.replaygain_track_gain?.dB,
      gainAlbumDb: tags.replaygain_album_gain?.dB,
    },
  };
}

scope.onmessage = async ({ data }: MessageEvent<MetadataJob | { known: string[] }>) => {
  if ("known" in data) {
    for (const hash of data.known) known.add(hash);
    return;
  }
  try {
    scope.postMessage({ id: data.id, ...(await read(data)) } satisfies MetadataReply);
  } catch {
    scope.postMessage({ id: data.id, ok: false } satisfies MetadataReply);
  }
};
