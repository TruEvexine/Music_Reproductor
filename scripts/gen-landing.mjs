// Genera las capturas reales de la app que usa la landing (src/assets/landing/*.jpg), con el audio sintético de
// tests/fixtures/audio (nunca música con derechos). Uso: node scripts/gen-landing.mjs [url-base] [carpeta]
// Requiere `npm run dev` y `npm run test:audio`. Repetir cuando cambie el aspecto de la app.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const out = process.argv[3] ?? join(import.meta.dirname, "..", "src", "assets", "landing");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac", "04-senoidal.mp3", "05-titulo-largo.mp3", "06-cuadrada.m4a", "07-opus.opus", "08-vorbis.ogg", "09-sin-portada.flac", "10-letra.mp3"].map((name) => join(fixtures, name));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const shot = (page, name) => page.screenshot({ path: join(out, name), type: "jpeg", quality: 80 });

async function session(viewport, touch) {
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForTimeout(4000);
  await page.locator(".track-row .row-main").nth(1).click();
  await page.waitForTimeout(1500);
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
