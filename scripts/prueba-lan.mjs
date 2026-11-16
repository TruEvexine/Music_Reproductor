// Prueba de la app abierta por http con la IP de la red local (contexto NO seguro), como un móvil con `npm run dev:lan`.
// Uso: node scripts/prueba-lan.mjs http://<ip-de-la-lan>:5173. Sin HTTPS no hay crypto.randomUUID, crypto.subtle, OPFS ni
// File System Access: la app debe seguir dejando añadir y reproducir en la sesión y explicar por qué no guarda. Sale con 1 si algo falla.
import { chromium, devices } from "@playwright/test";
import { join } from "node:path";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base || /localhost|127\.0\.0\.1/.test(base)) {
  console.error("Pasa la URL de red local que imprime `npm run dev:lan` (no localhost: localhost sí es contexto seguro).");
  process.exit(1);
}
const files = ["01-amanecer.flac", "02-marea.flac"].map((name) => join(import.meta.dirname, "..", "tests", "fixtures", "audio", name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`${base}/app`);
await page.waitForTimeout(1500);
const env = await page.evaluate(() => ({ secure: isSecureContext, uuid: typeof crypto.randomUUID, subtle: !!crypto.subtle, opfs: typeof navigator.storage?.getDirectory }));
check("la página no es contexto seguro (lo que esta prueba quiere reproducir)", !env.secure, JSON.stringify(env));
await page.getByLabel("Elegir archivos de música").setInputFiles(files);
await page.waitForTimeout(3000);
const titles = await page.locator(".track-row .title").allInnerTexts();
check("añadir archivos funciona y lee los metadatos", JSON.stringify(titles) === JSON.stringify(["Amanecer en La", "Marea de Fase"]), titles.join(" | "));
const notice = await page.locator(".notice").allInnerTexts();
check("avisa de que sin HTTPS no se guarda", notice.some((text) => text.includes("Sin HTTPS")), notice.join(" | "));
await page.locator(".track-row .row-main").first().click();
await page.waitForTimeout(1200);
check("la pista suena", await page.evaluate(() => !window.__engine.paused && window.__engine.position > 0));
check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
