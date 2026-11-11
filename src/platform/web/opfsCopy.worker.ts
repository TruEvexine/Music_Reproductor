// Copia a OPFS para navegadores sin createWritable (Safari antiguo): createSyncAccessHandle solo existe en workers.
type SyncHandle = { truncate(size: number): void; write(data: ArrayBuffer, options: { at: number }): number; flush(): void; close(): void };
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(data: unknown): void };
const CHUNK = 4 * 1024 * 1024;

scope.onmessage = async ({ data }: MessageEvent<{ id: string; dir: string[]; name: string; file: File }>) => {
  let handle: SyncHandle | undefined;
  try {
    let dir = await navigator.storage.getDirectory();
    for (const part of data.dir) dir = await dir.getDirectoryHandle(part, { create: true });
    const fileHandle = await dir.getFileHandle(data.name, { create: true });
    handle = await (fileHandle as unknown as { createSyncAccessHandle(): Promise<SyncHandle> }).createSyncAccessHandle();
    handle.truncate(0);
    for (let at = 0; at < data.file.size; at += CHUNK) handle.write(await data.file.slice(at, at + CHUNK).arrayBuffer(), { at });
    handle.flush();
    scope.postMessage({ id: data.id, ok: true });
  } catch {
    scope.postMessage({ id: data.id, ok: false });
  } finally {
    handle?.close();
  }
};
