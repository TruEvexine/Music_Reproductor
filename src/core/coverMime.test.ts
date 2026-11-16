import { describe, expect, it } from "vitest";
import { safeCoverMime, sniffImageType } from "./coverMime";

describe("safeCoverMime", () => {
  it("acepta los cuatro formatos de mapa de bits", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(safeCoverMime(type)).toBe(type);
    }
  });

  it("normaliza variantes habituales en tags", () => {
    expect(safeCoverMime("image/jpg")).toBe("image/jpeg");
    expect(safeCoverMime(" IMAGE/PNG ")).toBe("image/png");
    expect(safeCoverMime("image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(safeCoverMime("JPG")).toBe("image/jpeg");
  });

  it("descarta tipos que pueden ejecutar código o no son imagen", () => {
    for (const type of ["image/svg+xml", "text/html", "application/javascript", "", undefined, "image/x-evil"]) {
      expect(safeCoverMime(type)).toBeUndefined();
    }
  });
});

describe("sniffImageType (carátula elegida)", () => {
  const bytes = (...values: (number | string)[]) => new Uint8Array(values.flatMap((value) => (typeof value === "string" ? [...value].map((c) => c.charCodeAt(0)) : [value])));
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
  });
  it("rechaza lo demás aunque se llame .jpg: SVG, HTML, GIF, RIFF que no es WebP, vacío", () => {
    expect(sniffImageType(bytes("<svg xmlns"))).toBeUndefined();
    expect(sniffImageType(bytes("<!doctype html>"))).toBeUndefined();
    expect(sniffImageType(bytes("GIF89a"))).toBeUndefined();
    expect(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeUndefined();
    expect(sniffImageType(new Uint8Array())).toBeUndefined();
  });
});
