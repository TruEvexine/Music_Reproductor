// Prueba de la biblioteca local (Fase 3) en navegadores reales contra `npm run dev`.
// Uso: node scripts/prueba-biblioteca.mjs [url-base] [--rapida]
// Antes: `npm run test:audio` y `node scripts/gen-biblioteca.mjs` (5 000 pistas sintéticas). Nunca usa música real.
// --rapida omite la parte de 5 000 pistas y el archivo enorme. Sale con 1 si algo falla.
import { chromium, firefox, webkit } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const quick = process.argv.includes("--rapida");
const base = (args[0] ?? "http://localhost:5173").replace(/\/$/, "");
const root = join(import.meta.dirname, "..");
const fixtures = join(root, "tests", "fixtures", "audio");
const big = join(root, "tests", "fixtures", "biblioteca");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function open(type, options = {}) {
  const browser = await type.launch(type === chromium ? { args: ["--autoplay-policy=no-user-gesture-required"] } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...options });
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { browser, context, page, errors };
}

const rows = (page) => page.locator(".track-row .row-main");
const row = (page, text) => page.locator(".track-row .row-main", { hasText: text });
const title = (page) => page.locator(".bar-track .title").innerText();
const position = async (page) => Number(await page.locator(".bar-center .seek input").inputValue());
const scanDone = (page, timeout = 60_000) => page.waitForFunction(() => !document.querySelector(".scan-bar"), null, { timeout });
const reads = (page) => page.evaluate(() => globalThis.__metadataReads ?? 0);
const header = (page) => page.locator(".view-header .subtitle").innerText();
/** Lee la tabla de pistas directamente de IndexedDB (lo que sobrevive a una recarga). */
const stored = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("reproductor");
        request.onsuccess = () => {
          const all = request.result.transaction("tracks").objectStore("tracks").getAll();
          all.onsuccess = () => resolve(all.result.map(({ title, metadataStatus, v2, coverHash, lyrics }) => ({ title, metadataStatus, v2, coverHash, lyrics: Boolean(lyrics) })));
        };
      }),
  );

