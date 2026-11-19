// Pausa y reanudación con toques muy seguidos, y trabajo visual con la página oculta. Chromium contra `npm run dev`.
// Uso: node scripts/prueba-pausa.mjs [url-base]. Sale con 1 si algo falla.
// 1. 20 y 21 toques en el botón de reproducir en menos de 2 s: el estado final (botón y <audio> real) es el del último toque, sin excepciones.
// 2. Página oculta (visibilitychange): el bucle del fondo se detiene, se reanuda al volver y las luces no ven el hueco (sin salto).
// 3. Página oculta de verdad: 10 alternancias pause/play por MediaSession, con y sin el frenado de temporizadores de un móvil.
// AudioContext.resume() se retrasa 150 ms, como en un móvil (1 y 2). Usa audio sintético y `window.__engine` / `window.__backdrop` (solo en desarrollo).
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Como en un móvil: AudioContext.resume() tarda (en escritorio es casi inmediato y el fallo no se ve).
await page.addInitScript(() => {
  const resume = AudioContext.prototype.resume;
  AudioContext.prototype.resume = function () {
    return new Promise((done) => setTimeout(done, 150)).then(() => resume.call(this));
  };
});
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles(["01-amanecer.flac", "02-marea.flac"].map((name) => join(fixtures, name)));
await page.waitForTimeout(2500);
await page.locator(".track-row .row-main", { hasText: "Amanecer" }).click();
await page.waitForTimeout(800);

const label = () => page.locator(".bar-center .play-button").getAttribute("aria-label");
const element = () => page.evaluate(() => ({ paused: window.__engine.decks[window.__engine.active].audio.paused, time: window.__engine.decks[window.__engine.active].audio.currentTime }));

// 1. Toques muy seguidos: clics reales en el botón, cada 60 ms, desde la página (sin la espera de Playwright entre clics).
for (const taps of [20, 21]) {
  if ((await label()) !== "Pausar") await page.locator(".bar-center .play-button").click();
  await page.waitForTimeout(400);
  const took = await page.evaluate(async (n) => {
    const button = document.querySelector(".bar-center .play-button");
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    return performance.now() - start;
  }, taps);
  await page.waitForTimeout(600);
  const playing = taps % 2 === 0; // empezó sonando
  const before = await element();
  await page.waitForTimeout(400);
  const after = await element();
  check(`${taps} toques en ${Math.round(took)} ms (< 2 s): el botón queda en «${playing ? "Pausar" : "Reproducir"}»`, took < 2000 && (await label()) === (playing ? "Pausar" : "Reproducir"), await label());
  check(
    `${taps} toques: el <audio> real ${playing ? "suena y avanza" : "queda en pausa y no avanza"}`,
    playing ? !after.paused && after.time > before.time : after.paused && after.time === before.time,
    `${before.time.toFixed(2)} → ${after.time.toFixed(2)} s`,
  );
}
check("sin excepciones ni errores en consola", errors.length === 0, errors.join(" | "));

