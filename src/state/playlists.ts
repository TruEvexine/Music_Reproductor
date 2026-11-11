import { create } from "zustand";
import type { LocalPlaylist, OutboxEntry, PlaylistOp } from "../core/outbox";
import { storage } from "../platform";

// Playlists locales primero: todo cambio se guarda en IndexedDB y funciona sin cuenta ni red. Si la playlist es
// de una cuenta, además se anota en el outbox; src/sync/playlistSync.ts lo envía cuando hay sesión y conexión.

interface PlaylistsState {
  all: LocalPlaylist[];
  ready: boolean;
  /** Operaciones sin enviar a la nube. */
  pending: number;
  syncing: boolean;
  /** La última sincronización falló por la red: se reintentará sola. */
  offline: boolean;
}

export const usePlaylists = create<PlaylistsState>(() => ({ all: [], ready: false, pending: 0, syncing: false, offline: false }));

let userId: string | null = null;
let markReady: () => void;
const loaded = new Promise<void>((resolve) => (markReady = resolve));
const listeners = new Set<() => void>();

export const MAX_PLAYLIST_TRACKS = 5000;
const byCreation = (a: LocalPlaylist, b: LocalPlaylist) => a.createdAt.localeCompare(b.createdAt);

/** Las de la cuenta abierta y las creadas sin cuenta. Las de otra cuenta en este dispositivo no se muestran. */
export function visiblePlaylists(all: LocalPlaylist[], user: string | null): LocalPlaylist[] {
  return all.filter((playlist) => playlist.ownerId === null || playlist.ownerId === user).sort(byCreation);
}

async function save(next: LocalPlaylist[], changed: LocalPlaylist[], removed: string[] = []) {
  usePlaylists.setState({ all: next });
  await storage.write("playlists", changed, removed);
}

async function enqueue(ops: PlaylistOp[]) {
  if (ops.length === 0) return;
  for (const op of ops) await storage.append("outbox", { op, at: Date.now() } satisfies Omit<OutboxEntry, "seq">);
  usePlaylists.setState((state) => ({ pending: state.pending + ops.length }));
  for (const listener of listeners) listener();
}

function find(id: string) {
  return usePlaylists.getState().all.find((playlist) => playlist.id === id);
}

async function setTracks(id: string, identifiers: string[]) {
  const playlist = find(id);
  if (!playlist) return;
  const updated = { ...playlist, trackIdentifiers: identifiers.slice(0, MAX_PLAYLIST_TRACKS) };
  await save(usePlaylists.getState().all.map((item) => (item.id === id ? updated : item)), [updated]);
  if (updated.ownerId) await enqueue([{ type: "tracks", playlistId: id, userId: updated.ownerId, identifiers: updated.trackIdentifiers }]);
}

export const playlists = {
  async init() {
    const [all, outbox] = await Promise.all([storage.list<LocalPlaylist>("playlists"), storage.list<OutboxEntry>("outbox")]);
    usePlaylists.setState({ all, pending: outbox.length, ready: true });
    markReady();
  },
  /** La sincronización espera a lo guardado: mezclar con una lista aún vacía borraría playlists locales. */
  whenReady: () => loaded,
  /** Lo llama la sincronización al cambiar de cuenta. */
  setUser(id: string | null) {
    userId = id;
  },
  get user() {
    return userId;
  },
  onChange(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async create(name: string): Promise<string> {
    const playlist: LocalPlaylist = { id: crypto.randomUUID(), name: name.trim().slice(0, 120), trackIdentifiers: [], createdAt: new Date().toISOString(), ownerId: userId };
    await save([...usePlaylists.getState().all, playlist], [playlist]);
    if (userId) await enqueue([{ type: "upsert", playlistId: playlist.id, userId, name: playlist.name }]);
    return playlist.id;
  },
  async rename(id: string, name: string) {
    const playlist = find(id);
    if (!playlist) return;
    const updated = { ...playlist, name: name.trim().slice(0, 120) };
    await save(usePlaylists.getState().all.map((item) => (item.id === id ? updated : item)), [updated]);
    if (updated.ownerId) await enqueue([{ type: "upsert", playlistId: id, userId: updated.ownerId, name: updated.name }]);
  },
  async remove(id: string) {
    const playlist = find(id);
    if (!playlist) return;
    await save(usePlaylists.getState().all.filter((item) => item.id !== id), [], [id]);
    if (playlist.ownerId) await enqueue([{ type: "delete", playlistId: id, userId: playlist.ownerId }]);
  },
  async add(id: string, identifier: string) {
    const playlist = find(id);
    if (playlist && !playlist.trackIdentifiers.includes(identifier)) await setTracks(id, [...playlist.trackIdentifiers, identifier]);
  },
  async removeTrack(id: string, identifier: string) {
    const playlist = find(id);
    if (playlist) await setTracks(id, playlist.trackIdentifiers.filter((item) => item !== identifier));
  },
  async move(id: string, identifier: string, direction: -1 | 1) {
    const playlist = find(id);
    if (!playlist) return;
    const list = [...playlist.trackIdentifiers];
    const from = list.indexOf(identifier);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    await setTracks(id, list);
  },
  /** Copia de seguridad importada: entran como playlists nuevas (nunca sustituyen a las existentes). */
  async importMany(items: { name: string; tracks: string[] }[]) {
    for (const item of items) {
      const id = await playlists.create(item.name);
      if (item.tracks.length > 0) await setTracks(id, item.tracks);
    }
  },
  // --- Para la sincronización ---
  async replaceAll(next: LocalPlaylist[]) {
    const removed = usePlaylists.getState().all.filter((item) => !next.some((playlist) => playlist.id === item.id)).map((item) => item.id);
    await save(next, next, removed);
  },
  async adoptOwnerless(owner: string) {
    const orphans = usePlaylists.getState().all.filter((playlist) => playlist.ownerId === null);
    if (orphans.length === 0) return;
    const adopted = orphans.map((playlist) => ({ ...playlist, ownerId: owner }));
    await save(usePlaylists.getState().all.map((item) => adopted.find((playlist) => playlist.id === item.id) ?? item), adopted);
    await enqueue(
      adopted.flatMap((playlist): PlaylistOp[] => [
        { type: "upsert", playlistId: playlist.id, userId: owner, name: playlist.name },
        ...(playlist.trackIdentifiers.length > 0 ? [{ type: "tracks" as const, playlistId: playlist.id, userId: owner, identifiers: playlist.trackIdentifiers }] : []),
      ]),
    );
  },
};