// --- 1. Chromium: carpeta recordada con File System Access ---
// showDirectoryPicker abre un diálogo nativo que Playwright no puede pulsar: se sustituye por una carpeta de OPFS,
// que es un FileSystemDirectoryHandle real (se guarda en IndexedDB, se recorre y se lee igual que uno del disco).
{
  const { browser, page, errors } = await open(chromium);
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("e2e-musica");
    const state = () => localStorage.getItem("e2e-permiso") ?? "granted";
    FileSystemHandle.prototype.queryPermission = async () => state();
    FileSystemHandle.prototype.requestPermission = async () => {
      localStorage.setItem("e2e-permiso", "granted");
      return "granted";
    };
  });
  await page.goto(`${base}/app`);
  const put = (files) =>
    page.evaluate(async (list) => {
      const top = await navigator.storage.getDirectory();
      const dir = await top.getDirectoryHandle("e2e-musica", { create: true });
      for (const [path, url] of list) {
        const parts = path.split("/");
        let target = dir;
        for (const part of parts.slice(0, -1)) target = await target.getDirectoryHandle(part, { create: true });
        const writable = await (await target.getFileHandle(parts.at(-1), { create: true })).createWritable();
        await writable.write(await (await fetch(url)).blob());
        await writable.close();
      }
    }, files);
  const fx = (name) => `/tests/fixtures/audio/${name}`;
  await put([
    ["Ondas/01-amanecer.flac", fx("01-amanecer.flac")],
    ["Ondas/02-marea.flac", fx("02-marea.flac")],
    ["Letras/tono-sin-metadatos.wav", fx("tono-sin-metadatos.wav")],
    ["Letras/tono-sin-metadatos.lrc", fx("tono-sin-metadatos.lrc")],
    ["Letras/10-letra.mp3", fx("10-letra.mp3")],
    ["Letras/11-sylt.mp3", fx("11-sylt.mp3")],
    ["Portada/09-sin-portada.flac", fx("09-sin-portada.flac")],
    ["Portada/cover.png", fx("01-amanecer.flac.png")],
    ["Portada/tono-corto.wav", fx("tono-corto.wav")],
    ["corrupto.mp3", fx("corrupto.mp3")],
  ]);

  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("button", { name: /Carpeta completa/ }).click();
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 8);
  await scanDone(page);
  await page.waitForTimeout(600);
  check("añadir carpeta (File System Access): encuentra las 8 pistas, no la portada ni la letra", (await rows(page).count()) === 8, String(await rows(page).count()));
  check("lee etiquetas en el worker", (await row(page, "Marea de Fase").count()) === 1);
  check("cover.png de la carpeta como portada de la pista sin portada", (await row(page, "Sin Portada").locator("img").count()) === 1);
  const db = await stored(page);
  check("track:v2 calculado para cada pista", db.every((track) => /^track:v2:[0-9a-f]{64}$/.test(track.v2 ?? "")), db.filter((t) => !t.v2).map((t) => t.title).join(", "));
  check("archivo corrupto: se procesa (sin etiquetas) sin romper nada", ["error", "partial"].includes(db.find((track) => track.title === "corrupto")?.metadataStatus) && errors.length === 0, `${db.find((track) => track.title === "corrupto")?.metadataStatus} ${errors.join(" | ")}`);
  const shared = db.filter((track) => track.title === "Sin Portada" || track.title === "tono-corto").map((track) => track.coverHash);
  const covers = await page.evaluate(() => new Promise((resolve) => { const r = indexedDB.open("reproductor"); r.onsuccess = () => { const c = r.result.transaction("covers").objectStore("covers").count(); c.onsuccess = () => resolve(c.result); }; }));
  const distinct = new Set(db.map((track) => track.coverHash).filter(Boolean)).size;
  check("portadas deduplicadas: la misma imagen se guarda una vez", shared[0] !== undefined && shared[0] === shared[1] && covers === distinct, `${covers} guardadas, ${distinct} distintas`);

  // Letras: .lrc hermano y USLT dentro del MP3, sincronizadas con el audio real.
  await row(page, "tono-sin-metadatos").click();
  await page.locator(".bar-track").click();
  await page.getByRole("button", { name: "Letra", exact: true }).click();
  await page.waitForTimeout(1900);
  const active = page.locator(".lyric-line[aria-current='true']");
  check("letra .lrc: el verso activo sigue la posición", (await active.innerText().catch(() => "")) === "Segundo verso sintético", await active.innerText().catch(() => "—"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const withLyrics = await stored(page);
  check("letra en la etiqueta USLT", withLyrics.find((track) => track.title === "Con Letra")?.lyrics === true);
  check("letra sincronizada en la etiqueta SYLT", withLyrics.find((track) => track.title === "Letra Sincronizada")?.lyrics === true);

  // Persistencia: tras recargar, la biblioteca está y suena desde la carpeta recordada.
  await row(page, "Amanecer").click();
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 8);
  check("tras recargar la biblioteca sigue ahí", (await rows(page).count()) === 8);
  check("tras recargar se restaura la última pista", (await title(page)) === "Amanecer en La");
  await row(page, "Marea").click();
  await page.waitForTimeout(1200);
  check("reproduce desde el handle guardado", (await title(page)) === "Marea de Fase" && (await position(page)) > 0.3, `pos=${await position(page)}`);

  // Re-escaneo por diferencias: uno nuevo, uno borrado; solo se lee el nuevo.
  await put([["Ondas/03-hires.flac", fx("03-hires.flac")]]);
  await page.evaluate(async () => (await (await navigator.storage.getDirectory()).getDirectoryHandle("e2e-musica")).removeEntry("corrupto.mp3"));
  const before = await reads(page);
  await page.getByRole("button", { name: "Carpetas y copia de seguridad" }).click();
  await page.getByRole("button", { name: "Buscar cambios en e2e-musica" }).click();
  await page.waitForTimeout(300);
  await scanDone(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("re-escaneo: aparece lo nuevo y desaparece lo borrado", (await row(page, "Noventa y Seis Mil").count()) === 1 && (await row(page, "corrupto").count()) === 0);
  check("re-escaneo por diferencias: solo se leyó 1 archivo", (await reads(page)) - before === 1, `leídos=${(await reads(page)) - before}`);

  // Reconexión de permisos con un toque (el navegador vuelve a "prompt" en otra sesión).
  await page.evaluate(() => localStorage.setItem("e2e-permiso", "prompt"));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 8);
  const reconnect = page.getByRole("button", { name: "Reconectar" });
  check("sin permiso: aviso con botón Reconectar y la biblioteca visible", (await reconnect.count()) === 1 && (await rows(page).count()) === 8);
  check("sin permiso, la sesión restaurada no marca la pista como rota", (await page.locator(".track-row .warn").count()) === 0);
  await reconnect.click();
  await page.waitForTimeout(800);
  check("un toque en Reconectar devuelve el acceso", (await reconnect.count()) === 0);
  await row(page, "Amanecer").click();
  await page.waitForTimeout(1000);
  check("tras reconectar vuelve a sonar", (await position(page)) > 0.3);

  // Arrastrar archivos sueltos (en Chromium también se aceptan carpetas como handles).
  await page.evaluate(async (url) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([await (await fetch(url)).blob()], "04-senoidal.mp3", { type: "audio/mpeg" }));
    const target = document.querySelector(".library");
    target.dispatchEvent(new DragEvent("dragover", { dataTransfer: transfer, bubbles: true, cancelable: true }));
    target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, fx("04-senoidal.mp3"));
  await page.waitForFunction(() => [...document.querySelectorAll(".track-row .title")].some((el) => el.textContent.includes("Senoidal")), null, { timeout: 15_000 }).catch(() => {});
  check("arrastrar un archivo lo añade (copia en OPFS)", (await row(page, "Senoidal Nocturna").count()) === 1);

  // Vistas.
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  await page.locator(".album-tile").first().waitFor();
  check("vista Álbumes", (await page.locator(".album-tile").count()) >= 4);
  await page.locator(".album-tile", { hasText: "Ondas Puras" }).click();
  check("detalle de álbum numerado con calidad", (await page.locator(".group-header h2").innerText()) === "Ondas Puras" && (await page.locator(".row-number").count()) === 2);
  await page.getByRole("link", { name: "Carpetas", exact: true }).click();
  check("vista Carpetas", (await page.locator(".group-row", { hasText: "Letras" }).count()) === 1);
  await page.getByRole("link", { name: "Recientes", exact: true }).click();
  const recent = await rows(page).allInnerTexts();
  check("Recientes: lo último añadido y lo último que sonó, arriba", recent[0].includes("Senoidal") && recent[1].includes("Amanecer"), recent.slice(0, 2).join(" / ").replace(/\n/g, " "));
  await page.getByRole("link", { name: "Canciones", exact: true }).click();
  await page.getByRole("searchbox").fill("osciladores");
  check("búsqueda por artista", (await rows(page).count()) === 2);
  await page.getByRole("searchbox").fill("NOVENTA Y SEIS");
  check("búsqueda sin mayúsculas", (await rows(page).count()) === 1);
  await page.getByRole("searchbox").fill("");

  // Playlists sin cuenta y copia de seguridad.
  await page.getByRole("link", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "Nueva playlist" }).click();
  await page.getByLabel("Nombre de la playlist").fill("Pruebas sin red");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("button", { name: "Añadir canciones" }).click();
  await page.getByRole("button", { name: "Añadir Marea de Fase" }).click();
  await page.getByRole("button", { name: "Marea de Fase ya está en la playlist" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300); // la UI se pinta antes de que IndexedDB confirme la escritura
  await page.reload();
  await page.waitForTimeout(800);
  check("playlist sin cuenta: persiste tras recargar con su canción", (await page.locator(".playlist-detail .track-row", { hasText: "Marea de Fase" }).count()) === 1);
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: "Carpetas y copia de seguridad" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar" }).click()]);
  const dir = mkdtempSync(join(tmpdir(), "copia-"));
  const file = join(dir, "copia.json");
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, "utf8"));
  check("exportar: JSON con playlists y ajustes", backup.app === "reproductor" && backup.playlists[0]?.name === "Pruebas sin red" && backup.playlists[0].tracks[0]?.startsWith("track:v1:") && Boolean(backup.settings.audio));
  backup.playlists[0].name = "Importada";
  backup.playlists.push({ name: "<img src=x onerror=alert(1)>", tracks: ["no-es-identidad", "track:v1:x"] });
  writeFileSync(file, JSON.stringify(backup));
  await page.getByLabel("Elegir copia de seguridad").setInputFiles(file);
  await page.waitForTimeout(500);
  check("importar: valida y añade playlists", (await page.getByRole("status").last().innerText()).includes("2 playlists"));
  writeFileSync(file, "{ no es json");
  await page.getByLabel("Elegir copia de seguridad").setInputFiles(file);
  await page.waitForTimeout(300);
  check("importar un archivo inválido avisa sin romper", (await page.getByRole("status").last().innerText()).includes("no es una copia"));
  rmSync(dir, { recursive: true, force: true });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Playlists", exact: true }).click();
  check("el nombre importado se pinta como texto", (await page.locator(".playlist-item", { hasText: "<img src=x" }).count()) === 1 && errors.length === 0);
  await browser.close();
}

