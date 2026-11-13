// Mide la calidad del reescalado de portadas contra `npm run dev`. Uso: node scripts/medir-portada.mjs [url-base] [carpeta-de-salida]
// Parte de portadas reales de dominio público (tests/fixtures/landing/cover-raw-*.jpg; si faltan, `npm run landing:musica`), las baja a 300 px
// (una portada pequeña bien hecha) y las muestra a 640 px:
//   ANTES   = lo que hacía la app: guardar la miniatura con drawImage y que el navegador la amplíe en el <img>.
//   DESPUÉS = scaleBitmap (reducción por pasos + Lanczos + enfoque ligero con tope) desde la imagen incrustada, a los 640 px reales.
// La referencia es la misma portada reducida directamente del original a 640 px. Métricas: PSNR y SSIM (más alto = más parecido) y energía
// de bordes respecto a la referencia (1,00 = igual de nítida). Después comprueba la app de punta a punta (densidad 2, hilo principal, worker perezoso).
// Ningún algoritmo clásico añade detalle que no existe: se mide cuánto se acerca al original, no cuánto «parece» más nítido.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const root = join(import.meta.dirname, "..");
const out = process.argv[3] ?? join(root, "docs", "capturas");
mkdirSync(out, { recursive: true });
const covers = join(root, "tests", "fixtures", "landing");
const sources = existsSync(covers) ? readdirSync(covers).filter((name) => /^cover-raw-\d\.jpe?g$/.test(name)) : [];
if (sources.length === 0) throw new Error("Faltan las portadas de tests/fixtures/landing (npm run landing:musica).");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

// --- 1. Calidad: antes y después sobre las mismas portadas ---
const page = await browser.newPage({ viewport: { width: 1400, height: 700 }, deviceScaleFactor: 1 });
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.goto(`${base}/app`);

async function prepare(name) {
  const bytes = readFileSync(join(covers, name)).toString("base64");
  return page.evaluate(async ({ bytes, SHOW }) => {
    const { halvings, resample } = await import("/src/core/resample.ts");
    const { scaleBitmap } = await import("/src/platform/web/coverScale.ts");
    const original = await createImageBitmap(new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))]));
    const side = Math.min(original.width, original.height);
    // Referencia ideal: del original, por mitades y un último Lanczos, sin enfoque.
    const reference = async (bitmap, target) => {
      const s = Math.min(bitmap.width, bitmap.height);
      let source = bitmap;
      let crop = [(bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s];
      let current = s;
      for (const next of halvings(s, target)) {
        const c = new OffscreenCanvas(next, next);
        const x = c.getContext("2d");
        x.imageSmoothingQuality = "high";
        x.drawImage(source, ...crop, 0, 0, next, next);
        source = c;
        crop = [0, 0, next, next];
        current = next;
      }
      const c = new OffscreenCanvas(current, current);
      const x = c.getContext("2d");
      x.drawImage(source, ...crop, 0, 0, current, current);
      const raster = current === target ? x.getImageData(0, 0, current, current) : resample(x.getImageData(0, 0, current, current), target, target);
      const final = new OffscreenCanvas(target, target);
      final.getContext("2d").putImageData(new ImageData(raster.data, target, target), 0, 0);
      return final;
    };
    const png = async (canvas) => {
      const blob = await canvas.convertToBlob({ type: "image/png" });
      return URL.createObjectURL(blob);
    };
    // La portada pequeña que traería el archivo (300 px, JPEG).
    const embedded = await (await reference(original, 300)).convertToBlob({ type: "image/jpeg", quality: 0.9 });
    const embeddedBitmap = await createImageBitmap(embedded);
    // ANTES: la miniatura de 600 que guardaba la app (con 300 px de origen, 300 px) hecha con drawImage; el <img> la amplía.
    const oldLarge = new OffscreenCanvas(300, 300);
    oldLarge.getContext("2d").drawImage(embeddedBitmap, 0, 0, 300, 300);
    const before = await oldLarge.convertToBlob({ type: "image/jpeg", quality: 0.86 });
    // DESPUÉS: a los píxeles reales de pantalla desde la imagen incrustada.
    const after = await scaleBitmap(embeddedBitmap, SHOW, 0.92);
    const truth = await reference(original, SHOW);
    return { truth: await png(truth), before: URL.createObjectURL(before), after: URL.createObjectURL(after), side };
  }, { bytes, SHOW: 640 });
}

