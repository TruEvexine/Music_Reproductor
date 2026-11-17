// Prueba de la edición de metadatos en Chromium contra `npm run dev`. Uso: node scripts/prueba-edicion.mjs [url-base] [carpeta-capturas]
// Editar (desde la fila y desde el reproductor grande), restablecer por campo y por pista, reimportar el archivo cambiado y recargar sin perder la edición,
// identidad estable (track:v1 de la playlist, id de la cola y track:v2 no cambian), carátula elegida (tipo por contenido, ≤ 1024 px, sin EXIF, paleta con
// paletteVersion) que tiñe el fondo, teclado, lector de pantalla (etiquetas y avisos) y movimiento reducido. Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { args, carpetaCapturas } from "./salida.mjs";
import "./requiere-audio.mjs";

const base = (args[0] ?? "http://localhost:5173").replace(/\/$/, "");
const shots = carpetaCapturas(args[1], "edicion");
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "09-sin-portada.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

// Lo guardado, leído de IndexedDB tal cual (sin pasar por la app).
const idb = (page, store) =>
  page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("reproductor");
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result.map((value) => JSON.parse(JSON.stringify(value, (_k, v) => (v instanceof Blob ? `blob:${v.type}:${v.size}` : v)))));
          request.onerror = () => reject(request.error);
        };
        open.onerror = () => reject(open.error);
      }),
    store,
  );

// Los stores de la app, con la misma URL que cargó ella (Vite añade ?t= o ?v= tras recargas en caliente): otra URL sería otra instancia, vacía.
const appModule = `(path) => import(performance.getEntriesByType("resource").map((entry) => entry.name).find((name) => new URL(name).pathname === path) ?? path)`;

