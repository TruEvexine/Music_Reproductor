// Prueba del modo «HDR simulado» en Chromium contra `npm run dev`. Uso: node scripts/prueba-hdr.mjs [url-base] [carpeta-capturas]
// Comprueba: el modo existe y persiste; negro puro; la política --hdr-* cambia con `color-gamut: p3` y `dynamic-range: high` (emulados por CDP);
// el acento sube de croma sin pasar el techo de luminosidad; el lienzo pasa a Display P3 solo con pantalla P3; el respaldo CSS usa
// color(display-p3 …) solo con P3; el brillo máximo del fondo deja el texto legible (≥ 4.5:1); movimiento reducido y sin WebGL degradan sin errores.
// LO QUE ESTA PRUEBA NO PUEDE VER: cómo luce en una pantalla P3/HDR real. Emular el media query cambia las reglas, no la pantalla.
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
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(browser, { reducedMotion = "no-preference", media = [], noWebgl = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  if (noWebgl) await page.addInitScript(() => (HTMLCanvasElement.prototype.getContext = () => null));
  const session = await context.newCDPSession(page);
  if (media.length) await session.send("Emulation.setEmulatedMedia", { features: media.map(([name, value]) => ({ name, value })) });
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await wait(page, 2500);
  await page.locator(".track-row .row-main").first().click();
  await wait(page, 800);
  await page.locator(".bar-track").click();
  await wait(page, 500);
  return { page, errors, context, session };
}

const menu = (page) => page.locator("dialog.menu[open]");
const chooseHdr = async (page) => {
  await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
  await wait(page, 300);
  await menu(page).getByRole("button", { name: /^Fondo/ }).click();
  await wait(page, 300);
  await menu(page).getByRole("radio", { name: "HDR simulado" }).click();
  await wait(page, 500);
  await page.keyboard.press("Escape");
  await wait(page, 300);
};
const vars = (page) =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    // El color resuelto (no el texto de la variable) se lee de un sondeo; oklch() se serializa como oklch(L C H).
    const probe = document.createElement("i");
    document.querySelector(".shell").append(probe);
    const resolve = (name) => {
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };
    const out = {
      bg: root.getPropertyValue("--bg").trim(),
      chroma: parseFloat(root.getPropertyValue("--hdr-chroma")),
      contrast: parseFloat(root.getPropertyValue("--hdr-contrast")),
      glint: parseFloat(root.getPropertyValue("--hdr-glint")),
      peak: parseFloat(root.getPropertyValue("--hdr-peak")),
      accent: resolve("--accent"),
      accentIn: resolve("--accent-in"),
      danger: resolve("--danger"),
      p3: matchMedia("(color-gamut: p3)").matches,
      hdr: matchMedia("(dynamic-range: high)").matches,
    };
    probe.remove();
    return out;
  });
const oklch = (css) => {
  const m = css.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/);
  return m ? { l: +m[1], c: +m[2], h: +m[3] } : null;
};
// Brillo del fondo solo (sin lo que hay encima), medido en píxeles reales de una captura.
async function backdropLuminance(page) {
  await page.evaluate(() => document.querySelectorAll(".now-playing > :not(.backdrop), dialog.menu").forEach((el) => (el.style.visibility = "hidden")));
  await wait(page, 150);
  const png = await page.locator(".now-playing .backdrop").first().screenshot();
  await page.evaluate(() => document.querySelectorAll(".now-playing > :not(.backdrop), dialog.menu").forEach((el) => (el.style.visibility = "")));
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const linear = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    let max = 0;
    let maxBottom = 0;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]);
      const row = Math.floor(i / 4 / canvas.width);
      max = Math.max(max, y);
      if (row > canvas.height * 0.55) maxBottom = Math.max(maxBottom, y);
    }
    return { max, maxBottom };
  }, png.toString("base64"));
}
const contrastWithInk = (y) => (0.88 + 0.05) / (y + 0.05); // --ink: oklch(0.96 …) ≈ Y 0.88

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });

