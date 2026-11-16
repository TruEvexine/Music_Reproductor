// Prueba del botón «Comprar un café» en Chromium. Uso: node scripts/prueba-cafe.mjs <url-base> <esperado>
//   esperado = "ninguno": servidor sin VITE_CAFE_URL, no debe haber botón en Ajustes ni en la landing.
//   esperado = una URL https: servidor arrancado con VITE_CAFE_URL=<esa URL>, el botón debe llevar a ella (nunca se hace clic: no se visita).
// Ejemplo: VITE_CAFE_URL=https://example.com/cafe-de-prueba npx vite --port 5175 y luego node scripts/prueba-cafe.mjs http://localhost:5175 https://example.com/cafe-de-prueba
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const expected = process.argv[3] ?? "ninguno";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const outside = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  const { hostname, protocol } = new URL(request.url());
  if (!["localhost", "127.0.0.1"].includes(hostname) && !["data:", "blob:"].includes(protocol)) outside.push(request.url());
});
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));

const buttons = (where) => page.getByRole("link", { name: "Comprar un café" }).evaluateAll((links) => links.map((a) => ({ href: a.href, target: a.target, rel: a.rel, height: a.getBoundingClientRect().height })));

await page.goto(`${base}/app/ajustes`);
await page.waitForTimeout(800);
const inSettings = await buttons();
await page.goto(`${base}/`);
await page.waitForTimeout(800);
const inLanding = await buttons();

if (expected === "ninguno") {
  check("sin la variable no hay botón en Ajustes", inSettings.length === 0);
  check("sin la variable no hay botón en la landing", inLanding.length === 0);
  await page.goto(`${base}/app/ajustes`);
  await page.waitForTimeout(500);
  check("sin la variable tampoco hay sección «Apoyar el proyecto» ni texto de café", (await page.getByText(/Apoyar el proyecto|invitarme un café/).count()) === 0);
} else {
  check("Ajustes tiene un único botón y apunta a la URL esperada", inSettings.length === 1 && new URL(inSettings[0].href).href === new URL(expected).href, JSON.stringify(inSettings));
  check("se abre en otra pestaña sin dar acceso a la app (noopener noreferrer)", inSettings[0]?.target === "_blank" && /noopener/.test(inSettings[0].rel) && /noreferrer/.test(inSettings[0].rel));
  check("el botón mide 44 px o más", (inSettings[0]?.height ?? 0) >= 44);
  check("la landing también lo enseña, uno solo", inLanding.length === 1 && new URL(inLanding[0].href).href === new URL(expected).href);
  await page.goto(`${base}/app/ajustes`);
  await page.waitForTimeout(500);
  const text = await page.locator("#set-about").locator("..").locator(".about-cafe").innerText();
  check("el café va en Ajustes → Acerca de, sin sección ni entrada de índice propias", text.length > 0 && (await page.getByText("Apoyar el proyecto").count()) === 0);
  check("el texto es honesto y en primera persona: te sirve, invitarme un café, voluntario, no desbloquea nada", /te sirve, puedes invitarme un café/.test(text) && /voluntario/.test(text) && /no desbloquea nada/.test(text) && !/no te lo pierdas|solo hoy|¡/i.test(text), text.replace(/\n+/g, " / "));
  await page.getByRole("link", { name: "Comprar un café" }).scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
  check("sin scroll horizontal", !overflow);
}
check("la página no se conectó a ningún dominio de fuera (el enlace solo se visita si se pulsa)", outside.length === 0, outside.join(" | "));
check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