// --- 2. Firefox y WebKit: carpeta con <input webkitdirectory> → copia en OPFS ---
for (const type of [firefox, webkit]) {
  const name = type.name();
  const { browser, page, errors } = await open(type);
  await page.goto(`${base}/app`);
  const keeps = await page.evaluate(() => "showDirectoryPicker" in window);
  check(`${name}: sin File System Access usa la ruta de copia`, !keeps);
  try {
    await page.getByLabel("Elegir una carpeta de música").setInputFiles(fixtures);
  } catch (error) {
    // Si Playwright no sube carpetas en este navegador, se prueba lo mismo con los archivos sueltos.
    console.log(`     (${name}: subida de carpeta no soportada por Playwright, se usan archivos: ${error.message.split("\n")[0]})`);
    await page.getByLabel("Elegir archivos de música").setInputFiles(["01-amanecer.flac", "02-marea.flac", "04-senoidal.mp3", "07-opus.opus", "08-vorbis.ogg", "tono-corto.wav"].map((file) => join(fixtures, file)));
  }
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 5, null, { timeout: 30_000 });
  await scanDone(page);
  const count = await rows(page).count();
  const unsupported = await page.locator(".track-row .warn").count();
  console.log(`     (${name}: ${unsupported} pistas marcadas como formato no compatible según canPlayType)`);
  const opfs = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false));
  if (!opfs) {
    // WebKit de Playwright en Windows no trae OPFS (como una ventana privada de Safari): debe avisar y sonar en la sesión.
    check(`${name}: sin OPFS avisa que la música dura hasta recargar`, (await page.locator(".notice", { hasText: "hasta que recargues" }).count()) === 1);
    await row(page, "Amanecer").click();
    await page.waitForTimeout(1500);
    // Este WebKit tampoco reproduce medios (ni un new Audio() suelto avanza): se comprueba que el motor cargó el archivo de memoria.
    const src = await page.evaluate(() => window.__engine.snapshot().src);
    check(`${name}: sin OPFS carga la pista desde memoria en esta sesión`, (await title(page).catch(() => "")) !== "" && src.startsWith("blob:"), `${await title(page).catch(() => "—")} · ${src}`);
    check(`${name}: sin errores`, errors.length === 0, errors.join(" | "));
    await browser.close();
    continue;
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".track-row").length >= 5, null, { timeout: 15_000 }).catch(() => {});
  check(`${name}: la copia en OPFS sobrevive a la recarga`, (await rows(page).count()) === count, `${count} → ${await rows(page).count()}`);
  await row(page, "Amanecer").click();
  await page.waitForTimeout(1500);
  check(`${name}: reproduce la copia guardada`, (await title(page).catch(() => "")) === "Amanecer en La" && (await position(page)) > 0.2, `pos=${await position(page).catch(() => -1)}`);
  check(`${name}: sin errores`, errors.length === 0, errors.join(" | "));
  await browser.close();
}

