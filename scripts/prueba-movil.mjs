// Prueba de los gestos móviles y la landing (bloque P2) en Chromium contra `npm run dev`.
// Uso: node scripts/prueba-movil.mjs [url-base]. Los gestos son táctiles de verdad (CDP Input.dispatchTouchEvent → Pointer Events
// con pointerType "touch", y touch-action aplicado por el navegador). Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
// isMobile: como en un teléfono, soltar tras una pulsación larga genera un "click" (cae en el fondo de la hoja recién abierta).
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const cdp = await context.newCDPSession(page);

/** Dedo real: baja, se mueve en pasos y sube. `hold` = ms quieto antes de soltar. */
async function touch(from, to = from, { steps = 10, hold = 0 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps && (to.x !== from.x || to.y !== from.y); i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }] });
    await page.waitForTimeout(16);
  }
  if (hold) await page.waitForTimeout(hold);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const center = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};
const count = (selector) => page.locator(selector).count();
const row = (index) => page.locator(".track-row").nth(index);
const queueTitles = async () => {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" })));
  await page.waitForTimeout(350);
  const titles = await page.locator(".queue-row .title").allInnerTexts();
  return titles;
};
const closeQueue = async () => {
  if ((await count(".queue-panel")) === 0) return;
  await page.goBack();
  await page.waitForTimeout(300);
};
// Tras una secuencia táctil cruda (CDP) Chromium pierde el primer toque siguiente (no genera "click"): un toque neutro lo asienta.
// Es una rareza del emulador, no de un dedo real.
const settle = () => page.touchscreen.tap(3, 3);
const toastText = () => page.locator(".toast").innerText().catch(() => "");
const nowTitle = () => page.locator(".bar-track .title").innerText();

await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles(files);
await page.waitForTimeout(2500);
await row(0).locator(".row-main").tap();
await page.waitForTimeout(800);
await page.locator(".bar-mini").getByRole("button", { name: "Pausar" }).tap(); // las pistas de prueba duran 6-8 s: en pausa, la actual no cambia sola
await page.waitForTimeout(300);
const [A, M, N] = ["Amanecer en La", "Marea de Fase", "Noventa y Seis Mil"];
let titles = await queueTitles();
check("base: la cola es el contexto de la lista", JSON.stringify(titles) === JSON.stringify([A, M, N]), titles.join(" | "));
await closeQueue();

// ───────────── Deslizar filas de la biblioteca ─────────────
check("las filas dejan el scroll vertical al navegador (touch-action: pan-y)", (await row(2).evaluate((el) => getComputedStyle(el).touchAction)) === "pan-y");
let at = await center(row(2));
await touch({ x: 80, y: at.y }, { x: 260, y: at.y });
await page.waitForTimeout(300);
check("deslizar a la derecha: «Reproducir a continuación» con aviso", (await toastText()).includes("Sonará a continuación"), await toastText());
check("la pista no empezó a sonar (el clic del gesto se descarta)", (await nowTitle()) === A);
titles = await queueTitles();
check("queda justo detrás de la que suena", JSON.stringify(titles) === JSON.stringify([A, N, M]), titles.join(" | "));
await closeQueue();
await settle();
await page.locator(".toast").getByRole("button", { name: "Deshacer" }).tap();
await page.waitForTimeout(300);
titles = await queueTitles();
check("Deshacer devuelve la cola de antes", JSON.stringify(titles) === JSON.stringify([A, M, N]), titles.join(" | "));
await closeQueue();

at = await center(row(1));
await touch({ x: 80, y: at.y }, { x: 140, y: at.y }); // por debajo del umbral
await page.waitForTimeout(300);
const shortSwipeTitles = await queueTitles();
await closeQueue();
check("un deslizamiento corto no arma la acción", (await count(".toast")) === 0 && JSON.stringify(shortSwipeTitles) === JSON.stringify([A, M, N]), shortSwipeTitles.join(" | "));

