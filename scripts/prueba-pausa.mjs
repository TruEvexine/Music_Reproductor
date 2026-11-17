// Pausa y reanudación con toques muy seguidos, y trabajo visual con la página oculta. Chromium contra `npm run dev`.
// Uso: node scripts/prueba-pausa.mjs [url-base]. Sale con 1 si algo falla.
// 1. 20 y 21 toques en el botón de reproducir en menos de 2 s: el estado final (botón y <audio> real) es el del último toque, sin excepciones.
// 2. Página oculta (visibilitychange): el bucle del fondo se detiene, se reanuda al volver y las luces no ven el hueco (sin salto).
// AudioContext.resume() se retrasa 150 ms, como en un móvil. Usa audio sintético y `window.__engine` / `window.__backdrop` (solo en desarrollo).
import { chromium } from "@playwright/test";
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
console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones pasaron");
process.exit(failed ? 1 : 0);
