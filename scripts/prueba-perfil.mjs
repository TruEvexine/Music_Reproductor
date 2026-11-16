// Prueba del perfil básico (Ajustes → Perfil) en Chromium. Uso: node scripts/prueba-perfil.mjs [carpeta-capturas]
// Levanta su propio servidor con VITE_CUENTAS=1 (como prueba-legal), así que no depende de cómo arranque quien la lanza.
// Comprueba: el nombre empieza vacío, se limpia, se corta a 60 y persiste; la foto se recorta a 256 × 256, se vuelve a codificar SIN el EXIF
// (aquí, una marca falsa de ubicación GPS inyectada en la foto de prueba), se rechaza lo que no es imagen o pesa más de 12 MB, se puede quitar
// y nada de esto sale por la red. Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

process.env.VITE_CUENTAS = "1";
const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "perfil-"));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
const outside = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  const { hostname, protocol } = new URL(request.url());
  if (!["localhost", "127.0.0.1"].includes(hostname) && !["data:", "blob:"].includes(protocol)) outside.push(request.url());
});
await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
await page.goto(`${base}/app/ajustes`);
await wait(page, 800);

// Foto de prueba: 1200 × 800 (no cuadrada) con un segmento EXIF falso que lleva una marca de ubicación.
const jpeg = Buffer.from(
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    context.fillStyle = "#c04020";
    context.fillRect(0, 0, 1200, 800);
    context.fillStyle = "#2040c0";
    context.fillRect(400, 0, 400, 800); // franja central: el recorte cuadrado la conserva
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }),
);
const marker = Buffer.from("GPS-LAT-19.4326-LON-99.1332");
const tiff = Buffer.concat([Buffer.from("Exif\0\0II*\0\x08\0\0\0\0\0\0\0\0\0", "binary"), marker]);
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (tiff.length + 2) >> 8, (tiff.length + 2) & 0xff]), tiff]);
const withExif = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
check("la foto de prueba lleva la marca de ubicación antes de subirla", withExif.includes(marker) && withExif.includes(Buffer.from("Exif")));
const photo = join(work, "foto.jpg");
writeFileSync(photo, withExif);

const name = page.getByLabel("Nombre visible (opcional)");
check("el nombre empieza vacío y no hay foto", (await name.inputValue()) === "" && (await page.locator(".profile-avatar img").count()) === 0);
check("el perfil es la primera sección de Ajustes", (await page.locator(".settings-section > h2").first().innerText()) === "Perfil");

// Nombre: se limpia al salir del campo, se corta a 60 y persiste.
await name.fill("  Ana   María  ");
await name.blur();
await wait(page, 300);
check("el nombre se limpia al salir del campo", (await name.inputValue()) === "Ana María");
await page.reload();
await wait(page, 800);
check("el nombre persiste tras recargar", (await page.getByLabel("Nombre visible (opcional)").inputValue()) === "Ana María");
await name.fill("x".repeat(80));
check("el campo no deja pasar de 60 caracteres", (await name.inputValue()).length === 60);
await name.fill("");
await name.blur();
await wait(page, 300);
await page.reload();
await wait(page, 800);
check("vaciar el nombre lo quita (vuelve a sin nombre)", (await page.getByLabel("Nombre visible (opcional)").inputValue()) === "");

// Foto: recorte, re-codificado sin EXIF, y nav.
await page.getByLabel("Elegir foto de perfil").setInputFiles(photo);
await page.locator(".profile-avatar img").waitFor({ timeout: 5000 });
const stored = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("reproductor");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const blob = await new Promise((resolve) => {
    const request = db.transaction("kv").objectStore("kv").get("profile.avatar");
    request.onsuccess = () => resolve(request.result);
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image = await createImageBitmap(blob);
  return { type: blob.type, size: blob.size, width: image.width, height: image.height, head: [bytes[0], bytes[1]], text: new TextDecoder("latin1").decode(bytes) };
});
check("la foto guardada es un JPEG de 256 × 256", stored.type === "image/jpeg" && stored.width === 256 && stored.height === 256 && stored.head[0] === 0xff && stored.head[1] === 0xd8, JSON.stringify({ ...stored, text: undefined }));
check("pesa poco (menos de 60 KB)", stored.size < 60_000, `${stored.size} B`);
check("la foto guardada ya no lleva EXIF ni la marca de ubicación", !stored.text.includes("Exif") && !stored.text.includes("GPS-LAT"));
check("la foto se ve en Ajustes y sustituye al icono de la navegación", (await page.locator(".profile-avatar img").isVisible()) && (await page.locator(".nav-avatar").count()) === 1);
check("el botón pasa a «Cambiar foto» y aparece «Quitar foto»", (await page.getByRole("button", { name: "Cambiar foto" }).count()) === 1 && (await page.getByRole("button", { name: "Quitar foto" }).count()) === 1);
if (shots) await page.screenshot({ path: join(shots, "perfil-1440x900.png") });
await page.reload();
await wait(page, 800);
check("la foto persiste tras recargar", (await page.locator(".profile-avatar img").count()) === 1);

// Lo que no se acepta.
const svg = join(work, "dibujo.svg");
writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
await page.getByLabel("Elegir foto de perfil").setInputFiles(svg);
await wait(page, 400);
check("un SVG se rechaza con un mensaje", (await page.getByText("no es una imagen compatible").count()) === 1);
const fake = join(work, "falsa.png");
writeFileSync(fake, "esto no es un PNG");
await page.getByLabel("Elegir foto de perfil").setInputFiles(fake);
await wait(page, 500);
check("un archivo que no se puede leer se rechaza con un mensaje", (await page.getByText("No se pudo leer esa imagen").count()) === 1);
const big = join(work, "enorme.jpg");
writeFileSync(big, Buffer.alloc(13 * 1024 * 1024));
await page.getByLabel("Elegir foto de perfil").setInputFiles({ name: "enorme.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(13 * 1024 * 1024) });
await wait(page, 600);
check("una imagen de más de 12 MB se rechaza con un mensaje", (await page.getByText("pesa más de 12 MB").count()) === 1);
check("lo rechazado no tocó la foto que había", (await page.locator(".profile-avatar img").count()) === 1);

// «Qué se guarda» lo cuenta, y quitar la foto la borra de verdad.
check("Privacidad y datos cuenta el perfil", (await page.locator(".stored").innerText()).includes("Solo la foto, solo aquí"));
await page.getByRole("button", { name: "Quitar foto" }).click();
await wait(page, 400);
const left = await page.evaluate(async () => {
  const db = await new Promise((resolve) => {
    const open = indexedDB.open("reproductor");
    open.onsuccess = () => resolve(open.result);
  });
  return await new Promise((resolve) => {
    const request = db.transaction("kv").objectStore("kv").get("profile.avatar");
    request.onsuccess = () => resolve(request.result ?? null);
  });
});
check("quitar la foto la borra del almacenamiento y de la pantalla", left === null && (await page.locator(".profile-avatar img").count()) === 0 && (await page.locator(".nav-avatar").count()) === 0);

// Móvil.
await page.setViewportSize({ width: 390, height: 844 });
await wait(page, 300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
const small = await page.evaluate(() => [...document.querySelectorAll(".profile button, .profile input:not(.visually-hidden)")].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.width < 44 || r.height < 44); }).map((el) => el.className || el.tagName));
check("móvil: sin scroll horizontal y áreas táctiles de 44 px", !overflow && small.length === 0, small.join(","));
if (shots) await page.screenshot({ path: join(shots, "perfil-390x844.png") });

check("nada del perfil salió por la red", outside.length === 0, outside.join(" | "));
check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