const metrics = await page.evaluate(() => {
  window.__metrics = (a, b) => {
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let mse = 0;
    for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) mse += (a.data[i + c] - b.data[i + c]) ** 2;
    mse /= (a.data.length / 4) * 3;
    const c1 = (0.01 * 255) ** 2;
    const c2 = (0.03 * 255) ** 2;
    let ssim = 0;
    let n = 0;
    for (let by = 0; by + 8 <= a.height; by += 4) {
      for (let bx = 0; bx + 8 <= a.width; bx += 4) {
        let ma = 0;
        let mb = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = ((by + y) * a.width + bx + x) * 4; ma += lum(a.data, i); mb += lum(b.data, i); }
        ma /= 64;
        mb /= 64;
        let va = 0, vb = 0, cov = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = ((by + y) * a.width + bx + x) * 4; const da = lum(a.data, i) - ma; const db = lum(b.data, i) - mb; va += da * da; vb += db * db; cov += da * db; }
        ssim += ((2 * ma * mb + c1) * (2 * (cov / 63) + c2)) / ((ma * ma + mb * mb + c1) * (va / 63 + vb / 63 + c2));
        n++;
      }
    }
    const edges = (d) => { let t = 0; for (let y = 0; y < d.height - 1; y++) for (let x = 0; x < d.width - 1; x++) { const i = (y * d.width + x) * 4; t += Math.abs(lum(d.data, i + 4) - lum(d.data, i)) + Math.abs(lum(d.data, i + d.width * 4) - lum(d.data, i)); } return t / (d.width * d.height); };
    return { psnr: 10 * Math.log10((255 * 255) / mse), ssim: ssim / n, edges: edges(b) / edges(a) };
  };
  window.__pixels = async (dataUrl) => {
    const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const c = new OffscreenCanvas(image.width, image.height);
    const x = c.getContext("2d");
    x.drawImage(image, 0, 0);
    return x.getImageData(0, 0, image.width, image.height);
  };
  return true;
});
void metrics;

const rows = [];
let detailShot;
for (const name of sources) {
  const urls = await prepare(name);
  const shots = {};
  for (const kind of ["truth", "before", "after"]) {
    // Todas se pintan a 640 px CSS con densidad 1; la «antes» es de 300 px y la amplía el navegador, como en la app.
    await page.setContent(`<body style="margin:0;background:#111"><img id="i" src="${urls[kind]}" style="display:block;width:640px;height:640px">`);
    await page.waitForFunction(() => document.getElementById("i").complete);
    shots[kind] = (await page.locator("#i").screenshot({ type: "png" })).toString("base64");
  }
  const result = await page.evaluate(async (shots) => {
    const px = (b64) => window.__pixels(`data:image/png;base64,${b64}`);
    const truth = await px(shots.truth);
    return { before: window.__metrics(truth, await px(shots.before)), after: window.__metrics(truth, await px(shots.after)) };
  }, shots);
  rows.push({ name, ...result });
  if (name === "cover-raw-0.jpg") detailShot = shots;
}

console.log("\nPortadas de 300 px mostradas a 640 px (referencia: el original reducido a 640 px)\n");
console.log("portada          |   PSNR dB antes → después   |      SSIM antes → después     | bordes antes → después");
for (const { name, before, after } of rows) {
  console.log(`${name.padEnd(16)} | ${before.psnr.toFixed(2)} → ${after.psnr.toFixed(2)} (${(after.psnr - before.psnr >= 0 ? "+" : "") + (after.psnr - before.psnr).toFixed(2)}) | ${before.ssim.toFixed(4)} → ${after.ssim.toFixed(4)} | ${before.edges.toFixed(3)} → ${after.edges.toFixed(3)}`);
}
const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
const gain = mean((r) => r.after.psnr - r.before.psnr);
console.log(`media: PSNR ${gain >= 0 ? "+" : ""}${gain.toFixed(2)} dB, SSIM ${(mean((r) => r.after.ssim) - mean((r) => r.before.ssim)).toFixed(4)}\n`);
check("el reescalado se parece más al original que la ampliación del navegador (PSNR medio)", gain > 0.2, `${gain.toFixed(2)} dB`);
check("y no pierde en SSIM en ninguna portada", rows.every((r) => r.after.ssim >= r.before.ssim), rows.map((r) => (r.after.ssim - r.before.ssim).toFixed(4)).join(" "));
check("sin halos: la energía de bordes no se pasa de la del original", rows.every((r) => r.after.edges <= 1.1), rows.map((r) => r.after.edges.toFixed(2)).join(" "));

// Composición de detalle (antes · después · original) a 3× sin suavizado, para mirarla.
if (detailShot) {
  const html = ["before", "after", "truth"]
    .map((kind) => `<div style="width:300px;height:300px;overflow:hidden;position:relative"><img src="data:image/png;base64,${detailShot[kind]}" style="position:absolute;left:-990px;top:-240px;width:1920px;height:1920px;image-rendering:pixelated"></div>`)
    .join("");
  await page.setContent(`<body style="margin:0;background:#111;display:flex;gap:8px;padding:8px;width:944px">${html}</body>`);
  await page.setViewportSize({ width: 960, height: 320 });
  await page.screenshot({ path: join(out, "portada-baja-resolucion.png"), clip: { x: 0, y: 0, width: 944, height: 316 } });
  console.log(`Detalle (antes · después · original, zoom 3×) en ${join(out, "portada-baja-resolucion.png")}`);
}

