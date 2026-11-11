// Prueba de los gestos móviles y la landing (bloque P2) en Chromium contra `npm run dev`.
// Uso: node scripts/prueba-movil.mjs [url-base]. Los gestos son táctiles de verdad (CDP Input.dispatchTouchEvent → Pointer Events
// con pointerType "touch", y touch-action aplicado por el navegador). Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
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
await touch({ x: 260, y: at.y }, { x: 80, y: at.y });
await page.waitForTimeout(250);
check("deslizar a la izquierda sin acción (ya está en la cola): la fila no se mueve ni avisa", ["", "0px"].includes(await row(1).evaluate((el) => el.style.getPropertyValue("--dx"))) && (await count(".toast")) === 0);

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
check("la hoja ofrece reproducir, a continuación y a la cola (la que ya está en la cola no)", actions.join("|") === "Reproducir|Reproducir a continuación", actions.join("|"));
check("áreas táctiles de la hoja ≥ 44 px", await page.evaluate(() => [...document.querySelectorAll("dialog.dialog[open] button")].every((b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44)));
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
await touch({ x: art.x, y: art.y - 100 }, { x: art.x, y: art.y + 300 }, { steps: 8 });
await page.waitForTimeout(700);
check("arrastrar hacia abajo lo cierra y vuelve a la biblioteca", (await count(".now-playing")) === 0 && !page.url().includes("panel="), page.url());
await page.locator(".bar-track").tap();
await page.waitForTimeout(600);
await page.locator('.now-header button[aria-label="Cerrar reproductor"]').tap();
await page.waitForTimeout(400);
check("alternativa sin gesto: el botón ⌄ también lo cierra", (await count(".now-playing")) === 0);
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