// --- 3. 5 000 pistas sintéticas: escaneo, virtualización, búsqueda, restauración < 1 s y sin red ---
if (!quick) {
  const { browser, context, page, errors } = await open(chromium);
  await page.addInitScript(() => delete window.showDirectoryPicker); // la ruta de copia, como en Firefox/Safari
  await page.goto(`${base}/app`);
  const start = Date.now();
  await page.getByLabel("Elegir una carpeta de música").setInputFiles(big);
  await page.waitForFunction(() => document.querySelector(".view-header .subtitle")?.textContent === "5000 canciones", null, { timeout: 180_000 });
  const listed = Date.now() - start;
  await scanDone(page, 600_000);
  const done = Date.now() - start;
  check("5 000 pistas importadas y leídas", (await header(page)) === "5000 canciones", `listadas en ${(listed / 1000).toFixed(1)} s, etiquetas en ${(done / 1000).toFixed(1)} s`);
  check("lista virtualizada: pocas filas en el DOM", (await page.locator(".track-row").count()) < 80, `${await page.locator(".track-row").count()} filas`);

  const frames = await page.evaluate(async () => {
    const main = document.querySelector(".main");
    const gaps = [];
    let last = performance.now();
    for (let i = 0; i < 120; i++) {
      main.scrollTop += 900;
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      gaps.push(now - last);
      last = now;
    }
    main.scrollTop = main.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, 200));
    gaps.sort((a, b) => a - b);
    return { p50: gaps[60], p95: gaps[114], max: gaps.at(-1) };
  });
  check("scroll rápido: cuadros por debajo de 50 ms (p95)", frames.p95 < 50, `p50 ${frames.p50.toFixed(1)} ms · p95 ${frames.p95.toFixed(1)} ms · máx ${frames.max.toFixed(1)} ms`);
  check("al final de la lista se pinta la última fila", (await page.locator(".virtual-row").last().getAttribute("aria-posinset")) === "5000");

  const searchTime = await page.evaluate(async () => {
    const input = document.querySelector('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const t0 = performance.now();
    setter.call(input, "nandu marea");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(requestAnimationFrame);
    return performance.now() - t0;
  });
  await page.waitForTimeout(200);
  const hits = await page.locator(".track-row").count();
  check("búsqueda sin acentos en 5 000 pistas", hits > 0 && (await rows(page).first().innerText()).toLowerCase().includes("ñandú"), `${searchTime.toFixed(0)} ms hasta pintar, ${hits} filas visibles`);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("link", { name: "Álbumes", exact: true }).click();
  check("5 000 pistas → 500 álbumes en rejilla virtualizada", (await header(page)).startsWith("500 álbumes") && (await page.locator(".album-tile").count()) < 200, `${await header(page)}, ${await page.locator(".album-tile").count()} en el DOM`);
  await page.getByRole("link", { name: "Géneros", exact: true }).click();
  check("vista Géneros", (await header(page)).startsWith("8 géneros"));
  await page.getByRole("link", { name: "Canciones", exact: true }).click();

  // Las sintéticas duran 0,25 s: para comprobar la posición hace falta una pista larga (amanecer, 8 s).
  await page.getByLabel("Elegir archivos de música").setInputFiles([join(fixtures, "01-amanecer.flac"), join(fixtures, "02-marea.flac")]);
  await page.waitForFunction(() => document.querySelector(".view-header .subtitle")?.textContent === "5002 canciones", null, { timeout: 30_000 });
  await scanDone(page);
  await page.getByRole("searchbox").fill("amanecer en la");
  await row(page, "Amanecer en La").click();
  await page.getByRole("searchbox").fill("");
  await page.waitForTimeout(2000);
  const playing = await title(page);
  await page.reload();
  await page.waitForFunction((expected) => document.querySelector(".bar-track .title")?.textContent === expected && document.querySelectorAll(".track-row").length > 5 && Number(document.querySelector(".bar-center .seek input")?.value) > 0, playing, { timeout: 10_000 });
  const restore = await page.evaluate(() => performance.now());
  check("restaurar biblioteca (5 002), cola y posición en < 1 s", restore < 1000, `${restore.toFixed(0)} ms desde la navegación`);
  check("la posición restaurada no es cero", (await position(page)) >= 1, `pos=${await position(page)}`);

  await context.setOffline(true);
  await page.getByRole("searchbox").fill("marea de fase osciladores"); // en una lista virtualizada solo existe lo visible
  await row(page, "Marea de Fase").click();
  await page.waitForTimeout(1500);
  check("sin red: reproduce música local", (await title(page)) === "Marea de Fase" && (await position(page)) > 0.5, `pos=${await position(page)}`);
  await page.getByRole("link", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "Nueva playlist" }).click();
  await page.getByLabel("Nombre de la playlist").fill("Offline");
  await page.getByRole("button", { name: "Guardar" }).click();
  check("sin red: crear playlist funciona", (await page.locator(".playlist-item", { hasText: "Offline" }).count()) === 1);
  await context.setOffline(false);
  check("5 000 pistas sin errores", errors.length === 0, errors.join(" | "));
  await browser.close();
}

