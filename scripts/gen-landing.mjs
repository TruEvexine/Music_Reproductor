// Genera las capturas reales de la app que usa la landing (src/assets/landing/*.jpg) con música real CC0 o de dominio público
// (tests/fixtures/landing, que descarga y etiqueta scripts/descargar-musica-landing.mjs; nunca música con derechos).
// Uso: node scripts/gen-landing.mjs [url-base] [carpeta]. Requiere `npm run dev` y haber ejecutado antes
// `node scripts/descargar-musica-landing.mjs`. Repetir cuando cambie el aspecto de la app y luego `node scripts/avif-landing.mjs`
// (las versiones AVIF que sirve la landing salen de estos JPG).
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const out = process.argv[3] ?? join(import.meta.dirname, "..", "src", "assets", "landing");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "landing");
const files = readdirSync(fixtures)
  .filter((name) => /^\d\d-.*\.(ogg|flac)$/.test(name))
  .sort()
  .map((name) => join(fixtures, name));
if (files.length < 8) throw new Error(`Faltan pistas en ${fixtures}: ejecuta antes node scripts/descargar-musica-landing.mjs`);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
// Los títulos largos corren en un marquee: se detiene al principio para que la captura no los corte a mitad de palabra.
const shot = async (page, name) => {
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.effect?.target?.closest?.(".marquee") && animation.cancel()));
  return page.screenshot({ path: join(out, name), type: "jpeg", quality: 80 });
};

async function session(viewport, touch) {
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForTimeout(5000);
  await page.locator(".track-row .row-main", { hasText: "Nocturne No. 21" }).click(); // la portada de Delacroix da un ambiente rojo
  await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  await page.locator(".album-tile").first().waitFor();
  await page.waitForTimeout(800);
  return { page, context };
}

{
  const { page, context } = await session({ width: 1440, height: 900 }, false);
  await shot(page, "biblioteca-escritorio.jpg");
  await page.locator(".bar-track").click();
  await page.waitForTimeout(2500);
  await shot(page, "reproductor-escritorio.jpg");
  await context.close();
}
{
  const { page, context } = await session({ width: 390, height: 844 }, true);
  await shot(page, "biblioteca-movil.jpg");
  await page.locator(".bar-track").tap();
  await page.waitForTimeout(2500);
  await shot(page, "reproductor-movil.jpg");
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').tap();
  await page.waitForTimeout(500);
  await page.locator("dialog.menu[open]").getByRole("button", { name: /^Sonido/ }).tap();
  await page.waitForTimeout(300);
  await page.locator("dialog.menu[open]").getByRole("button", { name: /^Ecualizador/ }).tap();
  await page.waitForTimeout(300);
  await page.locator("dialog.menu[open]").getByRole("radio", { name: "Graves" }).tap();
  await page.waitForTimeout(500);
  await shot(page, "ecualizador-movil.jpg");
  await context.close();
}
await browser.close();
