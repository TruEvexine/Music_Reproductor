// Prueba de la página Ajustes (/app/ajustes) en Chromium contra `npm run dev`. Uso: node scripts/prueba-ajustes.mjs [url-base]
// Comprueba: las siete secciones existen, «Acerca de» al final (Sobre Satin, enlaces legales, índice y teclado); el interruptor HDR es el mismo del menú (un solo estado); «Reducir movimiento» apaga transiciones
// y persiste; los controles de sonido escriben en el reproductor; Exportar descarga una copia con los ajustes; Borrar datos vacía biblioteca y
// ajustes tras confirmar. No toca la prueba de restaurar biblioteca.
import { chromium } from "@playwright/test";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.goto(`${base}/app`);
await page.getByLabel("Elegir archivos de música").setInputFiles(files);
await wait(page, 2500);
await page.locator(".track-row .row-main").first().click();
await wait(page, 600);

await page.getByRole("link", { name: "Ajustes", exact: true }).click();
await wait(page, 500);
check("la pestaña Ajustes abre /app/ajustes con su título", new URL(page.url()).pathname === "/app/ajustes" && (await page.getByRole("heading", { level: 1, name: "Ajustes" }).count()) === 1);
const sections = await page.locator(".settings-section > h2").allInnerTexts();
check("siete secciones, «Acerca de» al final", sections.join("|") === "Perfil|Apariencia y luces|Reproducción|Biblioteca|Accesibilidad|Privacidad y datos|Acerca de", sections.join("|"));
check("no hay ajustes de tema ni de idioma (la app no los tiene)", (await page.locator(".settings").getByText(/idioma|tema claro/i).count()) === 0);

// Acerca de: «Sobre Satin» en primera persona (60–100 palabras, sin «nosotros»), el café solo si hay enlace y los dos enlaces legales.
const index = await page.getByRole("navigation", { name: "Apartados de Ajustes" }).getByRole("link").allInnerTexts();
check("el índice de escritorio tiene las mismas secciones, «Acerca de» incluida", index.join("|") === sections.join("|"), index.join("|"));
const about = page.getByRole("region", { name: "Acerca de" });
const aboutText = await about.locator(".help-about").innerText();
const words = aboutText.split(/\s+/).filter(Boolean).length;
check("«Sobre Satin»: título, una sola persona en México, de 60 a 100 palabras y sin «nosotros»", (await about.getByRole("heading", { level: 3, name: "Sobre Satin" }).count()) === 1 && /una sola persona en México, y soy yo/.test(aboutText) && words >= 60 && words <= 100 && !/nosotros/i.test(aboutText), `${words} palabras`);
check("sin VITE_CAFE_URL no hay café en Acerca de", (await about.getByText(/café/).count()) === 0);
await page.getByRole("navigation", { name: "Apartados de Ajustes" }).getByRole("link", { name: "Acerca de" }).click();
await wait(page, 200);
check("el índice lleva a «Acerca de» y enfoca su título", await page.evaluate(() => document.activeElement?.id === "set-about"));
await page.keyboard.press("Tab");
const firstLink = await page.evaluate(() => document.activeElement?.textContent);
await page.keyboard.press("Tab");
const secondLink = await page.evaluate(() => document.activeElement?.textContent);
check("teclado: desde el título, Tab pasa por «Aviso de privacidad» y «Términos de uso»", firstLink === "Aviso de privacidad" && secondLink === "Términos de uso", `${firstLink} → ${secondLink}`);
await page.locator(".main").evaluate((main) => (main.scrollTop = 0));

// HDR: un solo estado compartido con el menú del reproductor.
const hdrSwitch = page.locator(".settings").getByRole("switch", { name: "HDR simulado en toda la app" });
await hdrSwitch.click();
await wait(page, 300);
check("HDR desde Ajustes: <html data-hdr> y el interruptor lo refleja", (await page.evaluate(() => document.documentElement.hasAttribute("data-hdr"))) && (await hdrSwitch.getAttribute("aria-checked")) === "true");
await page.locator(".bar-track").click();
await wait(page, 500);
await page.locator('.now-header button[aria-label="Menú del reproductor"]').click();
await wait(page, 300);
await page.locator("dialog.menu[open]").getByRole("button", { name: /^Fondo/ }).click();
await wait(page, 300);
check("el menú del reproductor muestra el mismo interruptor ya encendido", (await page.locator("dialog.menu[open]").getByRole("switch", { name: "HDR simulado en toda la app" }).getAttribute("aria-checked")) === "true");
await page.keyboard.press("Escape");
await wait(page, 300);
await page.keyboard.press("Escape"); // cierra el reproductor
await wait(page, 400);

// Sonido: el control de Ajustes escribe en el reproductor.
const crossfade = page.locator(".settings").getByLabel("Fundido entre canciones");
await crossfade.focus();
for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
await wait(page, 200);
check("el fundido entre canciones de Ajustes cambia el ajuste de audio (3 s)", (await crossfade.inputValue()) === "3" && (await page.locator(".settings").getByText("3 s", { exact: true }).count()) === 1);

// Accesibilidad.
const motion = page.locator(".settings").getByRole("switch", { name: "Reducir movimiento" });
const transitionOf = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".icon-button, .button")).transitionDuration));
const before = await transitionOf();
await motion.click();
await wait(page, 200);
const after = await transitionOf();
check("Reducir movimiento: <html data-motion> y las transiciones pasan a ~0", (await page.evaluate(() => document.documentElement.dataset.motion)) === "reduce" && before > 0.05 && after < 0.001, `${before}s → ${after}s`);

// Exportar: la copia trae los ajustes (hdr y reduceMotion encendidos).
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar" }).click()]);
const text = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
const backup = JSON.parse(text);
check("Exportar descarga una copia con hdr y reduceMotion", backup.settings?.background?.hdr === true && backup.settings?.background?.reduceMotion === true && /^reproductor-copia-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());

// Persisten tras recargar.
await page.reload();
await wait(page, 1200);
check("HDR y movimiento reducido persisten tras recargar", (await page.evaluate(() => document.documentElement.hasAttribute("data-hdr") && document.documentElement.dataset.motion === "reduce")) === true);

// Borrar datos: cancelar no borra; confirmar vacía todo y recarga.
await page.getByRole("button", { name: "Borrar datos de este dispositivo" }).click();
await wait(page, 300);
await page.locator("dialog[open]").getByRole("button", { name: "Cancelar" }).click();
await wait(page, 300);
await page.locator(".nav").getByRole("link", { name: "Biblioteca", exact: true }).click();
await wait(page, 500);
check("cancelar el borrado no quita la biblioteca", (await page.locator(".track-row").count()) === 2);
await page.getByRole("link", { name: "Ajustes", exact: true }).click();
await page.getByRole("button", { name: "Borrar datos de este dispositivo" }).click();
await wait(page, 300);
await page.locator("dialog[open]").getByRole("button", { name: "Borrar todo" }).click();
await page.waitForLoadState("load");
await wait(page, 1500);
const state = await page.evaluate(() => ({ hdr: document.documentElement.hasAttribute("data-hdr"), motion: document.documentElement.dataset.motion ?? null }));
await page.goto(`${base}/app`);
await wait(page, 1200);
check("Borrar datos: biblioteca vacía y ajustes de vuelta a los de fábrica", (await page.locator(".track-row").count()) === 0 && !state.hdr && state.motion === null, JSON.stringify(state));
check("sin errores de página", errors.length === 0, errors.join(" | "));

await browser.close();
if (failed) {
  console.log(`\n${failed} comprobación(es) de Ajustes fallaron`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones de Ajustes pasaron");
