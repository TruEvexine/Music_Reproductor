import { describe, expect, it } from "vitest";
import { cafeUrl } from "./support";

describe("cafeUrl", () => {
  it("sin variable, vacía o con espacios no hay botón", () => {
    expect(cafeUrl(undefined)).toBeNull();
    expect(cafeUrl("")).toBeNull();
    expect(cafeUrl("   ")).toBeNull();
  });

  it("solo https: lo demás nunca es destino de un enlace", () => {
    expect(cafeUrl("http://example.com/cafe")).toBeNull();
    expect(cafeUrl("javascript:alert(1)")).toBeNull();
    expect(cafeUrl("data:text/html,hola")).toBeNull();
    expect(cafeUrl("ftp://example.com")).toBeNull();
    expect(cafeUrl("example.com/cafe")).toBeNull();
    expect(cafeUrl("no es una url")).toBeNull();
  });

  it("acepta un https válido y lo normaliza", () => {
    expect(cafeUrl("https://example.com/cafe")).toBe("https://example.com/cafe");
    expect(cafeUrl("  https://example.com  ")).toBe("https://example.com/");
  });
});
