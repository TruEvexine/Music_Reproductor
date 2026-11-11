import { create } from "zustand";
import { diffScan, isAudioFile, isFolderCover, isLyricsFile, stemOf } from "../core/library";
import { parseLrc } from "../core/lyrics";
import { folderOf, titleFromFileName, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "../core/track";
import type { Track } from "../core/track";
import { localLibrary, storage } from "../platform";
import type { FolderAccess, LibraryFile, LibraryRoot } from "../platform/types";
import { dropPendingMetadata, readMetadata, rememberCovers } from "../platform/web/metadata";
import type { MetadataReply } from "../platform/web/metadata";

// Biblioteca persistente: pistas, raíces y portadas en IndexedDB; los archivos se leen de la carpeta recordada
// (File System Access), de la copia privada (OPFS) o, si no se pudo copiar, de memoria durante esta sesión.

export interface RootView {
  id: string;
  name: string;
  kind: LibraryRoot["kind"];
  access: FolderAccess;
  count: number;
}

export interface ScanProgress {
  rootId: string;
  name: string;
  /** Archivos de audio encontrados. */
  found: number;
  /** Metadatos leídos de los que hacía falta leer. */
  read: number;
  toRead: number;
  walking: boolean;
}

interface LibraryState {
  tracks: Track[];
  roots: RootView[];
  scan: ScanProgress | null;
  /** La biblioteca guardada ya se cargó (antes de eso, "vacía" no significa vacía). */
  ready: boolean;
  notice: string | null;
}

export const useLibrary = create<LibraryState>(() => ({ tracks: [], roots: [], scan: null, ready: false, notice: null }));

const roots = new Map<string, LibraryRoot>();
const access = new Map<string, FolderAccess>();
const demoUrls = new Map<string, string>();
const LOOSE = "Archivos importados";
const MAX_LRC_BYTES = 512 * 1024;

const trackIdOf = (rootId: string, path: string) => `${rootId}:${path}`;
const byId = () => new Map(useLibrary.getState().tracks.map((track) => [track.id, track]));
const say = (notice: string | null) => useLibrary.setState({ notice });

function publishRoots() {
  const counts = new Map<string, number>();
  for (const track of useLibrary.getState().tracks) if (track.rootId) counts.set(track.rootId, (counts.get(track.rootId) ?? 0) + 1);
  useLibrary.setState({
    roots: [...roots.values()].map((root) => ({ id: root.id, name: root.name, kind: root.kind, access: access.get(root.id) ?? "granted", count: counts.get(root.id) ?? 0 })),
  });
}

// --- Escritura diferida: muchos cambios pequeños → una transacción cada 400 ms. ---

const dirty = new Set<string>();
const deleted = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function persist(ids: Iterable<string>, removed: Iterable<string> = []) {
  for (const id of ids) dirty.add(id);
  for (const id of removed) {
    dirty.delete(id);
    deleted.add(id);
  }
  flushTimer ??= setTimeout(flush, 400);
}

export async function flush() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  const tracks = byId();
  const put = [...dirty].flatMap((id) => {
    const track = tracks.get(id);
    // Lo que vive solo en memoria no se guarda: tras recargar no habría archivo que leer.
    if (!track?.rootId || roots.get(track.rootId)?.kind === "session") return [];
    const { unplayable: _runtime, ...stored } = track;
    return [stored];
  });
  const remove = [...deleted];
  dirty.clear();
  deleted.clear();
  if (put.length > 0 || remove.length > 0) await storage.write("tracks", put, remove);
}

// --- Cambios agrupados en el estado: aplicar 5 000 parches de uno en uno congelaría la UI. ---

const patches = new Map<string, Partial<Track>>();
let patchTimer: ReturnType<typeof setTimeout> | undefined;

function patch(id: string, change: Partial<Track>, now = false) {
  patches.set(id, { ...patches.get(id), ...change });
  if (now) applyPatches();
  else patchTimer ??= setTimeout(applyPatches, 250);
}

