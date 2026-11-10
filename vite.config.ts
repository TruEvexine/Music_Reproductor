import { readFileSync } from "node:fs";
import { loadEnv } from "vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { findBundledAudio, findSecretEnv } from "./scripts/envGuard";

function buildGuard(mode: string): Plugin {
  return {
    name: "build-guard",
    apply: "build",
    buildStart() {
      const problems = findSecretEnv({ ...process.env, ...loadEnv(mode, process.cwd(), "VITE_") });
      if (problems.length > 0) {
        this.error(`Variables VITE_* con secretos (acabarían en el JavaScript público):\n- ${problems.join("\n- ")}`);
      }
    },
    generateBundle(_options, bundle) {
      const audio = findBundledAudio(Object.keys(bundle));
      if (audio.length > 0) {
        this.error(`El build incluye audio (nunca se despliega música):\n- ${audio.join("\n- ")}`);
      }
    },
  };
}

// `vite preview` sirve las mismas cabeceras globales que Vercel, para poder verificar la CSP en local.
const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const globalHeaders = Object.fromEntries(
  (vercel.headers.find((rule) => rule.source === "/(.*)")?.headers ?? []).map(({ key, value }) => [key, value]),
);

export default defineConfig(({ mode }) => ({
  plugins: [react(), buildGuard(mode)],
  preview: { headers: globalHeaders },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
}));
