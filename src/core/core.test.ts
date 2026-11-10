import { describe, expect, it } from "vitest";
import { formatTime, isHiRes, matchesSearch, qualityLabel, searchKey } from "./format";
import { APP_BACKGROUND_L, contrastOfLightness, fallbackPalette, paletteFromPixels, rgbToOklch } from "./palette";
import { fileTrackId, titleFromFileName, trackV1Id } from "./track";

describe("identidad de pista", () => {
  it("track:v1 no cambia (las playlists guardadas dependen de él)", () => {
    expect(trackV1Id({ title: " Superhéroe ", artist: "Metro", album: "H&V", duration: 182.4 })).toBe(
      "track:v1:superh%C3%A9roe%7Cmetro%7Ch%26v%7C182",
    );
    expect(trackV1Id({ title: "A", artist: "B", album: "C" })).toBe("track:v1:a%7Cb%7Cc%7C");
  });

  it("el id de archivo es estable entre sesiones", () => {
    expect(fileTrackId("Cancion.FLAC", 10, 5)).toBe(fileTrackId("cancion.flac", 10, 5));
    expect(fileTrackId("a.flac", 10, 5)).not.toBe(fileTrackId("a.flac", 11, 5));
  });

  it("título de respaldo desde el nombre de archivo", () => {
    expect(titleFromFileName("01 - Tema.final.mp3")).toBe("01 - Tema.final");
  });
});

describe("formato", () => {
  it("formatTime", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(undefined)).toBe("--:--");
    expect(formatTime(Number.NaN)).toBe("--:--");
  });

  it("qualityLabel", () => {
    expect(qualityLabel({ fileName: "a.flac", lossless: true, sampleRate: 96000, bitsPerSample: 24 })).toBe("FLAC 24/96");
    expect(qualityLabel({ fileName: "a.flac", lossless: true, sampleRate: 44100, bitsPerSample: 16 })).toBe("FLAC 16/44.1");
    expect(qualityLabel({ fileName: "a.mp3", lossless: false, bitrate: 320000 })).toBe("MP3 320");
    expect(qualityLabel({ fileName: "a.m4a", lossless: true, sampleRate: 48000, bitsPerSample: 24 })).toBe("ALAC 24/48");
    expect(qualityLabel({ fileName: "a.ogg", codec: "Opus", bitrate: 128000 })).toBe("OPUS 128");
    expect(qualityLabel({ fileName: "a.wav" })).toBe("WAV");
  });

  it("isHiRes", () => {
    expect(isHiRes({ lossless: true, sampleRate: 96000, bitsPerSample: 24 })).toBe(true);
    expect(isHiRes({ lossless: true, sampleRate: 44100, bitsPerSample: 16 })).toBe(false);
    expect(isHiRes({ lossless: false, sampleRate: 96000 })).toBe(false);
  });

  it("búsqueda sin acentos ni mayúsculas", () => {
    expect(searchKey("  Ñandú ELÉCTRICO ")).toBe("nandu electrico");
    const track = { title: "Canción", artist: "Ñandú Eléctrico", album: "Ondas" };
    expect(matchesSearch(track, "nandu")).toBe(true);
    expect(matchesSearch(track, "CANCION")).toBe(true);
    expect(matchesSearch(track, "jazz")).toBe(false);
    expect(matchesSearch(track, "  ")).toBe(true);
  });
});

describe("paleta", () => {
  const solid = (r: number, g: number, b: number) => Array.from({ length: 64 }, () => [r, g, b, 255]).flat();
  const lightness = (color: string) => Number(color.match(/oklch\(([\d.]+)/)?.[1]);

  it("conversión a OKLCH", () => {
    expect(rgbToOklch(255, 255, 255).l).toBeCloseTo(1, 2);
    expect(rgbToOklch(0, 0, 0).l).toBeCloseTo(0, 2);
    expect(rgbToOklch(255, 0, 0).h).toBeCloseTo(29.2, 0);
  });

  it("portadas grises, negras o transparentes usan la paleta de respaldo", () => {
    expect(paletteFromPixels(solid(128, 128, 128))).toEqual(fallbackPalette);
    expect(paletteFromPixels(solid(0, 0, 0))).toEqual(fallbackPalette);
    expect(paletteFromPixels([255, 0, 0, 0])).toEqual(fallbackPalette);
  });

  it("cualquier color da un acento con contraste ≥ 4.5:1 y un ambiente oscuro", () => {
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [20, 10, 40], [250, 240, 200], [194, 65, 12]];
    for (const [r, g, b] of colors) {
      const palette = paletteFromPixels(solid(r, g, b));
      expect(contrastOfLightness(lightness(palette.accent), APP_BACKGROUND_L)).toBeGreaterThanOrEqual(4.5);
      expect(contrastOfLightness(lightness(palette.accent), lightness(palette.onAccent))).toBeGreaterThanOrEqual(4.5);
      expect(lightness(palette.glow)).toBeLessThan(0.4);
    }
  });

  it("conserva el tono dominante", () => {
    const hue = Number(paletteFromPixels(solid(30, 60, 220)).accent.match(/([\d.]+)\)$/)?.[1]);
    expect(hue).toBeGreaterThan(240);
    expect(hue).toBeLessThan(290);
  });
});