function applyPatches() {
  clearTimeout(patchTimer);
  patchTimer = undefined;
  if (patches.size === 0) return;
  const pending = new Map(patches);
  patches.clear();
  useLibrary.setState((state) => ({ tracks: state.tracks.map((track) => (pending.has(track.id) ? { ...track, ...pending.get(track.id) } : track)) }));
  persist(pending.keys());
}

// --- Metadatos ---

interface Job {
  id: string;
  file: Blob & { name?: string };
  folderCover?: File;
  lrc?: File;
}

let generation = 0; // un escaneo cancelado invalida las respuestas que lleguen después

async function lyricsFile(file: File | undefined) {
  if (!file || file.size > MAX_LRC_BYTES) return undefined;
  try {
    return parseLrc(await file.text());
  } catch {
    return undefined;
  }
}

async function applyMetadata(job: Job, reply: MetadataReply) {
  const track = byId().get(job.id);
  if (!track) return;
  if (reply.cover?.small && reply.cover.large) {
    await storage.write("covers", [{ hash: reply.cover.hash, small: reply.cover.small, large: reply.cover.large }]);
  }
  const tags = reply.metadata ?? {};
  const useful = Boolean(tags.title || tags.artist || tags.album || reply.cover);
  patch(job.id, {
    ...tags,
    title: tags.title ?? titleFromFileName(track.fileName),
    artist: tags.artist ?? UNKNOWN_ARTIST,
    album: tags.album ?? UNKNOWN_ALBUM,
    v2: reply.v2,
    coverHash: reply.cover?.hash,
    lyrics: reply.lyrics ?? (await lyricsFile(job.lrc)),
    metadataStatus: !reply.ok ? "error" : useful ? "available" : "partial",
  });
}

function readAll(jobs: Job[], progress?: ScanProgress): Promise<void> {
  const mine = generation;
  if (progress) useLibrary.setState({ scan: { ...progress, toRead: jobs.length, read: 0 } });
  let read = 0;
  return Promise.all(
    jobs.map(async (job) => {
      const reply = await readMetadata({ file: job.file, folderCover: job.folderCover });
      if (mine !== generation) return;
      await applyMetadata(job, reply);
      read += 1;
      // El contador se publica a saltos: con miles de pistas, cada setState cuesta un render.
      if (progress && (read % 10 === 0 || read === jobs.length)) useLibrary.setState((state) => (state.scan ? { scan: { ...state.scan, read } } : {}));
    }),
  ).then(() => undefined);
}

// --- Ingesta y escaneo ---

function newTrack(root: LibraryRoot, { path, file }: LibraryFile, previous?: Track): Track {
  const fileName = path.split("/").pop() ?? path;
  return {
    id: trackIdOf(root.id, path),
    rootId: root.id,
    path,
    fileName,
    size: file.size,
    lastModified: file.lastModified,
    title: titleFromFileName(fileName),
    artist: UNKNOWN_ARTIST,
    album: UNKNOWN_ALBUM,
    metadataStatus: "loading",
    addedAt: previous?.addedAt ?? Date.now(),
    playedAt: previous?.playedAt,
    unsupported: !localLibrary.canPlay(fileName) || undefined,
  };
}

/** Portadas de carpeta y letras .lrc encontradas junto a las pistas. */
function companions(files: LibraryFile[]) {
  const covers = new Map<string, File>();
  const lyrics = new Map<string, File>();
  for (const { path, file } of files) {
    const name = path.split("/").pop() ?? "";
    if (isFolderCover(name)) covers.set(folderOf(path), file);
    else if (isLyricsFile(name)) lyrics.set(stemOf(path), file);
  }
  return { covers, lyrics };
}

let scanning: AbortController | null = null;
let chain: Promise<void> = Promise.resolve();

/**
 * Recorre una raíz: lo nuevo aparece en cuanto se encuentra, solo se leen metadatos de lo nuevo o cambiado
 * (ruta + tamaño + fecha) y al final se quita lo que ya no está. Si se cancela, no se borra nada.
 */
