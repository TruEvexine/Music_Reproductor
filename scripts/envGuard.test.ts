import { describe, expect, it } from "vitest";
import { findBundledAudio, findSecretEnv } from "./envGuard";

// Se construye por partes para que ni el hook pre-commit ni gitleaks lo tomen por una credencial real.
const postgresUri = ["postgresql://", "usuario:clave", "@db.host:5432/postgres"].join("");

const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.firma`;

describe("findSecretEnv", () => {
  it("acepta la URL y la clave publicable", () => {
    expect(
      findSecretEnv({
        VITE_SUPABASE_URL: "https://abc.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
        VITE_OTRA: jwt("anon"),
        DATABASE_URL: postgresUri, // sin prefijo VITE_ no llega al cliente
      }),
    ).toEqual([]);
  });

  it("rechaza nombres y valores secretos", () => {
    expect(findSecretEnv({ VITE_SUPABASE_SERVICE_ROLE_KEY: "x" })).toHaveLength(1);
    expect(findSecretEnv({ VITE_API_SECRET: "x" })).toHaveLength(1);
    expect(findSecretEnv({ VITE_KEY: "sb_secret_abc" })).toHaveLength(1);
    expect(findSecretEnv({ VITE_KEY: jwt("service_role") })).toHaveLength(1);
    expect(findSecretEnv({ VITE_DB: postgresUri })).toHaveLength(1);
  });
});

describe("findBundledAudio", () => {
  it("detecta audio en la salida del build", () => {
    expect(findBundledAudio(["assets/index-abc.js", "assets/cancion-abc.FLAC", "assets/a.m4a"])).toEqual([
      "assets/cancion-abc.FLAC",
      "assets/a.m4a",
    ]);
  });
});
