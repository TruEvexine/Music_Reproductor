import type { Lyrics } from "../../core/lyrics";
import type { Track } from "../../core/track";

// Pool de workers de metadatos: uno por trabajo a la vez, con tiempo máximo. Un archivo corrupto o que
// cuelga al lector solo cuesta su worker (se termina y se crea otro), nunca el hilo principal.

export type TrackMetadata = Partial<
  Pick<
    Track,
    | "title"
    | "artist"
    | "album"
    | "albumArtist"
    | "duration"
    | "trackNumber"
    | "year"
    | "genre"
    | "bitrate"
    | "sampleRate"
    | "bitsPerSample"
    | "codec"
    | "lossless"
    | "gainTrackDb"
    | "gainAlbumDb"
  >
>;

export interface MetadataJob {
  id: number;
  file: Blob & { name?: string };
  /** cover.jpg / folder.jpg de la carpeta, por si la pista no trae portada. */
  folderCover?: File;
}

export interface MetadataReply {
  id: number;
  ok: boolean;
  timedOut?: boolean;
  metadata?: TrackMetadata;
  v2?: string;
  lyrics?: Lyrics;
  /** Sin `small`/`large`: la portada ya existía y no se volvió a reducir. */
  cover?: { hash: string; small?: Blob; large?: Blob };
}

export const METADATA_TIMEOUT_MS = 20_000;
const size = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)));

interface Slot {
  worker: Worker;
  busy: boolean;
}

const slots: Slot[] = [];
const waiting: { job: Omit<MetadataJob, "id">; resolve: (reply: MetadataReply) => void }[] = [];
const knownCovers = new Set<string>();
let nextId = 1;

function spawn(): Worker {
  const worker = new Worker(new URL("./metadata.worker.ts", import.meta.url), { type: "module" });
  if (knownCovers.size > 0) worker.postMessage({ known: [...knownCovers] });
  return worker;
}

function run(slot: Slot) {
  const task = waiting.shift();
  if (!task) return;
  slot.busy = true;
  const id = nextId++;
  const finish = (reply: MetadataReply) => {
    clearTimeout(timer);
    slot.worker.removeEventListener("message", onMessage);
    slot.worker.removeEventListener("error", onError);
    slot.busy = false;
    if (reply.cover) knownCovers.add(reply.cover.hash);
    task.resolve(reply);
    run(slot);
  };
  const onMessage = (event: MessageEvent<MetadataReply>) => event.data.id === id && finish(event.data);
  const onError = () => {
    slot.worker.terminate();
    slot.worker = spawn();
    finish({ id, ok: false });
  };
  const timer = setTimeout(() => {
    slot.worker.terminate(); // el lector se quedó colgado (archivo enorme o malformado)
    slot.worker = spawn();
    finish({ id, ok: false, timedOut: true });
  }, METADATA_TIMEOUT_MS);
  slot.worker.addEventListener("message", onMessage);
  slot.worker.addEventListener("error", onError);
  slot.worker.postMessage({ id, ...task.job } satisfies MetadataJob);
}

/** Portadas que ya están guardadas: los workers no las vuelven a reducir. */
export function rememberCovers(hashes: Iterable<string>) {
  const fresh = [...hashes].filter((hash) => !knownCovers.has(hash));
  for (const hash of fresh) knownCovers.add(hash);
  if (fresh.length > 0) for (const slot of slots) slot.worker.postMessage({ known: fresh });
}

export function readMetadata(job: Omit<MetadataJob, "id">): Promise<MetadataReply> {
  if (import.meta.env.DEV) (globalThis as { __metadataReads?: number }).__metadataReads = ((globalThis as { __metadataReads?: number }).__metadataReads ?? 0) + 1; // las pruebas comprueban el re-escaneo por diferencias
  return new Promise((resolve) => {
    waiting.push({ job, resolve });
    let slot = slots.find((item) => !item.busy);
    if (!slot && slots.length < size) slots.push((slot = { worker: spawn(), busy: false }));
    if (slot) run(slot);
  });
}

/** Cancela lo que aún no empezó (escaneo cancelado). */
export function dropPendingMetadata() {
  for (const task of waiting.splice(0)) task.resolve({ id: 0, ok: false });
}
