// Mide cuánto cuesta arrancar con letras dentro de cada pista (PLAN_RENDIMIENTO, Fase 4), solo medir: no cambia nada.
// Siembra 5 002 pistas sintéticas con letra sincronizada de 0, 2 o 6 KB y, con la CPU ×4 (CDP), mide en una pestaña nueva
// (1) `getAll("tracks")` de IndexedDB (la primera vez y la mediana de 5) y (2) el arranque completo de /app hasta ver la biblioteca.
// Uso: contra `vite preview` (build de producción): node scripts/medir-letras.mjs [url-base] [repeticiones]. Sale 0 siempre.
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:4173").replace(/\/$/, "");
const reps = Number(process.argv[3] ?? 5);
const COUNT = 5002;
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

const browser = await chromium.launch();
const results = [];
for (const kb of [0, 2, 6]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // 1) Esquema creado por la propia app y siembra de pistas.
  const seed = await context.newPage();
  await seed.goto(`${base}/app`);
  await seed.waitForTimeout(1500);
  await seed.evaluate(
    ([count, bytes]) =>
      new Promise((ok, ko) => {
        const request = indexedDB.open("reproductor");
        request.onerror = () => ko(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction("tracks", "readwrite");
          const store = tx.objectStore("tracks");
          const now = Date.now();
          const lyrics = (i) => {
            if (bytes === 0) return undefined;
            const synced = [];
            for (let line = 0, size = 0; size < bytes; line++) {
              const text = `Verso ${line} de la pista ${i}: palabras de una canción cualquiera`.slice(0, 44);
              synced.push({ time: line * 3.25, text });
              size += JSON.stringify({ time: line * 3.25, text }).length;
            }
            return { synced };
          };
          for (let i = 0; i < count; i++) {
            store.put({ id: `perf:${i}`, path: `Perf/Álbum ${i % 500}/${i}.flac`, fileName: `${i}.flac`, title: `Pista de prueba ${i}`, artist: `Artista ${i % 50}`, album: `Álbum ${i % 500}`, genre: "Prueba", year: 2020, duration: 240, trackNumber: (i % 10) + 1, size: 30000000, lastModified: now, addedAt: now - i, codec: "FLAC", lossless: true, sampleRate: 44100, bitsPerSample: 16, metadataStatus: "available", lyrics: lyrics(i) });
          }
          tx.oncomplete = ok;
          tx.onerror = () => ko(tx.error);
        };
      }),
    [COUNT, kb * 1024],
  );
  await seed.close();

  const throttled = async (url) => {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(url);
    return page;
  };

  // 2) getAll en una pestaña nueva (sin la app): la primera lectura y las siguientes.
  const reader = await throttled(`${base}/favicon.svg`);
  const getAll = await reader.evaluate(
    () =>
      new Promise((ok) => {
        const request = indexedDB.open("reproductor");
        request.onsuccess = () => {
          const times = [];
          let size = 0;
          const run = () => {
            const start = performance.now();
            const query = request.result.transaction("tracks").objectStore("tracks").getAll();
            query.onsuccess = () => {
              times.push(Math.round(performance.now() - start));
              size = query.result.length;
              times.length < 6 ? run() : ok({ times, size, mb: +(JSON.stringify(query.result).length / 1048576).toFixed(2) });
            };
          };
          run();
        };
      }),
  );
  await reader.close();

  // 3) Arranque completo de /app en pestaña nueva hasta que se ve la primera fila de la biblioteca.
  const starts = [];
  for (let i = 0; i < reps; i++) {
    const page = await throttled(`${base}/app`);
    await page.locator(".track-row").first().waitFor({ timeout: 30000 });
    starts.push(Math.round(await page.evaluate(() => performance.now())));
    await page.close();
  }
  results.push({ letra: `${kb} KB`, "getAll 1.ª (ms)": getAll.times[0], "getAll mediana (ms)": median(getAll.times.slice(1)), "tamaño leído (MB)": getAll.mb, "arranque mediana (ms)": median(starts), "arranque mín–máx": `${Math.min(...starts)}–${Math.max(...starts)}` });
  await context.close();
}
await browser.close();
console.table(results);
console.log("Regla de la Fase 4: hacerla solo si el arranque con 6 KB supera 1 000 ms con CPU ×4 o si getAll supera 300 ms.");
