// Prueba de la sección Ayuda (/app/ayuda) en Chromium contra `npm run dev`. Uso: node scripts/prueba-ayuda.mjs [url-base] [carpeta-capturas]
// Comprueba que los atajos y los gestos salen de las mismas fuentes que el código (lista de la hoja «?» y etiquetas reales de las filas),
// que la FAQ viene de FAQ.md sin sus notas de mantenimiento y que «Nosotros» es la presentación anónima decidida.
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

await page.getByRole("link", { name: "Ayuda", exact: true }).click();
await page.waitForTimeout(400);
check("la pestaña Ayuda abre /app/ayuda y queda marcada", new URL(page.url()).pathname === "/app/ayuda" && (await page.getByRole("link", { name: "Ayuda", exact: true }).getAttribute("aria-current")) === "page");
const sections = await page.locator(".help .settings-section > h2").allInnerTexts();
check("cuatro secciones: atajos, gestos, preguntas y nosotros", sections.join("|") === "Atajos de teclado|Gestos en el móvil|Preguntas frecuentes|Nosotros", sections.join("|"));

const helpKeys = await page.locator(".help .shortcuts").innerText();
await page.keyboard.press("?");
await page.waitForTimeout(300);
const sheetKeys = await page.locator("dialog[open] .shortcuts").innerText();
check("los atajos de Ayuda son los mismos que los de la hoja «?»", helpKeys.length > 100 && helpKeys === sheetKeys);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

const gestures = await page.locator(".help-list li h3").allInnerTexts();
check("cuatro gestos: deslizar fila, pulsación larga, deslizar portada y arrastrar para cerrar", gestures.join("|") === "Deslizar una fila|Pulsación larga|Deslizar la portada|Arrastrar para cerrar", gestures.join("|"));
const swipeText = await page.locator(".help-list li").first().innerText();
check("la ayuda de deslizar usa las etiquetas que ve la persona en la fila", hints.includes("Siguiente") && hints.includes("A la cola") && swipeText.includes("«Siguiente»") && swipeText.includes("«A la cola»"), hints.join(","));
check("cada gesto dice qué hacer sin él", (await page.locator(".help-list .hint").count()) === 4);

const items = await page.locator(".faq-item").count();
check("la FAQ trae todas las preguntas de FAQ.md", items >= 20, `${items}`);
check("ninguna respuesta enseña la línea «Comprobado en»", (await page.locator(".help-group").innerText().catch(() => "")).includes("Comprobado en") === false && !(await page.locator(".faq-item").allInnerTexts()).some((t) => t.includes("Comprobado en")));
await page.locator(".faq-item summary").first().click();
check("una pregunta se abre y muestra su respuesta", await page.locator(".faq-item[open] p").first().isVisible());
const about = await page.locator(".help-about").innerText();
check("«Nosotros» es anónimo: una persona en México, sin universidad", /una persona en México/.test(about) && !/universidad/i.test(about));

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
check("sin scroll horizontal en escritorio", !overflow);
if (shots) await page.screenshot({ path: join(shots, "ayuda-1440x900.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const overflowPhone = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
check("sin scroll horizontal en 390 px", !overflowPhone);
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
