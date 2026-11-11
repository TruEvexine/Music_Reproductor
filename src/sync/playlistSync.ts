import { isPermanentFailure, mergeRemote, planFlush } from "../core/outbox";
import type { OutboxEntry, PlaylistOp } from "../core/outbox";
import { connectivity, storage } from "../platform";
import { playlists, usePlaylists } from "../state/playlists";
import { deleteUserPlaylist, fetchUserPlaylists, replacePlaylistTracks, upsertUserPlaylist } from "./playlistService";
import { supabaseConfigured } from "./supabaseClient";

// Envía el outbox de playlists y trae lo de la cuenta. Nunca bloquea la UI: todo ya está guardado en local.
const RETRY_MS = 30_000;
let running: Promise<void> | null = null;
let again = false;
let retry: ReturnType<typeof setTimeout> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;

function send(op: PlaylistOp): Promise<void> {
  if (op.type === "upsert") return upsertUserPlaylist(op.playlistId, op.userId, op.name);
  if (op.type === "tracks") return replacePlaylistTracks(op.playlistId, op.identifiers);
  return deleteUserPlaylist(op.playlistId);
}

/** Devuelve false si hay que reintentar más tarde (red caída o servidor con problemas). */
async function flushOutbox(user: string): Promise<boolean> {
  const entries = (await storage.list<OutboxEntry>("outbox")).filter((entry) => entry.op.userId === user);
  for (const step of planFlush(entries)) {
    try {
      await send(step.op);
    } catch (error) {
      const { status, code } = error as { status?: number; code?: string };
      if (!isPermanentFailure(status, code)) return false;
      // Permanente (permiso, dato inválido): se descarta para no bloquear el resto de la cola.
    }
    if (step.seqs.length > 0) await storage.write("outbox", [], step.seqs);
  }
  return true;
}

async function syncOnce(user: string) {
  await playlists.whenReady();
  usePlaylists.setState({ syncing: true });
  try {
    await playlists.adoptOwnerless(user);
    const sent = await flushOutbox(user);
    if (sent) {
      const remote = await fetchUserPlaylists(user);
      const left = await storage.list<OutboxEntry>("outbox");
      const pending = new Set(left.filter((entry) => entry.op.userId === user).map((entry) => entry.op.playlistId));
      // La cuenta pudo cambiar mientras se esperaba a la red: no mezclar playlists de otra.
      if (playlists.user === user) await playlists.replaceAll(mergeRemote(usePlaylists.getState().all, remote, user, pending));
    }
    const left = await storage.list<OutboxEntry>("outbox");
    usePlaylists.setState({ pending: left.length, offline: !sent });
    if (!sent) scheduleRetry();
  } catch {
    usePlaylists.setState({ offline: true });
    scheduleRetry();
  } finally {
    usePlaylists.setState({ syncing: false });
  }
}

function scheduleRetry() {
  clearTimeout(retry);
  retry = setTimeout(() => void syncNow(), RETRY_MS);
}

/** Sincroniza si hay cuenta y red; si ya hay una en curso, encadena otra al terminar. */
export function syncNow(): Promise<void> {
  const user = playlists.user;
  if (!user || !supabaseConfigured || !connectivity.isOnline()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = syncOnce(user).finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

let started = false;

/** Llamar al cambiar la sesión (id de usuario o null). */
export function setSyncUser(user: string | null) {
  playlists.setUser(user);
  if (!started) {
    started = true;
    connectivity.subscribe((online) => online && void syncNow());
    playlists.onChange(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void syncNow(), 500);
    });
  }
  void syncNow();
}
