import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { migrations, openDatabase } from "./db";
import type { Migration } from "./db";

describe("esquema local versionado", () => {
  it("crea la base en la última versión", async () => {
    const db = await openDatabase("test-nueva");
    expect(db.version).toBe(migrations.length);
    expect([...db.objectStoreNames]).toContain("kv");
    db.close();
  });

  it("actualiza sobre datos existentes sin perderlos", async () => {
    const v1 = await openDatabase("test-migracion", migrations.slice(0, 1));
    await v1.put("kv", { volume: 0.5 }, "settings");
    v1.close();

    // Simula una versión futura de la app: nuevo almacén y transformación de un dato existente.
    const future: Migration[] = [
      ...migrations.slice(0, 1),
      async (db, tx) => {
        db.createObjectStore("tracks", { keyPath: "id" });
        const store = tx.objectStore("kv");
        const settings = (await store.get("settings")) as { volume: number };
        await store.put({ ...settings, shuffle: false }, "settings");
      },
    ];
    const v2 = await openDatabase("test-migracion", future);
    expect(v2.version).toBe(2);
    expect(await v2.get("kv", "settings")).toEqual({ volume: 0.5, shuffle: false });
    expect([...v2.objectStoreNames]).toEqual(["kv", "tracks"]);
    v2.close();
  });

  it("v1 → v2 conserva la sesión y crea la biblioteca", async () => {
    const v1 = await openDatabase("test-v2", migrations.slice(0, 1));
    await v1.put("kv", { position: 12 }, "session");
    v1.close();
    const v2 = await openDatabase("test-v2", migrations.slice(0, 2));
    expect(await v2.get("kv", "session")).toEqual({ position: 12 });
    expect([...v2.objectStoreNames].sort()).toEqual(["covers", "kv", "outbox", "playlists", "roots", "tracks"]);
    await v2.put("tracks", { id: "a", rootId: "r" });
    expect(await v2.getAllFromIndex("tracks", "rootId", "r")).toEqual([{ id: "a", rootId: "r" }]);
    expect(await v2.add("outbox", { op: 1 })).toBe(1);
    v2.close();
  });
});
