import { describe, expect, it } from "vitest";
import { artBackground, artOf, coverSeed, hash32, hueOf, initialOf, LAYOUTS, TONE_LIMITS } from "./coverArt";

const songs = Array.from({ length: 2000 }, (_, i) => coverSeed(`Canción ${i * 7919}`, `Artista ${i % 83}`));

describe("portada generativa", () => {
  it("es determinista: la misma canción da siempre la misma portada", () => {
    const seed = coverSeed("Marea de Fase", "Los Osciladores");
    expect(artBackground(artOf(seed), true)).toBe(artBackground(artOf(seed), true));
    expect(artBackground(artOf(seed))).toBe(artBackground(artOf(coverSeed("Marea de Fase", "Los Osciladores"))));
    expect(hash32("a")).toBe(hash32("a"));
  });

  it("ignora mayúsculas, espacios de más y la forma Unicode del texto", () => {
    expect(coverSeed("  Marea   de Fase ", "LOS osciladores")).toBe(coverSeed("marea de fase", "Los Osciladores"));
    expect(coverSeed("Café", "X")).toBe(coverSeed("Café", "X")); // é compuesta y e + acento
  });

  it("título y artista cuentan por separado (no se confunden al juntarlos)", () => {
    expect(coverSeed("ab", "c")).not.toBe(coverSeed("a", "bc"));
  });

  it("dos canciones distintas casi nunca comparten portada (2 000 canciones)", () => {
    const unique = new Set(songs.map((seed) => artBackground(artOf(seed))));
    expect(unique.size).toBeGreaterThan(songs.length * 0.995);
  });

  it("aparecen las tres composiciones, repartidas con cierta igualdad", () => {
    const counts = new Map<number, number>();
    for (const seed of songs) counts.set(Math.floor(artOf(seed).spots[0] * LAYOUTS), (counts.get(Math.floor(artOf(seed).spots[0] * LAYOUTS)) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([0, 1, 2]);
    for (const n of counts.values()) expect(n).toBeGreaterThan(songs.length / LAYOUTS / 2);
  });

  it("los tonos respetan los rangos del sistema de diseño: croma del acento y nada más oscuro que las superficies", () => {
    for (const seed of songs) {
      for (const { l, c, h } of artOf(seed).tones) {
        expect(l).toBeGreaterThanOrEqual(TONE_LIMITS.l[0]);
        expect(l).toBeLessThanOrEqual(TONE_LIMITS.l[1]);
        expect(c).toBeGreaterThanOrEqual(TONE_LIMITS.c[0]);
        expect(c).toBeLessThanOrEqual(TONE_LIMITS.c[1]);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });

  it("el tono claro siempre es más claro que el profundo (hay contraste interno)", () => {
    for (const seed of songs) {
      const [light, , deep] = artOf(seed).tones;
      expect(light.l - deep.l).toBeGreaterThan(0.3);
    }
  });

  it("el CSS es válido en lo esencial: paréntesis equilibrados, sin NaN, cada bloque dentro de la portada y la rica añade una capa", () => {
    for (const seed of songs.slice(0, 500)) {
      const plain = artBackground(artOf(seed));
      const rich = artBackground(artOf(seed), true);
      for (const css of [plain, rich]) {
        expect(css).not.toMatch(/NaN|undefined|Infinity/);
        expect((css.match(/\(/g) ?? []).length).toBe((css.match(/\)/g) ?? []).length);
        for (const [, size] of css.matchAll(/\/ ([\d.]+)% ([\d.]+)% no-repeat/g)) expect(Number(size)).toBeLessThanOrEqual(100);
        for (const [, left, top] of css.matchAll(/\) ([\d.]+)% ([\d.]+)% \//g)) {
          expect(Number(left)).toBeGreaterThanOrEqual(0);
          expect(Number(left)).toBeLessThanOrEqual(100);
          expect(Number(top)).toBeGreaterThanOrEqual(0);
          expect(Number(top)).toBeLessThanOrEqual(100);
        }
      }
      expect(rich.split("no-repeat").length).toBe(plain.split("no-repeat").length + 1);
    }
  });
});

describe("portada plana (propuestas inicial, nota y tarjeta)", () => {
  it("el tono sale del título: estable, en 0–359 y repartido por todo el círculo", () => {
    expect(hueOf(coverSeed("Marea de Fase", "X"))).toBe(hueOf(coverSeed("  marea DE fase ", "x")));
    const buckets = new Set(songs.map((seed) => Math.floor(hueOf(seed) / 30)));
    expect(buckets.size).toBe(12);
    for (const seed of songs.slice(0, 200)) {
      expect(hueOf(seed)).toBeGreaterThanOrEqual(0);
      expect(hueOf(seed)).toBeLessThan(360);
    }
  });

  it("la inicial es la primera letra o cifra, en mayúscula y sin perder el acento", () => {
    expect(initialOf("amanecer")).toBe("A");
    expect(initialOf("  ñandú")).toBe("Ñ");
    expect(initialOf("¿Qué?")).toBe("Q");
    expect(initialOf("(2019) Sol")).toBe("2");
    expect(initialOf("日本の歌")).toBe("日");
    expect(initialOf("🎵 mix")).toBe("M");
    expect(initialOf("***")).toBe("*");
    expect(initialOf("")).toBe("\u266a");
  });
});
