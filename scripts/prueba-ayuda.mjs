// Prueba de la sección Ayuda (/app/ayuda) en Chromium contra `npm run dev`. Uso: node scripts/prueba-ayuda.mjs [url-base] [carpeta-capturas]
// Ayuda = cómo se usa: «Empezar» (3 pasos que nombran controles reales), atajos y gestos de las mismas fuentes que el código (lista de la
// hoja «?» y etiquetas reales de las filas) y la FAQ de FAQ.md sin sus notas de mantenimiento (máximo 10). Nada de «Nosotros»: eso vive en
// Ajustes → Acerca de. En escritorio, dos columnas equilibradas en orden de lectura; en móvil, una.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles(files);
await page.waitForTimeout(2000);

// Etiquetas reales que pintan las filas al deslizarse (aria-hidden, pero están en el DOM).
const hints = await page.locator(".track-row .swipe-hint").allInnerTexts();
// Lo que nombra «Empezar»: el botón «Añadir» de Biblioteca y, en el menú ≡ del reproductor, sonido, temporizador y fondo (y el ecualizador dentro de sonido).
const addButton = (await page.locator(".main").getByRole("button", { name: /^Añadir/ }).count()) > 0;
await page.locator(".track-row .row-main").first().click();
await page.waitForTimeout(500);
await page.locator(".bar-track").click();
await page.waitForTimeout(500);
await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
await page.waitForTimeout(300);
const menu = page.locator("dialog.menu[open]");
const menuRows = await Promise.all(["Sonido", "Temporizador", "Fondo"].map((name) => menu.getByRole("button", { name: new RegExp(`^${name}`) }).count()));
await menu.getByRole("button", { name: /^Sonido/ }).click();
await page.waitForTimeout(300);
const eqRow = await menu.getByRole("button", { name: /^Ecualizador/ }).count();
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

await page.getByRole("link", { name: "Ayuda", exact: true }).click();
await page.waitForTimeout(400);
check("la pestaña Ayuda abre /app/ayuda y queda marcada", new URL(page.url()).pathname === "/app/ayuda" && (await page.getByRole("link", { name: "Ayuda", exact: true }).getAttribute("aria-current")) === "page");
const sections = await page.locator(".help .settings-section > h2").allInnerTexts();
check("cuatro secciones en orden: empezar, atajos, gestos y preguntas", sections.join("|") === "Empezar|Atajos de teclado|Gestos en el móvil|Preguntas frecuentes", sections.join("|"));
check("Ayuda no habla de quién la hace (eso está en Ajustes → Acerca de)", (await page.locator(".help").getByText(/Nosotros|Sobre Satin|una persona en México/).count()) === 0);

const steps = await page.locator("#help-start + ol > li").allInnerTexts();
check("«Empezar» son 3 pasos en una lista ordenada", steps.length === 3, steps.map((s) => s.split("\n")[0]).join(" · "));
check(
  "los pasos nombran controles que existen: «Añadir» y el menú ≡ con sonido, ecualizador, temporizador y fondo",
  addButton && menuRows.every((n) => n > 0) && eqRow > 0 && /«Añadir»/.test(steps[0] ?? "") && /sonido, el ecualizador, el temporizador y el fondo/.test(steps[2] ?? ""),
  JSON.stringify({ addButton, menuRows, eqRow }),
);

const helpKeys = await page.locator(".help .shortcuts").innerText();
await page.keyboard.press("?");
await page.waitForTimeout(300);
const sheetKeys = await page.locator("dialog[open] .shortcuts").innerText();
check("los atajos de Ayuda son los mismos que los de la hoja «?»", helpKeys.length > 100 && helpKeys === sheetKeys);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

const gestures = await page.locator("#help-gestures ~ .help-list li h3").allInnerTexts();
check("cinco gestos: deslizar fila, pulsación larga, deslizar portada, arrastrar para cerrar y ajuste fino de la barra", gestures.join("|") === "Deslizar una fila|Pulsación larga|Deslizar la portada|Arrastrar para cerrar|Ajuste fino de la barra", gestures.join("|"));
const swipeText = await page.locator("#help-gestures ~ .help-list li").first().innerText();
check("la ayuda de deslizar usa las etiquetas que ve la persona en la fila", hints.includes("Siguiente") && hints.includes("A la cola") && swipeText.includes("«Siguiente»") && swipeText.includes("«A la cola»"), hints.join(","));
check("cada gesto dice qué hacer sin él", (await page.locator("#help-gestures ~ .help-list .hint").count()) === 5);

const items = await page.locator(".faq-item").count();
check("la FAQ trae de 1 a 10 preguntas, sin subgrupos", items >= 1 && items <= 10 && (await page.locator(".help-group h3").count()) === 0, `${items}`);
check("ninguna respuesta enseña la línea «Comprobado en»", !(await page.locator(".faq-item").allInnerTexts()).some((t) => t.includes("Comprobado en")));
await page.locator(".faq-item summary").first().click();
check("una pregunta se abre y muestra su respuesta", await page.locator(".faq-item[open] p").first().isVisible());
await page.locator(".faq-item summary").first().click();

// Escritorio: dos columnas (empezar y atajos | gestos y preguntas), alturas parecidas, y el orden del DOM (el del foco) es el de lectura.
const layout = await page.evaluate(() =>
  [...document.querySelectorAll(".help-col")].map((col) => ({ x: Math.round(col.getBoundingClientRect().x), h: col.getBoundingClientRect().height, ids: [...col.querySelectorAll("h2")].map((h) => h.id) })),
);
const [left, right] = layout;
check("escritorio: empezar y atajos a la izquierda, gestos y preguntas a la derecha", left?.ids.join() === "help-start,help-keys" && right?.ids.join() === "help-gestures,help-faq" && right.x > left.x, JSON.stringify(layout.map((c) => c.ids)));
check("escritorio: columnas equilibradas (la corta mide al menos el 75 % de la larga)", Boolean(left && right) && Math.min(left.h, right.h) / Math.max(left.h, right.h) >= 0.75, layout.map((c) => Math.round(c.h)).join(" / "));
// Teclado: Tab recorre la columna izquierda entera antes de pasar a la primera pregunta (los gestos no tienen nada enfocable).
await page.locator(".help .link").focus();
await page.keyboard.press("Tab");
check("teclado: tras «Abrir la lista aparte» el foco pasa a la primera pregunta", await page.evaluate(() => document.activeElement?.closest(".faq-item") !== null));
await page.keyboard.press("Enter");
check("teclado: Enter abre la pregunta enfocada", (await page.locator(".faq-item[open]").count()) === 1);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
check("sin scroll horizontal en escritorio", !overflow);
if (shots) await page.screenshot({ path: join(shots, "ayuda-1440x900.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const overflowPhone = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
check("sin scroll horizontal en 390 px", !overflowPhone);
const order = await page.evaluate(() => [...document.querySelectorAll(".help h2")].map((h) => Math.round(h.getBoundingClientRect().top)));
check("móvil: una columna, secciones una debajo de otra en el mismo orden", order.every((top, i) => i === 0 || top > order[i - 1]), order.join(","));
const small = await page.evaluate(() => [...document.querySelectorAll(".help summary, .help button, .nav a, .nav button")].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.width < 44 || r.height < 44); }).map((el) => el.className || el.tagName));
check("áreas táctiles de 44 px o más", small.length === 0, small.join(","));
if (shots) {
  await page.evaluate(() => document.querySelector("#help-gestures")?.scrollIntoView());
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shots, "ayuda-gestos-390x844.png") });
}

check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
