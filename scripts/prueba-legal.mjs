// Prueba de las páginas legales en Chromium. Uso: node scripts/prueba-legal.mjs [carpeta-capturas]
// Aislada del entorno: levanta ella misma dos servidores de desarrollo con las LEGAL_* fijadas en el entorno del proceso (que en Vite pisa a
// .env.local), así que da igual lo que haya en .env.local o en las LEGAL_* de quien la lanza.
//   "marcadores": LEGAL_* vacías: los {{MARCADORES}} se ven tal cual (el build de producción los rechaza).
//   "completo": valores ficticios (abajo): se ven los valores y no queda ningún marcador.
// En ambos casos: las tres páginas rinden sin las notas internas, solo Ajustes → Acerca de enlaza aviso y términos, piden no indexarse y caben en móvil.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

const fake = {
  LEGAL_RESPONSABLE: "Persona de Prueba",
  LEGAL_DOMICILIO: "Calle Falsa 123, Ciudad de Prueba",
  LEGAL_CORREO_PRIVACIDAD: "prueba@example.com",
  LEGAL_NOMBRE_APP: "App de Prueba",
  LEGAL_FECHA_ACTUALIZACION: "1 de enero de 2030",
  LEGAL_URL_APP: "https://prueba.example",
};

/** Servidor con exactamente estas LEGAL_*; las no dadas quedan vacías, que para fillMarkers equivale a no definidas. */
async function withServer(values, run) {
  for (const key of Object.keys(fake)) process.env[key] = values[key] ?? "";
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" });
  await server.listen();
  try {
    await run(server.resolvedUrls.local[0].replace(/\/$/, ""));
  } finally {
    await server.close();
  }
}

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const pages = [
  { path: "/privacidad", title: /^Aviso de privacidad de /, has: ["Quién es responsable.", "Si no estás conforme"] }, // presente con y sin cuentas (VITE_CUENTAS)
  { path: "/terminos", title: /^Términos de uso de /, has: ["18. Contacto.", "14. Apoyo voluntario", "6. Derechos de autor: cómo avisarme."] },
  { path: "/almacenamiento", title: /^Cookies y almacenamiento local$/, has: ["no usa cookies ni herramientas de rastreo"] },
];

const browser = await chromium.launch();
const errors = [];
async function run(base, expected) {
for (const [label, viewport] of [["escritorio", { width: 1440, height: 900 }], ["móvil", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  for (const { path, title, has } of pages) {
    await page.goto(`${base}${path}`);
    await page.waitForSelector(".legal h1", { timeout: 8000 }).catch(() => {});
    const text = await page.locator(".legal").innerText().catch(() => "");
    check(`${label} ${path}: rinde con su título`, title.test(await page.locator(".legal h1").innerText().catch(() => "")));
    check(`${label} ${path}: lleva su contenido`, has.every((part) => text.includes(part)));
    check(`${label} ${path}: sin notas internas del borrador`, !/Decides tú|\[Abogado\]/.test(text));
    check(`${label} ${path}: avisa de que es un borrador`, text.includes("Borrador pendiente de revisión legal"));
    check(`${label} ${path}: pide no indexarse (meta robots)`, (await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check(`${label} ${path}: sin scroll horizontal de la página`, !overflow);
    if (shots && label === "móvil") await page.screenshot({ path: join(shots, `legal${path.replace("/", "-")}-390x844.png`) });
    if (shots && label === "escritorio" && path === "/privacidad") await page.screenshot({ path: join(shots, "legal-privacidad-1440x900.png") });
    if (path === "/privacidad" && label === "escritorio") {
      if (expected === "completo") {
        check("completo: se ven los valores y ningún marcador", text.includes("Persona de Prueba") && text.includes("Calle Falsa 123") && text.includes("prueba@example.com") && text.includes("App de Prueba") && text.includes("https://prueba.example") && !/\{\{[A-Z_]+\}\}/.test(text));
      } else {
        check("desarrollo: los marcadores se ven tal cual (nada inventado)", text.includes("{{RESPONSABLE}}") && text.includes("{{DOMICILIO}}") && text.includes("{{CORREO_PRIVACIDAD}}") && text.includes("{{NOMBRE_APP}}") && text.includes("{{FECHA_ACTUALIZACION}}") && text.includes("{{URL_APP}}"));
      }
    }
  }
  await page.close();
}

// Enlaces: solo Ajustes → Acerca de enlaza, y solo a aviso y términos; landing, biblioteca, playlists y ayuda, a ninguna.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const linked = [];
for (const path of ["/", "/app", "/app/playlists", "/app/ajustes", "/app/ayuda"]) {
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(600);
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => new URL(a.href).pathname));
  linked.push(...hrefs.filter((href) => /^\/(privacidad|terminos|almacenamiento)\/?$/.test(href)).map((href) => `${path} → ${href}`));
}
check("solo Ajustes enlaza a las legales, y solo a aviso y términos", linked.join("|") === "/app/ajustes → /privacidad|/app/ajustes → /terminos", linked.join(" | "));
for (const [label, title] of [["Aviso de privacidad", /^Aviso de privacidad de /], ["Términos de uso", /^Términos de uso de /]]) {
  await page.goto(`${base}/app/ajustes`);
  await page.waitForTimeout(600);
  const about = page.getByRole("region", { name: "Acerca de" });
  await about.getByRole("link", { name: label }).click();
  await page.waitForSelector(".legal h1", { timeout: 8000 }).catch(() => {});
  check(`Acerca de → «${label}» abre su página`, title.test(await page.locator(".legal h1").innerText().catch(() => "")), page.url());
  await page.goBack();
  await page.waitForTimeout(600);
  check(`desde «${label}», atrás vuelve a Ajustes`, new URL(page.url()).pathname === "/app/ajustes" && (await page.getByRole("heading", { level: 1, name: "Ajustes" }).count()) === 1);
}
await page.close();
}

await withServer({}, (base) => run(base, "marcadores"));
await withServer(fake, (base) => run(base, "completo"));

check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