function scan(root: LibraryRoot, given?: LibraryFile[]): Promise<void> {
  chain = chain.then(async () => {
    const controller = new AbortController();
    scanning = controller;
    const known = useLibrary.getState().tracks.filter((track) => track.rootId === root.id) as (Track & { size: number; lastModified: number })[];
    const knownByPath = new Map(known.map((track) => [track.path, track]));
    const all: LibraryFile[] = [];
    const audio: LibraryFile[] = [];
    const fresh: Track[] = [];
    const progress: ScanProgress = { rootId: root.id, name: root.name, found: 0, read: 0, toRead: 0, walking: true };
    useLibrary.setState({ scan: progress });

    const take = (batch: LibraryFile[]) => {
      all.push(...batch);
      const songs = batch.filter(({ path }) => isAudioFile(path));
      audio.push(...songs);
      const stamps = songs.map(({ path, file }) => ({ path, size: file.size, lastModified: file.lastModified, entry: { path, file } }));
      const { added } = diffScan(stamps.flatMap(({ path }) => (knownByPath.has(path) ? [knownByPath.get(path)!] : [])), stamps);
      const tracks = added.map(({ entry }) => newTrack(root, entry, knownByPath.get(entry.path)));
      fresh.push(...tracks);
      progress.found = audio.length;
      if (tracks.length > 0) {
        const ids = new Set(tracks.map((track) => track.id));
        useLibrary.setState((state) => ({ tracks: [...state.tracks.filter((track) => !ids.has(track.id)), ...tracks], scan: { ...progress } }));
        persist(ids);
      } else useLibrary.setState({ scan: { ...progress } });
    };

    try {
      if (given) take(given);
      else await localLibrary.walk(root, take, controller.signal);
    } catch {
      say(`No se pudo leer «${root.name}». Comprueba que la carpeta sigue ahí.`);
    }
    if (!controller.signal.aborted) {
      const seen = new Set(audio.map(({ path }) => path));
      // Un archivo recibido suelto no borra el resto de su raíz; un recorrido completo, sí.
      const gone = given ? [] : known.filter((track) => !seen.has(track.path)).map((track) => track.id);
      if (gone.length > 0) {
        const goneIds = new Set(gone);
        useLibrary.setState((state) => ({ tracks: state.tracks.filter((track) => !goneIds.has(track.id)) }));
        persist([], gone);
      }
      root.scannedAt = Date.now();
      if (root.kind !== "session") await storage.write("roots", [root]);
      publishRoots();
      const { covers, lyrics } = companions(all);
      const byPath = new Map(audio.map((entry) => [entry.path, entry.file]));
      progress.walking = false;
      await readAll(
        fresh.map((track) => ({ id: track.id, file: byPath.get(track.path)!, folderCover: covers.get(folderOf(track.path)), lrc: lyrics.get(stemOf(track.path)) })),
        progress,
      );
      applyPatches();
    }
    await flush();
    scanning = null;
    useLibrary.setState({ scan: null });
    publishRoots();
  }).catch(() => {
    // Un fallo inesperado no debe bloquear los escaneos siguientes.
    scanning = null;
    useLibrary.setState({ scan: null });
  });
  return chain;
}

async function addRoot(root: LibraryRoot) {
  roots.set(root.id, root);
  access.set(root.id, "granted");
  if (root.kind !== "session") await storage.write("roots", [root]);
  publishRoots();
}

/** Archivos sin carpeta recordable: se copian a OPFS si caben; si no, suenan solo en esta sesión. */
async function importFiles(files: LibraryFile[]) {
  const groups = new Map<string, LibraryFile[]>();
  for (const entry of files) {
    // Archivos sueltos van todos a la raíz "Archivos importados"; las carpetas, cada una a la suya.
    const top = entry.path.includes("/") ? entry.path.split("/")[0] : LOOSE;
    const path = entry.path.includes("/") ? entry.path : `${LOOSE}/${entry.path}`;
    groups.set(top, [...(groups.get(top) ?? []), { path, file: entry.file }]);
  }
  for (const [name, group] of groups) {
    if (!group.some(({ path }) => isAudioFile(path))) continue;
    const reuse = name === LOOSE ? [...roots.values()].find((root) => root.name === LOOSE && root.kind === "copy") : undefined;
    const root: LibraryRoot = reuse ?? { id: crypto.randomUUID(), name, kind: "copy", addedAt: Date.now() };
    const copied = await localLibrary.copyIn(root, group, scanning?.signal);
    if (copied !== "ok") {
      if (reuse) continue; // la raíz de sueltos ya guardada no pasa a ser de sesión: este lote se queda fuera
      root.kind = "session";
      say(
        copied === "space"
          ? "No hay espacio para guardar una copia: esta música sonará hasta que recargues la página."
          : "Este navegador no permite guardar una copia: esta música sonará hasta que recargues la página.",
      );
    }
    if (!reuse) await addRoot(root);
    void scan(root, group);
  }
}

