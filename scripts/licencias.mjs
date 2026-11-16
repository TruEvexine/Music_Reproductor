// Avisos de terceros: las dependencias de producción (las que pueden llegar al build) con su licencia, y el texto completo de cada una.
// Uso: node scripts/licencias.mjs  →  docs/producto/LICENCIAS_TERCEROS.md (resumen) y public/licencias-terceros.txt (textos, se sirve con la web).
// Regenerar al cambiar dependencias: scripts/docsContent.test.ts falla si una dependencia de package.json no está en el resumen.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const dirs = execSync("npm ls --omit=dev --all --parseable", { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter((dir) => /node_modules[\\/]/.test(dir));

const packages = [...new Set(dirs)]
  .map((dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying|ofl)(\.|$)/i.test(name));
    const license = typeof pkg.license === "string" ? pkg.license : (pkg.license?.type ?? "SIN DECLARAR");
    return { name: pkg.name, version: pkg.version, license, text: file ? readFileSync(join(dir, file), "utf8").trim() : "" };
  })
  .filter((pkg, index, all) => all.findIndex((other) => other.name === pkg.name) === index)
  .sort((a, b) => a.name.localeCompare(b.name));

const md = [
  "# Licencias de terceros",
  "",
  "> Generado por `node scripts/licencias.mjs`; no se edita a mano. El texto completo de cada licencia se publica con la web en",
  "> `public/licencias-terceros.txt` (`{{URL_APP}}/licencias-terceros.txt`). Incluye todas las dependencias de producción y las suyas;",
  "> el SDK de Supabase (`@supabase/*` y lo que arrastra) solo entra en el build con cuentas (`VITE_CUENTAS=1`).",
  "",
  "| Paquete | Versión | Licencia | Texto incluido |",
  "|---|---|---|---|",
  ...packages.map((pkg) => `| \`${pkg.name}\` | ${pkg.version} | ${pkg.license} | ${pkg.text ? "sí" : "**no** (el paquete no trae archivo de licencia)"} |`),
  "",
  "**Fuera de npm:**",
  "",
  "- **Instrument Sans** (tipografía, empaquetada desde `@fontsource-variable/instrument-sans`): SIL Open Font License 1.1,",
  "  «Copyright 2022 The Instrument Sans Project Authors» (github.com/Instrument/instrument-sans, consultado el 16-11-2026). La OFL exige",
  "  acompañar las copias con el aviso y la licencia: van en el texto del paquete.",
  "- **Música e imágenes de las capturas de la landing:** CC0 o dominio público, con la lista por archivo en `CREDITOS.md`. El audio no se publica.",
  "- **Iconos:** `lucide-react` (arriba).",
  "",
].join("\n");

const txt = [
  "Licencias de terceros incluidas en esta web. Generado por scripts/licencias.mjs.",
  "",
  ...packages.flatMap((pkg) => [`${"=".repeat(72)}`, `${pkg.name} ${pkg.version} — ${pkg.license}`, `${"=".repeat(72)}`, pkg.text || "(El paquete no incluye archivo de licencia; se rige por la licencia declarada arriba.)", ""]),
].join("\n");

// Un {{MARCADOR}} en el .txt haría fallar el build (vite.config.ts): no debe venir de ninguna licencia.
if (/\{\{[A-Z_]+\}\}/.test(txt)) throw new Error("Un texto de licencia contiene algo con forma de {{MARCADOR}}");
writeFileSync(new URL("docs/producto/LICENCIAS_TERCEROS.md", root), md);
writeFileSync(new URL("public/licencias-terceros.txt", root), txt);
console.log(`${packages.length} paquetes; sin archivo de licencia: ${packages.filter((pkg) => !pkg.text).map((pkg) => pkg.name).join(", ") || "ninguno"}`);
