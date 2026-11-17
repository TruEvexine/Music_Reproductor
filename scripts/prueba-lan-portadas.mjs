// Portadas abiertas por http con la IP de la red local (contexto NO seguro), como un móvil con `npm run dev:lan`.
// Uso: node scripts/prueba-lan-portadas.mjs http://<ip-de-la-lan>:5173 (o el build con `PREVIEW_HTTP=1 npx vite preview --host`). En escritorio y en Pixel 7:
// la carátula incrustada se ve como imagen decodificada y la pista sin carátula lleva la funda generada; nunca imagen rota. Sale con 1 si algo falla.
import { chromium, devices } from "@playwright/test";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base || /localhost|127\.0\.0\.1/.test(base)) {
  console.error("Pasa la URL de red local que imprime `npm run dev:lan` (no localhost: localhost sí es contexto seguro).");
  process.exit(1);
}
const fixture = (name) => join(import.meta.dirname, "..", "tests", "fixtures", "audio", name);
const withCover = ["01-amanecer.flac", "04-senoidal.mp3", "06-cuadrada.m4a"];
const bare = ["09-sin-portada.flac"];

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
for (const [label, options] of [["escritorio", { viewport: { width: 1440, height: 900 } }], ["Pixel 7", devices["Pixel 7"]]]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  check(`${label}: la página no es contexto seguro`, await page.evaluate(() => !isSecureContext && !crypto.subtle));
  await page.getByLabel("Elegir archivos de música").setInputFiles([...withCover, ...bare].map(fixture));
  await page.waitForFunction((count) => document.querySelectorAll(".track-row").length === count, withCover.length + bare.length);
  await page.waitForTimeout(1500);
  const rows = await page.locator(".track-row").evaluateAll((nodes) =>
    nodes.map((node) => {
      const img = node.querySelector(".row-cover img");
      return { title: node.querySelector(".title")?.textContent, img: img ? img.complete && img.naturalWidth > 0 : null, sleeve: !!node.querySelector(".row-cover svg.art") };
    }),
  );
  const covered = rows.filter((row) => row.title !== "Sin Portada");
  check(`${label}: la carátula incrustada se ve como imagen`, covered.length === withCover.length && covered.every((row) => row.img === true && !row.sleeve), JSON.stringify(covered));
  check(`${label}: sin carátula, funda generada y ninguna imagen`, rows.some((row) => row.title === "Sin Portada" && row.sleeve && row.img === null), JSON.stringify(rows));
  check(`${label}: sin errores de página`, errors.length === 0, errors.join(" | "));
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
