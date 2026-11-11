import { useEffect, useState } from "react";
import { storage } from "../platform";

// Portadas guardadas en IndexedDB → URLs blob: con conteo de uso. Al dejar de usarse se conservan unas pocas
// (para no recrearlas al hacer scroll) y el resto se revocan.
export type CoverSize = "small" | "large";
interface CoverRecord {
  hash: string;
  small: Blob;
  large: Blob;
}
interface Entry {
  url: Promise<string | undefined>;
  value?: string;
  refs: number;
}

const entries = new Map<string, Entry>();
const idle: string[] = []; // sin uso, de más antigua a más reciente
const KEEP_IDLE = 120;

function acquire(key: string, hash: string, size: CoverSize): Entry {
  let entry = entries.get(key);
  if (!entry) {
    const created: Entry = {
      refs: 0,
      url: storage.read<CoverRecord>("covers", hash).then((record) => {
        const blob = record?.[size];
        created.value = blob ? URL.createObjectURL(blob) : undefined;
        return created.value;
      }),
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

/** URL de la portada mientras el componente esté montado. */
export function useCover(hash: string | undefined, size: CoverSize): string | undefined {
  const key = hash ? `${size}:${hash}` : "";
  const [url, setUrl] = useState(() => (key ? entries.get(key)?.value : undefined));
  useEffect(() => {
    if (!hash) {
      setUrl(undefined);
      return;
    }
    let active = true;
    const entry = acquire(key, hash, size);
    if (entry.value) setUrl(entry.value);
    else void entry.url.then((value) => active && setUrl(value));
    return () => {
      active = false;
      release(key);
    };
  }, [key, hash, size]);
  return url;
}

/** Para la pantalla de bloqueo: retiene una sola portada grande a la vez. */
let held: string | undefined;
export async function holdCover(hash: string | undefined): Promise<string | undefined> {
  const key = hash ? `large:${hash}` : undefined;
  if (key === held) return key ? entries.get(key)?.url : undefined;
  if (held) release(held);
  held = key;
  return key && hash ? acquire(key, hash, "large").url : undefined;
}
