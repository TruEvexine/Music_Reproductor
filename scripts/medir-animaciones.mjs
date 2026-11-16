// Fotogramas perdidos de cada animación de la interfaz con la CPU 6× más lenta, contra `npm run dev`.
// Medir contra el build de producción (`npm run build && npx vite preview`): el modo desarrollo de React (jsxDEV) es mucho más lento y falsea el coste.
// Uso: node scripts/medir-animaciones.mjs [url-base] [--reps=5] [--json=salida.json] [--fondo=estatico] [--interrupciones]  (estatico: sin lienzo WebGL, para separar el coste del fondo)
// Por cada paso (abrir el reproductor, cola, menú, hoja de acciones, aviso, cambio de pista, pestañas, play/pausa…) mide, durante la ventana que dura su animación:
//   fotogramas: los que llegó a pintar el hilo principal (requestAnimationFrame) · perdidos: los 60 Hz que faltaron entre dos fotogramas · peor: el mayor hueco en ms · tareas largas: >50 ms.
// Además mide la continuidad al interrumpir (sin limitar la CPU, para que los tiempos sean exactos): cerrar a los 20 ms de abrir y reabrir a los 20 ms de cerrar.
// «Retroceso» = cuánto se mueve el panel, tras la orden contraria, hacia la pose que ya estaba abandonando (% del recorrido). Una inversión suave da ≈ 0; una animación
// que se reinicia desde el principio salta a la pose de partida y da un valor alto.
// Límite: requestAnimationFrame mide al hilo principal; una animación de transform/opacity en el compositor sigue fluida aunque el hilo se atasque, así que «perdidos» es un tope
// pesimista (sirve para comparar antes y después, no para afirmar cuántos fotogramas ve un usuario). Solo usa el audio sintético de tests/fixtures.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:5173").replace(/\/$/, "");
const reps = Number(flag("reps", 5));
const json = flag("json");
const soloInterrupciones = args.includes("--interrupciones");
const fondo = flag("fondo", "cover") === "estatico" ? "static" : "cover";
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac", "10-letra.mp3"].map((name) => join(fixtures, name));
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