// Coste de cada reescalado en un worker real (aquí, el hilo de la página: es un tope superior) con una portada grande.
const timing = await page.evaluate(async (bytes) => {
  const { scaleBitmap } = await import("/src/platform/web/coverScale.ts");
  const original = await createImageBitmap(new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))]));
  const time = async (fn, runs = 5) => {
    await fn();
    const t = performance.now();
    for (let i = 0; i < runs; i++) await fn();
    return (performance.now() - t) / runs;
  };
  const old = (size) => async () => {
    const c = new OffscreenCanvas(size, size);
    const s = Math.min(original.width, original.height);
    c.getContext("2d").drawImage(original, (original.width - s) / 2, (original.height - s) / 2, s, s, 0, 0, size, size);
    await c.convertToBlob({ type: "image/jpeg", quality: 0.86 });
  };
  const embedded = await createImageBitmap(await scaleBitmap(original, 300, 0.9));
  return {
    size: `${original.width}×${original.height}`,
    oldScan: (await time(old(96))) + (await time(old(600))),
    newScan: (await time(() => scaleBitmap(original, 96, 0.86))) + (await time(() => scaleBitmap(original, 600, 0.86))) + (await time(() => scaleBitmap(original, 1024, 0.82))),
    derive640: await time(() => scaleBitmap(embedded, 640, 0.92)),
    derive1088: await time(() => scaleBitmap(embedded, 1088, 0.92)),
    kb: Object.fromEntries(await Promise.all([[96, 0.86], [600, 0.86], [1024, 0.82]].map(async ([size, quality]) => [size, (await scaleBitmap(original, size, quality)).size / 1024]))),
  };
}, readFileSync(join(covers, sources[0])).toString("base64"));
console.log(`\nCoste con una portada de ${timing.size}:`);
console.log(`  al escanear (miniaturas${" "}+ master): antes ${timing.oldScan.toFixed(0)} ms → ahora ${timing.newScan.toFixed(0)} ms por portada distinta`);
console.log(`  lo que ocupa en IndexedDB por portada distinta: 96 px ${timing.kb[96].toFixed(0)} KB · 600 px ${timing.kb[600].toFixed(0)} KB · master 1024 px ${timing.kb[1024].toFixed(0)} KB`);
console.log(`  ampliar de 300 a 640 px: ${timing.derive640.toFixed(0)} ms · a 1088 px: ${timing.derive1088.toFixed(0)} ms (en un worker, una vez; luego queda en caché)`);
await page.close();

// --- 2. De punta a punta en la app: densidad 2, hilo principal libre y worker perezoso ---
const tmp = join(root, "node_modules", ".cache");
mkdirSync(tmp, { recursive: true });
const small = join(tmp, "portada-300.jpg");
const withCover = join(tmp, "portada-300.flac");
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(covers, sources[0]), "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=300:300:flags=lanczos", "-q:v", "2", small]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(root, "tests", "fixtures", "audio", "02-marea.flac"), "-i", small, "-map", "0:a", "-map", "1:v", "-c", "copy", "-disposition:v", "attached_pic", withCover]);

for (const dpr of [1, 2]) {
  const app = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  await app.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((list) => window.__long.push(...list.getEntries().map((e) => e.duration))).observe({ type: "longtask", buffered: true });
  });
  await app.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await app.goto(`${base}/app`);
  await app.getByLabel("Elegir archivos de música").setInputFiles([withCover]);
  await app.waitForTimeout(2500);
  await app.locator(".track-row .row-main").first().click();
  await app.waitForTimeout(800);
  check(`densidad ${dpr}: el worker de portadas no existe hasta que hace falta`, !app.workers().some((worker) => worker.url().includes("cover.worker")));
  await app.evaluate(() => (window.__long.length = 0));
  await app.locator(".bar-track").click();
  await app.waitForFunction(() => document.querySelector(".now-cover img"), null, { timeout: 10_000 });
  await app.waitForTimeout(1500);
  const shown = await app.evaluate(() => {
    const image = document.querySelector(".now-cover img");
    return { natural: image.naturalWidth, css: image.clientWidth, long: window.__long.slice() };
  });
  const expected = Math.min(1280, Math.ceil((shown.css * dpr) / 64) * 64);
  check(`densidad ${dpr}: la portada de 300 px se sirve a los píxeles reales de pantalla`, shown.natural === expected && shown.natural > 300, `${shown.natural} px naturales para ${shown.css} px CSS × ${dpr} (esperado ${expected})`);
  check(`densidad ${dpr}: no hay tareas largas (≥ 50 ms) en el hilo principal al abrir el reproductor`, shown.long.length === 0, `${shown.long.length} tareas${shown.long.length ? ` (${shown.long.map((d) => d.toFixed(0)).join(", ")} ms)` : ""}`);
  check(`densidad ${dpr}: el worker de portadas se creó al pedir la ampliación`, app.workers().some((worker) => worker.url().includes("cover.worker")));
  if (dpr === 2) await app.locator(".now-cover").screenshot({ path: join(tmp, "portada-baja-resolucion-app-2x.png") });
  await app.close();
}

await browser.close();
console.log(failed === 0 ? "\nTodo en verde." : `\n${failed} comprobaciones fallaron.`);
process.exit(failed === 0 ? 0 : 1);
