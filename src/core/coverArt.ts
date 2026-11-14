// Funda de las pistas sin carátula: cuadrada, estática y mate, con un solo motivo (una forma de onda de barras simétricas). Original: sin personajes, marcas
// ni obras reconocibles. Todo sale de un hash, así que la misma pista (o el mismo álbum) tiene siempre la misma funda. El color lo pone el CSS (`--h`, base.css)
// con luminosidad y croma fijos, dentro de los rangos del acento (DESIGN.md §3), y el modo HDR le aplica el filtro de `.cover` como a cualquier portada.
import { searchKey } from "./format";
import { UNKNOWN_ALBUM } from "./track";

const normalize = (text: string) => text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** La semilla de una pista suelta: título y artista sin distinguir mayúsculas ni espacios de más. */
export const coverSeed = (title: string, artist: string) => `${normalize(title)}\u0000${normalize(artist)}`;

/**
 * La semilla de la funda de una pista: la del álbum (la misma clave que agrupa en Álbumes, así la cabecera del álbum y sus pistas se parecen) o, sin álbum,
 * la de la pista suelta.
 */
export function trackCoverSeed(track: { title: string; artist: string; album: string; albumArtist?: string }): string {
  return track.album && track.album !== UNKNOWN_ALBUM ? `${searchKey(track.albumArtist ?? track.artist)}\u0000${searchKey(track.album)}` : coverSeed(track.title, track.artist);
}

/** FNV-1a de 32 bits. */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

/** mulberry32: números repetibles en [0, 1) a partir de la semilla. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Matiz (0–359) de la funda: el mismo texto da siempre el mismo tono. */
export const hueOf = (seed: string) => (hash32(seed) >>> 8) % 360;

export const BARS = 9;
/** Alturas de las barras relativas al alto útil, en [MIN_BAR, 1]: nunca una barra invisible, y siempre una que llena el alto para que el motivo se lea igual a 48 px. */
export const MIN_BAR = 0.14;

export function barsOf(seed: string): number[] {
  const next = random(hash32(seed));
  const bars = Array.from({ length: BARS }, () => MIN_BAR + next() * (1 - MIN_BAR));
  bars[Math.floor(next() * BARS)] = 1;
  return bars;
}
