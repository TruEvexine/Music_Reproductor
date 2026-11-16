// Prueba de la funda generada (pistas sin carátula) en Chromium contra `npm run dev`. Uso: node scripts/prueba-portada-generativa.mjs [url-base] [carpeta-de-capturas]
// Comprueba: estable por pista y distinta entre pistas, un solo SVG barato por fila, estática (ninguna animación, tampoco con la pista sonando), texto alternativo en el
// reproductor grande, ninguna copia del título dentro de la funda, el tono de la funda tiñe el ambiente, AMOLED y HDR la respetan, y la carátula real la sustituye.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const bare = ["07-opus.opus", "08-vorbis.ogg", "09-sin-portada.flac", "10-letra.mp3", "11-sylt.mp3", "tono-corto.wav", "tono-sin-metadatos.wav"].map((name) => join(fixtures, name));
const withCover = [join(fixtures, "01-amanecer.flac")];

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
async function open(files, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForTimeout(2300);
  return { page, errors, context };
}
const sleeves = (page) => page.locator(".track-row .row-cover").evaluateAll((nodes) => nodes.map((node) => `${node.style.getPropertyValue("--h")}|${[...node.querySelectorAll("rect")].map((rect) => rect.getAttribute("height")).join()}`));
const wait = (page, ms = 300) => page.waitForTimeout(ms);
const current = ".now-slot:not([data-side]) > .now-cover";

// 1. Listas: estables, distintas y baratas.
{
  const { page, errors } = await open(bare);
  const first = await sleeves(page);
  // Las 7 pistas son 5 álbumes de verdad (dos pistas comparten álbum) y dos sueltas sin álbum: el reparto exacto por álbum lo prueba coverArt.test.ts.
  check("pistas de álbumes distintos y pistas sueltas tienen funda distinta (7 pistas, 6 fundas: dos comparten álbum)", first.length >= 7 && new Set(first).size === first.length - 1, `${new Set(first).size} fundas en ${first.length} pistas`);
  check(
    "en las filas la funda es un solo SVG de 9 barras: sin canvas ni imágenes",
    (await page.locator(".track-row .row-cover canvas, .track-row .row-cover img").count()) === 0 && (await page.locator(".track-row .row-cover svg.art rect").count()) === first.length * 9,
  );
  check("la funda no lleva texto: título y artista ya están al lado", (await page.locator(".track-row .row-cover").evaluateAll((nodes) => nodes.every((node) => node.textContent.trim() === ""))) === true);
  await page.reload();
  await wait(page, 1500);
  const second = await sleeves(page);
  check("tras recargar cada pista conserva exactamente la misma funda", JSON.stringify(first.slice().sort()) === JSON.stringify(second.slice().sort()));
  check("sin errores en la lista", errors.length === 0, errors.join(" | "));
  if (out) await page.screenshot({ path: join(out, "funda-lista-1440.png") });

  // 2. Reproductor grande, sonando: estática y con el tono en el ambiente.
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 500);
  await page.locator(".bar-track").click();
  await wait(page, 1000);
  const cover = page.locator(current);
  const label = (await cover.getAttribute("aria-label")) ?? "";
  check("el reproductor grande describe la funda para lectores de pantalla", (await cover.getAttribute("role")) === "img" && /^Portada generada para «.+», de .+/.test(label), label);
  check("suena y la funda no tiene ninguna animación", (await page.evaluate((selector) => document.querySelector(selector).getAnimations({ subtree: true }).length, current)) === 0);
  check("el título no se repite dentro de la funda grande", (await cover.evaluate((node) => node.textContent.trim())) === "");
  const hue = await cover.evaluate((node) => Number(node.style.getPropertyValue("--h")));
  const ambient = await page.evaluate(() => getComputedStyle(document.querySelector(".shell")).getPropertyValue("--glow").trim());
  const glowHue = Number(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/.exec(ambient)?.[1]);
  check("el ambiente del reproductor toma el tono de la funda", Math.abs(((glowHue - hue + 540) % 360) - 180) < 1, `funda ${hue}, ambiente ${ambient}`);
  if (out) await page.screenshot({ path: join(out, "funda-reproductor-1440.png") });
  await page.keyboard.press("Escape");
  await wait(page, 400);

  // 3. AMOLED y HDR desde los controles reales.
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await wait(page, 400);
  await page.locator(".settings").getByRole("radio", { name: /AMOLED/ }).click();
  await wait(page, 300);
  await page.locator(".bar-track").click();
  await wait(page, 700);
  const amoled = await page.evaluate((selector) => ({
    bg: document.documentElement.dataset.bg,
    color: getComputedStyle(document.querySelector(".shell")).getPropertyValue("--bg").trim(),
    cover: document.querySelector(selector).getBoundingClientRect().width,
  }), current);
  check("AMOLED: fondo negro puro y la funda sigue ahí", amoled.bg === "amoled" && /oklch\(0 0 0\)/.test(amoled.color) && amoled.cover > 200, JSON.stringify(amoled));
  if (out) await page.screenshot({ path: join(out, "funda-amoled-1440.png") });
  await page.keyboard.press("Escape");
  await wait(page, 400);
  await page.locator(".settings").getByRole("switch", { name: "HDR simulado en toda la app" }).click();
  await wait(page, 300);
  await page.locator(".bar-track").click();
  await wait(page, 700);
  const hdr = await page.evaluate((selector) => ({ hdr: document.documentElement.hasAttribute("data-hdr"), filter: getComputedStyle(document.querySelector(selector)).filter }), current);
  check("HDR global: la funda recibe el mismo realce que las demás portadas", hdr.hdr && hdr.filter !== "none", JSON.stringify(hdr));
  await page.context().close();
}

// 4. Las portadas reales sustituyen a la funda.
{
  const { page, context } = await open(withCover);
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 600);
  await page.locator(".bar-track").click();
  await wait(page, 1500);
  const real = await page.evaluate((selector) => ({
    img: document.querySelector(`${selector} img`)?.getAttribute("alt"),
    role: document.querySelector(selector)?.getAttribute("role"),
    sleeve: document.querySelectorAll(`${selector} svg.art`).length,
  }), current);
  check("con carátula real se ve la imagen, con su texto alternativo, y no queda funda debajo", /^Portada de «.+»/.test(real.img ?? "") && real.role === null && real.sleeve === 0, JSON.stringify(real));
  await context.close();
}

await browser.close();
console.log(failed === 0 ? "\nTodo en verde." : `\n${failed} comprobaciones fallaron.`);
process.exit(failed === 0 ? 0 : 1);