const probe = () => {
  let rec = null;
  new PerformanceObserver((list) => rec && (rec.long += list.getEntries().length)).observe({ type: "longtask", buffered: false });
  window.__m = {
    start() {
      rec = { t: [], long: 0 };
      const loop = (t) => rec && (rec.t.push(t), requestAnimationFrame(loop));
      requestAnimationFrame(loop);
    },
    stop() {
      const out = rec;
      rec = null;
      return out;
    },
    // Muestrea transform y opacidad del elemento en cada fotograma, y la hora del último clic (para ver qué pasa justo tras interrumpir).
    sample(selector) {
      const samples = [];
      const clicks = [];
      document.addEventListener("click", () => clicks.push(performance.now()), true);
      let on = true;
      const loop = (t) => {
        const el = document.querySelector(selector);
        if (el) {
          const style = getComputedStyle(el);
          samples.push({ t, y: new DOMMatrix(style.transform === "none" ? undefined : style.transform).m42, o: Number(style.opacity) });
        }
        on && requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return () => ((on = false), { samples, clicks });
    },
  };
};

const frames = (rec) => {
  const gaps = rec.t.slice(1).map((t, i) => t - rec.t[i]);
  const dropped = gaps.reduce((sum, gap) => sum + Math.max(0, Math.round(gap / (1000 / 60)) - 1), 0);
  return { fotogramas: rec.t.length, perdidos: dropped, peor: Math.round(Math.max(0, ...gaps)), largas: rec.long };
};

async function run(viewport, mobile) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  await page.addInitScript(probe);
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForFunction(() => !document.querySelector(".scan-bar") && document.querySelectorAll(".track-row").length >= 4, null, { timeout: 30_000 });
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(800);
  if (fondo === "static") await page.evaluate(async (mode) => (await import("/src/state/background.ts")).useBackground.setState({ mode }), fondo); // solo con `npm run dev`
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const click = (selector) => page.locator(selector).first().click();
  const gone = (selector) => page.locator(selector).waitFor({ state: "detached" });
  const player = ".now-playing:not([data-closing])";
  // [id, ventana ms, acción medida, preparación sin medir]
  const steps = [
    ["Abrir el reproductor grande", 450, () => click(".bar-track")],
    ["Cambio de pista (siguiente)", 900, () => click('.now-playing button[aria-label="Siguiente canción"]')],
    ["Reproducir / pausar", 300, () => click(".now-playing .play-button")],
    ["Abrir la cola", 400, () => click('.now-playing button[aria-label="Cola de reproducción"]')],
    ["Cerrar la cola", 300, () => click('.queue-panel button[aria-label="Cerrar cola"]'), () => gone(".queue-panel")],
    ["Abrir el menú ≡", 400, () => click('.now-header button[aria-label="Menú del reproductor"]')],
    ["Menú: cambio de página", 350, () => page.locator("dialog.menu .menu-row", { hasText: /^Sonido/ }).click()],
    ["Cerrar el menú ≡", 300, () => page.keyboard.press("Escape"), () => gone("dialog.menu")],
    ["Cerrar el reproductor grande", 300, () => click('.now-playing button[aria-label="Cerrar reproductor"]'), () => gone(".now-playing")],
    ["Cambio de pestaña de la biblioteca", 300, () => page.getByRole("link", { name: "Álbumes", exact: true }).click(), () => page.getByRole("link", { name: "Canciones", exact: true }).click()],
    ["Abrir la hoja de acciones", 400, () => page.locator(".track-row").first().dispatchEvent("contextmenu")],
    ["Cerrar la hoja de acciones", 300, () => page.keyboard.press("Escape"), () => gone("dialog.dialog")],
    ["Aparece un aviso", 400, () => click('button[aria-label^="Añadir"][aria-label$="a la cola"]')],
    ["Desaparece el aviso", 300, () => page.locator(".toast .link").click(), () => gone(".toast")],
  ];
  const result = Object.fromEntries(steps.map(([id]) => [id, []]));
  for (let pass = 0; pass <= (soloInterrupciones ? -1 : reps); pass++) {
    for (const [id, ms, act, after] of steps) {
      await page.evaluate(() => window.__m.start());
      await act();
      await page.waitForTimeout(ms);
      const rec = await page.evaluate(() => window.__m.stop());
      if (pass > 0) result[id].push(frames(rec)); // la primera vuelta calienta (carga diferida, caches)
      await after?.();
      await page.waitForTimeout(150);
    }
  }
  // Interrupciones: abrir y cerrar a los 100 ms; luego abrir, cerrar y reabrir a los 50 ms del cierre.
  const jumps = {};
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const travel = mobile ? viewport.height : 24;
  // Pose normalizada 0 (abierto) … 1 (cerrado): la mayor de la fracción de recorrido y la opacidad perdida.
  const closedness = (s) => Math.max(Math.abs(s.y) / travel, 1 - s.o);
  for (const [name, closesAfter, plan] of [
    ["Cerrar a los 20 ms de abrir", true, async () => { await page.evaluate(() => document.querySelector(".bar-track").click()); await page.waitForTimeout(20); await page.evaluate(() => document.querySelector('.now-playing button[aria-label="Cerrar reproductor"]').click()); }],
    ["Reabrir a los 20 ms de cerrar", false, async () => { await page.evaluate(() => document.querySelector(".bar-track").click()); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('.now-playing button[aria-label="Cerrar reproductor"]').click()); await page.waitForTimeout(20); await page.evaluate(() => document.querySelector(".bar-track").click()); }],
  ]) {
    const stop = await page.evaluateHandle(() => window.__m.sample(".now-playing"));
    await plan();
    await page.waitForTimeout(700);
    const { samples, clicks } = await page.evaluate((fn) => fn(), stop);
    const at = clicks[clicks.length - 1];
    const before = [...samples].reverse().find((s) => s.t < at);
    const after = samples.filter((s) => s.t >= at);
    // Tras ordenar cerrar, lo esperable es que el cierre solo aumente; tras reabrir, que solo disminuya. Retroceso = lo que se desanda.
    const back = before && after.length ? (closesAfter ? closedness(before) - Math.min(...after.map(closedness)) : Math.max(...after.map(closedness)) - closedness(before)) : 0;
    jumps[name] = Math.max(0, Math.round(back * 100));
    if (await page.locator(player).count()) await click('.now-playing button[aria-label="Cerrar reproductor"]');
    await page.waitForTimeout(500);
  }
  await context.close();
  return { pasos: Object.fromEntries(Object.entries(result).map(([id, list]) => [id, { perdidos: median(list.map((m) => m.perdidos)), peor: median(list.map((m) => m.peor)), largas: median(list.map((m) => m.largas)), fotogramas: median(list.map((m) => m.fotogramas)) }])), saltos: jumps };
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const out = { reps, movil: await run({ width: 390, height: 844 }, true), escritorio: await run({ width: 1440, height: 900 }, false) };
await browser.close();
if (json) writeFileSync(json, JSON.stringify(out, null, 2));
for (const [name, data] of [["390×844 (móvil)", out.movil], ["1440×900 (escritorio)", out.escritorio]]) {
  console.log(`\n${name}, CPU 6×, mediana de ${reps}\n| Paso | fotogramas | perdidos | peor hueco | tareas largas |\n|---|---|---|---|---|`);
  for (const [id, m] of Object.entries(data.pasos)) console.log(`| ${id} | ${m.fotogramas} | ${m.perdidos} | ${m.peor} ms | ${m.largas} |`);
  for (const [id, jump] of Object.entries(data.saltos)) console.log(`| ${id} (retroceso tras interrumpir) | | | ${jump} % | |`);
}
