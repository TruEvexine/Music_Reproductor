// Prueba de los atajos de teclado en Chromium contra `npm run dev`. Uso: node scripts/prueba-atajos.mjs [url-base]
// Pone el foco en cada tipo de elemento (cuerpo, campo de texto, deslizador, botón, enlace) y comprueba que no hay doble acción:
// que la tecla hace lo suyo O lo que le toca al elemento, nunca las dos. También Ctrl/Alt/Meta, apagar los atajos en Ajustes y la hoja «?».
import { chromium } from "@playwright/test";
import { join } from "node:path";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
// Largas para que no terminen durante la prueba: amanecer 8 s, marea 6 s, hi-res.
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles(files);
await page.waitForTimeout(2500);

const title = () => page.locator(".bar-track .title").innerText();
const playing = async () => (await page.locator(".bar-center").getByRole("button", { name: "Pausar" }).count()) > 0;
const shuffleOn = async () => (await page.locator('.bar-center button[aria-pressed]').first().getAttribute("aria-pressed")) === "true";
const repeatState = () => page.locator(".bar-center button[aria-pressed]").last().getAttribute("aria-label");
const toastText = () => page.locator(".toast").innerText().catch(() => "");
const idle = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
const wait = (ms = 250) => page.waitForTimeout(ms);
const start = async () => {
  await page.locator(".track-row .row-main").first().click();
  await wait(700);
  await idle();
};

await start();
const first = await title();
check("hay una pista sonando para probar", (await playing()) && first.length > 0, first);

// 1. Foco en el cuerpo: cada atajo hace lo suyo.
await page.keyboard.press("Space");
await wait();
check("Espacio pausa (foco en el cuerpo)", !(await playing()));
await page.keyboard.press("Space");
await wait();
check("Espacio reanuda", await playing());
await page.keyboard.press("ArrowRight");
await wait(500);
const second = await title();
check("→ salta a la siguiente", second !== first, `${first} → ${second}`);
await page.keyboard.press("ArrowLeft");
await wait(500);
check("← vuelve a la anterior", (await title()) === first, await title());

await page.keyboard.press("x");
await wait();
check("X activa el aleatorio y avisa", (await shuffleOn()) && /Aleatorio activado/.test(await toastText()), await toastText());
await page.keyboard.press("x");
await wait();
check("X lo desactiva y avisa", !(await shuffleOn()) && /Aleatorio desactivado/.test(await toastText()), await toastText());

const seen = [await repeatState()];
const toasts = [];
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("p");
  await wait(150);
  seen.push(await repeatState());
  toasts.push(await toastText());
}
check(
  "P cicla desactivado → cola → canción → desactivado",
  seen.join("|") === "Repetición desactivada|Repitiendo la cola|Repitiendo la canción|Repetición desactivada",
  seen.join("|"),
);
check("cada cambio de P muestra el estado en el aviso", toasts.join("|") === "Repitiendo la cola|Repitiendo la canción|Repetición desactivada", toasts.join("|"));
check("el aviso lo anuncia un role=status", (await page.locator('.toaster[role="status"] .toast').count()) === 1);

// 2. Con Ctrl, Alt o Meta no se dispara nada.
const before = { title: await title(), playing: await playing(), shuffle: await shuffleOn(), repeat: await repeatState() };
for (const combo of ["Control+x", "Control+p", "Alt+ArrowRight", "Alt+ArrowLeft", "Meta+x", "Control+Space", "Meta+p"]) await page.keyboard.press(combo);
await wait();
const after = { title: await title(), playing: await playing(), shuffle: await shuffleOn(), repeat: await repeatState() };
check("Ctrl, Alt y Meta no disparan atajos", JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));

// 3. Campo de texto: se escribe, no se dispara nada.
await page.getByLabel("Buscar en tu música").focus();
await page.keyboard.type("x p ");
await page.keyboard.press("ArrowLeft");
await wait();
check(
  "en el campo de búsqueda se escribe y no se dispara nada",
  (await page.getByLabel("Buscar en tu música").inputValue()) === "x p " && (await title()) === before.title && (await playing()) === before.playing && !(await shuffleOn()) && (await repeatState()) === before.repeat,
  `valor="${await page.getByLabel("Buscar en tu música").inputValue()}"`,
);
await page.getByLabel("Buscar en tu música").fill("");
await idle();

// 4. Deslizador: las flechas ajustan el valor y no cambian de canción; el resto de atajos sigue vivo.
const volume = page.locator(".volume input");
await volume.focus();
const v0 = Number(await volume.inputValue());
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await wait();
const v1 = Number(await volume.inputValue());
check("flechas sobre el deslizador de volumen: cambia el volumen y no la canción", v1 < v0 && (await title()) === before.title, `${v0} → ${v1}`);
const seek = page.locator(".bar-center .seek input");
await seek.focus();
const p0 = Number(await seek.inputValue());
await page.keyboard.press("ArrowRight");
await wait(150);
check("flechas sobre la barra de progreso: mueve la barra y no cambia de canción", (await title()) === before.title && Number(await seek.inputValue()) !== p0, `${p0} → ${await seek.inputValue()}`);
await page.keyboard.press("x");
await wait();
check("X sigue funcionando con el foco en un deslizador (no lo usa)", await shuffleOn());
await page.keyboard.press("x");
await idle();

