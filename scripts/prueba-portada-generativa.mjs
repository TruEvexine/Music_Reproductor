// Prueba de la portada generativa (pistas sin carátula) en Chromium contra `npm run dev`. Uso: node scripts/prueba-portada-generativa.mjs [url-base] [carpeta-de-capturas]
// Comprueba: estable por pista y distinta entre pistas, barata en listas (un background, sin canvas ni imágenes), texto alternativo en el reproductor grande,
// movimiento solo mientras suena y con la pestaña visible, sin capa móvil con movimiento reducido (sistema o Ajustes), y que AMOLED y HDR la respetan.
// Las portadas reales no cambian.
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
const backgrounds = (page) => page.locator(".track-row .row-cover").evaluateAll((nodes) => nodes.map((node) => node.style.background));
const drift = (page) =>
  page.evaluate(() => ({
    layers: document.querySelectorAll(".now-cover .art-drift").length,
    live: document.querySelector(".now-cover")?.hasAttribute("data-live"),
    states: document.querySelector(".now-cover .art-drift")?.getAnimations().map((a) => a.playState) ?? [],
  }));
const wait = (page, ms = 300) => page.waitForTimeout(ms);
const idle = (page) => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); // Espacio sobre un botón enfocado lo activa a él, no la reproducción

// 1. Listas: estables, distintas y baratas.
{
  const { page, errors } = await open(bare);
  const first = await backgrounds(page);
  check("cada pista sin portada tiene la suya (7 pistas, 7 fondos distintos)", first.length >= 7 && new Set(first).size === first.length, `${new Set(first).size} de ${first.length}`);
  check(
    "en las filas el arte es un solo background: sin canvas, sin imágenes y sin capa que se mueva",
    (await page.locator(".track-row .row-cover canvas, .track-row .row-cover img, .track-row .row-cover .art-drift").count()) === 0 && first.every((css) => css.includes("no-repeat")),
  );
  await page.reload();
  await wait(page, 1500);
  const second = await backgrounds(page);
  check("tras recargar cada pista conserva exactamente la misma portada", JSON.stringify(first.slice().sort()) === JSON.stringify(second.slice().sort()));
  check("sin errores en la lista", errors.length === 0, errors.join(" | "));

  // 2. Reproductor grande.
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 500);
  await page.locator(".bar-track").click();
  await wait(page, 1000);
  const cover = page.locator(".now-cover");
  const label = (await cover.getAttribute("aria-label")) ?? "";
  check("el reproductor grande describe la portada generada para lectores de pantalla", (await cover.getAttribute("role")) === "img" && /^Portada generada para «.+», de .+/.test(label), label);
  const playing = await drift(page);
  check("suena: la capa se mueve (animación en marcha)", playing.layers === 1 && playing.live === true && playing.states.join() === "running", JSON.stringify(playing));
  check(
    "el movimiento solo usa transform (sin animar color ni tamaño)",
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.animationName === "art-drift")
        .every((a) => a.effect.getKeyframes().every((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)).every((p) => p === "transform"))),
    ),
  );
  await idle(page);
  await page.keyboard.press("Space");
  await wait(page, 400);
  const paused = await drift(page);
  check("en pausa se detiene", paused.live === false && paused.states.join() === "paused", JSON.stringify(paused));
  await page.keyboard.press("Space");
  await wait(page, 400);
  check("al reanudar vuelve a moverse", (await drift(page)).states.join() === "running");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(page, 300);
  const hidden = await drift(page);
  check("con la pestaña oculta se detiene aunque suene", hidden.live === false && hidden.states.join() === "paused", JSON.stringify(hidden));
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(page, 300);
  check("al volver a la pestaña continúa", (await drift(page)).states.join() === "running");
  if (out) await page.screenshot({ path: join(out, "generativa-reproductor-1440.png") });

  // Reducir movimiento desde Ajustes: la capa deja de existir (no solo se pausa).
  await page.keyboard.press("Escape");
  await wait(page, 400);
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await wait(page, 400);
  await page.locator(".settings").getByRole("switch", { name: "Reducir movimiento" }).click();
  await wait(page, 300);
  await page.locator(".bar-track").click();
  await wait(page, 600);
  const reduced = await drift(page);
  check("con «Reducir movimiento» de Ajustes la capa móvil no existe y el arte sigue pintado", reduced.layers === 0 && (await page.locator(".now-cover").evaluate((node) => node.style.background.includes("no-repeat"))));
  await page.keyboard.press("Escape");
  await wait(page, 400);

  // 3. AMOLED y HDR desde los controles reales.
  await page.locator(".settings").getByRole("switch", { name: "Reducir movimiento" }).click();
  await page.locator(".settings").getByRole("radio", { name: /AMOLED/ }).click();
  await wait(page, 300);
  await page.locator(".bar-track").click();
  await wait(page, 700);
  const amoled = await page.evaluate(() => ({
    bg: document.documentElement.dataset.bg,
    color: getComputedStyle(document.querySelector(".shell")).getPropertyValue("--bg").trim(),
    cover: document.querySelector(".now-cover").getBoundingClientRect().width,
  }));
  check("AMOLED: fondo negro puro y la portada sigue ahí", amoled.bg === "amoled" && /oklch\(0 0 0\)/.test(amoled.color) && amoled.cover > 200, JSON.stringify(amoled));
  if (out) await page.screenshot({ path: join(out, "generativa-amoled-1440.png") });
  await page.keyboard.press("Escape");
  await wait(page, 400);
  await page.locator(".settings").getByRole("switch", { name: "HDR simulado en toda la app" }).click();
  await wait(page, 300);
  await page.locator(".bar-track").click();
  await wait(page, 700);
  const hdr = await page.evaluate(() => ({ hdr: document.documentElement.hasAttribute("data-hdr"), filter: getComputedStyle(document.querySelector(".now-cover")).filter }));
  check("HDR global: la portada generada recibe el mismo realce que las demás", hdr.hdr && hdr.filter !== "none", JSON.stringify(hdr));
  if (out) await page.screenshot({ path: join(out, "generativa-hdr-1440.png") });
  await page.context().close();
}

// 4. Movimiento reducido del sistema: la capa no existe.
{
  const { page, context } = await open(bare, { reducedMotion: "reduce" });
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 500);
  await page.locator(".bar-track").click();
  await wait(page, 800);
  const state = await drift(page);
  check(
    "prefers-reduced-motion: no hay capa que se mueva y no hay ninguna animación del arte",
    state.layers === 0 && (await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "art-drift").length)) === 0,
    JSON.stringify(state),
  );
  await context.close();
}

// 5. Las portadas reales no cambian.
{
  const { page, context } = await open(withCover);
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 600);
  await page.locator(".bar-track").click();
  await wait(page, 1500);
  const real = await page.evaluate(() => ({
    img: document.querySelector(".now-cover img")?.getAttribute("alt"),
    role: document.querySelector(".now-cover")?.getAttribute("role"),
    layer: document.querySelectorAll(".now-cover .art-drift").length,
  }));
  check("con carátula real se ve la imagen, con su texto alternativo, y no hay arte debajo animándose", /^Portada de «.+»/.test(real.img ?? "") && real.role === null && real.layer === 0, JSON.stringify(real));
  await context.close();
}

await browser.close();
console.log(failed === 0 ? "\nTodo en verde." : `\n${failed} comprobaciones fallaron.`);
process.exit(failed === 0 ? 0 : 1);
