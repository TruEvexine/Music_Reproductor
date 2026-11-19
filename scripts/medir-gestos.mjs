// Coste de abrir y cerrar el reproductor grande (transformación desde la barra, ui/playerMorph.ts) con gestos simulados, con el método de
// docs/AUDITORIA_ANIMACIONES.md §2: trazas de Chromium con la CPU 4× más lenta, una por gesto, desde el primer contacto hasta 700 ms después
// de soltar. Contra el build de producción: `npm run build && npx vite preview`, y node scripts/medir-gestos.mjs [url-base] [--pasadas=3].
// Columnas: tareas largas = RunTask del hilo principal ≥ 50 ms · caídos = cuadros STATE_DROPPED (+ parciales) / cuadros con actualización,
// según PipelineReporter (la pista «Frames» del panel Performance) · layout = número de Layout (ms). Solo audio sintético (tests/fixtures).
// --json=archivo añade cada medida en una línea (para juntar corridas alternadas, p. ej. contra un build anterior en otro puerto).
// DESGLOSE=1 imprime de qué está hecha cada tarea de 30 ms o más.
import { chromium } from "@playwright/test";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import "./requiere-audio.mjs";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:4173").replace(/\/$/, "");
const passes = Number(args.find((a) => a.startsWith("--pasadas="))?.split("=")[1] ?? 3);
const json = args.find((a) => a.startsWith("--json="))?.split("=")[1]; // añade cada medida (una por línea) para juntar varias corridas
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(import.meta.dirname, "..", "tests", "fixtures", "audio", name));
const categories = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "benchmark", "cc", "blink.animations"];

function summarize(events) {
  const main = events.find((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain" && events.some((x) => x.pid === e.pid && x.tid === e.tid && x.name === "RunTask"));
  const onMain = (e) => main && e.pid === main.pid && e.tid === main.tid && e.ph === "X";
  const long = events.filter((e) => onMain(e) && e.name === "RunTask" && e.dur >= 50_000).map((e) => Math.round(e.dur / 1000));
  const layouts = events.filter((e) => onMain(e) && e.name === "Layout");
  const report = (e) => e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
  const frames = events.filter((e) => e.name === "PipelineReporter" && e.ph === "b" && report(e) && (!main || e.pid === main.pid));
  const state = (s) => frames.filter((e) => report(e).state === s).length;
  const updated = frames.filter((e) => report(e).state !== "STATE_NO_UPDATE_DESIRED").length;
  if (process.env.DESGLOSE) for (const task of events.filter((e) => onMain(e) && e.name === "RunTask" && e.dur >= 30_000)) {
    const inside = {};
    for (const e of events) if (onMain(e) && e !== task && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e.dur >= 2000) inside[e.name] = Math.round((inside[e.name] ?? 0) + e.dur / 1000);
    console.log("  tarea", Math.round(task.dur / 1000), "ms:", JSON.stringify(Object.fromEntries(Object.entries(inside).sort((a, b) => b[1] - a[1]).slice(0, 12))));
  }
  return { long, dropped: state("STATE_DROPPED"), partial: state("STATE_PRESENTED_PARTIAL"), updated, layouts: layouts.length, layoutMs: Math.round(layouts.reduce((sum, e) => sum + e.dur, 0) / 1000) };
}

async function trace(cdp, act) {
  const events = [];
  const collect = ({ value }) => events.push(...value);
  cdp.on("Tracing.dataCollected", collect);
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: categories }, transferMode: "ReportEvents" });
  await act();
  await new Promise((done) => setTimeout(done, 700));
  const finished = new Promise((done) => cdp.once("Tracing.tracingComplete", done));
  await cdp.send("Tracing.end");
  await finished;
  cdp.off("Tracing.dataCollected", collect);
  return summarize(events);
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

async function setup(viewport, mobile) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage();
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 2, null, { timeout: 30_000 });
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(4000); // la precarga en reposo del reproductor y la cola
  // En pausa: las pistas de prueba duran 6–8 s y su fin (siguiente pista) o la posición cada 250 ms caerían dentro de las trazas.
  await page.locator('.player-bar button[aria-label="Pausar"] >> visible=true').first().click();
  await page.waitForTimeout(300);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const touch = (type, point) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [point] : [] });
  const center = async (selector) => {
    const box = await page.locator(selector).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Trayecto del dedo: lista de desplazamientos verticales (px) y la pausa entre muestras (ms).
  const drag = async (selector, path, stepMs) => {
    const from = await center(selector);
    await touch("touchStart", from);
    for (const dy of path) {
      await touch("touchMove", { x: from.x, y: from.y + dy });
      await page.waitForTimeout(stepMs);
    }
    await touch("touchEnd");
  };
  const open = () => page.evaluate(() => new URLSearchParams(location.search).get("panel") === "player");
  return { context, page, cdp, drag, open };
}

