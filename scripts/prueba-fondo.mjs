// Prueba del fondo reactivo en Chromium contra `npm run dev`. Uso: node scripts/prueba-fondo.mjs [url-base] [carpeta-capturas]
// Comprueba: el lienzo WebGL se monta en el reproductor expandido y se desmonta al colapsar (queda un tinte CSS), cambiar de modo,
// intensidad y paleta llega al render, nada se mueve en Estático ni con prefers-reduced-motion, el bucle se detiene con la pestaña
// oculta, el respaldo CSS aparece sin WebGL y al perder el contexto, y el coste de JavaScript por cuadro (≤ 2 ms).
// Usa audio sintético y `window.__backdrop` (estadísticas del bucle, solo en desarrollo). Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const shots = process.argv[3] ?? "docs/capturas";
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(fixtures, name));
mkdirSync(shots, { recursive: true });

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(browser, { viewport = { width: 1440, height: 900 }, touch = false, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, reducedMotion });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await wait(page, 2500);
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 800);
  return { page, errors, context };
}

const expand = async (page) => {
  await page.locator(".bar-track").click();
  await wait(page, 500);
};
const stats = (page) => page.evaluate(() => (window.__backdrop ?? []).map((s) => ({ ...s })));
const canvases = (page) => page.locator("canvas.backdrop-canvas").count();
const menu = (page) => page.locator("dialog.menu[open]");
const heading = (page) => menu(page).locator(".menu-head h2");
const setRange = (locator, value) =>
  locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
const openBackgroundPage = async (page, viewportKind) => {
  const trigger = viewportKind === "mobile" ? '.now-header button[aria-label="Menú del reproductor"]' : '.now-header button[aria-label="Menú del reproductor"]';
  await page.locator(trigger).click();
  await wait(page, 300);
  await menu(page).getByRole("button", { name: /^Fondo/ }).click();
  await wait(page, 400);
};
const pickMode = async (page, label) => {
  await menu(page).getByRole("radio", { name: label }).click();
  await wait(page, 300);
};
// Captura solo el fondo: oculta lo que hay encima (controles, tiempos que avanzan, menú) para que un cambio de píxeles sea movimiento del fondo.
const shot = async (page, selector) => {
  await page.evaluate(() => document.querySelectorAll(".now-playing > :not(.backdrop), dialog.menu").forEach((el) => (el.style.visibility = "hidden")));
  await page.waitForTimeout(100); // con movimiento reducido todo tiene una transición de 0,01 ms: el ocultar se aplica en el cuadro siguiente
  const image = await page.locator(selector).first().screenshot();
  await page.evaluate(() => document.querySelectorAll(".now-playing > :not(.backdrop), dialog.menu").forEach((el) => (el.style.visibility = "")));
  return image;
};
const same = (a, b) => Buffer.compare(a, b) === 0;

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });

