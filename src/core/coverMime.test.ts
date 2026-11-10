import { describe, expect, it } from "vitest";
import { safeCoverMime } from "./coverMime";

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