const steps = (to, n) => Array.from({ length: n }, (_, i) => Math.round((to * (i + 1)) / n));
const results = [];
const record = (device, name, summary, ok) => {
  results.push({ device, name, ...summary, ok });
  if (json) appendFileSync(json, JSON.stringify({ base, device, name, ...summary, ok }) + "\n");
  const tasks = summary.long.length ? summary.long.join(", ") + " ms" : "ninguna";
  console.log(`${device.padEnd(10)} ${name.padEnd(36)} ${tasks.padEnd(12)} · ${summary.dropped}${summary.partial ? ` (+${summary.partial})` : ""} / ${summary.updated} · ${summary.layouts} (${summary.layoutMs} ms)${ok ? "" : "  ¡no llegó al estado esperado!"}`);
};

// ── Móvil: arrastres y toque ──
{
  const { context, page, cdp, drag, open } = await setup({ width: 390, height: 844 }, true);
  const gestures = [
    ["Arrastre lento: abrir", () => drag(".player-bar", steps(-560, 60), 16), true],
    ["Arrastre lento: cerrar", () => drag(".now-header", steps(560, 60), 16), false],
    ["Arrastre rápido: abrir", () => drag(".player-bar", steps(-160, 6), 8), true],
    ["Arrastre rápido: cerrar", () => drag(".now-header", steps(200, 6), 8), false],
    ["Arrastre interrumpido (sube y vuelve)", () => drag(".player-bar", [...steps(-360, 30), ...steps(360, 30).map((d) => d - 360)], 16), false],
    // Chromium sin ventana no genera el clic del primer toque tras un arrastre táctil simulado (pasa también antes de N8): un toque neutro antes, sin medir.
    ["Toque: abrir", () => page.locator(".bar-track").tap(), true, () => page.locator(".view-header h1").first().tap()],
    ["Toque: cerrar (⌄)", () => page.getByRole("button", { name: "Cerrar reproductor" }).tap(), false],
  ];
  for (let pass = 0; pass < passes; pass++) {
    for (const [name, act, expectOpen, prepare] of gestures) {
      await prepare?.();
      await page.waitForTimeout(300);
      const summary = await trace(cdp, act);
      await page.waitForTimeout(500);
      record("móvil", name, summary, (await open()) === expectOpen);
    }
  }
  await context.close();
}

// ── Escritorio: sin arrastre, abrir y cerrar por clic (la misma transformación, guiada por tiempo) ──
{
  const { context, page, cdp, open } = await setup({ width: 1440, height: 900 }, false);
  for (let pass = 0; pass < passes; pass++) {
    record("escritorio", "Clic: abrir", await trace(cdp, () => page.locator(".bar-track").click()), true);
    await page.waitForTimeout(500);
    const opened = await open();
    record("escritorio", "Clic: cerrar (⌄)", await trace(cdp, () => page.getByRole("button", { name: "Cerrar reproductor" }).click()), opened);
    await page.waitForTimeout(500);
  }
  await context.close();
}

await browser.close();
// Resumen por gesto: mediana y peor de los cuadros caídos, y todas las tareas largas vistas.
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
console.log(`
| Gesto | Tareas largas (${passes} pasadas) | Caídos: mediana · peor (parciales, mediana) | Layout por gesto |
|---|---|---|---|`);
for (const key of [...new Set(results.map((r) => `${r.device}|${r.name}`))]) {
  const runs = results.filter((r) => `${r.device}|${r.name}` === key);
  const long = runs.flatMap((r) => r.long);
  console.log(`| ${key.replace("|", ": ")} | ${long.length ? long.join(", ") + " ms" : "ninguna"} | ${median(runs.map((r) => r.dropped))} · ${Math.max(...runs.map((r) => r.dropped))} (${median(runs.map((r) => r.partial))}) / ${median(runs.map((r) => r.updated))} | ${median(runs.map((r) => r.layouts))} (${median(runs.map((r) => r.layoutMs))} ms) |`);
}
if (results.some((r) => !r.ok)) process.exitCode = 1;