// ───────────── SDR (pantalla sRGB estándar) ─────────────
let sdrPeak;
{
  const { page, errors, context } = await open(browser, { media: [["color-gamut", "srgb"], ["dynamic-range", "standard"]] });
  const cover = await backdropLuminance(page);
  await chooseHdr(page);
  const v = await vars(page);
  check("el modo HDR existe, se aplica a <html> y deja el negro puro", (await page.evaluate(() => document.documentElement.dataset.bg)) === "hdr" && /oklch\(0 0 0\)/.test(v.bg), v.bg);
  check("SDR: curva de saturación y contraste (croma ×1,2, curva al 35 %), reflejos al 0,6", v.chroma === 1.2 && v.contrast === 0.35 && v.glint === 0.6 && !v.p3 && !v.hdr, JSON.stringify({ ...v, accent: "", accentIn: "", danger: "" }));
  const accent = oklch(v.accent);
  const input = oklch(v.accentIn);
  check("SDR: el acento sube de croma ×1,2 sin cambiar de tono ni pasar el techo de luminosidad", accent && input && Math.abs(accent.c / input.c - 1.2) < 0.03 && Math.abs(accent.h - input.h) < 1 && accent.l <= v.peak + 0.001, `${v.accentIn} → ${v.accent}`);
  const canvasSpace = await page.evaluate(() => document.querySelector("canvas.backdrop-canvas")?.getContext("webgl")?.drawingBufferColorSpace ?? "sin soporte");
  check("SDR: el lienzo WebGL sigue en sRGB", canvasSpace === "srgb" || canvasSpace === "sin soporte", canvasSpace);
  await wait(page, 600);
  const hdr = await backdropLuminance(page);
  sdrPeak = hdr;
  check("el brillo máximo del fondo deja el texto legible (≥ 4.5:1 con la tinta en la zona de controles)", contrastWithInk(hdr.maxBottom) >= 4.5, `HDR ${hdr.maxBottom.toFixed(3)} (${contrastWithInk(hdr.maxBottom).toFixed(1)}:1) · Portada ${cover.maxBottom.toFixed(3)} (${contrastWithInk(cover.maxBottom).toFixed(1)}:1)`);
  await page.screenshot({ path: join(shots, "hdr-sdr-1440x900.png") });
  await page.reload();
  await wait(page, 800);
  check("el modo persiste tras recargar", (await page.evaluate(() => document.documentElement.dataset.bg)) === "hdr");
  check("sin errores de página (SDR)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Display P3 ─────────────
{
  const { page, errors, context } = await open(browser, { media: [["color-gamut", "p3"], ["dynamic-range", "standard"]] });
  await chooseHdr(page);
  const v = await vars(page);
  check("P3: croma ×1,5, curva más suave y reflejos al 0,8", v.p3 && !v.hdr && v.chroma === 1.5 && v.contrast === 0.25 && v.glint === 0.8, JSON.stringify({ chroma: v.chroma, contrast: v.contrast, glint: v.glint }));
  check("P3: el rojo de error usa color(display-p3 …)", /display-p3/.test(v.danger), v.danger);
  const accent = oklch(v.accent);
  const input = oklch(v.accentIn);
  check("P3: el acento sube de croma ×1,5", accent && input && Math.abs(accent.c / input.c - 1.5) < 0.05, `${v.accentIn} → ${v.accent}`);
  const canvasSpace = await page.evaluate(() => document.querySelector("canvas.backdrop-canvas")?.getContext("webgl")?.drawingBufferColorSpace ?? "sin soporte");
  check("P3: el lienzo WebGL pasa a Display P3 (si el navegador lo soporta)", canvasSpace === "display-p3" || canvasSpace === "sin soporte", canvasSpace);
  await wait(page, 600);
  const hdr = await backdropLuminance(page);
  check("P3: el fondo sigue legible (≥ 4.5:1)", contrastWithInk(hdr.maxBottom) >= 4.5, `${hdr.maxBottom.toFixed(3)} (${contrastWithInk(hdr.maxBottom).toFixed(1)}:1)`);
  await page.screenshot({ path: join(shots, "hdr-p3-1440x900.png") });
  check("sin errores de página (P3)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── P3 + rango dinámico alto ─────────────
// CDP no emula `dynamic-range`; `--force-color-profile=hdr10` hace que Chromium declare la pantalla como HDR (y P3) de verdad.
const hdrBrowser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader", "--force-color-profile=hdr10"] });
{
  const { page, errors, context } = await open(hdrBrowser);
  await chooseHdr(page);
  const v = await vars(page);
  check("P3 + HDR declarado: reflejos al máximo (1) y techo de acentos 0,9", v.p3 && v.hdr && v.glint === 1 && v.peak === 0.9, JSON.stringify({ glint: v.glint, peak: v.peak, hdr: v.hdr }));
  await wait(page, 600);
  const hdr = await backdropLuminance(page);
  check("P3 + HDR: el fondo sigue legible con el techo más alto (≥ 4.5:1)", contrastWithInk(hdr.maxBottom) >= 4.5, `${hdr.maxBottom.toFixed(3)} (${contrastWithInk(hdr.maxBottom).toFixed(1)}:1)`);
  await page.screenshot({ path: join(shots, "hdr-p3-hdr-1440x900.png") });
  check("sin errores de página (P3 + HDR)", errors.length === 0, errors.join(" | "));
  await context.close();
}
await hdrBrowser.close();

// ───────────── Degradación: movimiento reducido y sin WebGL ─────────────
for (const [label, options] of [
  ["movimiento reducido + P3", { reducedMotion: "reduce", media: [["color-gamut", "p3"]] }],
  ["movimiento reducido + sRGB", { reducedMotion: "reduce", media: [["color-gamut", "srgb"]] }],
  ["sin WebGL + P3", { noWebgl: true, media: [["color-gamut", "p3"]] }],
]) {
  const { page, errors, context } = await open(browser, options);
  await chooseHdr(page);
  const state = await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas.backdrop-canvas").length,
    paint: document.querySelector(".now-playing > .backdrop")?.style.background ?? "",
  }));
  const p3 = label.includes("P3");
  check(`${label}: sin lienzo y con gradiente CSS ${p3 ? "en display-p3" : "en rgb()"} sobre negro`, state.canvases === 0 && state.paint.includes(p3 ? "display-p3" : "rgb(") && (p3 || !state.paint.includes("display-p3")) && state.paint.endsWith("var(--bg)"), state.paint.slice(0, 70));
  check(`${label}: sin errores de página`, errors.length === 0, errors.join(" | "));
  await context.close();
}

// ───────────── Navegador sin sintaxis de color relativo ─────────────
{
  const { page, context } = await open(browser);
  await chooseHdr(page);
  const supported = await page.evaluate(() => CSS.supports("color", "oklch(from red l c h)"));
  check("este Chromium admite color relativo (si no, el acento queda como el de la portada, sin romperse)", supported);
  await context.close();
}

await browser.close();
if (failed) {
  console.log(`\n${failed} comprobación(es) del modo HDR fallaron`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones del modo HDR pasaron");
console.log(`(Brillo máximo HDR en SDR medido: ${sdrPeak?.maxBottom.toFixed(3)}. Lo que no se puede ver aquí: cómo luce en una pantalla P3/HDR real.)`);
