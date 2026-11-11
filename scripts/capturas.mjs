// Capturas y comprobación responsive. Uso: node scripts/capturas.mjs <carpeta-salida> [url-base]
// Requiere `npm run dev` corriendo y `npm run test:audio` ejecutado antes.
// Recorre TODA la matriz de viewports midiendo scroll horizontal y áreas táctiles < 44 px;
// guarda capturas de 390x844 y 1440x900 (con --todas, de toda la matriz). Sale con código 1 si algo falla.
// Nunca usa la música local: sustituye el catálogo de desarrollo por uno vacío e importa audio sintético.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const all = process.argv.includes("--todas");
const outDir = args[0] ?? "docs/capturas";
const base = (args[1] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = readdirSync(fixtures)
  .filter((f) => /\.(flac|mp3|m4a|wav|ogg|opus)$/.test(f))
  .map((f) => join(fixtures, f));
mkdirSync(outDir, { recursive: true });

const matrix = ["320x568", "360x800", "390x844", "412x915", "844x390", "768x1024", "1024x768", "1440x900", "1920x1080"];
const saved = new Set(["390x844", "1440x900"]);

const measure = () => {
  const small = new Set();
  for (const el of document.querySelectorAll("button, a, input:not(.visually-hidden), [role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || el.closest("[inert]")) continue;
    if (r.width < 44 || r.height < 44) small.add(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  let minFont = 99;
  for (const el of document.querySelectorAll("body *")) {
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
    }
  }
  // También dentro de los contenedores con scroll propio (.main, cola): ahí el desborde no ensancha el documento.
  const inner = [...document.querySelectorAll(".main, .queue-list, .dialog-body")].some((el) => el.scrollWidth > el.clientWidth + 1);
  return { overflow: document.documentElement.scrollWidth > innerWidth || inner, small: [...small], minFont };
};

const browser = await chromium.launch();
const problems = [];
for (const name of matrix) {
  const [width, height] = name.split("x").map(Number);
  const mobile = Math.min(width, height) < 600;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }),
  );
  const check = async (view) => {
    await page.waitForTimeout(350);
    if (all || saved.has(name)) await page.screenshot({ path: join(outDir, `${view}-${name}.png`) });
    const m = await page.evaluate(measure);
    if (m.overflow) problems.push(`${name} ${view}: scroll horizontal`);
    if (m.small.length) problems.push(`${name} ${view}: táctil < 44 px → ${m.small.join(" | ")}`);
    if (m.minFont < 12) problems.push(`${name} ${view}: texto de ${m.minFont}px`);
  };

  await page.goto(`${base}/app`);
  await page.waitForLoadState("networkidle");
  await check("01-vacio");

  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForFunction(() => !document.querySelector(".scan-bar"), null, { timeout: 30_000 });
  await check("02-biblioteca");

  // Vistas de la Fase 3: rejilla de álbumes, detalle, artistas y la hoja de carpetas/copia.
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  await page.locator(".album-tile").first().waitFor();
  await check("02b-albumes");
  await page.locator(".album-tile", { hasText: "Ondas Puras" }).click();
  await check("02c-album");
  await page.getByRole("link", { name: "Artistas", exact: true }).click();
  await check("02d-artistas");
  await page.getByRole("button", { name: "Carpetas y copia de seguridad" }).click();
  await check("02e-hoja-biblioteca");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Canciones", exact: true }).click();

  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(1200);
  await check("03-reproduciendo");

  // Menú ≡ desde el mini/barra: raíz y la página más ancha (ecualizador).
  const menu = page.locator("dialog.menu[open]");
  await page.locator('.player-bar button[aria-label="Menú del reproductor"]:visible').click();
  await check("03b-menu-mini");
  await menu.getByRole("button", { name: /^Sonido/ }).click();
  await menu.getByRole("button", { name: /^Ecualizador/ }).click();
  await check("03c-menu-ecualizador");
  await page.keyboard.press("Escape");
  await page.locator('.player-bar button[aria-label="Menú del reproductor"]:visible').click();
  await menu.getByRole("button", { name: /^Fondo/ }).click();
  await page.waitForTimeout(400);
  await check("03d-menu-fondo");
  await menu.getByRole("radio", { name: "Elegida" }).click(); // la página de Fondo más larga
  await check("03e-menu-fondo-elegida");
  await page.keyboard.press("Escape");

  await page.locator(".bar-track").click();
  await check("04-reproductor");
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
  await check("04b-menu-expandido");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Cola de reproducción" }).last().click();
  await check("05-cola");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.getByRole("searchbox").fill("zzzz");
  await check("06-busqueda-vacia");

  // Letra: la pista "Con Letra" trae USLT; el botón Letra vive en el reproductor expandido.
  await page.getByRole("searchbox").fill("con letra");
  await page.locator(".track-row .row-main", { hasText: "Con Letra" }).click();
  await page.locator(".bar-track").click();
  await page.getByRole("button", { name: "Letra", exact: true }).click();
  await check("06b-letra");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.goto(`${base}/app/playlists`);
  await check("07-playlists");

  await page.getByRole("button", { name: /Entrar|Cuenta/ }).first().click();
  await check("08-cuenta");

  await page.goto(`${base}/`);
  await check("09-landing");
  await context.close();
}
await browser.close();
console.log(problems.length ? problems.join("\n") : `Matriz correcta: ${matrix.length} viewports sin scroll horizontal ni áreas táctiles pequeñas.`);
process.exit(problems.length ? 1 : 0);