// 2. Página oculta con el reproductor grande abierto (el único sitio con lienzo y análisis).
if ((await label()) !== "Pausar") await page.locator(".bar-center .play-button").click();
await page.locator(".bar-track").click();
await page.waitForTimeout(800);
const stats = () => page.evaluate(() => ({ ...(window.__backdrop ?? [])[0] }));
const setHidden = (hidden) =>
  page.evaluate((value) => {
    if (value) {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    } else {
      delete document.hidden;
      delete document.visibilityState;
    }
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
const running = (await stats()).frames ?? 0;
check("con la página visible el fondo dibuja", running > 0, `${running} cuadros`);
await page.evaluate(() => (window.__backdrop[0].analysisGapMs = 0));
await setHidden(true);
await page.waitForTimeout(150);
const hiddenA = (await stats()).frames;
await page.waitForTimeout(1500);
const hiddenB = (await stats()).frames;
check("oculta: el bucle del fondo y el análisis se detienen", hiddenA === hiddenB, `${hiddenA} → ${hiddenB} cuadros en 1,5 s`);
await setHidden(false);
await page.waitForTimeout(500);
const back = await stats();
check("al volver se reanuda", back.frames > hiddenB, `${hiddenB} → ${back.frames}`);
check("al volver las luces no ven el hueco (sin salto)", back.analysisGapMs < 200, `mayor paso del reloj de las luces: ${Math.round(back.analysisGapMs)} ms tras 1,5 s oculta`);
check("sin excepciones tras ocultar y volver", errors.length === 0, errors.join(" | "));

await browser.close();

// 3. Pausas rápidas desde los controles del sistema (MediaSession) con la página oculta de verdad.
// Con Playwright conectado la página nunca pasa a «hidden»: Chromium se lanza a mano, Playwright prepara la reproducción, se desconecta
// y lo demás va por CDP. Chromium no frena los temporizadores de una página con un AudioContext en marcha, así que se repite con el frenado
// de un móvil emulado (temporizadores alineados a 1 s, sin requestAnimationFrame): nada de pausar ni reanudar puede depender de ellos.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "prueba-pausa-"));
const chrome = spawn(chromium.executablePath(), ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
try {
  const portFile = join(profile, "DevToolsActivePort");
  while (!existsSync(portFile)) await wait(50);
  const devtools = `http://127.0.0.1:${readFileSync(portFile, "utf8").split("\n")[0]}`;
  const remote = await chromium.connectOverCDP(devtools);
  const app = remote.contexts()[0].pages()[0];
  await app.addInitScript(() => {
    window.__media = {};
    const set = MediaSession.prototype.setActionHandler;
    MediaSession.prototype.setActionHandler = function (action, handler) {
      window.__media[action] = handler;
      return set.call(this, action, handler);
    };
  });
  await app.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await app.goto(`${base}/app`);
  await app.getByLabel("Elegir archivos de música").setInputFiles(join(fixtures, "01-amanecer.flac"));
  await app.waitForTimeout(2500);
  await app.locator(".track-row .row-main", { hasText: "Amanecer" }).click();
  await app.waitForTimeout(800);
  await remote.close(); // solo se desconecta

  const target = (await (await fetch(`${devtools}/json`)).json()).find((item) => item.type === "page" && item.url.includes("/app"));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (socket.onopen = resolve));
  let id = 0;
  const replies = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    replies.get(data.id)?.(data.result?.result?.value);
  };
  const run = (expression) =>
    new Promise((resolve) => {
      replies.set(++id, resolve);
      socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  await fetch(`${devtools}/json/new?about:blank`, { method: "PUT" }); // otra pestaña al frente
  await wait(500);
  check("3. la página queda oculta de verdad (otra pestaña al frente)", (await run("document.visibilityState")) === "hidden");
  const probe = () => run(`(() => { const e = window.__engine, a = e.decks[e.active].audio; return { gain: e.master.gain.value, time: a.currentTime, paused: a.paused, t: performance.now() }; })()`);
  const system = (action, details = {}) => run(`void window.__media[${JSON.stringify(action)}](${JSON.stringify({ action, ...details })})`);
  /** Espera hasta 5 s a que se cumpla `done(muestra, primera)`; devuelve los ms o Infinity. */
  const until = async (done) => {
    const first = await probe();
    for (let sample = first; sample.t - first.t < 5000; sample = await probe()) {
      if (done(sample, first)) return sample.t - first.t;
      await wait(5);
    }
    return Infinity;
  };

  for (const throttled of [false, true]) {
    const mode = throttled ? "oculta y con el frenado de un móvil" : "oculta";
    if (throttled)
      await run(`(() => {
        const set = window.setTimeout;
        window.setTimeout = (fn, ms = 0, ...args) => set(fn, Math.ceil((performance.now() + ms) / 1000) * 1000 - performance.now(), ...args);
        window.requestAnimationFrame = () => 0;
      })()`);
    let gainMs = 0;
    let moveMs = 0;
    for (let round = 0; round < 3; round++) {
      await system("seekto", { seekTime: 0.5 });
      await wait(800);
      for (let i = 0; i < 10; i++) {
        await system(i % 2 === 0 ? "pause" : "play");
        if (i < 9) await wait(150 + Math.random() * 100);
      }
      // Desde la última orden play: ganancia de vuelta a 1 y currentTime avanzando.
      const [gain, move] = await Promise.all([until((s) => s.gain >= 0.999), until((s, first) => !s.paused && s.time > first.time + 0.05)]);
      gainMs = Math.max(gainMs, gain);
      moveMs = Math.max(moveMs, move);
    }
    check(`${mode}: tras 10 alternancias pause/play por MediaSession la ganancia vuelve a 1 en < 300 ms`, gainMs < 300, `peor de 3: ${Math.round(gainMs)} ms`);
    check(`${mode}: … y el <audio> avanza en < 300 ms`, moveMs < 300, `peor de 3: ${Math.round(moveMs)} ms`);
    const before = await probe();
    await system("pause");
    const tail = await until((s) => s.paused);
    const after = await probe();
    check(`${mode}: al pausar, el <audio> se para en < 200 ms (no sigue mudo y la canción no avanza en silencio)`, tail < 200 && after.time - before.time < 0.2, `${Math.round(tail)} ms, avanzó ${(after.time - before.time).toFixed(2)} s`);
    await wait(400);
    const still = await probe();
    check(`${mode}: el último toque gana (pause): sigue en pausa`, still.paused && still.time === after.time);
    await system("play");
    await wait(600);
    let dipped = false;
    await system("seekto", { seekTime: 1 });
    const seekMs = await until((s) => (dipped ||= s.gain < 0.01) && s.gain >= 0.999);
    check(`${mode}: seekto vuelve a sonar en < 250 ms`, seekMs < 250, `${Math.round(seekMs)} ms`);
  }

  // 4. Isla de HyperOS: el sistema cree que está en pausa (playbackState desfasado) y manda play una y otra vez estando ya en reproducción.
  // Cada orden responde con el estado real en el mismo manejador, ninguna se convierte en pausa, y `?diag=1` lo anota («estado al sistema»).
  await run(`(() => { window.__said = []; window.__engine.trace = (text) => text.startsWith("estado al sistema") && window.__said.push(text); })()`);
  const said = () => run(`({ state: navigator.mediaSession.playbackState, said: window.__said.splice(0), paused: window.__engine.decks[window.__engine.active].audio.paused })`);
  const repeated = [];
  for (let i = 0; i < 9; i++) {
    await run(`navigator.mediaSession.playbackState = "paused"`);
    await system("play");
    repeated.push(await said());
    await wait(60);
  }
  check(
    "4. 9 play repetidos estando en reproducción: el sistema vuelve a oír «playing» en cada uno y sigue sonando",
    repeated.every((item) => item.state === "playing" && !item.paused && item.said.at(-1) === "estado al sistema: playing"),
    JSON.stringify(repeated.find((item) => item.state !== "playing" || item.paused || item.said.at(-1) !== "estado al sistema: playing") ?? ""),
  );
  await system("pause");
  const paused = await said();
  check("4. … y pause se publica como «paused» en el mismo manejador", paused.state === "paused" && paused.said.at(-1) === "estado al sistema: paused", JSON.stringify(paused));
  socket.close();
} finally {
  chrome.kill();
}

console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones pasaron");
process.exit(failed ? 1 : 0);
