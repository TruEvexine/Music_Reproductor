import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "./backup";
import { lineAt, lyricsFromTags, parseLrc } from "./lyrics";
import { isPermanentFailure, mergeRemote, planFlush } from "./outbox";
import type { LocalPlaylist, OutboxEntry, PlaylistOp } from "./outbox";

const entry = (seq: number, op: PlaylistOp): OutboxEntry => ({ seq, op, at: seq });

describe("outbox de playlists", () => {
  it("compacta: último nombre y últimas pistas, upsert antes que pistas", () => {
    const plan = planFlush([
      entry(1, { type: "upsert", playlistId: "p", userId: "u", name: "Uno" }),
      entry(2, { type: "tracks", playlistId: "p", userId: "u", identifiers: ["a"] }),
      entry(3, { type: "upsert", playlistId: "q", userId: "u", name: "Otra" }),
      entry(4, { type: "tracks", playlistId: "p", userId: "u", identifiers: ["a", "b"] }),
      entry(5, { type: "upsert", playlistId: "p", userId: "u", name: "Dos" }),
    ]);
    expect(plan.map((step) => step.op)).toEqual([
      { type: "upsert", playlistId: "p", userId: "u", name: "Dos" },
      { type: "tracks", playlistId: "p", userId: "u", identifiers: ["a", "b"] },
      { type: "upsert", playlistId: "q", userId: "u", name: "Otra" },
    ]);
    // Los seq se saldan con el último paso de cada playlist: si falla el de pistas, nada se da por enviado.
    expect(plan.map((step) => step.seqs)).toEqual([[], [1, 2, 4, 5], [3]]);
  });

  it("un borrado anula lo anterior de esa playlist", () => {
    const plan = planFlush([
      entry(1, { type: "upsert", playlistId: "p", userId: "u", name: "Uno" }),
      entry(2, { type: "delete", playlistId: "p", userId: "u" }),
    ]);
    expect(plan).toEqual([{ op: { type: "delete", playlistId: "p", userId: "u" }, seqs: [1, 2] }]);
  });

  it("fusiona con la nube: lo pendiente gana, lo borrado fuera desaparece, lo nuevo llega", () => {
    const local: LocalPlaylist[] = [
      { id: "pendiente", name: "Local", trackIdentifiers: ["x"], createdAt: "1", ownerId: "u" },
      { id: "sincronizada", name: "Vieja", trackIdentifiers: [], createdAt: "1", ownerId: "u" },
      { id: "borrada-fuera", name: "B", trackIdentifiers: [], createdAt: "1", ownerId: "u" },
      { id: "sin-cuenta", name: "S", trackIdentifiers: [], createdAt: "1", ownerId: null },
      { id: "de-otra-cuenta", name: "O", trackIdentifiers: [], createdAt: "1", ownerId: "otra" },
    ];
    const remote = [
      { id: "pendiente", name: "Remota", trackIdentifiers: [], createdAt: "1" },
      { id: "sincronizada", name: "Nueva", trackIdentifiers: ["y"], createdAt: "1" },
      { id: "nueva", name: "N", trackIdentifiers: [], createdAt: "2" },
    ];
    const merged = mergeRemote(local, remote, "u", new Set(["pendiente"]));
    expect(merged.map((playlist) => `${playlist.id}:${playlist.name}`)).toEqual([
      "pendiente:Local",
      "sincronizada:Nueva",
      "sin-cuenta:S",
      "de-otra-cuenta:O",
      "nueva:N",
    ]);
    expect(merged.find((playlist) => playlist.id === "nueva")?.ownerId).toBe("u");
  });

  it("errores permanentes frente a reintentables", () => {
    expect(isPermanentFailure(403, "42501")).toBe(true);
    expect(isPermanentFailure(400, undefined)).toBe(true);
    expect(isPermanentFailure(429, undefined)).toBe(false);
    expect(isPermanentFailure(503, undefined)).toBe(false);
    expect(isPermanentFailure(undefined, undefined)).toBe(false); // sin red
  });
});

describe("copia de seguridad", () => {
  it("ida y vuelta", () => {
    const backup = buildBackup([{ name: "Fiesta", trackIdentifiers: ["track:v1:a%7Cb%7Cc%7C"] }], { audio: { volume: 0.5 } }, new Date(0));
    const parsed = parseBackup(JSON.stringify(backup));
    expect("backup" in parsed && parsed.backup).toEqual(backup);
  });

  it("valida la entrada: tipo, versión y campos", () => {
    expect(parseBackup("{no es json")).toHaveProperty("error");
    expect(parseBackup(JSON.stringify({ app: "otra" }))).toHaveProperty("error");
    expect(parseBackup(JSON.stringify({ app: "reproductor", version: 99, playlists: [] }))).toHaveProperty("error");
    const parsed = parseBackup(
      JSON.stringify({
        app: "reproductor",
        version: 1,
        playlists: [
          { name: "  Buena  ", tracks: ["track:v2:abc", "track:v2:abc", "javascript:alert(1)", 42] },
          { name: "", tracks: [] },
          "basura",
        ],
        settings: { audio: "no-objeto", background: { mode: "rhythm" } },
      }),
    );
    expect("backup" in parsed && parsed.backup.playlists).toEqual([{ name: "Buena", tracks: ["track:v2:abc"] }]);
    expect("backup" in parsed && parsed.backup.settings).toEqual({ audio: undefined, background: { mode: "rhythm" } });
  });
});

describe("letras", () => {
  it("LRC con varias marcas por verso, offset y cabeceras", () => {
    const lyrics = parseLrc("[ar:Alguien]\n[offset:+500]\n[00:01.00][00:05.50]Estribillo\n[00:03.2]Verso");
    expect(lyrics?.synced).toEqual([
      { time: 0.5, text: "Estribillo" },
      { time: 2.7, text: "Verso" },
      { time: 5, text: "Estribillo" },
    ]);
  });

  it("texto sin marcas es letra sin sincronizar; vacío no es letra", () => {
    expect(parseLrc("Primera línea\nSegunda")).toEqual({ plain: "Primera línea\nSegunda" });
    expect(parseLrc("  \n")).toBeUndefined();
  });

  it("SYLT en milisegundos y USLT con LRC dentro", () => {
    expect(lyricsFromTags([{ timeStampFormat: 2, syncText: [{ text: "b", timestamp: 2000 }, { text: "a", timestamp: 1000 }] }])?.synced).toEqual([
      { time: 1, text: "a" },
      { time: 2, text: "b" },
    ]);
    expect(lyricsFromTags([{ timeStampFormat: 0, text: "[00:02.00]hola", syncText: [] }])?.synced).toEqual([{ time: 2, text: "hola" }]);
    expect(lyricsFromTags(undefined)).toBeUndefined();
  });

  it("verso actual", () => {
    const lines = [
      { time: 1, text: "a" },
      { time: 3, text: "b" },
    ];
    expect(lineAt(lines, 0.5)).toBe(-1);
    expect(lineAt(lines, 1)).toBe(0);
    expect(lineAt(lines, 10)).toBe(1);
  });
});