// --- URLs de audio: se crean al reproducir y se revocan al salir de las últimas usadas. ---

const urls = new Map<string, string>();
const KEEP_URLS = 4; // actual, siguiente precargada y la que se desvanece en el crossfade, con margen

export function trackUrl(id: string): string | undefined {
  return demoUrls.get(id) ?? urls.get(id);
}

/** Lee el archivo y devuelve su URL. Pide permiso a la carpeta si hace falta (necesita gesto del usuario). */
export async function ensureTrackUrl(id: string): Promise<string | undefined> {
  const cached = trackUrl(id);
  if (cached) {
    urls.delete(id);
    urls.set(id, cached); // más reciente al final
    return cached;
  }
  const track = byId().get(id);
  const root = track?.rootId ? roots.get(track.rootId) : undefined;
  if (!track || !root) return undefined;
  const state = await localLibrary.access(root, true);
  if (state !== access.get(root.id)) {
    access.set(root.id, state);
    publishRoots();
  }
  if (state !== "granted") return undefined;
  try {
    const url = URL.createObjectURL(await localLibrary.readFile(root, track.path));
    urls.set(id, url);
    while (urls.size > KEEP_URLS) {
      const [oldId, oldUrl] = urls.entries().next().value!;
      urls.delete(oldId);
      URL.revokeObjectURL(oldUrl);
    }
    return url;
  } catch {
    return undefined; // borrado o movido desde fuera
  }
}

// --- Acciones ---

let lastFocusScan = 0;