async function open(viewport, touch, extra = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, ...extra });
  const page = await context.newPage();
  await page.addInitScript(`window.__appModule = ${appModule};`);
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/app`);
  return { context, page, errors };
}

const rowOf = (page, title) => page.locator(".track-row").filter({ has: page.locator(".title", { hasText: title }) }).first();
const dialog = (page) => page.locator("dialog.edit-dialog");
const field = (page, name) => dialog(page).getByRole("textbox", { name, exact: true });
async function openEditor(page, title) {
  await rowOf(page, title).locator(".row-main").click({ button: "right" });
  await page.getByRole("button", { name: "Editar información" }).click();
  await dialog(page).waitFor();
}

// Imagen de prueba: 1600×1200 PNG de un color saturado, y la misma como JPEG con un bloque EXIF (APP1) insertado a mano.
async function testImages(page) {
  const [png, jpeg] = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(1600, 1200);
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(30, 90, 220)";
    context.fillRect(0, 0, 1600, 1200);
    context.fillStyle = "rgb(240, 200, 40)";
    context.fillRect(500, 300, 600, 600);
    const bytes = async (type) => [...new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.9 })).arrayBuffer())];
    return [await bytes("image/png"), await bytes("image/jpeg")];
  });
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  return { png: Buffer.from(png), jpeg: Buffer.from([...jpeg.slice(0, 2), ...app1, ...jpeg.slice(2)]) };
}

// --- Escritorio con teclado y ratón ---
{
  const { context, page, errors } = await open({ width: 1440, height: 900 }, false);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length === 2 && !document.querySelector(".scan-status"));
  await page.waitForTimeout(800);
  const before = (await idb(page, "tracks")).find((track) => track.fileName === "01-amanecer.flac");
  const { trackV1Id, v1Before } = await page.evaluate(async (track) => {
    const { trackV1Id } = await window.__appModule("/src/core/track.ts");
    const { playlists } = await window.__appModule("/src/state/playlists.ts");
    const id = await playlists.create("Prueba de identidad");
    await playlists.add(id, trackV1Id(track));
    return { trackV1Id: true, v1Before: trackV1Id(track) };
  }, before);
  check("la playlist guarda la pista por track:v1 del archivo", trackV1Id && v1Before.startsWith("track:v1:"));
  // Ponerla en la cola antes de editar: su id no debe cambiar.
  await rowOf(page, before.title).locator(".row-main").click();
  await page.waitForTimeout(300);

  await openEditor(page, before.title);
  check("el diálogo de edición se abre desde el menú de la fila", await dialog(page).isVisible());
  await page.waitForTimeout(400); // fin de la entrada (--base)
  await page.screenshot({ path: join(shots, "edicion-escritorio.png") });
  const title = field(page, "Título");
  check("el título lleva su etiqueta", (await title.inputValue()) === before.title);
  await title.fill("Amanecer editado");
  check("un campo cambiado enseña el original", await dialog(page).getByText(`Original: «${before.title}»`).isVisible());
  await field(page, "Género").fill("");
  await field(page, "Año").fill("20x1");
  await field(page, "Artista del álbum").fill("Varios artistas");
  await field(page, "Álbum").fill("Álbum editado");
  await field(page, "N.º de disco").fill("2");
  await page.getByRole("button", { name: "Guardar" }).click();
  const invalidFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-invalid") === "true" && document.activeElement.closest(".edit-year") !== null);
  check("un año inválido no guarda, se marca y recibe el foco", invalidFocus && (await dialog(page).isVisible()));
  await field(page, "Año").fill("1999");
  // Restablecer por campo: el disco vuelve al del archivo.
  await page.getByRole("button", { name: "Restablecer n.º de disco" }).click();
  check("restablecer un campo vuelve al valor del archivo", (await field(page, "N.º de disco").inputValue()) === String(before.discNumber ?? ""));
  // Teclado: Enter en un campo guarda.
  await field(page, "Año").press("Enter");
  await dialog(page).waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  check("guardar con Enter cierra el diálogo y lo editado se ve en la fila", await rowOf(page, "Amanecer editado").isVisible());
  const edits = await idb(page, "edits");
  check(
    "la edición vive en su almacén y no en el archivo",
    edits.length === 1 && edits[0].title === "Amanecer editado" && edits[0].genre === null && edits[0].year === 1999 && !("discNumber" in edits[0]),
    JSON.stringify(edits),
  );
  const stored = (await idb(page, "tracks")).find((track) => track.id === before.id);
  check("tracks en IndexedDB sigue con lo del archivo", stored.title === before.title && stored.genre === before.genre && !("source" in stored), JSON.stringify(stored));
  const identity = await page.evaluate(async (id) => {
    const { useLibrary } = await window.__appModule("/src/state/library.ts");
    const { usePlayer } = await window.__appModule("/src/state/player.ts");
    const { usePlaylists } = await window.__appModule("/src/state/playlists.ts");
    const { trackV1Id } = await window.__appModule("/src/core/track.ts");
    const track = useLibrary.getState().tracks.find((item) => item.id === id);
    return { v1: trackV1Id(track), v2: track.v2, queue: usePlayer.getState().queue.current?.id, playlist: usePlaylists.getState().all.find((list) => list.name === "Prueba de identidad")?.trackIdentifiers };
  }, before.id);
  check("identidad estable: track:v1, track:v2, cola y playlist", identity.v1 === v1Before && identity.v2 === before.v2 && identity.queue === before.id && identity.playlist?.[0] === v1Before, JSON.stringify(identity));
  await page.goto(`${base}/app/playlists`);
  await page.getByText("Prueba de identidad").first().click();
  await page.waitForTimeout(300);
  check("la playlist encuentra la pista y muestra el título editado", await page.locator(".title", { hasText: "Amanecer editado" }).first().isVisible());
  await page.goto(`${base}/app`);
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  await page.waitForTimeout(300);
  check("Álbumes agrupa por el álbum editado", await page.getByText("Álbum editado").first().isVisible());
  await page.getByRole("link", { name: "Canciones", exact: true }).click();
  await page.getByLabel("Buscar en tu música").fill("varios artistas");
  await page.waitForTimeout(300);
  check("la búsqueda encuentra el artista del álbum editado", (await page.locator(".track-row").count()) === 1);
  await page.getByLabel("Buscar en tu música").fill("");

  // Carátula: SVG con nombre de imagen → rechazado por contenido; JPEG grande con EXIF → aceptado, ≤ 1024 px, sin EXIF, con paleta.
  const { jpeg } = await testImages(page);
  await openEditor(page, "Amanecer editado");
  const picker = dialog(page).locator('input[type="file"]');
  await picker.setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  const rejected = await dialog(page).getByRole("alert").filter({ hasText: "no es una imagen" }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check("un archivo que no es imagen se rechaza aunque se llame .png", rejected);
  await picker.setInputFiles({ name: "portada.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await dialog(page).getByRole("img", { name: /Carátula elegida/ }).waitFor();
  await page.getByRole("button", { name: "Guardar" }).click();
  await dialog(page).waitFor({ state: "detached" });
  await page.waitForTimeout(500);
  const chosen = (await idb(page, "edits"))[0].coverHash;
  const cover = await page.evaluate(async (hash) => {
    const record = await new Promise((resolve) => {
      const open = indexedDB.open("reproductor");
      open.onsuccess = () => {
        const request = open.result.transaction("covers").objectStore("covers").get(hash);
        request.onsuccess = () => resolve(request.result);
      };
    });
    const { PALETTE_VERSION } = await window.__appModule("/src/core/palette.ts");
    const bitmap = await createImageBitmap(record.master);
    const bytes = new Uint8Array(await record.master.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
    return { side: [bitmap.width, bitmap.height], type: record.master.type, exif: text.includes("Exif"), palette: record.palette, version: record.paletteVersion === PALETTE_VERSION };
  }, chosen);
  check("la carátula elegida se reduce a ≤ 1024 px, en JPEG y sin EXIF", cover.side[0] <= 1024 && cover.side[1] <= 1024 && cover.type === "image/jpeg" && !cover.exif, JSON.stringify(cover.side));
  check("la carátula elegida trae su paleta con paletteVersion", cover.version && Boolean(cover.palette?.accent), JSON.stringify(cover.palette));
  check("la fila muestra la carátula elegida", await rowOf(page, "Amanecer editado").locator(".row-cover img").isVisible());
  const original = (await idb(page, "tracks")).find((track) => track.id === before.id).coverHash;
  check("la carátula del archivo sigue en su sitio, debajo", original === before.coverHash);

  // Reproductor grande: lápiz en la cabecera, fondo con la paleta de la carátula elegida.
  await page.locator(".bar-track").click();
  await page.waitForTimeout(500);
  const accent = await page.evaluate(() => document.querySelector("[style*=\"--accent-in\"]")?.style.getPropertyValue("--accent-in").trim());
  check("el acento y el fondo salen de la carátula elegida", accent === cover.palette.accent, `${accent} vs ${cover.palette.accent}`);
  await page.getByRole("button", { name: "Editar información" }).click();
  await dialog(page).waitFor();
  check("el lápiz del reproductor grande abre la edición", await field(page, "Título").isVisible());
  await page.keyboard.press("Escape");
  await dialog(page).waitFor({ state: "detached" });
  check("Escape cierra sin guardar", (await idb(page, "edits"))[0].title === "Amanecer editado");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Reimportar el archivo cambiado (mismo nombre, otro tamaño): se vuelven a leer sus metadatos y la edición sigue encima.
  const changed = readFileSync(join(fixtures, "02-marea.flac"));
  await page.getByLabel("Elegir archivos de música").setInputFiles({ name: "01-amanecer.flac", mimeType: "audio/flac", buffer: changed });
  await page.waitForTimeout(2500);
  const rescanned = await page.evaluate(async (id) => {
    const { useLibrary } = await window.__appModule("/src/state/library.ts");
    const track = useLibrary.getState().tracks.find((item) => item.id === id);
    return { title: track.title, sourceTitle: track.source?.title, cover: track.coverHash, status: track.metadataStatus };
  }, before.id);
  check("reescanear un archivo cambiado no pierde la edición", rescanned.title === "Amanecer editado" && rescanned.cover === chosen && rescanned.sourceTitle !== before.title, JSON.stringify(rescanned));
  await page.reload();
  await page.waitForTimeout(1200);
  check("tras recargar, la edición sigue", await rowOf(page, "Amanecer editado").isVisible());

  // Restablecer la pista entera: vuelve al archivo y la carátula elegida se borra.
  await openEditor(page, "Amanecer editado");
  await page.getByRole("button", { name: "Restablecer todo" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await dialog(page).waitFor({ state: "detached" });
  await page.waitForTimeout(400);
  const coverHashes = (await idb(page, "covers")).map((record) => record.hash);
  check("restablecer la pista borra su edición", (await idb(page, "edits")).length === 0);
  check("y la carátula elegida que ya nadie usa", !coverHashes.includes(chosen));
  check("sin errores de página (escritorio)", errors.length === 0, errors.join(" | "));
  await context.close();
}

// --- Móvil táctil con movimiento reducido: la hoja entra sin animación, cabe sin scroll horizontal y Guardar queda a la vista. ---
{
  const { context, page, errors } = await open({ width: 390, height: 844 }, true, { reducedMotion: "reduce" });
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length === 2);
  await page.waitForTimeout(1500);
  const title = await page.locator(".track-row .title").first().textContent();
  await openEditor(page, title);
  const motion = await dialog(page).evaluate((node) => getComputedStyle(node).transitionDuration);
  check("con movimiento reducido el diálogo no se anima", motion.split(",").every((value) => parseFloat(value) < 0.001), motion);
  await page.waitForTimeout(200); // el primer cuadro aún está en la pose de entrada (translateY(100%)), aunque la transición dure 0,01 ms
  const layout = await page.evaluate(() => {
    const save = [...document.querySelectorAll("dialog.edit-dialog button")].find((button) => button.textContent === "Guardar").getBoundingClientRect();
    const dialog = document.querySelector("dialog.edit-dialog");
    return { save: [Math.round(save.top), Math.round(save.bottom), innerHeight], overflow: dialog.scrollWidth > dialog.clientWidth + 1, saveVisible: save.bottom <= innerHeight && save.top >= 0, small: [...dialog.querySelectorAll("button, input:not([type=file])")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).length };
  });
  check("móvil: sin scroll horizontal, áreas de 44 px y Guardar a la vista", !layout.overflow && layout.saveVisible && layout.small === 0, JSON.stringify(layout));
  await page.screenshot({ path: join(shots, "edicion-movil.png") });
  check("sin errores de página (móvil)", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
console.log(`Capturas en ${shots}`);
process.exit(failed ? 1 : 0);
