// Cuándo se ve la animación de carga, con red y CPU limitadas, fotograma a fotograma. Contra un build servido (`npm run build && npx vite preview`).
// Uso: node scripts/medir-carga.mjs [url-base] [carpeta-de-fotogramas]
// Casos: abrir la landing, abrir /app directo y pulsar «Abrir el reproductor» en la landing (también con movimiento reducido). Por caso: en qué ms aparece y se va
// `.satin-carga` (opacidad > 0,05, medida en cada requestAnimationFrame), el LCP y, si se da carpeta, los fotogramas del screencast.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:4173").replace(/\/$/, "");
const out = process.argv[3];
// Red «Slow 4G» de DevTools y CPU ×4: un móvil de gama media.
const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU = 4;
const throttle = !process.env.SIN_LIMITE; // SIN_LIMITE=1: la carga tal cual en esta máquina

const browser = await chromium.launch();

async function run(name, { path, click, reducedMotion = "no-preference" }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion });
  const page = await context.newPage();
  await page.route("**/*supabase.co/**", (route) => route.abort()); // nada de red real al proyecto
  await page.addInitScript(() => {
    window.__frames = [];
    window.__lcp = 0;
    new PerformanceObserver((list) => (window.__lcp = list.getEntries().at(-1).startTime)).observe({ type: "largest-contentful-paint", buffered: true });
    const tick = () => {
      const node = document.querySelector(".satin-carga");
      window.__frames.push({ t: performance.now(), on: node ? Number(getComputedStyle(node).opacity) : 0 });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (throttle) {
    await cdp.send("Network.emulateNetworkConditions", NETWORK);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  }
  const shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    shots.push({ data, at: metadata.timestamp });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const shoot = () => out && cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });

  let t0 = 0; // reloj de la página en el que empieza lo medido
  if (click) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shoot();
    t0 = await page.evaluate(() => ((window.__frames = []), performance.now()));
    await page.getByRole("link", { name: click }).first().click();
  } else {
    await shoot();
    await page.goto(`${base}${path}`);
  }
  await page.waitForTimeout(3500);
  const { frames, lcp } = await page.evaluate(() => ({ frames: window.__frames, lcp: window.__lcp }));
  if (out) await cdp.send("Page.stopScreencast");
  const visible = frames.filter((frame) => frame.on > 0.05);
  const result = {
    caso: name,
    aparece: visible.length ? Math.round(visible[0].t - t0) : null,
    seVa: visible.length ? Math.round(visible.at(-1).t - t0) : null,
    msVisible: visible.length ? Math.round(visible.at(-1).t - visible[0].t) : 0,
    lcp: click ? null : Math.round(lcp),
    fotogramas: shots.length,
  };
  if (out && shots.length) {
    const dir = join(out, name);
    mkdirSync(dir, { recursive: true });
    const first = shots[0].at;
    shots.forEach((shot, index) => writeFileSync(join(dir, `${String(index).padStart(3, "0")}-${Math.round((shot.at - first) * 1000)}ms.jpg`), Buffer.from(shot.data, "base64")));
  }
  await context.close();
  return result;
}

const results = [];
for (const [name, options] of [
  ["landing", { path: "/" }],
  ["app-directo", { path: "/app" }],
  ["clic-abrir", { path: "/", click: "Abrir el reproductor" }],
  ["clic-abrir-reducido", { path: "/", click: "Abrir el reproductor", reducedMotion: "reduce" }],
]) results.push(await run(name, options));
await browser.close();
console.table(results);
