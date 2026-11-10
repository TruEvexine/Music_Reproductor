// Capturas de las vistas principales. Uso: node scripts/capturas.mjs <carpeta-salida> [url]
// Requiere `npm run dev` corriendo y `node scripts/gen-test-audio.mjs` ejecutado antes.
// Nunca usa la música local: sustituye el catálogo demo por uno vacío e importa audio sintético.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "docs/capturas";
const url = process.argv[3] ?? "http://localhost:5173/";
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = readdirSync(fixtures)
  .filter((f) => /\.(flac|mp3|m4a|wav|ogg|opus)$/.test(f))
  .map((f) => join(fixtures, f));
mkdirSync(outDir, { recursive: true });

const viewports = [
  ["390x844", { width: 390, height: 844 }, true],
  ["1440x900", { width: 1440, height: 900 }, false],
];

const browser = await chromium.launch();
const report = {};
for (const [name, viewport, mobile] of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  await page.route("**/demoCatalog.ts*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "export const demoTracks = [];" }),
  );
  const shot = (view) => page.screenshot({ path: join(outDir, `${view}-${name}.png`) });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await shot("01-vacio");

  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.waitForTimeout(2500);
  await shot("02-biblioteca");

  // Métricas objetivas para la auditoría: áreas táctiles, tamaños de texto y scroll horizontal.
  report[name] = await page.evaluate(() => {
    const small = [];
    for (const el of document.querySelectorAll("button, a, input, label.import-button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        small.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    const fonts = {};
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const size = getComputedStyle(el).fontSize;
      fonts[size] = (fonts[size] ?? 0) + 1;
    }
    return {
      horizontalScroll: document.documentElement.scrollWidth > innerWidth,
      smallTargets: [...new Set(small)],
      fontSizes: fonts,
    };
  });

  const firstTrack = page.locator("button.track-select, [data-testid=track-row]").first();
  if (await firstTrack.count()) {
    await firstTrack.click();
    await page.waitForTimeout(1500);
    await shot("03-reproduciendo");
  }
  const queueButton = page.getByRole("button", { name: /cola/i }).last();
  if (await queueButton.count()) {
    await queueButton.click();
    await page.waitForTimeout(400);
    await shot("04-cola");
    await page.keyboard.press("Escape");
    const close = page.getByRole("button", { name: "Cerrar cola" }).last();
    if (await close.isVisible().catch(() => false)) await close.click();
  }
  const search = page.getByRole("searchbox").first();
  if (await search.count()) {
    await search.fill("zzzz sin resultados");
    await shot("05-busqueda-vacia");
    await search.fill("");
  }
  const playlists = page.getByRole("button", { name: /^Playlists/ }).first();
  if (await playlists.isVisible().catch(() => false)) {
    await playlists.click();
    await page.waitForTimeout(400);
    await shot("06-playlists");
  }
  const account = page.getByRole("button", { name: /cuenta/i }).first();
  if (await account.isVisible().catch(() => false)) {
    await account.click();
    await page.waitForTimeout(400);
    await shot("07-cuenta");
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
