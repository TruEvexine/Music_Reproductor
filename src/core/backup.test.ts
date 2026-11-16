import { describe, expect, it } from "vitest";
import { buildAccountExport, parseBackup } from "./backup";

describe("datos de la cuenta", () => {
  const profile = { displayName: "Ana", createdAt: "2026-01-02T03:04:05Z" };
  const playlists = [
    { name: "Viaje", trackIdentifiers: ["track:v1:a%7Cb", "track:v2:abc123"] },
    { name: "Vacía", trackIdentifiers: [] },
  ];

  it("lleva el perfil, las playlists y el tipo de archivo", () => {
    const data = buildAccountExport(profile, playlists, new Date("2026-11-13T10:00:00Z"));
    expect(data).toMatchObject({ app: "reproductor", kind: "account", version: 1, exportedAt: "2026-11-13T10:00:00.000Z" });
    expect(data.profile).toEqual({ display_name: "Ana", created_at: "2026-01-02T03:04:05Z" });
    expect(data.playlists).toEqual([
      { name: "Viaje", tracks: ["track:v1:a%7Cb", "track:v2:abc123"] },
      { name: "Vacía", tracks: [] },
    ]);
  });

  it("se puede importar como copia de seguridad (mismas playlists)", () => {
    const parsed = parseBackup(JSON.stringify(buildAccountExport(profile, playlists)));
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.backup.playlists).toEqual([
      { name: "Viaje", tracks: ["track:v1:a%7Cb", "track:v2:abc123"] },
      { name: "Vacía", tracks: [] },
    ]);
  });

  it("sin nombre ni fecha en el perfil no inventa nada", () => {
    expect(buildAccountExport({ displayName: null, createdAt: null }, []).profile).toEqual({ display_name: null, created_at: null });
  });
});