// --- 4. Cancelar a mitad y retomar al recargar; archivo enorme sin bloquear la interfaz ---
if (!quick) {
  const { browser, page, errors } = await open(chromium);
  await page.addInitScript(() => delete window.showDirectoryPicker);
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir una carpeta de música").setInputFiles(big);
  await page.waitForFunction(() => /Leyendo etiquetas.*: ([5-9]\d|\d{3,}) de/.test(document.querySelector(".scan-text")?.textContent ?? ""), null, { timeout: 180_000 });
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.waitForTimeout(400);
  const afterCancel = await reads(page);
  await page.waitForTimeout(1500);
  const pending = (await stored(page)).filter((track) => track.metadataStatus === "loading").length;
  check("cancelar: se detiene, las pistas siguen y no se lee nada más", !(await page.locator(".scan-bar").count()) && (await header(page)) === "5000 canciones" && (await reads(page)) === afterCancel && pending > 0, `${pending} pendientes`);
  await page.reload();
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("reproductor");
        request.onsuccess = () => {
          const all = request.result.transaction("tracks").objectStore("tracks").getAll();
          all.onsuccess = () => resolve(all.result.every((track) => track.metadataStatus !== "loading"));
        };
      }),
    null,
    { timeout: 300_000, polling: 2000 },
  );
  check("al recargar se retoman las lecturas interrumpidas", true);

  const dir = mkdtempSync(join(tmpdir(), "enorme-"));
  const huge = join(dir, "enorme.mp3");
  writeFileSync(huge, Buffer.alloc(150 * 1024 * 1024)); // 150 MB de ceros con extensión de audio
  await page.evaluate(() => {
    window.__gaps = [];
    let last = performance.now();
    const tick = (now) => {
      window.__gaps.push(now - last);
      last = now;
      if (window.__gaps.length < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByLabel("Elegir archivos de música").setInputFiles(huge);
  await page.waitForFunction(() => document.querySelector(".view-header .subtitle")?.textContent === "5001 canciones", null, { timeout: 60_000 });
  await scanDone(page, 60_000);
  const worst = await page.evaluate(() => Math.max(...window.__gaps.slice(5)));
  const status = (await stored(page)).find((track) => track.title === "enorme")?.metadataStatus;
  check("archivo enorme: se procesa en el worker sin congelar la interfaz", status !== "loading" && worst < 500, `estado ${status}, peor cuadro ${worst.toFixed(0)} ms`);
  rmSync(dir, { recursive: true, force: true });
  check("cancelar/enorme sin errores", errors.length === 0, errors.join(" | "));
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} comprobaciones fallaron` : `\nTodas las comprobaciones pasaron (${results.length})`);
process.exit(failed ? 1 : 0);