// 5. Botón: Espacio lo activa a él y no alterna además la reproducción (si lo hicieran los dos, quedaría igual).
const playButton = page.locator(".bar-center .play-button");
const wasPlaying = await playing();
await playButton.focus();
await page.keyboard.press("Space");
await wait(400);
check("Espacio sobre el botón de reproducir: una sola acción (cambia el estado una vez)", (await playing()) === !wasPlaying, `${wasPlaying} → ${await playing()}`);
await page.keyboard.press("Space");
await wait(400);
check("y otra vez: vuelve al estado inicial", (await playing()) === wasPlaying);
const shuffleButton = page.locator('.bar-center button[aria-pressed]').first();
await shuffleButton.focus();
await page.keyboard.press("Space");
await wait();
check("Espacio sobre el botón de aleatorio: activa el aleatorio y no toca la reproducción", (await shuffleOn()) && (await playing()) === wasPlaying);
await page.keyboard.press("Space");
await wait();
check("Espacio otra vez: lo apaga", !(await shuffleOn()));
await page.keyboard.press("ArrowRight");
await wait(500);
check("→ con el foco en un botón sí cambia de canción (el botón no usa las flechas)", (await title()) !== before.title, await title());
await page.keyboard.press("ArrowLeft");
await wait(500);

// 6. Enlace: Espacio no es suyo (los enlaces se activan con Intro), pero tampoco alterna: la tecla es del elemento.
await page.getByRole("link", { name: "Playlists", exact: true }).focus();
const urlBefore = page.url();
const playingBefore = await playing();
await page.keyboard.press("Space");
await wait(400);
check("Espacio sobre un enlace no alterna la reproducción", (await playing()) === playingBefore && page.url() === urlBefore);

// 7. «?» abre la hoja de ayuda y Escape la cierra; el aviso no tapa nada.
await idle();
await page.keyboard.press("Shift+Slash");
await wait(400);
const help = page.locator("dialog[open]").filter({ hasText: "Atajos de teclado" });
check("«?» abre la hoja con la lista de atajos", (await help.count()) === 1 && (await help.locator("kbd").count()) >= 12, `${await help.locator("kbd").count()} teclas`);
check("la lista incluye Espacio, X y P", (await help.innerText()).includes("Reproducir o pausar") && (await help.locator("kbd", { hasText: /^X$/ }).count()) === 1 && (await help.locator("kbd", { hasText: /^P$/ }).count()) === 1);
await page.keyboard.press("x"); // con un diálogo abierto no actúa
await wait();
check("con la hoja abierta los atajos no actúan", !(await shuffleOn()));
await page.keyboard.press("Escape");
await wait(400);
check("Escape cierra la hoja", (await page.locator("dialog[open]").count()) === 0);

// 8. Ajustes → Accesibilidad: apagar los atajos y el enlace a la lista.
await page.getByRole("link", { name: "Ajustes", exact: true }).click();
await wait(500);
const toggle = page.locator(".settings").getByRole("switch", { name: "Atajos de teclado" });
check("Ajustes tiene el interruptor de atajos, encendido por defecto", (await toggle.getAttribute("aria-checked")) === "true");
await page.locator(".settings").getByRole("button", { name: "Ver la lista de atajos" }).click();
await wait(400);
check("el enlace de Ajustes abre la misma hoja", (await page.locator("dialog[open]").filter({ hasText: "Atajos de teclado" }).count()) === 1);
await page.keyboard.press("Escape");
await wait(400);
await toggle.click();
await wait(300);
check("el interruptor queda apagado", (await toggle.getAttribute("aria-checked")) === "false");
await idle();
const off = { title: await title(), playing: await playing(), shuffle: await shuffleOn(), repeat: await repeatState() };
for (const key of ["Space", "ArrowRight", "x", "p", "Shift+Slash", "m"]) await page.keyboard.press(key);
await wait(400);
check(
  "con los atajos apagados ninguna tecla hace nada",
  JSON.stringify(off) === JSON.stringify({ title: await title(), playing: await playing(), shuffle: await shuffleOn(), repeat: await repeatState() }) && (await page.locator("dialog[open]").count()) === 0,
);
await page.reload();
await wait(1500);
await page.keyboard.press("x");
await wait();
check("apagado persiste tras recargar", !(await shuffleOn()));
await page.getByRole("link", { name: "Ajustes", exact: true }).click();
await wait(400);
await page.locator(".settings").getByRole("switch", { name: "Atajos de teclado" }).click();
await wait(300);
await idle();
await page.keyboard.press("x");
await wait();
check("al volver a encenderlos, X vuelve a funcionar", await shuffleOn());

check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failed === 0 ? "\nTodo en verde." : `\n${failed} comprobaciones fallaron.`);
process.exit(failed === 0 ? 0 : 1);
