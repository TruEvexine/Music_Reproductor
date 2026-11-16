// Ediciones de metadatos: nunca se escriben en el archivo. Viven en su propio almacén (IndexedDB «edits») y se superponen a lo leído del archivo.
// La pista en memoria muestra lo editado y guarda los originales en `source`: identidad (track:v1), playlists y sincronización salen de ahí.
import { UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./track";
import type { EditableField, Track } from "./track";

export const TEXT_FIELDS = ["title", "artist", "albumArtist", "album", "genre"] as const;
export const NUMBER_FIELDS = ["year", "trackNumber", "discNumber"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type NumberField = (typeof NUMBER_FIELDS)[number];
const FIELDS: EditableField[] = [...TEXT_FIELDS, ...NUMBER_FIELDS, "coverHash"];

/** Lo editado de una pista (clave: su id). Clave presente = campo editado; `null` = vaciado a propósito. La carátula elegida es un hash del almacén de portadas. */
export type TrackEdit = { id: string } & { [K in TextField]?: string | null } & { [K in NumberField]?: number | null } & { coverHash?: string };

export const MAX_TEXT = 200;
export const NUMBER_LIMITS: Record<NumberField, number> = { year: 9999, trackNumber: 999, discNumber: 999 };

/** La pista tal como la leyó el archivo, sin ediciones. */
export function originalOf(track: Track): Track {
  if (!track.source) return track;
  const { source, ...rest } = track;
  return { ...rest, ...source };
}

/** La pista con la edición encima (o la original si no hay). Sirve también para reaplicar sobre una pista que ya traía otra edición. */
export function applyEdit(track: Track, edit: TrackEdit | undefined): Track {
  const base = originalOf(track);
  if (!edit) return base;
  const shown: Record<string, unknown> = { ...base };
  const source: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if (!(key in edit)) continue;
    const value = edit[key];
    source[key] = base[key];
    // El título nunca queda vacío; artista y álbum vacíos usan el respaldo de siempre; lo demás, sin valor.
    shown[key] = value ?? (key === "title" ? base.title : key === "artist" ? UNKNOWN_ARTIST : key === "album" ? UNKNOWN_ALBUM : undefined);
  }
  return { ...(shown as unknown as Track), source };
}

/** ¿Está editado este campo de la pista? */
export const isEdited = (track: Track, key: EditableField) => Boolean(track.source && key in track.source);

/** Texto de un número del formulario: vacío → null (vaciado); entero en rango → número; lo demás, inválido. */
export function parseNumberField(field: NumberField, text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  return value >= 1 && value <= NUMBER_LIMITS[field] ? value : "invalid";
}

export type EditForm = Record<TextField | NumberField, string>;

const text = (value: string | number | undefined) => (value === undefined ? "" : String(value));
/** Artista y álbum desconocidos son el respaldo, no un valor: en el formulario se ven vacíos. */
const known = (track: Track, key: TextField) => (key === "artist" && track.artist === UNKNOWN_ARTIST) || (key === "album" && track.album === UNKNOWN_ALBUM) ? undefined : track[key];

/** Valores del formulario a partir de lo que se ve ahora (con edición, si la hay). Con `originalOf(track)`, los del archivo (para «Restablecer»). */
export function formOf(track: Track): EditForm {
  return {
    title: track.title,
    artist: text(known(track, "artist")),
    albumArtist: text(track.albumArtist),
    album: text(known(track, "album")),
    genre: text(track.genre),
    year: text(track.year),
    trackNumber: text(track.trackNumber),
    discNumber: text(track.discNumber),
  };
}

/**
 * La edición que resulta del formulario sobre la pista original. Lo que coincide con el archivo no cuenta como edición; el título vacío vuelve al original.
 * `coverHash`: la carátula elegida, o undefined para la del archivo. Sin nada editado, `edit` es undefined (se borra la edición); `invalid`, los números fuera de rango.
 */
export function editFromForm(original: Track, form: EditForm, coverHash: string | undefined): { edit?: TrackEdit; invalid: NumberField[] } {
  const edit: TrackEdit = { id: original.id };
  const invalid: NumberField[] = [];
  for (const key of TEXT_FIELDS) {
    const value = [...form[key].replace(/\s+/g, " ").trim()].slice(0, MAX_TEXT).join("") || null;
    if (key === "title" && value === null) continue;
    if (value !== (known(original, key) ?? null)) edit[key] = value;
  }
  for (const key of NUMBER_FIELDS) {
    const value = parseNumberField(key, form[key]);
    if (value === "invalid") invalid.push(key);
    else if (value !== (original[key] ?? null)) edit[key] = value;
  }
  if (coverHash !== undefined && coverHash !== original.coverHash) edit.coverHash = coverHash;
  return { edit: Object.keys(edit).length > 1 ? edit : undefined, invalid };
}
