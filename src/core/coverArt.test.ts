import { describe, expect, it } from "vitest";
import { barsOf, BARS, coverSeed, hash32, hueOf, MIN_BAR, trackCoverSeed } from "./coverArt";
import { UNKNOWN_ALBUM } from "./track";

const songs = Array.from({ length: 2000 }, (_, i) => coverSeed(`Canción ${i * 7919}`, `Artista ${i % 83}`));

describe("funda sin carátula", () => {
  it("es determinista: la misma semilla da siempre el mismo motivo y el mismo tono", () => {
    const seed = coverSeed("Marea de Fase", "Los Osciladores");
    expect(barsOf(seed)).toEqual(barsOf(seed));
    expect(hueOf(seed)).toBe(hueOf(seed));
    expect(hash32("a")).toBe(hash32("a"));
  });

  it("ignora mayúsculas, espacios de más y la forma Unicode del texto; título y artista cuentan por separado", () => {
    expect(coverSeed("  Marea   de Fase ", "LOS osciladores")).toBe(coverSeed("marea de fase", "Los Osciladores"));
    expect(coverSeed("Café", "X")).toBe(coverSeed("Café", "X")); // é compuesta y e + acento
    expect(coverSeed("ab", "c")).not.toBe(coverSeed("a", "bc"));
  });

  it("estable por álbum: todas las pistas de un álbum comparten funda; sin álbum, cada pista suelta tiene la suya", () => {
    const a = { title: "Uno", artist: "Ana", album: "Frecuencias" };
    const b = { title: "Dos", artist: "Ana", album: "FRECUENCIAS" };
    expect(trackCoverSeed(a)).toBe(trackCoverSeed(b));
    expect(trackCoverSeed({ ...a, artist: "Invitada", albumArtist: "Ana" })).toBe(trackCoverSeed(a)); // el artista del álbum manda, como en Álbumes
    expect(trackCoverSeed({ ...a, album: "Otro" })).not.toBe(trackCoverSeed(a));
    const loose = (title: string) => trackCoverSeed({ title, artist: "Ana", album: UNKNOWN_ALBUM });
    expect(loose("Uno")).not.toBe(loose("Dos"));
    expect(loose("Uno")).toBe(coverSeed("Uno", "Ana"));
  });

  it("el motivo son 9 barras entre el mínimo y el alto completo, con al menos una completa", () => {
    for (const seed of songs) {
      const bars = barsOf(seed);
      expect(bars).toHaveLength(BARS);
      for (const bar of bars) {
        expect(bar).toBeGreaterThanOrEqual(MIN_BAR);
        expect(bar).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...bars)).toBe(1);
    }
  });

  it("dos semillas distintas casi nunca comparten motivo (2 000 canciones)", () => {
    expect(new Set(songs.map((seed) => barsOf(seed).join())).size).toBeGreaterThan(songs.length * 0.999);
  });

  it("el tono está en 0–359 y repartido por todo el círculo", () => {
    expect(new Set(songs.map((seed) => Math.floor(hueOf(seed) / 30))).size).toBe(12);
    for (const seed of songs.slice(0, 200)) {
      expect(hueOf(seed)).toBeGreaterThanOrEqual(0);
      expect(hueOf(seed)).toBeLessThan(360);
    }
  });
});