// ───────────── Pulsación larga → hoja de acciones ─────────────
at = await center(row(2));
await touch({ x: 120, y: at.y }, { x: 120, y: at.y }, { hold: 700 });
await page.waitForTimeout(400);
check("pulsación larga abre la hoja de acciones con la pista", (await count("dialog.dialog[open]")) === 1 && (await page.locator("dialog.dialog[open] h2").innerText()) === N);
check("y no reproduce la pista al soltar", (await nowTitle()) === A);
const actions = await page.locator("dialog.dialog[open] .sheet-action").allInnerTexts();
check("la hoja ofrece reproducir, a continuación, a la cola (también si ya está en la cola) y editar", actions.join("|") === "Reproducir|Reproducir a continuación|Añadir a la cola|Editar información", actions.join("|"));
check("áreas táctiles de la hoja ≥ 44 px", await page.evaluate(() => [...document.querySelectorAll("dialog.dialog[open] button")].every((b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44)));
// 10 pulsaciones largas de 520 a 952 ms: la hoja sigue abierta tras soltar todas las veces (el clic de soltar se descarta).
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
let stayedOpen = 0;
for (let i = 0; i < 10; i++) {
  at = await center(row(2));
  await touch({ x: 120, y: at.y }, { x: 120, y: at.y }, { hold: 520 + i * 48 });
  await page.waitForTimeout(450);
  if ((await count("dialog.dialog[open]")) === 1) stayedOpen += 1;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}
check("pulsación larga: la hoja sigue abierta al soltar, 10 de 10", stayedOpen === 10, `${stayedOpen}/10`);
await touch({ x: 120, y: at.y }, { x: 120, y: at.y }, { hold: 700 });
await page.waitForTimeout(400);
// Arrastrar la cabecera hacia abajo cierra la hoja.
const head = await center(page.locator("dialog.dialog[open] .dialog-header h2"));
await touch({ x: head.x, y: head.y }, { x: head.x, y: head.y + 300 }, { steps: 8 });
await page.waitForTimeout(500);
check("arrastrar la cabecera de la hoja hacia abajo la cierra", (await count("dialog.dialog[open]")) === 0);
// Y con el menú contextual (alternativa de teclado / ratón): Shift+F10 sobre el botón de la fila.
await row(2).locator(".row-main").focus();
await page.keyboard.press("Shift+F10");
await page.waitForTimeout(300);
let viaKeyboard = (await count("dialog.dialog[open]")) === 1;
if (!viaKeyboard) {
  await page.keyboard.press("ContextMenu");
  await page.waitForTimeout(300);
  viaKeyboard = (await count("dialog.dialog[open]")) === 1;
}
check("sin gestos: la tecla de menú contextual abre la hoja de la pista enfocada", viaKeyboard && (await page.locator("dialog.dialog[open] h2").first().innerText()) === N, await page.locator("dialog.dialog[open] h2").first().innerText().catch(() => "—"));
await page.locator("dialog.dialog[open]").getByRole("button", { name: "Reproducir a continuación" }).click();
await page.waitForTimeout(400);
check("la hoja ejecuta la acción, se cierra y avisa", (await count("dialog.dialog[open]")) === 0 && (await toastText()).includes("Sonará a continuación"));
titles = await queueTitles();
check("«Reproducir a continuación» desde la hoja reordena la cola", JSON.stringify(titles) === JSON.stringify([A, N, M]), titles.join(" | "));

// ───────────── Deslizar filas de la cola ─────────────
const queueRow = (index) => page.locator(".queue-row").nth(index);
at = await center(queueRow(2)); // Marea
await touch({ x: 300, y: at.y }, { x: 90, y: at.y });
await page.waitForTimeout(300);
titles = await page.locator(".queue-row .title").allInnerTexts();
check("cola: deslizar a la izquierda quita la pista", JSON.stringify(titles) === JSON.stringify([A, N]) && (await toastText()).includes("Quitada"), titles.join(" | "));
await settle();
await page.locator(".toast").getByRole("button", { name: "Deshacer" }).tap();
await page.waitForTimeout(300);
titles = await page.locator(".queue-row .title").allInnerTexts();
check("cola: Deshacer la devuelve a su sitio", JSON.stringify(titles) === JSON.stringify([A, N, M]), titles.join(" | "));
at = await center(queueRow(2));
await touch({ x: 80, y: at.y }, { x: 270, y: at.y });
await page.waitForTimeout(300);
titles = await page.locator(".queue-row .title").allInnerTexts();
check("cola: deslizar a la derecha la sube detrás de la actual", JSON.stringify(titles) === JSON.stringify([A, M, N]), titles.join(" | "));
check("cola: la fila que suena no se puede quitar deslizando (sin acción a la izquierda)", await (async () => {
  const y = (await center(queueRow(0))).y;
  await touch({ x: 300, y }, { x: 90, y });
  await page.waitForTimeout(250);
  return (await page.locator(".queue-row").count()) === 3;
})());
await closeQueue();

// ───────────── Reproductor grande: hoja que se arrastra hacia abajo ─────────────
await settle();
await page.locator(".bar-track").tap();
await page.waitForTimeout(700);
check("el reproductor grande ocupa toda la pantalla", await page.locator(".now-playing").evaluate((el) => { const r = el.getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight && r.top === 0; }));
const art = await center(page.locator(".now-art"));
await touch({ x: art.x, y: art.y }, { x: art.x, y: art.y + 40 }, { steps: 10, hold: 400 }); // corto y lento
await page.waitForTimeout(400);
check("un arrastre corto no lo cierra", (await count(".now-playing")) === 1 && (await page.locator(".now-playing").evaluate((el) => el.style.transform)) === "");
const seek = await center(page.locator(".now-controls .seek input"));
await touch({ x: seek.x - 60, y: seek.y }, { x: seek.x + 60, y: seek.y + 120 }, { steps: 6 });
await page.waitForTimeout(400);
check("arrastrar el control de posición no cierra el reproductor", (await count(".now-playing")) === 1);

// ───────────── Deslizador: al pulsar se engrosa; alejarse en vertical es el ajuste fino ─────────────
{
  const range = page.locator(".now-controls .seek .range");
  const box = (await range.boundingBox());
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * 0.1;
  const value = async () => Number(await page.locator(".now-controls .seek input").inputValue());
  const move = (x, yy) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: yy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  await move(x0 + 12, y);
  await page.waitForTimeout(250); // tras la transición (--fast)
  const pressed = await range.evaluate((el) => ({ active: el.hasAttribute("data-active"), rail: getComputedStyle(el.querySelector(".range-rail")).transform, thumb: getComputedStyle(el.querySelector(".range-thumb")).opacity }));
  const start = await value();
  for (let i = 1; i <= 6; i++) await move(x0 + 12, y - i * 20); // se aleja 120 px hacia arriba: ¼ de velocidad
  for (let i = 1; i <= 9; i++) {
    await move(x0 + 12 + i * 20, y - 120);
    await page.waitForTimeout(16);
  }
  const fine = await value();
  const bubble = await page.locator(".now-controls .range-value").innerText().catch(() => "");
  if (process.env.CAPTURA_DESLIZADOR) await page.screenshot({ path: process.env.CAPTURA_DESLIZADOR });
  for (let i = 1; i <= 6; i++) await move(x0 + 192, y - 120 + i * 20); // vuelve a la barra: velocidad normal
  for (let i = 1; i <= 9; i++) {
    await move(x0 + 192 + i * 10, y);
    await page.waitForTimeout(16);
  }
  const normal = await value();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  const expectedNormal = (90 / box.width) * (await page.locator(".now-controls .seek input").getAttribute("max"));
  check("deslizador: al pulsar se engrosa la barra y aparece el tirador", pressed.active && pressed.rail === "none" && pressed.thumb === "1", JSON.stringify(pressed));
  check("deslizador: alejarse 120 px en vertical ajusta a ¼ de velocidad y muestra el valor", fine - start <= 1.5 && bubble.includes("Fino ¼"), `${start} → ${fine} s en 180 px · «${bubble}»`);
  check("deslizador: de vuelta en la barra, velocidad normal", normal - fine >= expectedNormal - 1.5, `${fine} → ${normal} s en 90 px (esperado ≈ ${expectedNormal.toFixed(1)})`);
  check("deslizador: al soltar vuelve a su grosor y el reproductor sigue abierto", !(await range.evaluate((el) => el.hasAttribute("data-active"))) && (await count(".now-playing")) === 1);
}

// ───────────── Carrusel de portadas ─────────────
const nowPlayingTitle = () => page.locator(".now-title").innerText();
const railOffset = () => page.locator(".now-track").evaluate((el) => el.style.getPropertyValue("--dx"));
check("carrusel: en reposo la vecina espera fuera de la pantalla", await page.locator('.now-slot[data-side="next"]').evaluate((el) => el.getBoundingClientRect().left >= innerWidth));
await touch({ x: art.x + 60, y: art.y }, { x: art.x + 20, y: art.y + 4 }, { steps: 6 }); // corto: no llega al umbral
await page.waitForTimeout(400);
check("carrusel: un deslizamiento corto vuelve a su sitio", (await nowPlayingTitle()) === A && ["", "0px"].includes(await railOffset()) && (await count(".now-playing")) === 1);
// A mitad del gesto la portada sigue al dedo y la siguiente asoma.
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: art.x + 120, y: art.y }] });
for (let i = 1; i <= 8; i++) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: art.x + 120 - i * 20, y: art.y + 2 }] });
  await page.waitForTimeout(16);
}
const peek = await page.locator('.now-slot[data-side="next"]').evaluate((el) => el.getBoundingClientRect().left);
check("carrusel: a mitad del gesto la portada sigue al dedo y la siguiente asoma", (await railOffset()) === "-160px" && peek < 390, `vecina en x=${Math.round(peek)}`);
if (process.env.CAPTURA_CARRUSEL) await page.screenshot({ path: process.env.CAPTURA_CARRUSEL });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(700);
check("carrusel: deslizar a la izquierda pasa a la siguiente", (await nowPlayingTitle()) === M && (await nowTitle()) === M, await nowPlayingTitle());
check("carrusel: el carril vuelve a 0 con la nueva portada en el centro", ["", "0px"].includes(await railOffset()));
await touch({ x: art.x - 120, y: art.y }, { x: art.x + 180, y: art.y + 4 }, { steps: 8 });
await page.waitForTimeout(700);
check("carrusel: deslizar a la derecha vuelve a la anterior", (await nowPlayingTitle()) === A, await nowPlayingTitle());
await touch({ x: art.x - 120, y: art.y }, { x: art.x + 180, y: art.y + 4 }, { steps: 8 });
await page.waitForTimeout(700);
check("carrusel: sin anterior, resiste y se queda", (await nowPlayingTitle()) === A && ["", "0px"].includes(await railOffset()));
await page.locator(".now-controls").getByRole("button", { name: "Pausar" }).tap(); // las pistas duran segundos: en pausa no cambian solas
await page.waitForTimeout(300);

