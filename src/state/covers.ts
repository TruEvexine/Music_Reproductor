import { useEffect, useState } from "react";
import { storage } from "../platform";
import { coverPalette, scaleCover } from "../platform/web/covers";
import { hueOf } from "../core/coverArt";
import { fallbackPalette, PALETTE_VERSION, paletteIsCurrent, sleevePalette } from "../core/palette";
import type { Palette } from "../core/palette";

// Portadas guardadas en IndexedDB → URLs blob: con conteo de uso. Al dejar de usarse se conservan unas pocas
// (para no recrearlas al hacer scroll) y el resto se revocan. Además, las portadas grandes se sirven al tamaño real de pantalla
// (ancho × densidad): si lo guardado se queda corto, un worker lo rehace desde el original (platform/web/covers.ts) y el resultado se cachea aquí.
export type CoverSize = "small" | "large";
interface CoverRecord {
  hash: string;
  small: Blob;
  large: Blob;
  /** Original incrustado (o una versión de hasta 1024 px hecha desde él). Las portadas anteriores a esto no lo tienen. */
  master?: Blob;
  /** Lado en px de `large`. */
  largeSide?: number;
  /** Paleta (core/palette), calculada en el worker la primera vez que se pidió. */
  palette?: Palette;
  /** Versión del algoritmo con que se calculó `palette`; si no es la actual (`PALETTE_VERSION`), se recalcula. */
  paletteVersion?: number;
}
interface Entry {
  url: Promise<string | undefined>;
  value?: string;
  refs: number;
}

const entries = new Map<string, Entry>();
const idle: string[] = []; // sin uso, de más antigua a más reciente
const KEEP_IDLE = 120;

type Load = () => Promise<string | undefined>;

function acquire(key: string, load: Load): Entry {
  let entry = entries.get(key);
  if (!entry) {
    const created: Entry = {
      refs: 0,
      url: load().then((value) => (created.value = value)),
    };
    entries.set(key, (entry = created));
  }
  const at = idle.indexOf(key);
  if (at >= 0) idle.splice(at, 1);
  entry.refs += 1;
  return entry;
}

function release(key: string) {
  const entry = entries.get(key);
  if (!entry || --entry.refs > 0) return;
  idle.push(key);
  while (idle.length > KEEP_IDLE) {
    const old = idle.shift()!;
    const stale = entries.get(old);
    entries.delete(old);
    void stale?.url.then((url) => url && URL.revokeObjectURL(url));
  }
}

const stored =
  (hash: string, size: CoverSize): Load =>
  () =>
    storage.read<CoverRecord>("covers", hash).then((record) => (record?.[size] ? URL.createObjectURL(record[size]) : undefined));

/** La portada rehecha a `px` de lado, o undefined si lo guardado ya alcanza (el navegador solo reduce) o no se pudo. */
const sharp =
  (hash: string, px: number): Load =>
  async () => {
    const record = await storage.read<CoverRecord>("covers", hash);
    if (!record || px <= (record.largeSide ?? 0)) return undefined;
    const blob = await scaleCover(record.master ?? record.large, px);
    return blob && URL.createObjectURL(blob);
  };

function useEntry(key: string, load: Load): string | undefined {
  const [url, setUrl] = useState(() => (key ? entries.get(key)?.value : undefined));
  useEffect(() => {
    if (!key) {
      setUrl(undefined);
      return;
    }
    let active = true;
    const entry = acquire(key, load);
    if (entry.value) setUrl(entry.value);
    else void entry.url.then((value) => active && setUrl(value));
    return () => {
      active = false;
      release(key);
    };
    // `load` se rehace en cada render pero siempre equivale a lo que dice la clave: basta con ella
  }, [key]);
  return url;
}

/**
 * URL de la portada mientras el componente esté montado. Con `px` (píxeles reales de pantalla, ver `coverBucket`) y tamaño grande, cuando lo guardado
 * es más pequeño que eso se pide al worker una versión a medida; mientras llega se ve la guardada.
 */
export function useCover(hash: string | undefined, size: CoverSize, px = 0): string | undefined {
  const base = useEntry(hash ? `${size}:${hash}` : "", stored(hash ?? "", size));
  const exact = useEntry(hash && px && size === "large" ? `${px}:${hash}` : "", sharp(hash ?? "", px));
  return exact ?? base;
}

/** Para la pantalla de bloqueo: retiene una sola portada grande a la vez. */
let held: string | undefined;
export async function holdCover(hash: string | undefined): Promise<string | undefined> {
  const key = hash ? `large:${hash}` : undefined;
  if (key === held) return key ? entries.get(key)?.url : undefined;
  if (held) release(held);
  held = key;
  return key && hash ? acquire(key, stored(hash, "large")).url : undefined;
}

// Paletas: una por portada, calculada una sola vez en el worker y guardada con la portada; en memoria, la ya resuelta se lee al instante.
const palettes = new Map<string, Promise<Palette>>();
const resolved = new Map<string, Palette>();

function paletteOf(hash: string): Promise<Palette> {
  let found = palettes.get(hash);
  if (!found) {
    found = storage
      .read<CoverRecord>("covers", hash)
      .then(async (record) => {
        if (!record) return fallbackPalette;
        if (paletteIsCurrent(record)) return record.palette!;
        const palette = await coverPalette(record.small);
        if (!palette) return record.palette ?? fallbackPalette; // sin worker u OffscreenCanvas: la guardada (aunque sea de otra versión) o la neutra
        void storage.write("covers", [{ ...record, palette, paletteVersion: PALETTE_VERSION }]);
        return palette;
      })
      .catch(() => fallbackPalette)
      .then((palette) => (resolved.set(hash, palette), palette));
    palettes.set(hash, found);
  }
  return found;
}

/** Paleta de la portada `hash`. Sin portada, la de la funda generada (`seed`: su tono tiñe el ambiente; el acento es el neutro); sin semilla o con portada sin color, la neutra. */
export function usePaletteOf(hash: string | undefined, seed?: string): Palette {
  const [loaded, setLoaded] = useState(fallbackPalette);
  useEffect(() => {
    if (!hash) return;
    let active = true;
    void paletteOf(hash).then((palette) => active && setLoaded(palette));
    return () => {
      active = false;
    };
  }, [hash]);
  // Ya resuelta en memoria: sin esperar a un render más (al terminar el gesto, la nueva pista estrena su color en el mismo cuadro).
  // Mientras se calcula una nueva, sigue la anterior (sin destello a la neutra).
  return hash ? (resolved.get(hash) ?? loaded) : seed ? sleevePalette(hueOf(seed)) : fallbackPalette;
}
