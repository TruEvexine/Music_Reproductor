import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { newId } from "./id";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sin contexto seguro (no hay crypto.randomUUID) sigue dando UUID v4 distintos", () => {
    vi.stubGlobal("crypto", { getRandomValues: <T extends Uint8Array>(bytes: T) => webcrypto.getRandomValues(bytes) });
    const ids = Array.from({ length: 200 }, newId);
    expect(ids.every((id) => uuidV4.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("con contexto seguro usa crypto.randomUUID", () => {
    expect(newId()).toMatch(uuidV4);
  });
});
