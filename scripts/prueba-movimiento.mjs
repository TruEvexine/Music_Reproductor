// Prueba del sistema de movimiento en Chromium contra `npm run dev`. Uso: node scripts/prueba-movimiento.mjs [url-base]
// Comprueba, leyendo los estilos calculados del navegador: entradas (animación y duración), salidas (data-closing, --exit, desmontaje),
// pulsar (--press; ni en transporte ni por teclado), lo frecuente sin animación (pestañas, filas) y movimiento reducido (sin esperas).
import { chromium } from "@playwright/test";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });

async function open({ width, height, touch = false, reducedMotion = "no-preference" }) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForTimeout(2500);
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(800);
  return { page, errors, context };
}

const style = (page, selector) =>
  page.locator(selector).first().evaluate((el) => {
    const css = getComputedStyle(el);
    return { name: css.animationName, duration: parseFloat(css.animationDuration) * 1000, transitionDuration: parseFloat(css.transitionDuration) * 1000, transform: css.transform, closing: el.dataset.closing ?? null };
  });
const present = (page, selector) => page.locator(selector).count();
const scale = (transform) => (transform === "none" ? 1 : Number(transform.match(/matrix\(([\d.]+)/)?.[1] ?? NaN));
const wait = (page, ms) => page.waitForTimeout(ms);

// Abre y cierra un elemento con salida: devuelve lo observado durante la salida.
async function closeWith(page, selector, close) {
  await close();
  await wait(page, 60); // a mitad de la salida (--exit = 140 ms)
  const during = (await present(page, selector)) ? await style(page, selector) : null;
  await wait(page, 450);
  return { during, gone: (await present(page, selector)) === 0 };
}

// ───────────── Escritorio ─────────────
{
  const { page, errors, context } = await open({ width: 1440, height: 900 });

  // Diálogo: entrada --base (pop), salida --exit por la X y por Escape.
  await page.getByRole("button", { name: /Entrar|Cuenta/ }).first().click();
  await wait(page, 30);
  let s = await style(page, "dialog.dialog");
  check("diálogo (escritorio): entra con transición en --base (220 ms)", s.name === "none" && Math.round(s.transitionDuration) === 220, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 400);
  let out = await closeWith(page, "dialog.dialog", () => page.locator("dialog.dialog").getByRole("button", { name: "Cerrar" }).click());
  check("diálogo: al cerrar con la X sale con transición en --exit (140 ms) y se desmonta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  await page.getByRole("button", { name: /Entrar|Cuenta/ }).first().click();
  await wait(page, 400);
  out = await closeWith(page, "dialog.dialog", () => page.keyboard.press("Escape"));
  check("diálogo: Escape también sale con animación y se desmonta", out.during?.closing === "true" && out.gone);

  // Cola en columna fija (sin reproductor grande): sin animación y se desmonta al instante.
  await page.locator(".player-bar").getByRole("button", { name: "Cola de reproducción" }).click();
  await wait(page, 300);
  s = await style(page, ".queue-panel");
  check("cola en columna (escritorio): sin animación de entrada", s.name === "none", s.name);
  await page.locator(".queue-panel").getByRole("button", { name: "Cerrar cola" }).click();
  await wait(page, 40);
  check("cola en columna: se desmonta al instante (no hay salida que animar)", (await present(page, ".queue-panel")) === 0);

  // Frecuente: pestañas y filas sin animación.
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  await wait(page, 100);
  s = await style(page, ".tab");
  check("pestañas de biblioteca: sin transición ni animación (se usan a menudo)", s.name === "none" && s.transitionDuration === 0, `${s.name} ${s.transitionDuration}`);
  await page.getByRole("link", { name: "Canciones", exact: true }).click();
  await wait(page, 200);
  s = await style(page, ".row-main");
  check("filas de pista: sin transición ni animación", s.name === "none" && s.transitionDuration === 0, `${s.name} ${s.transitionDuration}`);

  // Pulsar: --press en un botón; nada en transporte ni por teclado.
  const button = page.locator(".split-menu-trigger, .library-actions .button, .button").first();
  await button.hover();
  await page.mouse.down();
  await wait(page, 250);
  check("pulsar un botón lo hunde a --press (0,96)", Math.abs(scale((await style(page, ".button")).transform) - 0.96) < 0.005, (await style(page, ".button")).transform);
  await page.mouse.up();
  const play = page.locator(".player-bar .transport .play-button");
  await play.hover();
  await page.mouse.down();
  await wait(page, 250);
  check("pulsar el transporte no se anima", scale((await style(page, ".player-bar .transport .play-button")).transform) === 1);
  await page.mouse.up();
  await button.focus();
  await page.keyboard.press("Tab"); // marca html[data-input="key"]
  await button.focus();
  await page.keyboard.down("Space");
  await wait(page, 250);
  check("pulsar con el teclado (Espacio) no se anima", scale((await style(page, ".button")).transform) === 1, (await style(page, ".button")).transform);
  await page.keyboard.up("Space");
  await page.keyboard.press("Escape");

  // Reproductor grande: entrada --slow, salida --exit; la cola encima también sale.
  await page.locator(".bar-track").click();
  await wait(page, 40);
  s = await style(page, ".now-playing");
  check("reproductor grande (escritorio): entra con transición en --slow (280 ms)", s.name === "none" && Math.round(s.transitionDuration) === 280, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 500);
  await page.locator(".now-playing").getByRole("button", { name: "Cola de reproducción" }).click();
  await wait(page, 40);
  s = await style(page, ".queue-panel");
  check("cola sobre el reproductor: entra con transición en --base", s.name === "none" && Math.round(s.transitionDuration) === 220, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 400);
  out = await closeWith(page, ".queue-panel", () => page.locator(".queue-panel").getByRole("button", { name: "Cerrar cola" }).click());
  check("la cola sobre el reproductor sale con transición en --exit y se desmonta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  out = await closeWith(page, ".now-playing", () => page.getByRole("button", { name: "Cerrar reproductor" }).click());
  check("el reproductor grande sale con transición en --exit y se desmonta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  // Dos Escape seguidos: el primero cierra el menú (que tarda --exit en salir) y el segundo no se pierde: cierra el reproductor.
  await page.locator(".bar-track").click();
  await wait(page, 500);
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
  await wait(page, 300);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await wait(page, 600);
  check("dos Escape seguidos cierran el menú y el reproductor (el menú que sale no se traga el segundo)", (await present(page, "dialog.menu")) === 0 && (await present(page, ".now-playing")) === 0);
  check("sin errores de página (escritorio)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Móvil ─────────────
{
  const { page, errors, context } = await open({ width: 390, height: 844, touch: true });
  await page.getByRole("button", { name: /Entrar|Cuenta/ }).first().tap();
  await wait(page, 30);
  let s = await style(page, "dialog.dialog");
  check("diálogo (móvil): entra como hoja con transición en --base", s.name === "none" && Math.round(s.transitionDuration) === 220, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 400);
  let out = await closeWith(page, "dialog.dialog", () => page.locator("dialog.dialog").getByRole("button", { name: "Cerrar" }).tap());
  check("diálogo (móvil): sale como hoja con transición en --exit y se desmonta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  await page.locator(".bar-track").tap();
  await wait(page, 40);
  s = await style(page, ".now-playing");
  check("reproductor grande (móvil): sube como hoja (transición, --slow)", s.name === "none" && Math.round(s.transitionDuration) === 280, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 500);
  out = await closeWith(page, ".now-playing", () => page.getByRole("button", { name: "Cerrar reproductor" }).tap());
  check("reproductor grande (móvil): baja con transición en --exit y se desmonta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  await page.locator(".bar-track").tap();
  await wait(page, 500);
  await page.locator(".now-playing").getByRole("button", { name: "Cola de reproducción" }).tap();
  await wait(page, 400);
  out = await closeWith(page, ".queue-panel", () => page.locator(".queue-panel").getByRole("button", { name: "Cerrar cola" }).tap());
  check("cola (móvil): sale con exit-fade en --exit y se desmonta", out.during?.closing === "true" && out.gone, JSON.stringify(out.during));
  check("sin errores de página (móvil)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Movimiento reducido: sin esperas ─────────────
{
  const { page, errors, context } = await open({ width: 1440, height: 900, reducedMotion: "reduce" });
  await page.getByRole("button", { name: /Entrar|Cuenta/ }).first().click();
  await wait(page, 30);
  const s = await style(page, "dialog.dialog");
  check("movimiento reducido: la entrada dura 0,01 ms", s.duration < 1, `${s.duration} ms`);
  await page.locator("dialog.dialog").getByRole("button", { name: "Cerrar" }).click();
  await wait(page, 30);
  check("movimiento reducido: el diálogo se cierra al instante, sin fase de salida", (await present(page, "dialog.dialog")) === 0);
  await page.locator(".bar-track").click();
  await wait(page, 100);
  await page.getByRole("button", { name: "Cerrar reproductor" }).click();
  await wait(page, 30);
  check("movimiento reducido: el reproductor grande se desmonta al instante", (await present(page, ".now-playing")) === 0);
  check("sin errores de página (movimiento reducido)", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
if (failed) {
  console.log(`\n${failed} comprobación(es) del movimiento fallaron`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones del movimiento pasaron");
