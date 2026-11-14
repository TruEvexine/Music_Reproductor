import { describe, expect, it } from "vitest";
import { formatBytes, maskEmail } from "./format";

describe("formatBytes", () => {
  it("usa la unidad que toca, con decimales solo desde GB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(84 * 1024 * 1024)).toBe("84 MB");
    expect(formatBytes(12.4 * 1024 ** 3)).toBe("12,4 GB");
  });
});

describe("maskEmail", () => {
  it("deja la primera letra y el dominio", () => {
    expect(maskEmail("ana@correo.com")).toBe("a…@correo.com");
    expect(maskEmail("sin-arroba")).toBe("sin-arroba");
  });
});
