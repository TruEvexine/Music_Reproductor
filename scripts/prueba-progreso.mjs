// Barra de progreso «confirmar al soltar», con audio real en Chromium contra `npm run dev`. Uso: node scripts/prueba-progreso.mjs [url-base]
// Cuenta cada escritura de `currentTime` en los <audio>: arrastrando no hay ninguna (la reproducción sigue), al soltar hay una sola;
// lo mismo al tocar y con cada flecha. Una búsqueda que interrumpe a otra no deja el volumen bajo. Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const audio = (name) => join(import.meta.dirname, "..", "tests", "fixtures", "audio", name);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.addInitScript(() => {
  const own = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  window.__seeks = [];
  window.__audios = new Set();
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      window.__audios.add(this);
      return own.get.call(this);
    },
    set(value) {
      if (this.getAttribute("src")) window.__seeks.push(value);
      own.set.call(this, value);
    },
  });
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles([audio("01-amanecer.flac"), audio("02-marea.flac")]);
await page.waitForTimeout(2500);
await page.locator(".track-row .row-main", { hasText: "amanecer" }).click();
await page.waitForTimeout(800);

const seeks = () => page.evaluate(() => window.__seeks.length);
// El tiempo del <audio> que suena (el único que no está en pausa).
const now = () => page.evaluate(() => [...window.__audios].find((a) => !a.paused)?.currentTime ?? -1);
const master = () => page.evaluate(() => window.__engine.snapshot().master);
const range = page.locator(".bar-center .seek .range");
const box = await range.boundingBox();
const y = box.y + box.height / 2;
const x = (fraction) => box.x + box.width * fraction;

// 1. Arrastrar: el tirador y la burbuja muestran el destino; el audio sigue donde iba, sin búsquedas.
await page.evaluate(() => window.__engine.seek(0));
await page.waitForTimeout(400);
let before = await seeks();
const t0 = await now();
await page.mouse.move(x(0.2), y);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(x(0.2 + i * 0.05), y);
  await page.waitForTimeout(40);
}
const bubble = await page.locator(".bar-center .range-value").innerText().catch(() => "");
const thumb = Number(await page.locator(".bar-center .seek input").inputValue());
const t1 = await now();
const during = (await seeks()) - before;
check("arrastrando no se escribe currentTime", during === 0, `${during} escrituras`);
check("arrastrando la reproducción sigue en su posición", t1 > t0 && t1 - t0 < 1.5, `${t0.toFixed(2)} → ${t1.toFixed(2)} s`);
check("arrastrando se muestra el tiempo de destino", thumb >= 4 && /^0:0\d/.test(bubble) && bubble.startsWith(`0:0${Math.round(thumb)}`), `tirador ${thumb} s · «${bubble}»`);
await page.mouse.up();
await page.waitForTimeout(400);
let after = await seeks();
check("al soltar se busca una sola vez", after - before === 1, `${after - before} escrituras`);
check("al soltar suena desde el destino", Math.abs((await now()) - thumb) < 0.8, `${(await now()).toFixed(2)} s (destino ${thumb})`);
check("tras la búsqueda el volumen vuelve entero", Math.abs((await master()) - 1) < 0.01, `ganancia ${(await master()).toFixed(3)}`);

// 2. Tocar la barra: una sola búsqueda.
before = await seeks();
await page.mouse.click(x(0.25), y);
await page.waitForTimeout(400);
check("tocar la barra busca una sola vez", (await seeks()) - before === 1, `${(await seeks()) - before} escrituras`);

// 3. Flechas: una búsqueda por tecla.
before = await seeks();
await page.locator(".bar-center .seek input").focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
const one = (await seeks()) - before;
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
check("cada flecha busca una vez", one === 1 && (await seeks()) - before === 2, `${one} y ${(await seeks()) - before}`);

// 4. Interrumpir: un segundo arrastre suelta justo tras el primero; el volumen vuelve.
await page.evaluate(() => document.activeElement?.blur());
before = await seeks();
for (const to of [0.6, 0.3]) {
  await page.mouse.move(x(0.45), y);
  await page.mouse.down();
  await page.mouse.move(x(to), y, { steps: 2 });
  await page.mouse.up();
}
const lowNow = await master();
await page.waitForTimeout(500);
after = await seeks();
check("una búsqueda que interrumpe a otra no deja el volumen bajo", Math.abs((await master()) - 1) < 0.01, `a mitad ${lowNow?.toFixed(3)} → ${(await master()).toFixed(3)}`);
check("dos arrastres seguidos: una búsqueda por arrastre", after - before === 2, `${after - before} escrituras`);
// Playwright tarda más que la bajada (40 ms) entre arrastres: a mitad de la bajada se prueba llamando al motor directamente.
before = await seeks();
await page.evaluate(async () => {
  window.__engine.seek(2);
  await new Promise((resolve) => setTimeout(resolve, 15));
  window.__engine.seek(5);
});
await page.waitForTimeout(500);
check("a mitad de la bajada, solo salta la última y el volumen vuelve", (await seeks()) - before === 1 && Math.abs((await master()) - 1) < 0.01 && Math.abs((await now()) - 5.4) < 0.5, `${(await seeks()) - before} escrituras · ${(await now()).toFixed(2)} s · ganancia ${(await master()).toFixed(3)}`);

// 5. Los demás deslizadores siguen en vivo: el volumen cambia mientras se arrastra.
const volume = page.locator(".bar-end .range");
const vbox = await volume.boundingBox();
await page.mouse.move(vbox.x + vbox.width * 0.9, vbox.y + vbox.height / 2);
await page.mouse.down();
await page.mouse.move(vbox.x + vbox.width * 0.3, vbox.y + vbox.height / 2, { steps: 4 });
await page.waitForTimeout(150);
const live = await master();
await page.mouse.up();
check("el volumen sigue en vivo mientras se arrastra", live < 0.6, `ganancia ${live?.toFixed(3)} sin soltar`);

check("sin errores en la página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
