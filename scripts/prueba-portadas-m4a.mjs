// Portadas de m4a contra `npm run dev`. Uso: node scripts/prueba-portadas-m4a.mjs [url-base]
// Los cuatro fixtures de tests/fixtures/audio/m4a (AAC y ALAC, moov al principio y al final) dan su portada (covr) en Chromium, Firefox y WebKit,
// y una pista guardada que apunta a una portada que no llegó a guardarse, o cuya lectura falló, la recupera al volver a abrir la app sin reimportar.
// Sale con 1 si algo falla.
import { chromium, firefox, webkit } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { args } from "./salida.mjs";
import "./requiere-audio.mjs";

const base = (args[0] ?? "http://localhost:5173").replace(/\/$/, "");
const dir = join(import.meta.dirname, "..", "tests", "fixtures", "audio", "m4a");
const names = ["aac-moov-inicio.m4a", "aac-moov-final.m4a", "alac-moov-inicio.m4a", "alac-moov-final.m4a"];
const files = names.map((name) => join(dir, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Que los fixtures sean lo que dicen: el orden de los átomos de primer nivel.
for (const name of names) {
  const bytes = readFileSync(join(dir, name));
  const top = [];
  for (let at = 0; at + 8 <= bytes.length; ) {
    const size = bytes.readUInt32BE(at);
    top.push(bytes.toString("latin1", at + 4, at + 8));
    if (size < 8) break;
    at += size;
  }
  const moovFirst = top.indexOf("moov") < top.indexOf("mdat");
  check(`${name}: moov ${name.includes("inicio") ? "antes" : "después"} de mdat`, moovFirst === name.includes("inicio"), top.join(" "));
}

// La app lee y escribe sus propios módulos (con la URL que cargó ella).
const tracksOf = (page) =>
  page.evaluate(async () => {
    const path = "/src/state/library.ts";
    const url = performance.getEntriesByType("resource").map((entry) => entry.name).find((name) => new URL(name).pathname === path) ?? path;
    const { useLibrary } = await import(url);
    return useLibrary.getState().tracks.map((track) => ({ id: track.id, fileName: track.fileName, coverHash: track.coverHash, status: track.metadataStatus }));
  });
const db = (page, body, arg) =>
  page.evaluate(
    ([source, value]) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("reproductor");
        open.onsuccess = () => new Function("db", "value", "resolve", "reject", source)(open.result, value, resolve, reject);
        open.onerror = () => reject(open.error);
      }),
    [body, arg],
  );
const coverKeys = (page) => db(page, `const r = db.transaction("covers").objectStore("covers").getAllKeys(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);`);
const settled = (page) =>
  page.waitForFunction((count) => document.querySelectorAll(".track-row").length === count && !document.querySelector(".scan-status"), names.length, { timeout: 60_000 });
// Las miniaturas de las filas, decodificadas (no rotas ni la funda generada).
const decoded = (page) =>
  page
    .waitForFunction((count) => [...document.querySelectorAll(".track-row img")].filter((img) => img.complete && img.naturalWidth > 0).length === count, names.length, { timeout: 8_000 })
    .then(() => names.length, () => page.evaluate(() => document.querySelectorAll(".track-row img").length));

for (const type of [chromium, firefox, webkit]) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await page.goto(`${base}/app`);
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await settled(page);
  await page.waitForTimeout(600);
  const tracks = await tracksOf(page);
  for (const name of names) {
    const track = tracks.find((item) => item.fileName === name);
    check(`${type.name()}: ${name} trae su portada`, Boolean(track?.coverHash), track ? `estado ${track.status}` : "no se importó");
  }
  // WebKit de Playwright en Windows no guarda ninguna portada en IndexedDB (tampoco de FLAC o MP3): ahí no hay miniaturas que mirar.
  if ((await coverKeys(page)).length > 0) check(`${type.name()}: las cuatro miniaturas se ven`, (await decoded(page)) === names.length);
  else console.log(`(${type.name()}: este navegador no guardó portadas en IndexedDB, con ningún formato; sin prueba de miniaturas)`);

  // Recuperar sin reimportar (solo si la importación se guardó: OPFS; WebKit sin ventana se queda en memoria).
  const saved = await db(page, `const r = db.transaction("tracks").objectStore("tracks").getAll(); r.onsuccess = () => resolve(r.result.length); r.onerror = () => reject(r.error);`);
  if (saved === names.length) {
    // Una pista cuya lectura falló y portadas que no llegaron a guardarse (lo que dejaba un escaneo cancelado): tracks apunta a hashes sin registro.
    const failedOne = tracks.find((item) => item.fileName === names[0]);
    await db(
      page,
      `const tx = db.transaction(["tracks", "covers"], "readwrite");
       tx.objectStore("covers").clear();
       const store = tx.objectStore("tracks");
       const r = store.get(value);
       r.onsuccess = () => { const t = r.result; delete t.coverHash; t.metadataStatus = "error"; store.put(t); };
       tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);`,
      failedOne.id,
    );
    await page.reload();
    await page.waitForFunction(
      async (count) => {
        const open = await new Promise((resolve) => { const request = indexedDB.open("reproductor"); request.onsuccess = () => resolve(request.result); });
        const keys = await new Promise((resolve) => { const request = open.transaction("covers").objectStore("covers").getAllKeys(); request.onsuccess = () => resolve(request.result); });
        open.close();
        return keys.length > 0 && document.querySelectorAll(".track-row img").length === count;
      },
      names.length,
      { timeout: 30_000 },
    ).catch(() => {});
    await page.waitForTimeout(600);
    const after = await tracksOf(page);
    const keys = new Set(await coverKeys(page));
    check(`${type.name()}: al volver a abrir, cada pista recupera su portada guardada`, after.length === names.length && after.every((track) => track.coverHash && keys.has(track.coverHash)), JSON.stringify(after.map((track) => [track.fileName, track.status, Boolean(track.coverHash && keys.has(track.coverHash))])));
    check(`${type.name()}: la que había fallado vuelve a estar disponible`, after.find((track) => track.id === failedOne.id)?.status === "available");
    check(`${type.name()}: y se ven`, (await decoded(page)) === names.length);
  } else console.log(`(${type.name()}: la importación no se guardó en este navegador; sin prueba de recuperación)`);
  check(`${type.name()}: sin errores de página`, errors.length === 0, errors.join(" | "));
  await browser.close();
}

process.exit(failed > 0 ? 1 : 0);
