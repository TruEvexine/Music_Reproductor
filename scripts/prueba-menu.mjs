// Prueba del menú del reproductor (≡) en Chromium contra `npm run dev`. Uso: node scripts/prueba-menu.mjs [url-base] [carpeta-capturas]
// Móvil 390x844 con toque (hoja inferior) y escritorio 1440x900 con teclado (popover): se abre desde el mini/barra y desde el
// reproductor expandido, se navegan los submenús, se comprueba que no hay scroll horizontal y que cada ajuste llega al grafo
// de audio real (`window.__engine.snapshot()`, solo existe en desarrollo). Sale con 1 si algo falla.
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

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

async function open(viewport, touch) {
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/app`);
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.waitForTimeout(2500);
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(800);
  return { page, errors, context };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const engine = (page) => page.evaluate(() => window.__engine.snapshot());
const menu = (page) => page.locator("dialog.menu[open]");
const heading = (page) => menu(page).locator(".menu-head h2");
const setRange = (locator, value) =>
  locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
const smallTargets = (page) =>
  menu(page).evaluate((dialog) =>
    [...dialog.querySelectorAll("button, input, [role=radio], [role=switch]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.width < 44 || r.height < 44);
      })
      .map((el) => `${el.getAttribute("aria-label") ?? el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );

// ───────────── Móvil: toque, hoja inferior ─────────────
{
  const { page, errors, context } = await open({ width: 390, height: 844 }, true);
  const mini = page.locator('.bar-mini button[aria-label="Menú del reproductor"]');

  await mini.tap();
  await page.waitForTimeout(400);
  check("móvil: el ≡ del mini reproductor abre una hoja inferior", (await menu(page).getAttribute("data-presentation")) === "sheet");
  check("móvil: la cabecera dice «Menú»", (await heading(page).innerText()) === "Menú");
  check("móvil: sin scroll horizontal (raíz)", await noOverflow(page));
  check("móvil: áreas táctiles ≥ 44 px en la raíz", (await smallTargets(page)).length === 0, (await smallTargets(page)).join(" | "));
  await page.screenshot({ path: join(shots, "menu-01-raiz-390x844.png") });

  // Reproducción: Repetir y Aleatorio llegan al store (lo refleja el aria-checked).
  await menu(page).getByRole("radio", { name: "Cola" }).tap();
  check("móvil: Repetir → Cola", (await menu(page).getByRole("radio", { name: "Cola" }).getAttribute("aria-checked")) === "true");
  await menu(page).getByRole("radio", { name: "Canción" }).tap();
  check("móvil: Repetir → Canción", (await menu(page).getByRole("radio", { name: "Canción" }).getAttribute("aria-checked")) === "true");
  await menu(page).getByRole("radio", { name: "Apagado" }).first().tap();
  await menu(page).getByRole("switch", { name: "Aleatorio" }).tap();
  check("móvil: Aleatorio se activa", (await menu(page).getByRole("switch", { name: "Aleatorio" }).getAttribute("aria-checked")) === "true");
  await menu(page).getByRole("switch", { name: "Aleatorio" }).tap();

  // Sonido → Ecualizador (profundidad dentro del mismo panel).
  await menu(page).getByRole("button", { name: /^Sonido/ }).tap();
  await page.waitForTimeout(300);
  check("móvil: «Sonido» abre su página en el mismo panel", (await heading(page).innerText()) === "Sonido" && (await page.locator("dialog.menu[open]").count()) === 1);
  check("móvil: sin scroll horizontal (sonido)", await noOverflow(page));
  await page.screenshot({ path: join(shots, "menu-02-sonido-390x844.png") });

  await setRange(menu(page).getByLabel(/Velocidad/), 1.5);
  await page.waitForTimeout(200);
  check("móvil: la velocidad llega al reproductor (playbackRate 1.5)", (await engine(page)).rate === 1.5, `rate=${(await engine(page)).rate}`);
  await menu(page).getByRole("button", { name: "Velocidad normal" }).tap();
  check("móvil: «Velocidad normal» la restablece", (await engine(page)).rate === 1);

  await menu(page).getByRole("button", { name: /^Ecualizador/ }).tap();
  await page.waitForTimeout(300);
  check("móvil: segundo nivel «Ecualizador»", (await heading(page).innerText()) === "Ecualizador");
  check("móvil: sin scroll horizontal (ecualizador)", await noOverflow(page));
  check("móvil: áreas táctiles ≥ 44 px en el ecualizador", (await smallTargets(page)).length === 0, (await smallTargets(page)).join(" | "));
  await menu(page).getByRole("radio", { name: "Graves" }).tap();
  await page.waitForTimeout(200);
  let snapshot = await engine(page);
  check("móvil: el preajuste «Graves» llega a los filtros (62 Hz = +5 dB)", snapshot.eq[1] === 5, `eq=${snapshot.eq}`);
  await setRange(menu(page).getByLabel(/^Graves/), 4);
  await setRange(menu(page).getByLabel(/^Agudos/), -3);
  await setRange(menu(page).getByLabel(/^Balance/), -0.5);
  await setRange(menu(page).getByLabel(/^Preamplificación/), 2);
  await page.waitForTimeout(200);
  snapshot = await engine(page);
  check("móvil: graves, agudos y balance llegan al grafo", snapshot.bass === 4 && snapshot.treble === -3 && Math.abs(snapshot.pan + 0.5) < 0.01, JSON.stringify(snapshot));
  check("móvil: preamp = compensación automática (−6) + 2", Math.abs(snapshot.preamp - 10 ** (-4 / 20)) < 0.01, `preamp=${snapshot.preamp}`);
  await page.screenshot({ path: join(shots, "menu-03-ecualizador-390x844.png"), fullPage: false });
  await menu(page).locator(".menu-body").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.screenshot({ path: join(shots, "menu-04-ecualizador-abajo-390x844.png") });

  await menu(page).getByRole("button", { name: "Volver a Sonido" }).tap();
  check("móvil: la flecha vuelve a «Sonido»", (await heading(page).innerText()) === "Sonido");
  await menu(page).getByRole("button", { name: "Volver a Menú" }).tap();
  check("móvil: y de ahí al menú", (await heading(page).innerText()) === "Menú");

  // Temporizador.
  await menu(page).getByRole("button", { name: /^Temporizador/ }).tap();
  await menu(page).getByRole("button", { name: "Al terminar la canción" }).tap();
  check("móvil: temporizador al terminar la canción", (await menu(page).locator('[role="status"]').innerText()).includes("al terminar esta canción"));
  await page.screenshot({ path: join(shots, "menu-05-temporizador-390x844.png") });
  await menu(page).getByRole("button", { name: "Cancelar temporizador" }).tap();
  await menu(page).getByRole("button", { name: "Volver a Menú" }).tap();

  // Arrastre de la cabecera: cierra la hoja.
  const grabber = await menu(page).locator(".menu-grabber").boundingBox();
  await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + 2 + step * 25);
  await page.mouse.up();
  await page.waitForTimeout(500);
  check("móvil: arrastrar la hoja hacia abajo la cierra", (await menu(page).count()) === 0);
  check("móvil: al cerrar, el foco vuelve al icono ≡", await mini.evaluate((el) => el === document.activeElement));

  // Un arrastre corto la devuelve a su sitio sin cerrarla.
  await mini.tap();
  await page.waitForTimeout(400);
  const handle = await menu(page).locator(".menu-grabber").boundingBox();
  await page.mouse.move(handle.x + 10, handle.y + 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10, handle.y + 30, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  check("móvil: un arrastre corto no la cierra", (await menu(page).count()) === 1);
  await page.keyboard.press("Escape");
  check("móvil: Escape cierra", (await menu(page).count()) === 0);

  // Desde el reproductor expandido.
  await page.locator(".bar-track").tap();
  await page.waitForTimeout(400);
  const header = page.locator('.now-header button[aria-label="Menú del reproductor"]');
  await header.tap();
  await page.waitForTimeout(400);
  check("móvil: el ≡ del reproductor expandido abre el menú", (await menu(page).count()) === 1 && (await page.locator(".now-playing").count()) === 1);
  await page.screenshot({ path: join(shots, "menu-06-desde-expandido-390x844.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("móvil: Escape cierra el menú pero no el reproductor expandido", (await menu(page).count()) === 0 && (await page.locator(".now-playing").count()) === 1);
  check("móvil: Aleatorio y Repetir siguen a un toque en el expandido", (await page.locator(".now-controls .transport-large").getByRole("button", { name: /Aleatorio/ }).count()) === 1 && (await page.locator(".now-controls .transport-large").getByRole("button", { name: /Repet/ }).count()) === 1);
  check("móvil: sin errores de página", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Escritorio: teclado, popover ─────────────
{
  const { page, errors, context } = await open({ width: 1440, height: 900 }, false);
  const trigger = page.locator('.bar-end button[aria-label="Menú del reproductor"]');
  await trigger.click();
  await page.waitForTimeout(300);
  check("escritorio: el ≡ de la barra abre un popover", (await menu(page).getAttribute("data-presentation")) === "popover");
  const box = await menu(page).boundingBox();
  const anchor = await trigger.boundingBox();
  check("escritorio: el popover queda dentro de la ventana y encima del icono", box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= anchor.y, JSON.stringify({ box, anchorY: anchor.y }));
  check("escritorio: sin scroll horizontal", await noOverflow(page));
  await page.screenshot({ path: join(shots, "menu-07-popover-1440x900.png") });

  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim().slice(0, 30));
  check("escritorio: al abrir, el foco está en el título del panel", (await focused()) === null || (await page.evaluate(() => document.activeElement?.tagName)) === "H2");
  await page.keyboard.press("ArrowDown");
  check("escritorio: ↓ pasa al primer control", (await page.evaluate(() => document.activeElement?.closest(".menu-page") !== null)));
  const first = await focused();
  await page.keyboard.press("ArrowRight");
  check("escritorio: → cambia de opción dentro del grupo", (await focused()) !== first, `${first} → ${await focused()}`);
  await page.keyboard.press("Enter");
  check("escritorio: Enter elige la opción enfocada (Repetir: Cola)", (await menu(page).getByRole("radio", { name: "Cola" }).getAttribute("aria-checked")) === "true");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");

  let trapped = true;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    trapped &&= await page.evaluate(() => document.activeElement?.closest("dialog.menu") !== null);
  }
  check("escritorio: el foco queda atrapado en el menú (40 Tab)", trapped);

  // Navegación con teclado hasta Sonido.
  await heading(page).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown"); // Apagado, Cola, Canción, Aleatorio, Sonido
  const onSound = await page.evaluate(() => document.activeElement?.textContent?.startsWith("Sonido"));
  check("escritorio: ↓ recorre los controles hasta la fila «Sonido»", onSound === true, `${await focused()}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  check("escritorio: Enter abre «Sonido»", (await heading(page).innerText()) === "Sonido");
  check("escritorio: el foco pasa al título de la nueva página", (await page.evaluate(() => document.activeElement?.tagName)) === "H2");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  check("escritorio: «Ecualizador» por teclado", (await heading(page).innerText()) === "Ecualizador");

  // Las flechas del deslizador vertical de la banda cambian su valor y llegan al grafo.
  await menu(page).getByRole("switch", { name: "Ecualizador activado" }).click();
  const band = menu(page).getByLabel("1 kHz");
  await band.focus();
  const before = (await engine(page)).eq[5];
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  const after = (await engine(page)).eq[5];
  check("escritorio: ↑ en la banda de 1 kHz sube 2 dB en el filtro real", after - before === 2, `${before} → ${after}`);
  await page.screenshot({ path: join(shots, "menu-08-ecualizador-1440x900.png") });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("escritorio: Escape cierra el menú entero", (await menu(page).count()) === 0);
  check("escritorio: el foco vuelve al icono ≡", await trigger.evaluate((el) => el === document.activeElement));

  // Persistencia: tras recargar, el EQ y la banda siguen.
  await page.reload();
  await page.waitForTimeout(1200);
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.waitForTimeout(2500);
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(600);
  await trigger.click();
  await menu(page).getByRole("button", { name: /^Sonido/ }).click();
  check("escritorio: el ajuste del ecualizador persiste tras recargar", (await menu(page).getByRole("button", { name: /^Ecualizador/ }).innerText()).includes("A medida"));
  await page.keyboard.press("Escape");

  // Desde el expandido: popover hacia abajo, junto al icono de la cabecera.
  await page.locator(".bar-track").click();
  await page.waitForTimeout(400);
  const head = page.locator('.now-header button[aria-label="Menú del reproductor"]');
  await head.click();
  await page.waitForTimeout(300);
  const popover = await menu(page).boundingBox();
  const headBox = await head.boundingBox();
  check("escritorio: desde el expandido el popover se abre debajo del icono", popover.y >= headBox.y + headBox.height && popover.x + popover.width <= 1440);
  await page.screenshot({ path: join(shots, "menu-09-desde-expandido-1440x900.png") });
  await page.keyboard.press("Escape");
  check("escritorio: Escape no cierra también el reproductor expandido", (await page.locator(".now-playing").count()) === 1);
  check("escritorio: sin errores de página", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones del menú pasaron");
process.exit(failed ? 1 : 0);
