import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv, normalizePath } from "vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fillMarkers, parseFaq, parseLegal, unfilledMarkers } from "./scripts/docsContent";
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
    // El resultado de producción no puede llevar ningún {{MARCADOR}} sin sustituir (datos personales de los textos legales que se completan al compilar).
    writeBundle({ dir }) {
      if (!dir) return;
      const files = Object.fromEntries(
        readdirSync(dir, { recursive: true, encoding: "utf8" })
          .filter((name) => /\.(js|css|html|json|svg|txt|webmanifest)$/.test(name))
          .map((name) => [name.replaceAll("\\", "/"), readFileSync(`${dir}/${name}`, "utf8")]),
      );
      const left = unfilledMarkers(files);
      if (left.length > 0) {
        this.error(
          `El build contiene marcadores sin sustituir:\n- ${left.join("\n- ")}\nDefine LEGAL_RESPONSABLE, LEGAL_DOMICILIO, LEGAL_CORREO_PRIVACIDAD, LEGAL_NOMBRE_APP, LEGAL_FECHA_ACTUALIZACION y LEGAL_URL_APP (variables de entorno del build; nunca en el repositorio) antes de compilar para publicar.`,
        );
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

// `virtual:docs`: la FAQ y los borradores legales salen de docs/producto, así que la app y el documento no se desfasan. Los datos personales
// ({{RESPONSABLE}}, {{DOMICILIO}}, {{CORREO_PRIVACIDAD}}) y los que dependen del nombre aún sin registrar ({{NOMBRE_APP}}, {{FECHA_ACTUALIZACION}}, {{URL_APP}}) se completan al compilar con LEGAL_RESPONSABLE,
// LEGAL_DOMICILIO, LEGAL_CORREO_PRIVACIDAD, LEGAL_NOMBRE_APP, LEGAL_FECHA_ACTUALIZACION y LEGAL_URL_APP (entorno o .env, ignorado por git).
function docsContent(mode: string): Plugin {
  const resolved = "\0virtual:docs";
  const files = ["FAQ.md", "LEGAL_BORRADORES.md"].map((name) => normalizePath(fileURLToPath(new URL(`./docs/producto/${name}`, import.meta.url))));
  return {
    name: "docs-content",
    resolveId: (source) => (source === "virtual:docs" ? resolved : undefined),
    load(id) {
      if (id !== resolved) return;
      files.forEach((file) => this.addWatchFile(file));
      const env = { ...process.env, ...loadEnv(mode, process.cwd(), "LEGAL_") };
      const values = Object.fromEntries(Object.entries(env).filter(([name]) => name.startsWith("LEGAL_")).map(([name, value]) => [name.slice(6), value]));
      const fill = (text: string) => fillMarkers(text, values);
      const faq = parseFaq(readFileSync(files[0], "utf8")).map(({ group, items }) => ({ group, items: items.map(({ question, answer }) => ({ question, answer: answer.map(fill) })) }));
      const legal = Object.fromEntries(Object.entries(parseLegal(readFileSync(files[1], "utf8"))).map(([name, text]) => [name, fill(text)]));
      return `export const faq = ${JSON.stringify(faq)};\nexport const legal = ${JSON.stringify(legal)};`;
    },
    configureServer(server) {
      server.watcher.add(files);
      server.watcher.on("change", (file) => {
        if (!files.includes(normalizePath(file))) return;
        const module = server.moduleGraph.getModuleById(resolved);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      });
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

// VITE_TARGET=android|ios: la app se sirve desde archivos, así que las rutas de los assets son relativas.
const native = process.env.VITE_TARGET === "android" || process.env.VITE_TARGET === "ios";

export default defineConfig(({ mode }) => ({
  base: native ? "./" : "/",
  plugins: [react(), docsContent(mode), buildGuard(mode)],
  preview: { headers: globalHeaders },
  worker: { format: "es" }, // el worker de metadatos carga music-metadata con imports dinámicos
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
}));