export const library = {
  /** Carga lo guardado. Rápido: una lectura de cada tabla, sin tocar archivos ni permisos de escritura. */
  async init() {
    const [savedRoots, savedTracks] = await Promise.all([storage.list<LibraryRoot>("roots"), storage.list<Track>("tracks")]);
    for (const root of savedRoots) roots.set(root.id, root);
    rememberCovers(savedTracks.flatMap((track) => (track.coverHash ? [track.coverHash] : [])));
    useLibrary.setState((state) => ({ tracks: [...savedTracks, ...state.tracks], ready: true }));
    publishRoots();
    window.addEventListener("pagehide", () => {
      applyPatches();
      void flush(); // lo pendiente de escribir (≤ 400 ms) no se pierde al cerrar o recargar
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastFocusScan > 60_000) library.rescanAll();
    });
    // Permisos después de pintar: queryPermission no muestra nada al usuario.
    await Promise.all(savedRoots.map(async (root) => access.set(root.id, await localLibrary.access(root))));
    publishRoots();
    // Lecturas que una recarga interrumpió: se retoman donde hay acceso.
    const interrupted = savedTracks.filter((track) => track.metadataStatus === "loading" && access.get(track.rootId ?? "") === "granted");
    if (interrupted.length > 0) {
      const jobs = await Promise.all(
        interrupted.map(async (track) => ({ id: track.id, file: await localLibrary.readFile(roots.get(track.rootId!)!, track.path).catch(() => new Blob()) })),
      );
      void readAll(jobs).then(applyPatches);
    }
  },
  get keepsFolders() {
    return localLibrary.keepsFolders;
  },
  /** Chromium: carpeta recordada. El resto usa el <input webkitdirectory> y llama a addFiles. */
  async addFolder() {
    const root = await localLibrary.pickFolder();
    if (!root) return;
    await addRoot(root);
    await scan(root);
  },
  async addFiles(files: File[]) {
    const entries = files.flatMap((file) => {
      const path = file.webkitRelativePath || file.name;
      const name = path.split("/").pop() ?? "";
      return isAudioFile(name) || isLyricsFile(name) || isFolderCover(name) ? [{ path, file }] : [];
    });
    const skipped = files.length - entries.length;
    if (entries.length === 0) {
      say(files.length > 0 ? "Ninguno de esos archivos es audio compatible." : null);
      return;
    }
    if (skipped > 0) say(`${skipped} ${skipped === 1 ? "archivo omitido: no es" : "archivos omitidos: no son"} audio compatible.`);
    await importFiles(entries);
  },
  /** Llamar de forma síncrona desde el evento drop. */
  async drop(data: DataTransfer) {
    const { folders, files } = await localLibrary.dropped(data);
    for (const root of folders) {
      await addRoot(root);
      void scan(root);
    }
    if (files.length > 0) await importFiles(files);
  },
  cancelScan() {
    generation += 1;
    scanning?.abort();
    dropPendingMetadata();
  },
  /** Re-escaneo por diferencias de una carpeta recordada. */
  async rescan(rootId: string) {
    const root = roots.get(rootId);
    if (!root || root.kind !== "folder" || access.get(rootId) !== "granted") return;
    await scan(root);
  },
  rescanAll() {
    lastFocusScan = Date.now();
    if (scanning) return;
    for (const root of roots.values()) if (root.kind === "folder" && access.get(root.id) === "granted") void scan(root);
  },
  /** Un toque: vuelve a pedir permiso a la carpeta y busca cambios. */
  async reconnect(rootId: string) {
    const root = roots.get(rootId);
    if (!root) return;
    const state = await localLibrary.access(root, true);
    access.set(rootId, state);
    publishRoots();
    if (state === "granted") await scan(root);
    else if (state === "missing") say(`«${root.name}» ya no está disponible. Quítala y vuelve a añadirla.`);
  },
  async removeRoot(rootId: string) {
    const root = roots.get(rootId);
    if (!root) return;
    if (scanning && useLibrary.getState().scan?.rootId === rootId) library.cancelScan();
    const gone = useLibrary.getState().tracks.filter((track) => track.rootId === rootId).map((track) => track.id);
    roots.delete(rootId);
    access.delete(rootId);
    useLibrary.setState((state) => ({ tracks: state.tracks.filter((track) => track.rootId !== rootId) }));
    persist([], gone);
    await Promise.all([flush(), storage.write("roots", [], [rootId]), localLibrary.forget(root)]);
    publishRoots();
  },
  space: () => localLibrary.space(),
  /** Permiso de la carpeta de una pista (para explicar por qué no suena). */
  accessFor(id: string): { access: FolderAccess; name: string } | undefined {
    const rootId = byId().get(id)?.rootId;
    const root = rootId ? roots.get(rootId) : undefined;
    return root ? { access: access.get(root.id) ?? "granted", name: root.name } : undefined;
  },
  markUnplayable(id: string) {
    patch(id, { unplayable: true }, true);
  },
  markPlayed(id: string) {
    patch(id, { playedAt: Date.now() });
  },
  dismissNotice() {
    say(null);
  },
};

// Solo en desarrollo: carga src/assets/music/. El import dinámico desaparece del build de producción,
// así que ningún archivo de audio llega a dist/ (vite.config.ts lo comprueba además).
if (import.meta.env.DEV) {
  void import("./demoCatalog.dev").then(({ demoFiles }) => {
    const tracks = demoFiles.map(({ path, url }): Track => {
      const fileName = path.split("/").pop() ?? path;
      demoUrls.set(`demo:${path}`, url);
      return { id: `demo:${path}`, path, fileName, title: titleFromFileName(fileName), artist: UNKNOWN_ARTIST, album: UNKNOWN_ALBUM, metadataStatus: "loading" };
    });
    if (tracks.length === 0) return;
    useLibrary.setState((state) => ({ tracks: [...state.tracks, ...tracks] }));
    void Promise.all(tracks.map(async (track) => ({ id: track.id, file: await (await fetch(demoUrls.get(track.id)!)).blob() }))).then(readAll);
  });
}
