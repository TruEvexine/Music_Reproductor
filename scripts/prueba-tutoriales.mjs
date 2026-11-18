// Prueba de los avisos de primera vez en Chromium contra `npm run dev`. Uso: node scripts/prueba-tutoriales.mjs [url-base] [carpeta-capturas]
// Comprueba: uno a la vez y solo al encontrar cada cosa; en el flujo (no tapan nada); «Entendido» y «Omitir todos» se guardan en local;
// hacer el gesto también lo da por visto; Ajustes → Accesibilidad → «Ver tutoriales otra vez» los devuelve; Ayuda no dispara ninguno; con
// movimiento reducido no hay transiciones.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.waitForTimeout(400);
  return { context, page };
}
const addMusic = async (page) => {
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForTimeout(2200);
};
const tips = (page) => page.locator(".tip");
const tipText = (page) => tips(page).first().innerText().catch(() => "");
const box = (page, selector) => page.locator(selector).first().boundingBox();
// Gesto táctil real (eventos de puntero con pointerType "touch") por el protocolo de Chrome.
async function swipe(page, from, to) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", from.x, from.y);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", from.x + ((to.x - from.x) * i) / 8, from.y);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd");
  await page.waitForTimeout(300);
}

// ── 1. Móvil (dedo): fila deslizable, reproductor grande, omitir y volver a verlos ──
{
  const { context, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await addMusic(page);
  await page.waitForTimeout(400);
  check("móvil: al ver filas deslizables sale el aviso de deslizar, uno solo", (await tips(page).count()) === 1 && /Desliza una canción/.test(await tipText(page)), await tipText(page));

  // Sin música todavía no hay barra del reproductor: debajo del aviso están las pestañas.
  const [tip, main, nav] = [await box(page, ".tip"), await box(page, ".main"), await box(page, ".nav")];
  check(
    "móvil: el aviso está en el flujo, entre el contenido y las pestañas, sin solaparlos",
    Boolean(tip && main && nav) && tip.y >= main.y + main.height - 1 && tip.y + tip.height <= nav.y + 1,
    JSON.stringify({ tip, mainBottom: main && main.y + main.height, navTop: nav?.y }),
  );
  if (shots) await page.screenshot({ path: join(shots, "tutorial-fila-390x844.png") });
  const small = await page.evaluate(() => [...document.querySelectorAll(".tip button")].filter((el) => el.getBoundingClientRect().height < 44).length);
  check("móvil: los botones del aviso miden 44 px o más", small === 0);

  // Hacer el gesto lo da por visto, sin pulsar «Entendido».
  const row = await page.locator(".track-row").first().boundingBox();
  await swipe(page, { x: row.x + 40, y: row.y + row.height / 2 }, { x: row.x + 240, y: row.y + row.height / 2 });
  check("móvil: deslizar una fila de verdad cierra el aviso", (await tips(page).count()) === 0);
  await page.reload();
  await page.waitForTimeout(1500);
  check("móvil: tras recargar no vuelve (se guardó en local)", (await tips(page).count()) === 0);

  // Reproductor grande: aviso propio dentro, sin tapar los controles.
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(700);
  await page.locator(".bar-track").click();
  await page.waitForTimeout(700);
  check("móvil: al abrir el reproductor grande sale su aviso (portada y cerrar)", (await tips(page).count()) === 1 && /portada/.test(await tipText(page)), await tipText(page));
  const [seek, hint] = [await box(page, ".now-playing .range"), await box(page, ".tip")];
  check("móvil: el aviso del reproductor no solapa la barra de progreso", Boolean(hint && seek) && hint.y + hint.height <= seek.y + 1, JSON.stringify({ hint, seek }));
  if (shots) await page.screenshot({ path: join(shots, "tutorial-reproductor-390x844.png") });
  await page.getByRole("button", { name: "Omitir todos" }).click();
  await page.waitForTimeout(300);
  check("móvil: «Omitir todos» quita el aviso", (await tips(page).count()) === 0);
  await page.getByRole("button", { name: "Cerrar reproductor" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator(".bar-track").click();
  await page.waitForTimeout(700);
  check("móvil: omitidos y recargado, no sale ninguno más", (await tips(page).count()) === 0);
  await page.getByRole("button", { name: "Cerrar reproductor" }).click();
  await page.waitForTimeout(500);

  // Ajustes → Ver tutoriales otra vez.
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Ver tutoriales otra vez" }).click();
  await page.waitForTimeout(300);
  check("móvil: «Ver tutoriales otra vez» confirma sin abrir nada encima", (await tips(page).count()) === 0 && (await page.getByText("volverá a salir").count()) === 1);
  check("móvil: «Ver tutoriales otra vez» sigue en Ajustes → Accesibilidad (no se movió a Acerca de)", (await page.getByRole("region", { name: "Accesibilidad" }).getByRole("button", { name: "Ver tutoriales otra vez" }).count()) === 1);
  // Ayuda explica con texto (Empezar, atajos, gestos): visitarla no dispara ningún aviso, ni siquiera con todos recién devueltos.
  await page.locator(".nav").getByRole("link", { name: "Ayuda", exact: true }).click();
  await page.waitForTimeout(500);
  check("móvil: en Ayuda no sale ningún aviso de primera vez", (await tips(page).count()) === 0 && (await page.getByRole("heading", { level: 2, name: "Empezar" }).count()) === 1);
  await page.locator(".nav").getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.waitForTimeout(600);
  check("móvil: de vuelta en la biblioteca el aviso de deslizar vuelve a salir", (await tips(page).count()) === 1 && /Desliza una canción/.test(await tipText(page)));
  await page.getByRole("button", { name: "Entendido" }).click();
  await page.waitForTimeout(300);
  check("móvil: «Entendido» lo quita", (await tips(page).count()) === 0);
  await context.close();
}

// ── 2. Escritorio (puntero): atajos y reproductor grande con teclado ──
{
  const { context, page } = await open({ viewport: { width: 1440, height: 900 } });
  await addMusic(page);
  check("escritorio: al ver filas no sale el aviso de deslizar (el ratón no desliza)", (await tips(page).count()) === 0);
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(800);
  check("escritorio: al sonar la primera canción sale el aviso de atajos, uno solo", (await tips(page).count()) === 1 && /atajos/.test(await tipText(page)), await tipText(page));
  const [tip, main, bar] = [await box(page, ".tip"), await box(page, ".main"), await box(page, ".player-bar")];
  check("escritorio: la franja no tapa el contenido ni la barra", tip.y >= main.y + main.height - 1 && tip.y + tip.height <= bar.y + 1 && tip.x >= main.x - 1);
  if (shots) await page.screenshot({ path: join(shots, "tutorial-atajos-1440x900.png") });
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("escritorio: abrir la lista de atajos lo da por visto", (await tips(page).count()) === 0);
  await page.locator(".bar-track").click();
  await page.waitForTimeout(700);
  check("escritorio: el reproductor grande avisa de ← → y Esc", (await tips(page).count()) === 1 && /Esc/.test(await tipText(page)), await tipText(page));
  await context.close();
}

// ── 3. Movimiento reducido: sin transiciones ──
{
  const { context, page } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await addMusic(page);
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(800);
  const duration = await page.locator(".tip").first().evaluate((el) => Math.max(...getComputedStyle(el).transitionDuration.split(",").map((value) => parseFloat(value) * (value.includes("ms") ? 1 : 1000))));
  check("movimiento reducido: el aviso no tiene transición (≤ 0,01 ms)", duration <= 0.011, `${duration} ms`);
  await page.getByRole("button", { name: "Entendido" }).click();
  await page.waitForTimeout(40);
  check("movimiento reducido: al descartarlo desaparece al instante", (await tips(page).count()) === 0);
  await context.close();
}

check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
