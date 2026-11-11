import { audioTypeOf, isAudioFile, isFolderCover, isLyricsFile } from "../../core/library";
import type { FolderAccess, LibraryFile, LibraryRoot, LocalLibrary } from "../types";

// File System Access no es Baseline: se decide por detección de la función, nunca por navegador.
type PermissionHandle = FileSystemHandle & {
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
};
type Picker = (options?: { id?: string; mode?: "read" }) => Promise<FileSystemDirectoryHandle>;
type DropItem = DataTransferItem & { getAsFileSystemHandle?(): Promise<FileSystemHandle | null> };

const picker = (globalThis as { showDirectoryPicker?: Picker }).showDirectoryPicker;
const wanted = (name: string) => isAudioFile(name) || isLyricsFile(name) || isFolderCover(name);
const newRoot = (name: string, kind: LibraryRoot["kind"], handle?: FileSystemDirectoryHandle): LibraryRoot => ({
  id: crypto.randomUUID(),
  name,
  kind,
  handle,
  addedAt: Date.now(),
});
// Nombres que no pueden ser una entrada de OPFS o que escaparían de la carpeta.
const segments = (path: string) => path.split("/").filter((part) => part && part !== "." && part !== "..");

async function opfsDir(root: LibraryRoot, create = false): Promise<FileSystemDirectoryHandle> {
  const base = await navigator.storage.getDirectory();
  const library = await base.getDirectoryHandle("biblioteca", { create });
  return library.getDirectoryHandle(root.id, { create });
}

async function dirOf(root: LibraryRoot): Promise<FileSystemDirectoryHandle> {
  if (root.kind === "folder" && root.handle) return root.handle;
  if (root.kind === "copy") return opfsDir(root);
  throw new Error("Raíz sin carpeta");
}

// Archivos "session": viven solo en memoria hasta recargar.
const sessionFiles = new Map<string, Map<string, File>>();

async function walkDir(dir: FileSystemDirectoryHandle, prefix: string, onBatch: (files: LibraryFile[]) => void, signal?: AbortSignal) {
  let batch: LibraryFile[] = [];
  const stack: [FileSystemDirectoryHandle, string][] = [[dir, prefix]];
  while (stack.length > 0) {
    const [current, path] = stack.pop()!;
    for await (const entry of current.values()) {
      if (signal?.aborted) return;
      if (entry.kind === "directory") stack.push([entry as FileSystemDirectoryHandle, `${path}/${entry.name}`]);
      else if (wanted(entry.name)) {
        try {
          batch.push({ path: `${path}/${entry.name}`, file: await (entry as FileSystemFileHandle).getFile() });
        } catch {
          // Borrado o ilegible a mitad del escaneo: se omite.
        }
        if (batch.length >= 100) {
          onBatch(batch);
          batch = [];
        }
      }
    }
  }
  if (batch.length > 0) onBatch(batch);
}

/** Recorre lo arrastrado con la API de entradas (Firefox, Safari y Chromium sin handles). */
async function readEntry(entry: FileSystemEntry, out: LibraryFile[]): Promise<void> {
  if (entry.isFile) {
    if (!wanted(entry.name)) return;
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)).catch(() => null);
    if (file) out.push({ path: entry.fullPath.replace(/^\//, ""), file });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries entrega por tandas: hay que llamarlo hasta que devuelva una lista vacía.
  for (;;) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject)).catch(() => []);
    if (entries.length === 0) return;
    for (const child of entries) await readEntry(child, out);
  }
}

let copyWorker: Worker | undefined;

/** Safari sin createWritable: se escribe desde un worker con createSyncAccessHandle. */
function copyInWorker(dir: string[], name: string, file: File): Promise<void> {
  copyWorker ??= new Worker(new URL("./opfsCopy.worker.ts", import.meta.url), { type: "module" });
  const worker = copyWorker;
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const done = (event: MessageEvent<{ id: string; ok: boolean }>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", done);
      if (event.data.ok) resolve();
      else reject(new Error("copia fallida"));
    };
    worker.addEventListener("message", done);
    worker.postMessage({ id, dir, name, file });
  });
}

const probe = typeof document === "undefined" ? undefined : document.createElement("audio");
const playable = new Map<string, boolean>();

