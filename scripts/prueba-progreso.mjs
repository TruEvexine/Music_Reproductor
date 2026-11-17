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
check("con ratón, la burbuja dice la velocidad y la pista con «el puntero»", /· Normal\s+Aleja el puntero de la barra para más precisión/.test(bubble), bubble.replace(/\n/g, " / "));
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

// 5b. Volumen en el reproductor grande (escritorio): el mismo estado que el de la barra.
await page.evaluate(() => (history.pushState(null, "", "/app?panel=player"), dispatchEvent(new PopStateEvent("popstate"))));
await page.waitForTimeout(800);
const bigVolume = page.locator(".now-playing .volume").getByRole("slider", { name: "Volumen" });
const barVolume = page.locator(".bar-end .volume input");
check("reproductor grande: hay un deslizador «Volumen» con su valor", (await bigVolume.count()) === 1 && /^\d+ %$/.test((await bigVolume.getAttribute("aria-valuetext")) ?? ""), await bigVolume.getAttribute("aria-valuetext"));
await bigVolume.focus();
const v0 = Number(await bigVolume.inputValue());
for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
await page.waitForTimeout(150);
const v1 = Number(await bigVolume.inputValue());
check("flechas en el grande: suben el volumen y la barra lo refleja (un solo estado)", Math.abs(v1 - v0 - 0.05) < 0.001 && (await barVolume.inputValue()) === String(v1) && Math.abs((await master()) - v1) < 0.02, `${v0} → ${v1}, barra ${await barVolume.inputValue()}, ganancia ${(await master()).toFixed(3)}`);
check("el foco de teclado se ve en el deslizador", await page.locator(".now-playing .volume .range").evaluate((el) => getComputedStyle(el.querySelector(".range-rail")).outlineStyle === "solid"));
await page.locator(".now-playing .volume").getByRole("button", { name: "Silenciar" }).click();
await page.waitForTimeout(150);
check("el icono silencia: valor 0 anunciado como «Silenciado», también en la barra", (await bigVolume.inputValue()) === "0" && (await bigVolume.getAttribute("aria-valuetext")) === "Silenciado" && (await barVolume.inputValue()) === "0" && (await page.locator(".now-playing .volume").getByRole("button", { name: "Activar sonido" }).count()) === 1);
await page.locator(".now-playing .volume").getByRole("button", { name: "Activar sonido" }).click();
const vbig = await page.locator(".now-playing .volume .range").boundingBox();
await page.mouse.move(vbig.x + vbig.width / 2, vbig.y + vbig.height / 2);
await page.mouse.wheel(0, 100);
await page.waitForTimeout(150);
check("la rueda del ratón baja el volumen (≈ 5 % por clic)", Math.abs(Number(await bigVolume.inputValue()) - (v1 - 0.05)) < 0.011, `${v1} → ${await bigVolume.inputValue()}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// 6. Táctil (gesto simulado por CDP, móvil, reproductor grande): la burbuja junto al tiempo dice la velocidad y cómo cambiarla mientras dura el gesto.
for (const reducedMotion of ["no-preference", "reduce"]) {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion });
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await phone.goto(`${base}/app`);
  await phone.getByLabel("Elegir archivos de música").setInputFiles([audio("01-amanecer.flac"), audio("02-marea.flac")]);
  await phone.waitForTimeout(2500);
  await phone.locator(".track-row .row-main", { hasText: "amanecer" }).tap();
  await phone.evaluate(() => (history.pushState(null, "", "/app?panel=player"), dispatchEvent(new PopStateEvent("popstate"))));
  await phone.waitForTimeout(900);
  if (reducedMotion === "reduce") check("móvil: el reproductor grande no tiene volumen (mandan los botones del teléfono)", (await phone.locator(".now-playing .volume").count()) === 0);
  const seekBox = await phone.locator(".now-playing .seek .range").boundingBox();
  const cdp = await phone.context().newCDPSession(phone);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const sy = seekBox.y + seekBox.height / 2;
  const sx = seekBox.x + seekBox.width * 0.3;
  const text = () => phone.locator(".now-playing .range-value").innerText().catch(() => "");
  await touch("touchStart", sx, sy);
  await touch("touchMove", sx + 20, sy);
  await touch("touchMove", sx + 30, sy);
  await phone.waitForTimeout(100);
  const normal = await text();
  await touch("touchMove", sx + 30, sy + 110); // ¼ (96–160 px)
  await phone.waitForTimeout(100);
  const quarter = await text();
  await touch("touchMove", sx + 30, sy + 180); // ⅒ (≥ 160 px)
  await phone.waitForTimeout(100);
  const tenth = await text();
  const motion = await phone.locator(".now-playing .range-value").evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.transitionDuration}|${style.animationName}`;
  });
  await touch("touchEnd");
  await phone.waitForTimeout(200);
  const label = reducedMotion === "reduce" ? "movimiento reducido" : "táctil";
  check(`${label}: cerca de la barra, «Normal» y «Aleja el dedo de la barra…»`, /· Normal\s+Aleja el dedo de la barra para más precisión/.test(normal), normal.replace(/\n/g, " / "));
  check(`${label}: a 110 px, «Fino ¼» y «Aléjalo más…»`, /· Fino ¼\s+Aléjalo más para más precisión/.test(quarter), quarter.replace(/\n/g, " / "));
  check(`${label}: a 180 px, «Fino ⅒» y «Máxima precisión»`, /· Fino ⅒\s+Máxima precisión/.test(tenth), tenth.replace(/\n/g, " / "));
  // Sin transición propia; con movimiento reducido la regla global deja 0,01 ms (1e-05 s) en todo.
  check(`${label}: la etiqueta aparece sin animación`, /^(0s|1e-05s)\|none$/.test(motion), motion);
  check(`${label}: al soltar, la etiqueta desaparece`, (await phone.locator(".range-value").count()) === 0);
  await phone.close();
}

check("sin errores en la página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