// ───────────── Escritorio, movimiento normal ─────────────
{
  const { page, errors, context } = await open(browser);
  check("colapsado: no hay lienzo ni bucle, solo el tinte CSS", (await canvases(page)) === 0 && (await stats(page)).length === 0 && (await page.locator(".tint").count()) === 1);
  await page.screenshot({ path: join(shots, "fondo-01-tinte-mini-1440x900.png") });

  await expand(page);
  check("expandido: el lienzo WebGL se monta en el reproductor", (await page.locator(".now-playing canvas.backdrop-canvas").count()) === 1);
  check("expandido: el tinte de la app desaparece (no hay doble fondo)", (await page.locator(".tint").count()) === 0);
  await wait(page, 700);
  const a = await stats(page);
  await wait(page, 700);
  const b = await stats(page);
  check("el bucle de dibujo está en marcha (los cuadros aumentan)", a.length === 1 && b[0].frames > a[0].frames + 5, `${a[0]?.frames} → ${b[0]?.frames}`);
  check("coste de JavaScript por cuadro ≤ 2 ms", b[0].cpuMs <= 2, `${b[0].cpuMs.toFixed(3)} ms (nivel ${b[0].level})`);

  const first = await shot(page, ".now-playing .backdrop");
  await wait(page, 900);
  const second = await shot(page, ".now-playing .backdrop");
  check("en modo Portada el fondo se mueve", !same(first, second));
  await page.screenshot({ path: join(shots, "fondo-02-portada-1440x900.png") });

  // Menú → Fondo: vista previa en vivo y cambio de modo.
  await openBackgroundPage(page, "desktop");
  check("el menú tiene página «Fondo» con vista previa en vivo (segundo lienzo)", (await heading(page).innerText()) === "Fondo" && (await canvases(page)) === 2 && (await stats(page)).length === 2);
  await page.screenshot({ path: join(shots, "fondo-03-menu-portada-1440x900.png") });

  await pickMode(page, "Ritmo");
  let s = await stats(page);
  check("cambiar a Ritmo llega al render (reproductor y vista previa)", s.length === 2 && s.every((x) => x.mode === "rhythm"), JSON.stringify(s.map((x) => x.mode)));
  check("sigue ≤ 2 ms por cuadro en modo Ritmo (con análisis de audio)", s.every((x) => x.cpuMs <= 2), s.map((x) => x.cpuMs.toFixed(3)).join(" / "));
  await page.screenshot({ path: join(shots, "fondo-04-menu-ritmo-1440x900.png") });

  await setRange(menu(page).getByLabel(/^Intensidad/), 0.2);
  await wait(page, 300);
  s = await stats(page);
  check("cambiar la intensidad llega al render", s.every((x) => Math.abs(x.intensity - 0.2) < 0.001), JSON.stringify(s.map((x) => x.intensity)));
  await setRange(menu(page).getByLabel(/^Intensidad/), 1);
  await setRange(menu(page).getByLabel(/^Velocidad/), 2);
  await wait(page, 300);

  // Origen de la paleta y tope de cuadros.
  await menu(page).getByRole("radio", { name: "Elegida" }).click();
  await setRange(menu(page).getByLabel(/^Tono elegido/), 120);
  await menu(page).getByRole("radio", { name: "30" }).click();
  await wait(page, 300);
  check("«Elegida» muestra el deslizador de tono", (await menu(page).getByLabel(/^Tono elegido/).count()) === 1);
  const frames30a = (await stats(page))[0].frames;
  await wait(page, 1000);
  const perSecond = (await stats(page))[0].frames - frames30a;
  check("el tope de 30 cuadros se respeta", perSecond <= 34, `${perSecond} cuadros/s`);

  // Estático: sin lienzo, gradiente CSS con el tono elegido (verde), y quieto.
  await pickMode(page, "Estático");
  check("Estático: sin lienzo ni bucle", (await canvases(page)) === 0 && (await stats(page)).length === 0);
  const paint = await page.locator(".now-playing > .backdrop").evaluate((el) => el.style.background);
  const rgb = paint.match(/rgb\((\d+) (\d+) (\d+)/)?.slice(1).map(Number) ?? [0, 0, 0];
  check("Estático con tono elegido 120°: el primer color es verde", paint.includes("linear-gradient") && rgb[1] > rgb[0] && rgb[1] > rgb[2], paint.slice(0, 60));
  const still1 = await shot(page, ".now-playing > .backdrop");
  await wait(page, 900);
  const still2 = await shot(page, ".now-playing > .backdrop");
  check("Estático: nada se mueve", same(still1, still2));
  check("sin controles de movimiento en Estático (velocidad, cuadros, batería)", (await menu(page).getByLabel(/^Velocidad/).count()) === 0 && (await menu(page).getByRole("switch", { name: /batería/ }).count()) === 0);
  await page.screenshot({ path: join(shots, "fondo-05-estatico-1440x900.png") });

  await pickMode(page, "AMOLED");
  const amoled = await page.evaluate(() => ({ attr: document.documentElement.dataset.bg, bg: getComputedStyle(document.querySelector(".now-playing")).backgroundColor, layer: document.querySelectorAll(".now-playing > .backdrop").length }));
  check("AMOLED: negro puro y sin capa de fondo", amoled.attr === "amoled" && (amoled.bg === "rgb(0, 0, 0)" || amoled.bg === "oklch(0 0 0)") && amoled.layer === 0, JSON.stringify(amoled));
  await page.screenshot({ path: join(shots, "fondo-06-amoled-1440x900.png") });

  // Persistencia.
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await wait(page, 2500);
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 600);
  await expand(page);
  await openBackgroundPage(page, "desktop");
  check("el modo y la paleta persisten tras recargar", (await menu(page).getByRole("radio", { name: "AMOLED" }).getAttribute("aria-checked")) === "true" && (await page.evaluate(() => document.documentElement.dataset.bg)) === "amoled");
  await pickMode(page, "Portada");
  await menu(page).getByRole("radio", { name: "Portada" }).first().focus();
  await page.keyboard.press("Escape");

  // Pestaña oculta: el bucle se detiene.
  await wait(page, 500);
  const running = (await stats(page))[0]?.frames ?? 0;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(page, 150);
  const hiddenA = (await stats(page))[0].frames;
  await wait(page, 600);
  const hiddenB = (await stats(page))[0].frames;
  check("con la pestaña oculta el bucle se detiene", hiddenB === hiddenA && hiddenA >= running, `${hiddenA} → ${hiddenB}`);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(page, 500);
  check("y se reanuda al volver", (await stats(page))[0].frames > hiddenB);

  // Pérdida de contexto → respaldo CSS.
  await page.evaluate(() => document.querySelector(".now-playing canvas").getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext());
  await wait(page, 400);
  check("al perder el contexto WebGL aparece el gradiente CSS de respaldo", (await canvases(page)) === 0 && (await page.locator(".now-playing > .backdrop[style*='gradient']").count()) === 1);

  // Colapsar: el lienzo se libera.
  await page.keyboard.press("Escape");
  await page.goBack().catch(() => undefined);
  await wait(page, 500);
  if ((await page.locator(".now-playing").count()) > 0) await page.locator('.now-header button[aria-label="Cerrar reproductor"]').click();
  await wait(page, 400);
  check("al colapsar el reproductor se libera el lienzo y vuelve el tinte", (await canvases(page)) === 0 && (await stats(page)).length === 0 && (await page.locator(".tint").count()) === 1);
  check("sin errores de página (escritorio)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Degradación automática con cuadros lentos ─────────────
{
  const { page, context } = await open(browser);
  await expand(page);
  // Dispositivo flojo simulado: otra tarea ocupa 30 ms del hilo principal en cada cuadro (≈ 25 fps cuando se piden 60).
  await page.evaluate(() => {
    const burn = () => {
      const start = performance.now();
      while (performance.now() - start < 30);
      requestAnimationFrame(burn);
    };
    requestAnimationFrame(burn);
  });
  await wait(page, 6000);
  const level = (await stats(page))[0].level;
  check("con cuadros lentos el fondo baja de calidad solo (menos manchas y menos cuadros)", level >= 1, `nivel ${level}`);
  await context.close();
}

// ───────────── Movimiento reducido ─────────────
{
  const { page, errors, context } = await open(browser, { reducedMotion: "reduce" });
  await expand(page);
  check("con prefers-reduced-motion no hay lienzo ni bucle", (await canvases(page)) === 0 && (await stats(page)).length === 0);
  check("y el fondo es un gradiente CSS", (await page.locator(".now-playing > .backdrop[style*='gradient']").count()) === 1);
  await wait(page, 1500); // la paleta de la portada se calcula en segundo plano: que ya esté asentada
  const one = await shot(page, ".now-playing > .backdrop");
  await wait(page, 1200);
  const two = await shot(page, ".now-playing > .backdrop");
  check("con prefers-reduced-motion nada se mueve", same(one, two));
  await openBackgroundPage(page, "desktop");
  check("el menú avisa de que el fondo no se anima", (await menu(page).locator(".hint[role=status]").innerText()).includes("menos movimiento"));
  check("sin errores de página (movimiento reducido)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Sin WebGL ─────────────
{
  const noGl = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-3d-apis", "--disable-gpu"] });
  const { page, errors, context } = await open(noGl);
  await expand(page);
  await wait(page, 500);
  check("sin WebGL: gradiente CSS de respaldo, sin lienzo y sin errores", (await canvases(page)) === 0 && (await page.locator(".now-playing > .backdrop[style*='gradient']").count()) === 1 && errors.length === 0, errors.join(" | "));
  await context.close();
  await noGl.close();
}

// ───────────── Móvil 390x844 ─────────────
{
  const { page, errors, context } = await open(browser, { viewport: { width: 390, height: 844 }, touch: true });
  await expand(page);
  await page.screenshot({ path: join(shots, "fondo-07-portada-390x844.png") });
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').tap();
  await wait(page, 400);
  await menu(page).getByRole("button", { name: /^Fondo/ }).tap();
  await wait(page, 500);
  check("móvil: página «Fondo» abierta con vista previa", (await heading(page).innerText()) === "Fondo" && (await canvases(page)) === 2);
  check("móvil: sin scroll horizontal en «Fondo»", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const small = await menu(page).evaluate((dialog) => [...dialog.querySelectorAll("button, input, [role=radio], [role=switch]")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map((el) => `${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
  check("móvil: áreas táctiles ≥ 44 px en «Fondo»", small.length === 0, small.join(" | "));
  await page.screenshot({ path: join(shots, "fondo-08-menu-portada-390x844.png") });
  await menu(page).getByRole("radio", { name: "Ritmo" }).tap();
  await menu(page).locator(".menu-body").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await wait(page, 300);
  await page.screenshot({ path: join(shots, "fondo-09-menu-ritmo-abajo-390x844.png") });
  check("móvil: sin errores de página", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones del fondo pasaron");
process.exit(failed ? 1 : 0);
