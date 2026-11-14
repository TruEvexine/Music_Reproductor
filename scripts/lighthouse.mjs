// Lighthouse (solo rendimiento, móvil simulado: Slow 4G y CPU ×4) contra el build de producción servido con `vite preview`.
// Uso: npm run build && node scripts/lighthouse.mjs [--pasadas 5] [--solo landing|app] [--etiqueta texto]
// Cada pasada abre Chrome con un perfil temporal vacío y sin extensiones; se imprime la mediana de N pasadas (tabla Markdown).
// Usa Chrome instalado (o el Chromium de Playwright) y `npx lighthouse@13`, que se descarga solo la primera vez: no es dependencia del proyecto.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const flag = (name, fallback) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback);
const passes = Number(flag("pasadas", 5));
const only = flag("solo", "");
const label = flag("etiqueta", "");
const port = 4179;
const base = `http://localhost:${port}`;
const pages = [["landing", "/"], ["/app", "/app"]].filter(([name]) => !only || name.includes(only));

const installed = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome"].find(existsSync);
const chrome = process.env.CHROME_PATH ?? installed ?? chromium.executablePath();

const preview = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { shell: true, stdio: "ignore" });
const stop = () => spawnSync("taskkill", ["/pid", String(preview.pid), "/T", "/F"], { stdio: "ignore" }) && preview.kill();
process.on("exit", stop);
for (let i = 0; ; i++) {
  if (await fetch(base).then((r) => r.ok, () => false)) break;
  if (i > 60) throw new Error("vite preview no arrancó (¿falta npm run build?)");
  await new Promise((done) => setTimeout(done, 500));
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const out = mkdtempSync(join(tmpdir(), "lighthouse-"));
const rows = [];
for (const [name, path] of pages) {
  const runs = [];
  for (let i = 0; i < passes; i++) {
    const file = join(out, `${name.replace("/", "")}-${i}.json`);
    const result = spawnSync(
      "npx",
      ["--yes", "lighthouse@13", base + path, "--only-categories=performance", "--form-factor=mobile", "--output=json", `--output-path=${file}`, "--quiet",
        `--chrome-flags="--headless=new --disable-extensions --no-first-run"`],
      { shell: true, env: { ...process.env, CHROME_PATH: chrome }, encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(`Lighthouse falló en ${name}: ${(result.stderr || result.stdout).slice(-400)}`);
    const { categories, audits } = JSON.parse(readFileSync(file, "utf8"));
    runs.push({
      score: Math.round(categories.performance.score * 100),
      fcp: audits["first-contentful-paint"].numericValue,
      lcp: audits["largest-contentful-paint"].numericValue,
      tbt: audits["total-blocking-time"].numericValue,
      cls: audits["cumulative-layout-shift"].numericValue,
      kb: audits["total-byte-weight"].numericValue / 1024,
    });
    console.error(`${name} ${i + 1}/${passes}: ${runs[i].score} puntos, LCP ${Math.round(runs[i].lcp)} ms`);
  }
  const of = (key) => median(runs.map((run) => run[key]));
  rows.push(`| ${label ? `${label} · ` : ""}${name} | ${of("score")} | ${Math.round(of("fcp"))} | ${Math.round(of("lcp"))} | ${Math.round(Math.min(...runs.map((r) => r.lcp)))}–${Math.round(Math.max(...runs.map((r) => r.lcp)))} | ${Math.round(of("tbt"))} | ${of("cls").toFixed(3)} | ${Math.round(of("kb"))} |`);
}
stop();
console.log(`Mediana de ${passes} pasadas, Chrome ${chrome.includes("Program Files") ? "instalado" : "de Playwright"}, perfil vacío sin extensiones. Informes JSON en ${out}`);
console.log("\n| Página | Puntos | FCP ms | LCP ms (mediana) | LCP mín–máx | TBT ms | CLS | KB transferidos |\n|---|---|---|---|---|---|---|---|");
console.log(rows.join("\n"));
process.exit(0);
