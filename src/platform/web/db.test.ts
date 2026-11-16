import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { clearDatabase, migrations, openDatabase } from "./db";
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

  it("v2 → v3 mueve las letras de cada pista a su almacén y marca hasLyrics, sin perder ninguna", async () => {
    const v2 = await openDatabase("test-v3", migrations.slice(0, 2));
    const lyrics = { synced: [{ time: 1.5, text: "verso" }] };
    await v2.put("tracks", { id: "a", title: "Con letra", lyrics });
    await v2.put("tracks", { id: "b", title: "Sin letra" });
    await v2.put("tracks", { id: "c", title: "Letra plana", lyrics: { plain: "hola" } });
    v2.close();
    const v3 = await openDatabase("test-v3", migrations.slice(0, 3));
    expect(v3.version).toBe(3);
    expect(await v3.get("tracks", "a")).toEqual({ id: "a", title: "Con letra", hasLyrics: true });
    expect(await v3.get("tracks", "b")).toEqual({ id: "b", title: "Sin letra" });
    expect(await v3.get("lyrics", "a")).toEqual({ id: "a", lyrics });
    expect(await v3.get("lyrics", "c")).toEqual({ id: "c", lyrics: { plain: "hola" } });
    expect(await v3.count("lyrics")).toBe(2);
    v3.close();
  });

  it("v3 interrumpida a mitad: no se pierde nada, se reintenta, termina y no quedan letras duplicadas ni huérfanas", async () => {
    const v2 = await openDatabase("test-v3-corte", migrations.slice(0, 2));
    for (const id of ["a", "b", "c", "d"]) await v2.put("tracks", { id, title: id, lyrics: { plain: `letra ${id}` } });
    await v2.put("tracks", { id: "e", title: "Sin letra" });
    v2.close();

    // La migración real, con un corte (abort) justo después de la segunda letra movida.
    const cortada: Migration = async (db, tx) => {
      let moved = 0;
      tx.done.catch(() => {}); // idb deja `done` sin atender al abortar; sin esto Vitest lo da por error no capturado
      const store = (name: string) => {
        const real = tx.objectStore(name);
        const put = async (value: unknown) => {
          const key = await real.put(value);
          if (++moved === 2) tx.abort();
          return key;
        };
        return name !== "lyrics" ? real : new Proxy(real, { get: (target, prop) => (prop === "put" ? put : Reflect.get(target, prop)) });
      };
      const spy = new Proxy(tx, { get: (target, prop) => (prop === "objectStore" ? store : Reflect.get(target, prop)) }) as typeof tx;
      await Promise.resolve(migrations[2](db, spy)).catch(() => {}); // tras el abort, las escrituras siguientes fallan: es lo esperado
    };
    await expect(openDatabase("test-v3-corte", [...migrations.slice(0, 2), cortada])).rejects.toThrow();

    // Tras el corte la base sigue en v2 y con todas las letras en su sitio.
    const raw = await openDatabase("test-v3-corte", migrations.slice(0, 2));
    expect(raw.version).toBe(2);
    expect([...raw.objectStoreNames]).not.toContain("lyrics");
    expect((await raw.getAll("tracks")).filter((track) => track.lyrics).length).toBe(4);
    raw.close();

    const v3 = await openDatabase("test-v3-corte", migrations.slice(0, 3));
    expect(v3.version).toBe(3);
    const tracks = await v3.getAll("tracks");
    expect(tracks.map((track) => track.id).sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(tracks.some((track) => "lyrics" in track)).toBe(false);
    const lyricIds = (await v3.getAllKeys("lyrics")).sort();
    expect(lyricIds).toEqual(["a", "b", "c", "d"]);
    for (const id of lyricIds) expect(await v3.get("lyrics", id)).toEqual({ id, lyrics: { plain: `letra ${id}` } });
    expect(tracks.filter((track) => track.hasLyrics).map((track) => track.id).sort()).toEqual(lyricIds);
    v3.close();
  });

  it("v3 → v4 añade el almacén de ediciones sin tocar pistas, letras ni portadas", async () => {
    const v3 = await openDatabase("test-v4", migrations.slice(0, 3));
    await v3.put("tracks", { id: "r:a.flac", title: "Original", hasLyrics: true });
    await v3.put("lyrics", { id: "r:a.flac", lyrics: { plain: "hola" } });
    await v3.put("covers", { hash: "h1" });
    v3.close();
    const v4 = await openDatabase("test-v4");
    expect(v4.version).toBe(4);
    expect(await v4.count("edits")).toBe(0);
    expect(await v4.get("tracks", "r:a.flac")).toEqual({ id: "r:a.flac", title: "Original", hasLyrics: true });
    expect(await v4.get("lyrics", "r:a.flac")).toEqual({ id: "r:a.flac", lyrics: { plain: "hola" } });
    await v4.put("edits", { id: "r:a.flac", title: "Editado" });
    expect(await v4.get("edits", "r:a.flac")).toEqual({ id: "r:a.flac", title: "Editado" });
    v4.close();
  });

  it("v4 interrumpida: la base sigue en v3 con todo, se reintenta y termina", async () => {
    const v3 = await openDatabase("test-v4-corte", migrations.slice(0, 3));
    for (const id of ["a", "b", "c"]) await v3.put("tracks", { id, title: id });
    await v3.put("lyrics", { id: "a", lyrics: { plain: "letra" } });
    v3.close();

    // La migración real y un corte (abort) justo después de crear el almacén, antes de que la transacción termine.
    const cortada: Migration = async (db, tx) => {
      tx.done.catch(() => {}); // idb deja `done` sin atender al abortar; sin esto Vitest lo da por error no capturado
      await migrations[3](db, tx);
      tx.abort();
    };
    await expect(openDatabase("test-v4-corte", [...migrations.slice(0, 3), cortada])).rejects.toThrow();

    const raw = await openDatabase("test-v4-corte", migrations.slice(0, 3));
    expect(raw.version).toBe(3);
    expect([...raw.objectStoreNames]).not.toContain("edits");
    expect((await raw.getAllKeys("tracks")).sort()).toEqual(["a", "b", "c"]);
    raw.close();

    const v4 = await openDatabase("test-v4-corte");
    expect(v4.version).toBe(4);
    expect([...v4.objectStoreNames]).toContain("edits");
    expect((await v4.getAll("tracks")).map((track) => track.title).sort()).toEqual(["a", "b", "c"]);
    expect(await v4.get("lyrics", "a")).toEqual({ id: "a", lyrics: { plain: "letra" } });
    v4.close();
  });

  it("clearDatabase vacía todos los almacenes y conserva el esquema", async () => {
    const db = await openDatabase("test-clear");
    await db.put("kv", { volume: 0.5 }, "settings");
    await db.put("tracks", { id: "a", rootId: "r" });
    await db.put("playlists", { id: "p" });
    await db.add("outbox", { op: 1 });
    await db.put("edits", { id: "a", title: "Editado" });
    await clearDatabase(db);
    for (const name of ["kv", "tracks", "playlists", "outbox", "roots", "covers", "lyrics", "edits"]) expect(await db.count(name)).toBe(0);
    expect(db.version).toBe(migrations.length);
    db.close();
  });
});
