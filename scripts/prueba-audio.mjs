// Prueba de audio real en Chromium contra `npm run dev` (puerto 5173). Uso: node scripts/prueba-audio.mjs
// Importa tonos sintéticos de tests/fixtures/audio y comprueba reproducción, atajos, fin de pista,
// repetición, crossfade, ecualizador, volumen, archivo corrupto y restauración de sesión.
// Sale con 1 si algo falla. La biblioteca no persiste entre recargas (Fase 3): se reimporta tras recargar.
import { chromium } from "@playwright/test";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const dir = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const f = (name) => join(dir, name);
// Orden de la cola = orden de importación. Duraciones: amanecer 8 s, marea 6 s, corto 2 s, sin-metadatos 4 s.
const all = ["01-amanecer.flac", "02-marea.flac", "tono-corto.wav", "tono-sin-metadatos.wav", "corrupto.mp3"].map(f);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const title = () => page.locator(".bar-track .title").innerText();
const playing = async () => (await page.locator(".bar-center").getByRole("button", { name: "Pausar" }).count()) > 0;
const position = async () => Number(await page.locator(".bar-center .seek input").inputValue());
const row = (text) => page.locator(".track-row .row-main", { hasText: text });
// Quita el foco de cualquier control sin pulsar nada (un clic en la lista cambiaría de pista).
const idle = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
const setRange = (locator, value) =>
  locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
const load = async (files) => {
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.waitForTimeout(2500);
};

await page.goto(`${base}/app`);
await load(all);

// 1. Reproducir y que el tiempo avance con el audio real.
await row("amanecer").click();
await page.waitForTimeout(1200);
check("reproduce y muestra la pista", (await title()) === "Amanecer en La" && (await playing()), await title());
check("la posición avanza con el audio real", (await position()) > 0.5, `pos=${await position()}`);

// 2. Espacio pausa y reanuda.
await idle();
await page.keyboard.press("Space");
await page.waitForTimeout(300);
check("Espacio pausa", !(await playing()));
const paused = await position();
await page.waitForTimeout(500);
check("en pausa la posición no avanza", (await position()) === paused);
await page.keyboard.press("Space");
await page.waitForTimeout(600);
check("Espacio reanuda", (await playing()) && (await position()) > paused, `${paused} → ${await position()}`);

// 3. Fin de pista → siguiente automática (tono-corto 2 s → tono-sin-metadatos).
await row("tono-corto").click();
await page.waitForTimeout(3000);
check("al terminar avanza sola a la siguiente", (await title()) === "tono-sin-metadatos" && (await playing()), await title());

// 4. Repetir pista: la pista de 2 s se repite sin cambiar de canción.
await row("tono-corto").click();
await idle();
await page.keyboard.press("r");
await page.keyboard.press("r"); // off → cola → pista
await page.waitForTimeout(4500);
check("repetir pista vuelve a empezar la misma canción", (await title()) === "tono-corto" && (await playing()), await title());
await page.keyboard.press("r"); // vuelve a off

// 5. Siguiente / anterior con teclado.
await row("Marea").click();
await idle();
await page.waitForTimeout(300);
const t0 = await title();
await page.keyboard.press("Shift+ArrowRight");
await page.waitForTimeout(400);
check("Mayús+→ salta a la siguiente", (await title()) === "tono-corto", await title());
await page.keyboard.press("Shift+ArrowLeft");
await page.waitForTimeout(400);
check("Mayús+← vuelve a la anterior", (await title()) === t0, await title());

// 6. Seek con la barra.
await row("amanecer").click();
await page.waitForTimeout(800);
await setRange(page.locator(".bar-center .seek input"), 5);
await page.waitForTimeout(500);
check("seek mueve la posición", (await position()) >= 4.9, `pos=${await position()}`);

// 7. Volumen y silencio por teclado.
const volume = () => page.locator(".volume input").inputValue();
await idle();
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
check("↓ baja el volumen", Number(await volume()) < 1, `vol=${await volume()}`);
await page.keyboard.press("m");
check("M silencia", Number(await volume()) === 0);
await page.keyboard.press("m");

// 8. Ajustes: EQ y crossfade de 2 s; persisten al recargar.
await page.getByRole("button", { name: /Sonido: ecualizador/ }).click();
await page.getByRole("tab", { name: "Ecualizador" }).click();
await page.getByLabel("Ecualizador activado").check();
await page.getByLabel("Preajuste").selectOption("Graves");
check("preajuste aplica ganancias", (await page.getByLabel("62 Hz").inputValue()) === "5");
await page.getByRole("tab", { name: "General" }).click();
await setRange(page.getByLabel(/Fundido entre canciones/), 2);
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.reload();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Sonido" }).first().click();
await page.getByRole("tab", { name: "Ecualizador" }).click();
check("el EQ persiste tras recargar", await page.getByLabel("Ecualizador activado").isChecked());
await page.getByRole("tab", { name: "General" }).click();
check("el crossfade persiste tras recargar", (await page.getByLabel(/Fundido entre canciones/).inputValue()) === "2");
await page.keyboard.press("Escape");

// 9. Crossfade: amanecer dura 8 s; con 2 s de fundido la siguiente ya suena a los 7 s (sin él, seguiría amanecer).
await load([f("01-amanecer.flac"), f("02-marea.flac")]);
await row("amanecer").click();
await page.waitForTimeout(7200);
check("con crossfade la siguiente ya suena antes del final de la anterior", (await title()) === "Marea de Fase" && (await playing()), await title());

// 10. Archivo corrupto: aviso visible y la app sigue viva.
await load([f("corrupto.mp3")]);
await row("corrupto").click();
await page.waitForTimeout(2000);
check("archivo corrupto muestra aviso y la app sigue viva", (await page.locator(".notice").count()) > 0 && errors.length === 0, errors.join(" | "));

// 11. Temporizador: "al terminar la canción" detiene al final de la pista, sin avanzar.
await row("Marea").click();
await page.getByRole("button", { name: "Sonido" }).first().click();
await page.getByRole("button", { name: "Al terminar la canción" }).click();
await page.keyboard.press("Escape");
await setRange(page.locator(".bar-center .seek input"), 5);
await page.waitForTimeout(2200);
check("temporizador al terminar la canción detiene sin avanzar", !(await playing()) && (await title()) === "Marea de Fase", `${await title()} playing=${await playing()}`);

// 12. Sesión: tras recargar y volver a importar el archivo, la pista se restaura.
await row("Marea").click();
await page.waitForTimeout(1500);
await page.reload();
await load([f("02-marea.flac")]);
check("la sesión restaura la pista al volver a tener el archivo", (await title()) === "Marea de Fase" && !(await playing()), `title=${await title().catch(() => "—")}`);

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} comprobaciones fallaron` : `\nTodas las comprobaciones pasaron (${results.length})`);
process.exit(failed ? 1 : 0);
