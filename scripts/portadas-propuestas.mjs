// Capturas de las propuestas de portada sin carátula (COVER_STYLE en src/core/coverArt.ts) contra `npm run dev`.
// Uso: node scripts/portadas-propuestas.mjs <carpeta-de-salida> [url-base]
// Para cada estilo y cada tamaño de la matriz de capturas.mjs guarda la lista de la biblioteca (portadas de 48 px) y el reproductor grande; además,
// a 390×844 y 1440×900, las mismas vistas con el fondo AMOLED y con el HDR simulado. El estilo se fuerza reescribiendo la constante al servir el módulo:
// no hay interruptores en el código de la app. AMOLED y HDR se activan por el store de fondo, como el menú. Solo usa el audio sintético de tests/fixtures.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2];
if (!out) throw new Error("Falta la carpeta de salida");
const base = (process.argv[3] ?? "http://localhost:5173").replace(/\/$/, "");
mkdirSync(out, { recursive: true });
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = readdirSync(fixtures)
  .filter((f) => /\.(flac|mp3|m4a|wav|ogg|opus)$/.test(f) && !f.startsWith("corrupto"))
  .map((f) => join(fixtures, f));
const styles = (process.env.ESTILOS ?? "campos,inicial,nota,tarjeta").split(",");
const sizes = (process.env.TAMANOS ? process.env.TAMANOS.split(",") : ["320x568", "360x800", "390x844", "412x915", "844x390", "768x1024", "1024x768", "1440x900", "1920x1080"]);
const modes = { normal: {}, amoled: { mode: "amoled" }, hdr: { hdr: true } };

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const style of styles) {
  for (const size of sizes) {
    const [width, height] = size.split("x").map(Number);
    const mobile = Math.min(width, height) < 600;
    for (const [mode, attrs] of Object.entries(modes)) {
      if (mode !== "normal" && !["390x844", "1440x900"].includes(size)) continue;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
      const page = await context.newPage();
      await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
      await page.route("**/core/coverArt.ts*", async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/export const COVER_STYLE = "[a-z]+"/, `export const COVER_STYLE = "${style}"`);
        await route.fulfill({ response, body });
      });
      await page.goto(`${base}/app`);
      await page.getByLabel("Elegir archivos de música").setInputFiles(files);
      await page.waitForFunction(() => !document.querySelector(".scan-bar") && document.querySelectorAll(".track-row").length >= 10, null, { timeout: 30_000 });
      // Por el store, como el menú: así también cambia el fondo del reproductor grande (negro en AMOLED), no solo el atributo de <html>.
      await page.evaluate(async (a) => (await import("/src/state/background.ts")).useBackground.setState(a), attrs);
      await page.waitForTimeout(500);
      const generated = await page.locator(".track-row .cover:not(:has(img))").count();
      const flat = await page.locator(`.track-row .cover[data-cover="${style}"] > .art`).count();
      if (style !== "campos" && (flat === 0 || flat !== generated)) throw new Error(`${style} ${size}: el estilo no se aplicó (${flat}/${generated})`);
      await page.screenshot({ path: join(out, `${style}-lista-${mode}-${size}.png`) });
      await page.locator(".track-row .row-main", { hasText: "Con Letra" }).click();
      await page.waitForTimeout(500);
      await page.locator(".bar-track").click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, `${style}-grande-${mode}-${size}.png`) });
      await context.close();
    }
  }
  console.log("hecho", style);
}
await browser.close();
