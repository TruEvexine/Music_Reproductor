import { createHash, webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256 } from "./sha256";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const text = (value: string) => new TextEncoder().encode(value);
const sample = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 31 + 7) & 0xff);
const subtleHex = async (bytes: Uint8Array) => hex(new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes)));

describe("sha256 en JS puro", () => {
  it("da los vectores estándar de FIPS 180-2 (vacío, un bloque, dos bloques y un millón de «a»)", () => {
    expect(hex(sha256(text("")))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex(sha256(text("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hex(sha256(text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    expect(hex(sha256(text("a".repeat(1_000_000))))).toBe("cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
  });

  it("coincide con crypto.subtle y con el de Node en los bordes del relleno y en trozos grandes", async () => {
    // 2 MiB + 8 es justo lo que hashea track:v2 de un archivo grande (primer y último MiB más el tamaño).
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 1024 * 1024 + 1, 2 * 1024 * 1024 + 8]) {
      const bytes = sample(length);
      expect(hex(sha256(bytes)), `longitud ${length}`).toBe(await subtleHex(bytes));
      expect(hex(sha256(bytes)), `longitud ${length}`).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
  });
});
