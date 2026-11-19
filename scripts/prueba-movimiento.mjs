// Prueba del sistema de movimiento en Chromium contra `npm run dev`. Uso: node scripts/prueba-movimiento.mjs [url-base]
// Comprueba, leyendo los estilos calculados del navegador: entradas (animación y duración), salidas (data-closing, --exit, desmontaje; el
// reproductor y la cola no se desmontan: quedan ocultos, inert y aria-hidden), el foco al abrir y cerrar esos dos paneles, pulsar (--press;
// ni en transporte ni por teclado), lo frecuente sin animación (pestañas, filas) y movimiento reducido (sin esperas).
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
// El reproductor grande no anima por CSS: abrir y cerrar es la transformación desde la barra (ui/playerMorph.ts), con WAAPI en la hoja.
const sheetAnimation = (page) => page.locator(".now-playing").evaluate((el) => { const [anim] = el.getAnimations(); return anim ? Math.round(anim.effect.getTiming().duration) : 0; });
// Cerrado: desmontado (diálogos) u oculto del todo (reproductor y cola, que siguen montados: ui/motion.ts, useKeptPanel).
const closed = (page, selector) =>
  page.evaluate((sel) => [...document.querySelectorAll(sel)].every((el) => el.hasAttribute("data-closed") && el.inert && el.getAttribute("aria-hidden") === "true" && getComputedStyle(el).visibility === "hidden"), selector);
