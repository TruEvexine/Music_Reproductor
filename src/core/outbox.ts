// Playlists locales primero y outbox de operaciones pendientes con la nube. Puro: la red vive en src/sync.
// Regla de conflicto: un cambio local pendiente gana (se envía después); sin pendientes, manda lo remoto.

export interface LocalPlaylist {
  id: string;
  name: string;
  /** Identidades de pista en orden (track:v1, o track:v2 si se añadió así). */
  trackIdentifiers: string[];
  createdAt: string;
  /** Cuenta dueña. null = creada sin cuenta: se adopta al iniciar sesión. */
  ownerId: string | null;
}

export type PlaylistOp =
  | { type: "upsert"; playlistId: string; userId: string; name: string }
  | { type: "tracks"; playlistId: string; userId: string; identifiers: string[] }
  | { type: "delete"; playlistId: string; userId: string };

export interface OutboxEntry {
  seq: number;
  op: PlaylistOp;
  at: number;
}

/**
 * Compacta la cola antes de enviarla: por playlist basta su último nombre y su última lista de pistas,
 * y un borrado anula todo lo anterior. Mantiene el orden de llegada entre playlists y el upsert antes que las pistas
 * (la fila padre debe existir). Cada paso lleva los `seq` que salda.
 */
export function planFlush(entries: OutboxEntry[]): { op: PlaylistOp; seqs: number[] }[] {
  const byPlaylist = new Map<string, OutboxEntry[]>();
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    const key = `${entry.op.userId}\u0000${entry.op.playlistId}`;
    byPlaylist.set(key, [...(byPlaylist.get(key) ?? []), entry]);
  }
  const plan: { op: PlaylistOp; seqs: number[] }[] = [];
  for (const group of byPlaylist.values()) {
    const seqs = group.map((entry) => entry.seq);
    const last = (type: PlaylistOp["type"]) => [...group].reverse().find((entry) => entry.op.type === type);
    const deleted = last("delete");
    if (deleted) {
      plan.push({ op: deleted.op, seqs });
      continue;
    }
    const upsert = last("upsert");
    const tracks = last("tracks");
    const steps = [upsert, tracks].filter((entry): entry is OutboxEntry => entry !== undefined);
    steps.forEach((entry, index) => plan.push({ op: entry.op, seqs: index === steps.length - 1 ? seqs : [] }));
  }
  return plan;
}

export interface RemotePlaylist {
  id: string;
  name: string;
  createdAt: string;
  trackIdentifiers: string[];
}

/** Combina lo descargado de la cuenta con lo local. `pending` = playlists con operaciones sin enviar. */
export function mergeRemote(local: LocalPlaylist[], remote: RemotePlaylist[], userId: string, pending: Set<string>): LocalPlaylist[] {
  const remoteById = new Map(remote.map((playlist) => [playlist.id, playlist]));
  const merged: LocalPlaylist[] = [];
  for (const playlist of local) {
    if (playlist.ownerId !== userId || pending.has(playlist.id)) {
      merged.push(playlist);
      continue;
    }
    const fresh = remoteById.get(playlist.id);
    if (fresh) merged.push({ ...fresh, ownerId: userId }); // si no está en la nube, se borró desde otro dispositivo
  }
  const known = new Set(local.map((playlist) => playlist.id));
  for (const playlist of remote) if (!known.has(playlist.id)) merged.push({ ...playlist, ownerId: userId });
  return merged;
}

/** Errores que no se arreglan reintentando (permiso, datos inválidos): la operación se descarta para no bloquear la cola. */
export function isPermanentFailure(status: number | undefined, code: string | undefined): boolean {
  if (code === "42501" || code === "23514" || code === "22001" || code === "23503") return true;
  return status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
}