await touch({ x: art.x, y: art.y - 100 }, { x: art.x, y: art.y + 300 }, { steps: 8 });
await page.waitForTimeout(700);
check("arrastrar hacia abajo lo cierra y vuelve a la biblioteca", (await count(".now-playing")) === 0 && !page.url().includes("panel="), page.url());
await page.locator(".bar-track").tap();
await page.waitForTimeout(600);
await page.locator('.now-header button[aria-label="Cerrar reproductor"]').tap();
await page.waitForTimeout(400);
check("alternativa sin gesto: el botón ⌄ también lo cierra", (await count(".now-playing")) === 0);

// Una canción puede ir varias veces a la cola: cada copia es una entrada propia.
at = await center(row(1));
await touch({ x: 260, y: at.y }, { x: 80, y: at.y });
await page.waitForTimeout(300);
check("deslizar a la izquierda aunque ya esté en la cola: añade otra copia y avisa", (await toastText()).includes("Añadida a la cola"), await toastText());
titles = await queueTitles();
check("la misma canción queda dos veces en la cola", JSON.stringify(titles) === JSON.stringify([A, M, N, M]), titles.join(" | "));
at = await center(page.locator(".queue-row").nth(3));
await touch({ x: 300, y: at.y }, { x: 90, y: at.y });
await page.waitForTimeout(300);
titles = await page.locator(".queue-row .title").allInnerTexts();
check("quitar una copia deja la otra y la que suena sigue", JSON.stringify(titles) === JSON.stringify([A, M, N]) && (await nowTitle()) === A, titles.join(" | "));
await closeQueue();
check("sin errores de página", errors.length === 0, errors.join(" | "));
await context.close();

