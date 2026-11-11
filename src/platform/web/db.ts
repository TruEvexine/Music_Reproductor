import { openDB } from "idb";
import type { IDBPDatabase, IDBPTransaction } from "idb";

// Base local del usuario. La app instalada se actualiza sobre datos existentes, así que el esquema
// SOLO cambia añadiendo una migración al final de esta lista. Nunca se edita una ya publicada.
// La versión de la base es migrations.length.
type Upgrade = IDBPTransaction<unknown, string[], "versionchange">;
export type Migration = (db: IDBPDatabase, tx: Upgrade) => void | Promise<void>;

export const migrations: Migration[] = [
  // v1: clave-valor para sesión y ajustes.
  (db) => {
    db.createObjectStore("kv");
  },
  // v2 (Fase 3): biblioteca persistente, portadas deduplicadas, playlists locales y outbox de sincronización.
  (db) => {
    db.createObjectStore("tracks", { keyPath: "id" }).createIndex("rootId", "rootId");
    db.createObjectStore("roots", { keyPath: "id" });
    db.createObjectStore("covers", { keyPath: "hash" });
    db.createObjectStore("playlists", { keyPath: "id" });
    db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
  },
];

export const DB_NAME = "reproductor";

export function openDatabase(name = DB_NAME, list: Migration[] = migrations): Promise<IDBPDatabase> {
  return openDB(name, list.length, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      for (let version = oldVersion; version < list.length; version++) {
        await list[version](db, tx as unknown as Upgrade);
      }
    },
  });
}
