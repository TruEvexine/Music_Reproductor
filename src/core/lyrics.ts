// Letras: archivos .lrc hermanos y etiquetas USLT (texto) / SYLT (sincronizada). Puro, sin DOM.

export interface LyricLine {
  /** Segundos desde el inicio de la pista. */
  time: number;
  text: string;
}

export interface Lyrics {
  synced?: LyricLine[];
  plain?: string;
}

const MAX_LYRICS_CHARS = 200_000;
const stamp = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Interpreta texto LRC ("[01:02.50]verso"); si no lleva marcas de tiempo, es letra sin sincronizar. */
export function parseLrc(text: string): Lyrics | undefined {
  const source = text.slice(0, MAX_LYRICS_CHARS).replace(/^﻿/, "");
  const offset = Number(/^\[offset:\s*([+-]?\d+)\]/im.exec(source)?.[1] ?? 0) / 1000;
  const synced: LyricLine[] = [];
  const plain: string[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const times = [...raw.matchAll(stamp)];
    if (times.length === 0) {
      // Etiquetas de cabecera ([ar:…], [ti:…], [offset:…]) no son letra.
      if (!/^\s*\[[a-z#]+:.*\]\s*$/i.test(raw)) plain.push(raw);
      continue;
    }
    const words = raw.replace(stamp, "").trim();
    for (const [, min, sec, fraction = "0"] of times) {
      const time = Number(min) * 60 + Number(sec) + Number(fraction.padEnd(3, "0")) / 1000 - offset;
      synced.push({ time: Math.max(0, time), text: words });
    }
  }
  if (synced.length > 0) return { synced: synced.sort((a, b) => a.time - b.time) };
  const joined = plain.join("\n").trim();
  return joined ? { plain: joined } : undefined;
}

/** Forma de music-metadata (`common.lyrics`). `timeStampFormat` 2 = milisegundos; los cuadros MPEG no se usan. */
export interface LyricsTag {
  text?: string;
  syncText?: { text: string; timestamp?: number }[];
  timeStampFormat?: number;
}

export function lyricsFromTags(tags: LyricsTag[] | undefined): Lyrics | undefined {
  if (!tags?.length) return undefined;
  for (const tag of tags) {
    const lines = tag.timeStampFormat === 2 ? (tag.syncText ?? []).filter((line) => line.timestamp !== undefined) : [];
    if (lines.length > 0) {
      return { synced: lines.map((line) => ({ time: line.timestamp! / 1000, text: line.text.trim() })).sort((a, b) => a.time - b.time) };
    }
  }
  // USLT o un campo LYRICS de Vorbis: puede traer LRC dentro.
  const text = tags.find((tag) => tag.text?.trim())?.text;
  return text ? parseLrc(text) : undefined;
}

/** Índice del verso que suena en `seconds` (-1 antes del primero). */
export function lineAt(lines: LyricLine[], seconds: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= seconds) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found;
}
