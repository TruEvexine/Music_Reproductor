import type { Track } from "./track";

export function formatTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function kHz(sampleRate: number): string {
  return String(Math.round(sampleRate / 100) / 10);
}

/** Insignia de calidad: "FLAC 24/96", "FLAC 16/44.1", "MP3 320". */
export function qualityLabel(track: Pick<Track, "fileName" | "codec" | "lossless" | "bitrate" | "sampleRate" | "bitsPerSample">): string {
  const extension = track.fileName.split(".").pop()?.toUpperCase() ?? "";
  const format = extension === "M4A" && track.lossless ? "ALAC" : extension === "OGG" && /opus/i.test(track.codec ?? "") ? "OPUS" : extension || "AUDIO";
  const lossless = track.lossless ?? ["FLAC", "WAV", "ALAC", "AIFF"].includes(format);
  if (lossless && track.sampleRate) {
    return track.bitsPerSample ? `${format} ${track.bitsPerSample}/${kHz(track.sampleRate)}` : `${format} ${kHz(track.sampleRate)} kHz`;
  }
  if (!lossless && track.bitrate) return `${format} ${Math.round(track.bitrate / 1000)}`;
  return format;
}

/** Hi-Res: sin pérdida y por encima de calidad CD. */
export function isHiRes(track: Pick<Track, "lossless" | "sampleRate" | "bitsPerSample">): boolean {
  return Boolean(track.lossless) && ((track.bitsPerSample ?? 0) > 16 || (track.sampleRate ?? 0) > 48000);
}

/** Texto para comparar en búsquedas: sin acentos ni mayúsculas ("Ñandú" ≈ "nandu"). */
export function searchKey(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}

export function matchesSearch(track: Pick<Track, "title" | "artist" | "album" | "albumArtist" | "genre">, query: string): boolean {
  const key = searchKey(query);
  if (!key) return true;
  return [track.title, track.artist, track.album, track.albumArtist, track.genre].some(
    (value) => value !== undefined && searchKey(value).includes(key),
  );
}