const active = (page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
const scale = (transform) => (transform === "none" ? 1 : Number(transform.match(/matrix\(([\d.]+)/)?.[1] ?? NaN));
const wait = (page, ms) => page.waitForTimeout(ms);

// Abre y cierra un elemento con salida: devuelve lo observado durante la salida.
async function closeWith(page, selector, close) {
  await close();
  await wait(page, 60); // a mitad de la salida (--exit = 140 ms)
  const during = (await present(page, selector)) ? await style(page, selector) : null;
  await wait(page, 450);
  return { during, gone: await closed(page, selector) };
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
  check("cola en columna: se oculta al instante (no hay salida que animar)", await closed(page, ".queue-panel"));

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
  let ms = await sheetAnimation(page);
  check("reproductor grande (escritorio): crece desde la barra en --slow (280 ms)", ms === 280, `${ms} ms`);
  const copy = () => page.locator(".now-copy").evaluate((el) => ({ fade: el.hasAttribute("data-fade"), opacity: Number(getComputedStyle(el).opacity) }));
  let title = await copy();
  check("título: al abrir el reproductor no se funde (ya se mueve la hoja)", !title.fade && title.opacity === 1, JSON.stringify(title));
  await wait(page, 500);
  // Clic y lectura en el cuadro siguiente, dentro de la página: con la máquina cargada, 30 ms medidos desde Playwright ya superaban el fundido (120 ms).
  await page.locator(".now-playing").getByRole("button", { name: "Siguiente canción" }).hover();
  title = await page.evaluate(async () => {
    document.querySelector('.now-playing button[aria-label="Siguiente canción"]').click();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const el = document.querySelector(".now-copy");
    return { fade: el.hasAttribute("data-fade"), opacity: Number(getComputedStyle(el).opacity) };
  });
  check("título: al cambiar de pista sí se funde", title.fade && title.opacity < 1, JSON.stringify(title));
  await wait(page, 400);
  await page.locator(".now-playing").getByRole("button", { name: "Cola de reproducción" }).click();
  await wait(page, 40);
  s = await style(page, ".queue-panel");
  check("cola sobre el reproductor: entra con transición en --base", s.name === "none" && Math.round(s.transitionDuration) === 220, `${s.name} ${s.transitionDuration} ms`);
  await wait(page, 400);
  out = await closeWith(page, ".queue-panel", () => page.locator(".queue-panel").getByRole("button", { name: "Cerrar cola" }).click());
  check("la cola sobre el reproductor sale con transición en --exit y queda oculta", out.during?.closing === "true" && Math.round(out.during.transitionDuration) === 140 && out.gone, JSON.stringify(out.during));
  await page.getByRole("button", { name: "Cerrar reproductor" }).click();
  await wait(page, 40);
  ms = await sheetAnimation(page);
  await wait(page, 450);
  check("el reproductor grande vuelve a la barra en --exit (140 ms) y queda oculto", ms === 140 && (await closed(page, ".now-playing")), `${ms} ms`);
  // Dos Escape seguidos: el primero cierra el menú (que tarda --exit en salir) y el segundo no se pierde: cierra el reproductor.
  await page.locator(".bar-track").click();
  await wait(page, 500);
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
  await wait(page, 300);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await wait(page, 600);
  check("dos Escape seguidos cierran el menú y el reproductor (el menú que sale no se traga el segundo)", (await present(page, "dialog.menu")) === 0 && (await closed(page, ".now-playing")));

  // Foco: al abrir entra en el panel (su botón de cerrar) y al cerrar vuelve a quien lo tenía. Cerrado, Tab no entra.
  await page.locator(".bar-track").focus();
  await page.keyboard.press("Enter");
  await wait(page, 400);
  check("foco: abrir el reproductor lo lleva a «Cerrar reproductor»", (await active(page)) === "Cerrar reproductor", await active(page));
  await page.locator(".now-playing").getByRole("button", { name: "Cola de reproducción" }).focus();
  await page.keyboard.press("Enter");
  await wait(page, 400);
  check("foco: abrir la cola lo lleva a «Cerrar cola»", (await active(page)) === "Cerrar cola", await active(page));
  await page.keyboard.press("Escape");
  await wait(page, 400);
  const backInPlayer = await page.evaluate(() => Boolean(document.activeElement?.closest(".now-playing")));
  check("foco: cerrar la cola lo devuelve al botón de la cola del reproductor", (await active(page)) === "Cola de reproducción" && backInPlayer, await active(page));
  await page.keyboard.press("Escape");
  await wait(page, 400);
  check("foco: cerrar el reproductor lo devuelve al mini reproductor", (await active(page))?.startsWith("Abrir reproductor"), await active(page));
  for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
  check("cerrados: Tab no entra en el reproductor ni en la cola ocultos", !(await page.evaluate(() => Boolean(document.activeElement?.closest(".now-playing, .queue-panel")))));
  await page.locator(".player-bar").getByRole("button", { name: "Cola de reproducción" }).focus();
  await page.keyboard.press("Enter");
  await wait(page, 300);
  check("foco: la cola en columna también lo recibe al abrirse", (await active(page)) === "Cerrar cola", await active(page));
  await page.keyboard.press("Escape");
  await wait(page, 300);
  check("foco: y lo devuelve al botón de la barra al cerrarse", (await active(page)) === "Cola de reproducción" && !(await page.evaluate(() => Boolean(document.activeElement?.closest(".queue-panel")))), await active(page));
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
  let ms = await sheetAnimation(page);
  check("reproductor grande (móvil): tocar el mini lo hace crecer desde la barra, guiado por tiempo (--slow)", ms === 280, `${ms} ms`);
  await wait(page, 500);
  await page.getByRole("button", { name: "Cerrar reproductor" }).tap();
  await wait(page, 40);
  ms = await sheetAnimation(page);
  await wait(page, 450);
  check("reproductor grande (móvil): vuelve a la barra en --exit y queda oculto", ms === 140 && (await closed(page, ".now-playing")), `${ms} ms`);
  await page.locator(".bar-track").tap();
  await wait(page, 500);
  await page.locator(".now-playing").getByRole("button", { name: "Cola de reproducción" }).tap();
  await wait(page, 400);
  out = await closeWith(page, ".queue-panel", () => page.locator(".queue-panel").getByRole("button", { name: "Cerrar cola" }).tap());
  check("cola (móvil): sale con exit-fade en --exit y queda oculta", out.during?.closing === "true" && out.gone, JSON.stringify(out.during));
  check("foco (móvil): cerrar la cola con el dedo lo devuelve al botón de la cola", (await active(page)) === "Cola de reproducción", await active(page));
  await page.getByRole("button", { name: "Cerrar reproductor" }).tap();
  await wait(page, 400);
  check("foco (móvil): cerrar el reproductor lo devuelve al mini reproductor", (await active(page))?.startsWith("Abrir reproductor"), await active(page));
  // Barra inferior: la píldora de la pestaña activa se desliza (solo transform, --fast); la vista ya cambió en el mismo toque.
  const pill = () => page.locator(".nav-indicator").evaluate((el) => ({ ms: Math.round(parseFloat(getComputedStyle(el).transitionDuration) * 1000), x: Math.round(new DOMMatrix(getComputedStyle(el).transform).m41) }));
  await page.getByRole("link", { name: "Ajustes" }).tap();
  await wait(page, 20);
  const sliding = await pill();
  const settings = await page.locator(".view").first().isVisible();
  await wait(page, 300);
  const landed = await pill();
  check("barra inferior: la píldora se desliza a la pestaña nueva en --fast, sin esperar a la vista", sliding.ms === 120 && sliding.x < landed.x && landed.x > 100 && settings, `${JSON.stringify(sliding)} → ${JSON.stringify(landed)}`);
  await page.getByRole("link", { name: "Biblioteca" }).tap();
  await wait(page, 300);
  // Gestos simulados con eventos táctiles de CDP (el navegador los convierte en Pointer Events): arrastrar el mini hacia arriba abre,
  // la cabecera hacia abajo cierra, a mitad se puede volver, un tirón corto decide por velocidad y lo horizontal es del carrusel.
  const cdp = await context.newCDPSession(page);
  const touch = (type, point) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [point] : [] });
  const drag = async (from, to, steps = 24, stepMs = 16) => {
    await touch("touchStart", from);
    for (let i = 1; i <= steps; i++) {
      await touch("touchMove", { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
      await wait(page, stepMs);
    }
    await touch("touchEnd");
    await wait(page, 600);
  };
  const center = async (selector) => {
    const box = await page.locator(selector).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const isOpen = () => page.evaluate(() => new URLSearchParams(location.search).get("panel") === "player" && !document.querySelector(".now-playing").hasAttribute("data-closed"));
  const noPanel = () => page.evaluate(() => !location.search.includes("panel"));
  let mini = await center(".player-bar");
  await drag(mini, { x: mini.x, y: mini.y - 120 }, 30, 20);
  check("gesto: arrastrar el mini hacia arriba, despacio, abre el reproductor (y la URL lo dice)", await isOpen());
  check("gesto: al abrir así, el foco entra en «Cerrar reproductor»", (await active(page)) === "Cerrar reproductor", await active(page));
  check("gesto: abierto, la barra inferior y la hoja quedan sin estilos en línea (nada a medias)", await page.evaluate(() => !document.querySelector(".nav").style.opacity && !document.querySelector(".now-playing").style.transform));
  const header = await center(".now-header");
  await drag(header, { x: header.x + 20, y: header.y + 340 });
  check("gesto: arrastrar la cabecera hacia abajo lo cierra (oculto, inert, aria-hidden y sin ?panel)", (await closed(page, ".now-playing")) && (await noPanel()));
  mini = await center(".player-bar");
  // Interrumpido: sube 300 px y vuelve casi a donde empezó, despacio. Debe quedarse cerrado.
  await touch("touchStart", mini);
  for (let i = 1; i <= 20; i++) {
    await touch("touchMove", { x: mini.x, y: mini.y - i * 15 });
    await wait(page, 16);
  }
  const midway = await page.locator(".now-playing").evaluate((el) => ({ morph: el.hasAttribute("data-morph"), y: Math.round(new DOMMatrix(getComputedStyle(el).transform).m42) }));
  for (let i = 19; i >= 0; i--) {
    await touch("touchMove", { x: mini.x, y: mini.y - i * 15 - 2 });
    await wait(page, 30);
  }
  await touch("touchEnd");
  await wait(page, 600);
  check("gesto: a mitad del arrastre la hoja sigue al dedo (visible, a medio camino)", midway.morph && midway.y > 50 && midway.y < 700, JSON.stringify(midway));
  check("gesto interrumpido: subir a mitad y volver deja el reproductor cerrado", (await closed(page, ".now-playing")) && (await noPanel()));
  await drag(mini, { x: mini.x, y: mini.y - 80 }, 4, 0); // 80 px casi sin pausa: más rápido que 0,45 px/ms y por debajo de los 96 px de distancia
  check("gesto rápido: un tirón corto hacia arriba abre (decide la velocidad)", await isOpen());
  const cover = await center(".now-slot:not([data-side]) .now-cover");
  await drag(cover, { x: cover.x - 60, y: cover.y + 20 }, 10, 16);
  check("gesto horizontal sobre la portada: no cierra (es del carrusel)", await isOpen());
  const seek = await center(".now-playing .seek .range");
  await drag(seek, { x: seek.x + 30, y: seek.y + 200 }, 16, 16);
  check("gesto sobre la barra de progreso: no cierra (el ajuste fino es suyo)", await isOpen());
  await page.goBack();
  await wait(page, 500);
  check("gesto atrás del sistema: cierra el reproductor y queda oculto", await closed(page, ".now-playing"));
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
  check("movimiento reducido: el reproductor grande se oculta al instante", await closed(page, ".now-playing"));
  const pillMs = await page.locator(".nav-indicator").evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) * 1000);
  check("movimiento reducido: la píldora de la barra inferior cambia al instante", pillMs < 1, `${pillMs} ms`);
  check("sin errores de página (movimiento reducido)", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
if (failed) {
  console.log(`\n${failed} comprobación(es) del movimiento fallaron`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones del movimiento pasaron");