export const localLibrary: LocalLibrary = {
  keepsFolders: picker !== undefined,

  async pickFolder() {
    if (!picker) return null;
    try {
      const handle = await picker({ id: "musica", mode: "read" });
      return newRoot(handle.name, "folder", handle);
    } catch {
      return null; // cancelado por el usuario
    }
  },

  async dropped(data) {
    // Hay que sacar todo de los elementos ANTES del primer await: después del evento quedan vacíos.
    const items = Array.from(data.items).filter((item) => item.kind === "file") as DropItem[];
    const handles = items.map((item) => item.getAsFileSystemHandle?.());
    const entries = items.map((item) => item.webkitGetAsEntry());
    const loose = Array.from(data.files);
    const folders: LibraryRoot[] = [];
    const files: LibraryFile[] = [];
    for (let i = 0; i < items.length; i++) {
      const handle = await handles[i]?.catch(() => null);
      if (handle?.kind === "directory") {
        folders.push(newRoot(handle.name, "folder", handle as FileSystemDirectoryHandle));
        continue;
      }
      const entry = entries[i];
      if (entry) await readEntry(entry, files);
      else if (loose[i] && wanted(loose[i].name)) files.push({ path: loose[i].name, file: loose[i] });
    }
    return { folders, files };
  },

  async access(root, ask = false): Promise<FolderAccess> {
    if (root.kind === "session") return sessionFiles.has(root.id) ? "granted" : "missing";
    if (root.kind === "copy") return "granted";
    const handle = root.handle as PermissionHandle | undefined;
    if (!handle) return "missing";
    let state: PermissionState;
    try {
      state = (await handle.queryPermission?.({ mode: "read" })) ?? "granted";
    } catch {
      return "missing"; // la carpeta se borró o se movió
    }
    if (state !== "prompt" || !ask) return state;
    try {
      return (await handle.requestPermission?.({ mode: "read" })) ?? state;
    } catch {
      return state; // sin gesto del usuario el navegador no deja preguntar: sigue pendiente
    }
  },

  async walk(root, onBatch, signal) {
    if (root.kind === "session") {
      const files = sessionFiles.get(root.id);
      if (files) onBatch([...files].map(([path, file]) => ({ path, file })));
      return;
    }
    await walkDir(await dirOf(root), root.name, onBatch, signal);
  },

  async readFile(root, path) {
    if (root.kind === "session") {
      const file = sessionFiles.get(root.id)?.get(path);
      if (!file) throw new Error("Archivo de una sesión anterior");
      return file;
    }
    // La ruta lleva delante el nombre de la raíz, que no es una entrada dentro de ella.
    const parts = segments(path).slice(1);
    let dir = await dirOf(root);
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
  },

  async copyIn(root, files, signal) {
    const remember = () => sessionFiles.set(root.id, new Map(files.map(({ path, file }) => [path, file])));
    if (!navigator.storage?.getDirectory) {
      remember();
      return "unsupported";
    }
    const needed = files.reduce((total, { file }) => total + file.size, 0);
    const space = await localLibrary.space();
    if (space && space.quota - space.usage < needed * 1.05) {
      remember();
      return "space";
    }
    try {
      void navigator.storage.persist?.(); // que el navegador no borre la copia cuando falte espacio
      const base = await opfsDir(root, true);
      const writable = "createWritable" in FileSystemFileHandle.prototype;
      for (const { path, file } of files) {
        if (signal?.aborted) break;
        const parts = segments(path).slice(1);
        if (parts.length === 0) continue;
        if (!writable) {
          await copyInWorker(["biblioteca", root.id, ...parts.slice(0, -1)], parts[parts.length - 1], file);
          continue;
        }
        let dir = base;
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const stream = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
        await stream.write(file);
        await stream.close();
      }
      return "ok";
    } catch (error) {
      remember(); // esta sesión sigue funcionando desde memoria
      // Sin cuota → "space"; OPFS deshabilitado (ventana privada de Safari, WebKit para Windows) → "unsupported".
      return (error as DOMException | undefined)?.name === "QuotaExceededError" ? "space" : "unsupported";
    }
  },

  async forget(root) {
    sessionFiles.delete(root.id);
    if (root.kind !== "copy") return;
    try {
      const base = await navigator.storage.getDirectory();
      await (await base.getDirectoryHandle("biblioteca")).removeEntry(root.id, { recursive: true });
    } catch {
      // Ya no existía.
    }
  },

  async space() {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return quota > 0 ? { usage, quota } : undefined;
    } catch {
      return undefined;
    }
  },

  canPlay(fileName) {
    const type = audioTypeOf(fileName);
    if (!type || !probe) return false;
    let known = playable.get(type);
    if (known === undefined) playable.set(type, (known = probe.canPlayType(type) !== ""));
    return known;
  },
};