// ───────────── Landing ─────────────
for (const [name, viewport, touchOn] of [["móvil 390", { width: 390, height: 844 }, true], ["escritorio 1440", { width: 1440, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport, hasTouch: touchOn });
  const p = await ctx.newPage();
  const problems = [];
  p.on("pageerror", (error) => problems.push(error.message));
  await p.goto(`${base}/`);
  await p.waitForTimeout(900);
  check(`landing ${name}: sin scroll horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const h1 = await p.evaluate(() => { const el = document.querySelector("h1"); const s = getComputedStyle(el); return Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight)); });
  check(`landing ${name}: el título cabe en dos líneas`, h1 <= 2, `${h1} líneas`);
  check(`landing ${name}: el botón principal está en la primera pantalla`, await p.evaluate(() => { const r = document.querySelector(".landing-copy .button.primary").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
  await p.waitForTimeout(800);
  check(`landing ${name}: las cinco capturas cargan`, await p.evaluate(() => [...document.querySelectorAll(".landing img")].every((img) => img.complete && img.naturalWidth > 0)) && (await p.locator(".landing img").count()) >= 4);
  check(`landing ${name}: todo aparece tras desplazarse (nada se queda oculto)`, await p.evaluate(() => [...document.querySelectorAll("[data-reveal]")].every((el) => el.hasAttribute("data-in") && getComputedStyle(el).opacity === "1")));
  await p.locator(".landing-close .button.primary").click();
  await p.waitForTimeout(500);
  check(`landing ${name}: el botón abre la app`, new URL(p.url()).pathname === "/app");
  check(`landing ${name}: sin errores de página`, problems.length === 0, problems.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones móviles pasaron");
process.exit(failed ? 1 : 0);
