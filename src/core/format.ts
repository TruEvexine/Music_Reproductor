import type { Track } from "./track";

/** Duración CSS en milisegundos. El build minifica `140ms` como `.14s`, así que hay que leer la unidad (`parseFloat` a secas daba 0,14). */
export function cssMs(value: string): number {
  const text = value.trim();
  return (parseFloat(text) * (text.endsWith("ms") ? 1 : 1000)) || 0;
}

/** Tamaño legible en español: «84 MB», «12,4 GB». */
export function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("es", { maximumFractionDigits: unit > 1 ? 1 : 0 })} ${units[unit]}`;
}

/** Correo para mostrarlo sin enseñarlo entero: «r…@correo.com». */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return domain ? `${[...name][0] ?? ""}…@${domain}` : email;
}

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
