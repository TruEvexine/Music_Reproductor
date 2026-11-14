import { describe, expect, it } from "vitest";
import { checkAvatar, MAX_AVATAR_BYTES, MAX_NAME, sanitizeName, squareCrop } from "./profile";

describe("nombre del perfil", () => {
  it("junta espacios, recorta los extremos y vacío significa sin nombre", () => {
    expect(sanitizeName("  Ana   María \n")).toBe("Ana María");
    expect(sanitizeName("   ")).toBe("");
    expect(sanitizeName(undefined)).toBe("");
    expect(sanitizeName(42)).toBe("");
  });

  it("llega a 60 caracteres y no parte un emoji por la mitad", () => {
    expect([...sanitizeName("a".repeat(100))]).toHaveLength(MAX_NAME);
    const name = sanitizeName(`${"a".repeat(MAX_NAME - 1)}🎵🎵`);
    expect([...name]).toHaveLength(MAX_NAME);
    expect(name.endsWith("🎵")).toBe(true);
  });
});

describe("foto del perfil", () => {
  it("solo mapas de bits de hasta 12 MB", () => {
    expect(checkAvatar({ type: "image/jpeg", size: 1000 })).toBe("ok");
    expect(checkAvatar({ type: "image/png", size: MAX_AVATAR_BYTES })).toBe("ok");
    expect(checkAvatar({ type: "image/png", size: MAX_AVATAR_BYTES + 1 })).toBe("size");
    expect(checkAvatar({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(checkAvatar({ type: "text/html", size: 10 })).toBe("type");
    expect(checkAvatar({ type: "", size: 10 })).toBe("type");
  });

  it("recorta el cuadrado central, también en vertical", () => {
    expect(squareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, side: 800 });
    expect(squareCrop(600, 900)).toEqual({ sx: 0, sy: 150, side: 600 });
    expect(squareCrop(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 });
  });
});
