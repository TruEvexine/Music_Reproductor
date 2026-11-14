// Prueba de las páginas legales en Chromium. Uso: node scripts/prueba-legal.mjs <url-base> [esperado] [carpeta-capturas]
//   esperado = "marcadores": servidor de desarrollo sin LEGAL_*: los {{MARCADORES}} se ven tal cual (el build de producción los rechaza).
//   esperado = "completo": build servido con `vite preview` y LEGAL_RESPONSABLE="Persona de Prueba", LEGAL_DOMICILIO="Calle Falsa 123, Ciudad de Prueba",
//              LEGAL_CORREO_PRIVACIDAD="prueba@example.com": se ven los valores y no queda ningún marcador.
// En ambos casos: las tres páginas rinden sin las notas internas, no están enlazadas desde la navegación pública, piden no indexarse y caben en móvil.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const expected = process.argv[3] ?? "marcadores";
const shots = process.argv[4];
if (shots) mkdirSync(shots, { recursive: true });

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const pages = [
  { path: "/privacidad", title: /^Aviso de privacidad de /, has: ["Quién es responsable.", "Tus derechos (ARCO)."] },
  { path: "/terminos", title: /^Términos de uso de /, has: ["10. Contacto.", "7. Apoyo voluntario."] },
  { path: "/almacenamiento", title: /^Cookies y almacenamiento local$/, has: ["no usa cookies ni herramientas de rastreo"] },
];

const browser = await chromium.launch();
const errors = [];
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
        check("completo: se ven los valores y ningún marcador", text.includes("Persona de Prueba") && text.includes("Calle Falsa 123") && text.includes("prueba@example.com") && !/\{\{[A-Z_]+\}\}/.test(text));
      } else {
        check("desarrollo: los marcadores se ven tal cual (nada inventado)", text.includes("{{RESPONSABLE}}") && text.includes("{{DOMICILIO}}") && text.includes("{{CORREO_PRIVACIDAD}}"));
      }
    }
  }
  await page.close();
}

// Sin enlaces desde la navegación pública: landing, app, ajustes y ayuda.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
const linked = [];
for (const path of ["/", "/app", "/app/playlists", "/app/ajustes", "/app/ayuda"]) {
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(600);
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => new URL(a.href).pathname));
  linked.push(...hrefs.filter((href) => /^\/(privacidad|terminos|almacenamiento)\/?$/.test(href)).map((href) => `${path} → ${href}`));
}
check("ninguna página pública enlaza a las legales", linked.length === 0, linked.join(" | "));

check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
