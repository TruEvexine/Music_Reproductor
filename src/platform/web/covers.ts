import type { Palette } from "../../core/palette";
import type { CoverScaleJob, CoverScaleReply } from "./cover.worker";

// Cliente del worker de portadas. Se crea la primera vez que hace falta (no cuesta nada al arrancar) y todo el trabajo
// de píxeles ocurre fuera del hilo principal. Sin Worker u OffscreenCanvas devuelve undefined: se queda la portada guardada o la paleta neutra.
let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (reply: CoverScaleReply | undefined) => void>();

function reset() {
  worker?.terminate();
  worker = undefined;
  for (const resolve of pending.values()) resolve(undefined);
  pending.clear();
}

function spawn(): Worker {
  const created = new Worker(new URL("./cover.worker.ts", import.meta.url), { type: "module" });
  created.onmessage = ({ data }: MessageEvent<CoverScaleReply>) => {
    pending.get(data.id)?.(data);
    pending.delete(data.id);
  };
  created.onerror = reset;
  return created;
}

function ask(blob: Blob, px?: number): Promise<CoverScaleReply | undefined> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return Promise.resolve(undefined);
  const active = (worker ??= spawn());
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    active.postMessage({ id, blob, px } satisfies CoverScaleJob);
  });
}

/** La portada de `blob` recortada a cuadrado y a `px` de lado, o undefined si no se pudo. */
export const scaleCover = (blob: Blob, px: number): Promise<Blob | undefined> => ask(blob, px).then((reply) => reply?.blob);

/** Paleta de la portada (core/palette), o undefined si no se pudo. */
export const coverPalette = (blob: Blob): Promise<Palette | undefined> => ask(blob).then((reply) => reply?.palette);
