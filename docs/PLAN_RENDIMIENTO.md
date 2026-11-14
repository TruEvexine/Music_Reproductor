# Plan de rendimiento

> 2026-11-12 · rama `desarrollo` · base `eafa860`. Este documento solo planifica: no cambia código.
> Mediciones en este PC (Windows 11, escritorio, Chromium de Playwright 1.65), no en gama media. Las cifras de móvil están pendientes (§6).

## 1. Qué dice `rendimiento_auditoria.md`

No es una auditoría con conclusiones: es una lista sin marcar de 31 mejoras genéricas sacadas de un Reel (frontend, API, backend, base de datos y monitoreo), con una plantilla de pregunta: «¿está hecha, se puede hacer o no se puede, y por qué?». La respuesta punto por punto está en §5. En resumen: la mayoría ya está hecha o no aplica, porque la app es estática y local primero, sin servidor propio. Hay cuatro huecos reales: no se divide el JavaScript, las imágenes de la landing no se cargan en diferido, no hay medición en dispositivos reales y sobra una dependencia.

## 2. El fallo conocido: «restaurar biblioteca (5 002), cola y posición en < 1 s»

### Mediciones

Preparé el mismo escenario que la parte 3 de `scripts/prueba-biblioteca.mjs`: importar 5 000 pistas por la ruta de copia, añadir las 2 largas, reproducir «Amanecer en La» 3 s y recargar. Usé un guion de perfilado aparte (no versionado) con estos instrumentos: `PerformanceObserver` de tareas largas, sondeo por cuadro de las tres condiciones de la prueba, envoltura de `indexedDB.open`/`get`/`getAll` y traza de Chromium con perfil de CPU.

| Escenario | Servidor | Tiempo hasta lista + título + posición |
|---|---|---|
| **Primera recarga tras importar** (lo que mide la prueba) | dev (`vite`) | 1 573 · 1 637 · 1 690 · 1 865 ms; una vez 435 ms (intermitente) |
| Lo mismo | producción (`vite preview`) | 2 124 · 1 436 ms |
| Recargas siguientes | dev | 384 – 428 ms |
| Recargas siguientes | producción | 263 – 289 ms |
| **Pestaña nueva** (cerrar la pestaña y abrir `/app` en el mismo perfil, como un usuario que vuelve) | dev | 442 · 408 ms |

Con la espera antigua de 2 s (antes de `660e819`) el guion no llega ni a medir: la posición guardada sigue en 0 y la espera agota los 15 s. Coincide con el motivo de ese commit.

### Causa

- **Durante el segundo de más, el hilo principal está ocioso.** En producción, el bundle está listo a los 136–165 ms (DOMContentLoaded), pero IndexedDB contesta tarde: un `get("kv")` diminuto tarda 482 ms (2–3 ms en las recargas siguientes), `getAll("tracks")` 656 ms (148 ms) y `get("covers")` 546 ms (26 ms). En dev se suma otra espera: 28 peticiones de módulos emitidas a los 175 ms no salen del navegador hasta los 1 309 ms (`requestTime` de la traza), aunque las 6 conexiones están libres.
- **Causa probable:** el almacenamiento del navegador (IndexedDB y OPFS) sigue ocupado con la importación de la misma sesión. Son 5 002 registros escritos en lotes cada 400 ms (`src/state/library.ts:69`), reescritos al llegar los metadatos, más 5 000 archivos copiados a OPFS. No lo confirmé dentro de Chromium: haría falta una traza con las categorías internas de IndexedDB. Encaja con todo lo observado: solo pasa en la primera recarga tras importar, también en producción, y desaparece en las recargas siguientes y en una pestaña nueva.
- **El trabajo propio de la app en el hilo principal es pequeño.** Es una sola tarea larga: 58–95 ms en producción y 122–152 ms en dev. Según el perfil de CPU en dev, se reparte así: ~50 % código nativo en el camino del resultado de IndexedDB (deserializar 5 002 registros, 3,3 MB en JSON, unos 670 B por pista), ~12 % layout forzado (`getBoundingClientRect` en `src/ui/Marquee.tsx:12` y la medición de `src/ui/VirtualList.tsx`), ~5 % ordenar las 5 002 con `Intl.Collator` (`src/core/library.ts:134`) y el resto el render de React.
- **Por qué antes pasaba** (387–419 ms en `PLAN.md:445`; 385 y 548 ms después): no lo bisequé. La cifra antigua no se puede reproducir con el guion actual, porque con 2 s de espera ni siquiera llega a medir.

### Veredicto

- **Para un usuario que vuelve a la app no es un problema real en escritorio:** 263–289 ms en producción y 408–442 ms en dev, lejos de 1 s.
- **Sí hay un efecto real pero acotado:** recargar justo después de importar miles de pistas cuesta 1,4–2,1 s una sola vez. Nada en la app lo provoca, salvo el volumen de escritura, que es necesario: guardar cada pista antes de leer sus metadatos es lo que permite retomar una importación cortada.
- **La prueba mide un escenario que nadie vive:** recargar segundos después de una importación automatizada. El umbral de 1 s no se toca. Lo que propongo cambiar es **qué** se mide (Fase 1, decisión tuya en §6.4).
- **El riesgo que sí importa es el móvil de gama media.** Los ~140 ms de `getAll` y la tarea larga de 60–150 ms pueden multiplicarse por 4–6. Hay que medirlo (§6.1) antes de optimizar nada.

## 3. Hallazgos ordenados por impacto

| # | Hallazgo | Causa | Evidencia | Impacto |
|---|---|---|---|---|
| H1 | El arranque carga **toda** la biblioteca en el hilo principal: `getAll("tracks")` + orden + render | Diseño de `library.init` (`src/state/library.ts:362`): una lectura por tabla y todo en memoria | 3,3 MB y ~140 ms de `getAll` para 5 002 pistas; tarea larga de 58–95 ms (prod). Sin cifra de móvil | Alto en móvil si se confirma; bajo en escritorio |
| H2 | **Las letras viven dentro de cada pista** (`lyrics?: Lyrics`, `src/core/track.ts:23`), así que el arranque carga las letras de toda la biblioteca | Se guardan junto a los metadatos | Por código. Los fixtures no traen letras: los 3,3 MB no lo reflejan. Un `.lrc` puede pesar hasta 512 KB (`MAX_LRC_BYTES`) | Potencialmente alto con bibliotecas reales con letras; sin medir |
| H3 | **Un solo chunk de 630,8 KB (190,2 KB gzip)** que incluye Supabase y la landing | No hay `import()`: solo existe el de `demoCatalog.dev` | `vite build`; según el sourcemap, `@supabase/*` es ~840 KB de los ~1,86 MB de fuente del chunk (~45 %). `PLAN.md:337` ya pedía cargar Supabase solo cuando haga falta | Medio: parseo y compilación en móvil en cada visita sin caché, y en la landing |
| H4 | La prueba de restaurar falla por cómo mide, no por la app | §2 | §2 | Bajo para el usuario; deja la suite en rojo |
| H5 | **Imágenes de la landing sin carga diferida**: 4 JPG de 54–142 KB | Faltan `loading="lazy"` y `decoding="async"` | `src/ui/Landing.tsx:61,75,76,81` | Bajo–medio en la primera visita (compiten con el LCP) |
| H6 | **Sin medición de usuarios reales ni en móvil** | Nunca se montó | No hay RUM ni trazas de dispositivo | Medio: hoy todo lo de móvil es suposición |
| H7 | Layout forzado al montar (`Marquee` mide cada título) | `useLayoutEffect` + `getBoundingClientRect` por instancia | ~12 % de la tarea larga en dev (~15 ms) | Bajo |
| H8 | Dependencia sin uso: `@tokenizer/http` | Huérfana desde `da00c01` | `grep` sin resultados en `src/` y `scripts/` | Nulo en ejecución (no entra al bundle); solo limpieza |

## 4. Plan por fases

Cada fase es un commit, con `npm run typecheck`, `npm test` y `npm run build` en verde, más la prueba de navegador que toque.

### Fase 0: medir en un móvil (lo haces tú, §6.1 y §6.2)
- **Cambio:** ninguno. Saca la línea base de H1, H3 y H5 en gama media y en la landing.
- **Hecho:** tengo la traza de arranque con 5 002 pistas en el móvil y el informe de Lighthouse de la landing.
- **Decide:** si H1 o H2 entran en el plan (Fase 4) y si hace falta un esqueleto de carga (§5, punto 1).

### Fase 1: que la prueba mida lo que dice medir (tras tu visto bueno, §6.4)
- **Cambio:** en `scripts/prueba-biblioteca.mjs`, la comprobación «< 1 s» se mide abriendo una página nueva en el mismo contexto, tras cerrar la que importó. Es lo que vive un usuario que vuelve. La primera recarga tras importar se sigue midiendo, pero solo se imprime (sin aprobar ni suspender), para no perder de vista una regresión. El umbral sigue en 1 s.
- **Riesgo:** esconder una regresión real de la recarga tras importar. Se mitiga porque la cifra se sigue imprimiendo en cada ejecución.
- **Se mide con:** `node scripts/prueba-biblioteca.mjs` 5 veces seguidas.
- **Hecho:** 5 de 5 en verde, con la restauración por debajo de 1 s y las dos cifras en la salida.
- **Estado (2026-11-12): hecha.** 10 pasadas de la parte 3: pestaña nueva 451–491 ms (10 de 10 < 1 s); recarga justo tras importar 391–494 ms, y una vez 3 322 ms (1 de 10 > 1 s), solo informativa.

### Fase 2: sacar Supabase y la landing del chunk de entrada (H3)
- **Cambio:** cargar `@supabase/supabase-js` con `import()` en `src/sync/supabaseClient.ts`, la primera vez que se usa (sesión, login, sync), y `React.lazy` para `Landing` y para la app desde `src/ui/App.tsx`. Sin dependencias nuevas.
- **Riesgo:** volver de un enlace mágico u OAuth (`detectSessionInUrl`) debe seguir creando la sesión, así que el cliente se crea en cuanto la URL trae tokens. También hace falta un estado de «cargando» corto en las vistas que esperan a Auth, y la carga diferida no puede romper el offline. La CSP no cambia (chunks del mismo origen; comprobar con `node scripts/verificar-csp.mjs`).
- **Se mide con:** la salida de `npm run build` (gzip del chunk de entrada) y el sourcemap (que no aparezca `@supabase` en el chunk de entrada). Lighthouse de la landing antes y después (§6.2).
- **Hecho:** el chunk de entrada no contiene `@supabase` y baja al menos un 25 % en gzip; login, cierre de sesión, sincronización de playlists y retorno de enlace mágico siguen funcionando; la app arranca sin red; `prueba-biblioteca` y `capturas.mjs` siguen en verde.
- **Estado (2026-11-12): hecha solo para Supabase.** `getSupabase()` en `src/sync/supabaseClient.ts` descarga el SDK la primera vez que hace falta, y al instante si la URL trae tokens. Entrada: 630,8 → 408,6 kB (−35 %); gzip 190,2 → 132,3 kB (−30 %); brotli 162,2 → 113,0 kB (−30 %). El SDK va aparte (224,5 kB, 58,9 kB gzip). `scripts/prueba-enlace-magico.mjs` cubre la vuelta del enlace a `/` y a `/app` (y falla si el cliente no se crea al volver). **La landing se queda en la entrada:** con `React.lazy` el LCP pasó de ~155 a ~490–640 ms en `vite preview` (React 19 retrasa ~300 ms el contenido que sustituye a un fallback de Suspense, y la fuente no se pide hasta entonces), a cambio de solo 1,8 kB gzip.

### Fase 3: imágenes de la landing en diferido (H5)
- **Cambio:** `loading="lazy"` y `decoding="async"` en las imágenes de `Landing.tsx` bajo el pliegue. La primera visible se queda en carga normal porque es candidata a LCP.
- **Riesgo:** casi ninguno. Si la imagen LCP se pusiera en diferido, el LCP empeoraría.
- **Se mide con:** Lighthouse (bytes iniciales y LCP) y la pestaña Red (las imágenes de abajo no se piden hasta hacer scroll).
- **Hecho:** el LCP no empeora y las imágenes de abajo dejan de pedirse en la carga inicial.
- **Estado (2026-11-12): hecha, con efecto parcial.** `loading="lazy"` y `decoding="async"` en las 3 capturas bajo el pliegue; el hero sigue en carga normal. En `vite preview` el LCP no cambia (148–168 ms antes y después). Firefox deja de pedirlas: en 390×844 pasa de 4 imágenes a 1 en la carga inicial, y en 1440×900 de 4 a 3. **Chromium las sigue pidiendo todas:** la landing entera cabe en su margen de carga diferida (≥ 1 250 px). En WebKit (Windows) no se pudo medir.

### Fase 4: letras fuera de la tabla de pistas (H2). **Solo si la Fase 0 o la medición de abajo lo justifican**
- **Medir primero:** generar 5 000 pistas sintéticas con un `.lrc` de ~3 KB cada una y medir `getAll("tracks")`. Si el tiempo crece más del doble frente a los ~140 ms actuales, se hace.
- **Cambio:** un almacén `lyrics` (clave = id de pista) como **migración nueva al final** de `src/platform/web/db.ts`, que mueve las letras existentes. La vista Letra las lee al abrirse.
- **Riesgo:** es una migración sobre datos reales: si se corta, no se pueden perder letras. Hay que mover en la misma transacción de actualización y probar con `fake-indexeddb` (`db.test.ts`). La copia de seguridad no incluye letras, así que no le afecta.
- **Hecho:** test de migración en verde, `getAll` vuelve a ~140 ms con letras, y las pruebas de letras de `prueba-biblioteca` siguen en verde.

### Fase 5: limpieza (H8)
- **Cambio:** `npm uninstall @tokenizer/http`.
- **Riesgo:** ninguno en ejecución. Se verifica con typecheck, test y build.
- **Hecho:** desaparece de `package.json` y `package-lock.json` y todo sigue en verde.
- **Estado (2026-11-12): hecha.** Nada la importaba: solo aparecía en un comentario de ejemplo de `file-type` y ningún paquete del lockfile la pedía.

## 5. Los 31 puntos de la lista

| # | Punto | Estado | Dónde / por qué |
|---|---|---|---|
| 1 | Skeletons | Parcial | `LibraryView.tsx:430` pinta una sección vacía con `aria-busy` mientras carga. Con 260–440 ms en escritorio, un esqueleto solo parpadearía. Se decide tras la Fase 0 |
| 2 | WebP/AVIF | No; descartado por ahora | Las portadas son JPEG generados en el worker y nunca viajan por red; Safari no codifica WebP en canvas y la Media Session las declara `image/jpeg`. Convertir la landing exigiría una dependencia (las capturas de Playwright solo salen en PNG o JPEG): solo si Lighthouse lo señala |
| 3 | Lazy loading de imágenes | Parcial | Portadas sí (`parts.tsx:41`); landing no → Fase 3 |
| 4 | UI optimista | Sí | Todo se escribe primero en IndexedDB; outbox de playlists (`src/state/playlists.ts`, `src/sync/playlistSync.ts`) |
| 5 | Code splitting | No → Fase 2 | Un solo chunk de 630,8 KB |
| 6 | Virtualizar listas | Sí | `VirtualList.tsx` + `@tanstack/react-virtual`; 18 filas en el DOM con 5 000 pistas y scroll p95 de 24–28 ms |
| 7 | Evitar re-renders | Sin medir | Selectores de Zustand y `useMemo` en `LibraryView`. No se toca sin una traza que lo señale (Fase 0) |
| 8 | Fuentes propias | Sí | `@fontsource-variable/instrument-sans` (`main.tsx:3`), CSP `font-src 'self'` |
| 9 | Limitar pesos de fuente | Hecho de otra forma | Una fuente variable cubre todos los pesos; subconjuntos por `unicode-range` (latin 57 KB, latin-ext 19 KB solo si hace falta) |
| 10 | Scripts de terceros diferidos | No aplica | No hay ninguno (`index.html`; CSP `script-src 'self'`) |
| 11 | Caché de estáticos | Sí | `vercel.json`: `/assets/*` con `immutable` de 1 año y el HTML con `no-cache`. Falta verificarlo en producción (§6.3) |
| 12 | Debounce en búsqueda | Descartado | El filtro es en memoria, con el texto de búsqueda cacheado (`LibraryView.tsx:49`), y pinta en ~35 ms con 5 000 pistas. Un debounce solo añadiría retraso. Si en móvil se nota lag al teclear, `useDeferredValue` |
| 13 | Llamadas duplicadas | Bajo riesgo | Supabase solo sincroniza playlists; la UI nunca espera a la red |
| 14 | Paginar la API | No aplica | Las playlists de un usuario son pocas y la base ya limita tamaños (`20261014120000_hardening_limits.sql`) |
| 15 | Peticiones en paralelo | Sí donde son independientes | El arranque lee en paralelo (`Promise.all` en `initSession`); las dos consultas de `fetchUserPlaylists` dependen una de otra |
| 16 | Timeout en llamadas externas | Descartado por ahora | Ninguna llamada de Supabase tiene timeout, pero como la app es local primero, un cuelgue solo retrasa la sincronización. Envolver el `fetch` global puede pisar las señales de aborto de supabase-js |
| 17 | Streaming | No aplica | Respuestas JSON pequeñas |
| 18 | Cola de trabajos | Sí, en cliente | Workers para metadatos y copia a OPFS (`metadata.worker.ts`, `opfsCopy.worker.ts`), outbox para sincronizar |
| 19 | Brotli/GZIP | Lo hace Vercel | Falta verificarlo (§6.3) |
| 20 | Redis | No aplica | No hay servidor propio |
| 21 | Dependencias sin uso | Una → Fase 5 | `@tokenizer/http` |
| 22 | Pool de conexiones | No aplica | El cliente usa la API REST de Supabase |
| 23 | Balanceo de carga | No aplica | Sitio estático en CDN |
| 24 | Servidor cerca de la base | No aplica | Solo afecta a la latencia de la sincronización (región de Supabase, §6.3, opcional) |
| 25 | SSR/edge | Descartado | La app depende de IndexedDB y File System Access en el cliente. Prerenderizar la landing solo si Lighthouse muestra un LCP malo |
| 26 | CDN para estáticos | Sí | Vercel |
| 27 | Consultas N+1 | No hay | Dos consultas con `.in()` (`src/sync/playlistService.ts:40`) |
| 28 | Índices | Sí | `playlists_user_id_idx`, `playlist_tracks_playlist_position_idx` (migración inicial) |
| 29 | Solo las columnas necesarias | Sí | `select` explícitos en `playlistService.ts` y `useAuthController.ts` |
| 30 | OpenTelemetry | No aplica | No hay backend propio que trazar |
| 31 | RUM y pruebas en móvil | No → Fase 0 | Ver §7 sobre RUM continuo |

## 6. Lo que necesito que hagas tú

### 6.1 Arranque con 5 002 pistas en un Android de gama media
Necesitas el móvil con cable USB, la **depuración USB** activada (Ajustes → Opciones de desarrollador) y `adb` instalado.

1. En el PC, en la raíz del repo: `npm run build` y después `npx vite preview --port 4173`. Deja esa terminal abierta.
2. En otra terminal: `adb reverse tcp:4173 tcp:4173`. Así el móvil ve el servidor como `localhost`, que cuenta como contexto seguro.
3. En el móvil, abre Chrome en `http://localhost:4173/app`.
4. En el PC, abre Chrome en `chrome://inspect/#devices` y pulsa **inspect** bajo esa pestaña.
5. En la **Consola** de esa ventana de DevTools, pega esto. Crea 5 002 pistas sintéticas sin archivos y no toca nada más:
   ```js
   await new Promise((ok, ko) => { const r = indexedDB.open("reproductor"); r.onerror = () => ko(r.error); r.onsuccess = () => { const tx = r.result.transaction("tracks", "readwrite"); const s = tx.objectStore("tracks"); const now = Date.now(); for (let i = 0; i < 5002; i++) s.put({ id: `perf:${i}`, path: `Perf/Álbum ${i % 500}/${i}.flac`, fileName: `${i}.flac`, title: `Pista de prueba ${i}`, artist: `Artista ${i % 50}`, album: `Álbum ${i % 500}`, genre: "Prueba", year: 2020, duration: 240, trackNumber: (i % 10) + 1, size: 30000000, lastModified: now, addedAt: now - i, codec: "FLAC", lossless: true, sampleRate: 44100, bitsPerSample: 16, metadataStatus: "available" }); tx.oncomplete = ok; tx.onerror = () => ko(tx.error); }; }); "listo"
   ```
6. Recarga la pestaña una vez y espera 10 s.
7. Ve a la pestaña **Performance** y pulsa el botón de **grabar y recargar** (la flecha circular). Detén la grabación cuando se vea la lista. Guarda la traza (icono de descarga, **Save trace**). Repítelo una segunda vez.
8. En la Consola, pega esto y copia lo que imprime:
   ```js
   await new Promise((ok) => { const r = indexedDB.open("reproductor"); r.onsuccess = () => { const t = []; const go = () => { const a = performance.now(); const q = r.result.transaction("tracks").objectStore("tracks").getAll(); q.onsuccess = () => { t.push(Math.round(performance.now() - a)); t.length < 5 ? go() : ok({ getAllMs: t, pistas: q.result.length, kb: Math.round(JSON.stringify(q.result).length / 1024) }); }; }; go(); }; })
   ```
9. Para limpiar, pega esto (borra solo las pistas sintéticas):
   ```js
   await new Promise((ok) => { const r = indexedDB.open("reproductor"); r.onsuccess = () => { const tx = r.result.transaction("tracks", "readwrite"); tx.objectStore("tracks").delete(IDBKeyRange.bound("perf:", "perf:￿")); tx.oncomplete = ok; }; }); "limpio"
   ```

**Mándame:** los dos archivos de traza (`.json` o `.json.gz`), lo que imprimió el paso 8, y el modelo del móvil con su versión de Android y de Chrome.

### 6.2 Lighthouse de la landing en producción
1. En Chrome de escritorio, abre una ventana de incógnito con la URL de producción de Vercel (la raíz `/`, no `/app`).
2. DevTools → **Lighthouse** → Mode: *Navigation*, Device: *Mobile*, Categories: solo *Performance* → **Analyze page load**.
3. Guarda el informe: menú ⋮ del informe → **Save as JSON**.
4. Repítelo después de las Fases 2 y 3.

**Mándame:** el JSON y la URL que usaste.

### 6.3 Cabeceras de caché y compresión en producción
1. Cambia `TU-DOMINIO` por tu dominio de producción y ejecuta:
   ```bash
   curl -s https://TU-DOMINIO/app | grep -o 'assets/index-[^"]*\.js'
   ```
2. Con el nombre que salga:
   ```bash
   curl -sI -H "Accept-Encoding: br, gzip" https://TU-DOMINIO/assets/index-XXXX.js
   ```
3. *(Opcional, solo afecta a la sincronización)* En el panel de Supabase: **Project Settings → General**, apunta la **Region**.

**Mándame:** la salida completa del paso 2 (busco `content-encoding` y `cache-control`) y, si lo hiciste, la región.

### 6.4 Una decisión
¿Apruebas la Fase 1, es decir, medir la restauración en una página nueva tras cerrar la que importó (umbral de 1 s intacto) e imprimir sin juzgar la primera recarga tras importar? **Respóndeme sí o no.** Si es no, la alternativa honesta es dejar esa comprobación en rojo como fallo conocido y documentado. No voy a subir el umbral.

## 7. Qué se descarta y por qué

- **Subir el umbral de 1 s:** pedido explícito de no hacerlo, y además no hace falta (§2).
- **Reducir escrituras de IndexedDB durante la importación** para acortar la primera recarga: guardar cada pista antes de leer sus metadatos es lo que permite retomar una importación cortada (`library.ts:379`). Quitarlo rompe una función a cambio de mejorar un caso raro.
- **Esqueletos de carga, `useDeferredValue` y quitar el layout forzado de `Marquee` (H7):** son 15 ms o menos en escritorio. Solo si la traza de móvil los señala.
- **WebP/AVIF, SSR/prerender, timeouts de Supabase y paginación:** razones en §5.
- **RUM continuo (p. ej. Vercel Speed Insights):** añade una dependencia, un ajuste en el panel de Vercel y una consideración de privacidad. Con una medición manual en móvil (§6.1) basta para decidir este plan. Se reconsidera si tú lo pides.
- **Redis, pool, balanceo, OpenTelemetry y streaming:** no hay servidor propio.

## 8. Fallos intermitentes medidos (2026-11-12, 10 pasadas cada uno, dev en este PC)

| Prueba | Tasa | Causa | Qué se hizo |
|---|---|---|---|
| `capturas.mjs`, menú Fondo | 4 de 10 | Del script: reabría ≡ durante los 140 ms de salida. El clic caía entre `dialog.close()` y el evento `close` (el `<dialog>` ya cerrado, React aún con `open=true`), así que `setOpen(true)` no hacía nada | Arreglado en el script (espera a que el `<dialog>` se desmonte): 10 de 10 en verde |
| `prueba-movil.mjs`, pulsación larga | 6 de 10 | De la app, o de la emulación táctil de Chromium: la hoja se abre a los 500 ms, pero al soltar llega un `click` cuyo destino es el propio `<dialog>` y `parts.tsx:63` lo cierra como si fuera un toque en el fondo. `SwipeRow` solo descarta el clic dentro de la fila. No depende de cuánto se mantenga el dedo (falla con 600, 700 y 1 000 ms) | Sin arreglar (la causa no está en el script). Falta comprobarlo en un móvil real |
| `prueba-biblioteca.mjs`, recarga tras importar | 1 de 10 > 1 s (3 322 ms; resto 391–494 ms) | §2: almacenamiento ocupado tras la importación | Ya solo informativa (Fase 1). La pestaña nueva: 10 de 10 < 1 s |
| `prueba-biblioteca.mjs`, scroll p95 (hallado de paso) | 1 de 10 (53 ms, umbral 50) | Sin investigar | Nada |

## 9. Lighthouse en producción local (línea base y seguimiento)

Script: `npm run build && node scripts/lighthouse.mjs [--pasadas 5] [--solo landing|app] [--etiqueta texto]`. Sirve `dist` con `vite preview`, abre Chrome instalado con perfil temporal vacío y sin extensiones, móvil simulado (Slow 4G, CPU ×4, valores por defecto de Lighthouse 13 vía `npx lighthouse@13`) y da la mediana de 5 pasadas. Los avisos de «JS sin minificar» no aparecen: sin extensiones no hay JS ajeno.

**Línea base** (2026-11-14, `desarrollo` en `768f40a`+2, Windows 11, Chrome 157, build con las variables de Supabase de `.env`):

| Página | Puntos | FCP ms | LCP ms (mediana) | LCP mín–máx | TBT ms | CLS | KB transferidos |
|---|---|---|---|---|---|---|---|
| landing | 91 | 754 | 3 440 | 754–3 531 | 11 | 0 | 564 |
| /app | 97 | 754 | 2 499 | 2 451–2 557 | 22 | 0 | 278 |

Ojo con la landing: es **bimodal**. En 2 de 5 pasadas el LCP fue 754 ms (100 puntos) porque el candidato fue `span.brand` (la cabecera), y en las otras 3 fue el `h1` a ~3 440–3 530 ms. Con 5 pasadas la mediana cae en el modo lento; si salen 3 del modo rápido, la mediana se desploma sin que nada haya mejorado. Por eso se mira también el mínimo–máximo. Sin extensiones el FCP baja de 1,7 s (tu medida) a 0,75 s; el LCP del `h1` sigue en 3,4 s.

### 9.1 Landing sin el reproductor (shell con carga diferida): medido y descartado

Probado y **no se conserva** (el parche queda fuera del repositorio): `Shell` (la app de `/app`) en su propio módulo, con `import()` precargado al acercarse, enfocar o pulsar «Abrir», y el arranque del reproductor (`initSession` y demás) dentro de ese módulo. La entrada bajó de 457,6 a 274 kB (150 → 90 kB gzip) y la landing de 564 a 500 KB transferidos.

| Variante | Landing LCP | /app LCP | Nota |
|---|---|---|---|
| Línea base | 3 440 (754–3 531) | 2 499 (2 451–2 557) | |
| Shell diferido, `import()` desde `main.tsx` | **3 306** (3 305–3 308), 92 puntos, TBT 0 | **2 598** (2 298–2 600) | /app +100 ms |
| + `import()` lo primero de la entrada | = | 2 601 | sin efecto |
| + SDK de Supabase pedido a la vez | = | 2 750 | peor: compite por el ancho de banda |
| `app.html` como entrada de `/app` (Shell estático y precargado) y CSS único | = | 2 707 | peor; FCP 754 con CSS único |

Causa: Lighthouse simula la carga con el gráfico de dependencias por iniciador, así que cualquier módulo pedido desde otro módulo (el `import()` del Shell, o los de `app.html` desde su mini-entrada) añade un viaje de ida y vuelta (~150 ms) a /app aunque el navegador los pida en paralelo; el LCP observado sin simulación no cambia (112 → 108 ms). El requisito era no empeorar /app, y con una sola `index.html` no hay forma de cumplirlo sin que la landing cargue también el reproductor. La ganancia en la landing (−134 ms) no compensa. Se retoma si se prerrenderiza la landing o si `/app` pasa a tener su propio HTML con el reproductor dentro de la entrada (no un mini-módulo que importe el resto); sin probar.

### 9.2 Imágenes de la landing en AVIF con srcset (punto 3)

`scripts/avif-landing.mjs` (ffmpeg con libaom) deriva de los JPG de `src/assets/landing/` un AVIF a 390 y 780 px (y 1440 en las de escritorio); cada imagen es un `<picture>` con `<source type="image/avif" srcset sizes>` y el JPG como respaldo, con `width`/`height` y los mismos `alt`. La captura de la primera pantalla lleva `fetchpriority="low"`. Los `sizes` salen de medir el ancho real de cada imagen en 390, 700, 900, 1 440 y 1 920 px; el diseño no cambia (mismas cajas, medido). La segunda captura de móvil usaba `img:last-child`; ahora es `picture:last-child`.

Peso por imagen: biblioteca-móvil 142 → 17 kB (390) / 49 kB (780); reproductor-escritorio 63 → 3 / 6 / 13 kB.

**Por qué el móvil descargaba `reproductor-escritorio-*.jpg`:** no era un error de selección. Es la imagen de la sección «Formato y calidad», que se muestra a una columna también en móvil (351 px de ancho), y no tenía versión pequeña: se servía el JPG de 1 440 px (63 kB). Chromium además carga las imágenes `loading="lazy"` que quedan dentro de unos 1 250 px del borde de la pantalla, y la landing entera cabe en esa distancia (Fase 3). Sigue haciendo falta en móvil; ahora pesa 3 kB.

| Landing | Puntos | FCP ms | LCP ms | LCP mín–máx | TBT ms | KB transferidos |
|---|---|---|---|---|---|---|
| Línea base | 91 | 754 | 3 440 | 754–3 531 | 11 | 564 |
| AVIF + srcset + fetchpriority | **100** | 754 | **754** | 753–755 | 8 | **297** (−47 %) |

Matices: (1) el LCP simulado ahora es `span.brand` en las 5 pasadas (en la línea base lo era en 2 de 5 y el resto era el `h1`); el salto a 100 puntos no es solo del `h1` más rápido, sino de que el candidato deja de ser el `h1` retrasado por los bytes de la imagen. (2) Con la CPU ×4 y 150 ms/1,6 Mbps aplicados de verdad (no simulados; Playwright + CDP), los candidatos de LCP son `span.brand` ~1,5 s y la captura del hero ~2,0 s, con y sin `fetchpriority="low"` (2 020–2 050 ms en ambos): el atributo no cambia el LCP real de la imagen, y el `h1` nunca es candidato. (3) El LCP real de la captura sigue en ~2 s; reducirlo más pasaría por una captura de primera pantalla más pequeña o por precargarla, y se descartó porque Lighthouse ya no lo penaliza.

### 9.3 Fuente Instrument Sans (punto 4): no se toca

Cadena: `index.html` → CSS (`@font-face` con `font-display: swap`, latin y latin-ext por `unicode-range`) → la fuente solo se pide cuando React pinta texto con ella (≈90 ms observados). Con `swap` el `h1` se pinta de inmediato con la fuente de respaldo, así que la fuente **no bloquea el primer pintado**. Aun así probé `<link rel="preload" as="font" crossorigin>` de la latin (Vite la deduplica con la del CSS: mismo archivo con hash, una sola descarga):

| | Landing LCP | /app LCP |
|---|---|---|
| Sin preload (tras 9.2 / línea base) | 754 (753–755) | 2 499 (2 451–2 557) |
| Con preload | 755 (754–755) | 2 557 (2 555–2 558) |

Sin mejora (la landing ya está en su suelo, que es el FCP; /app queda dentro del ruido de la línea base), así que se revirtió y no se tocó `font-display`.

### 9.4 Restauración con letras realistas (punto 5): medición de la Fase 4

`node scripts/medir-letras.mjs http://localhost:4173 5` contra `vite preview` (build de producción). Siembra 5 002 pistas con letra sincronizada de 0, 2 o 6 KB (JSON), con la CPU ×4 por CDP, en Chromium de Playwright y contexto nuevo por variante. `getAll`: en una pestaña nueva sin la app, la primera lectura y la mediana de las 5 siguientes. Arranque: pestaña nueva en `/app` hasta ver la primera fila de la biblioteca (`performance.now()`), mediana de 5.

| Letra por pista | getAll 1.ª (ms) | getAll mediana (ms) | Leído (MB) | Arranque mediana (ms) | Arranque mín–máx |
|---|---|---|---|---|---|
| 0 KB | 129 | 132 | 1,79 | 643 | 637–687 |
| 2 KB | 181 | 180 | 11,92 | 885 | 873–906 |
| 6 KB | 243 | 249 | 31,67 | **1 368** | 1 349–1 400 |

Regla: hacer la Fase 4 si el arranque con 6 KB pasa de 1 s con CPU ×4 o si `getAll` supera 300 ms. **Se cumple la primera** (1 368 ms; `getAll` 249 ms no la cumple). La referencia sin letras es coherente con la tuya: 22 ms de `getAll` a CPU ×1 son ~130 ms a ×4. Matiz: 6 KB de letra en las 5 002 pistas (31 MB) es un caso extremo; con 2 KB el arranque es 885 ms.

**Fase 4 hecha** (migración v3 en `platform/web/db.ts`, `hasLyrics` en la pista, `library.lyricsOf(id)` al abrir la ventana de letra; las letras de pistas sueltas, que no se guardan, viven en memoria en esta sesión). Mismas mediciones con el esquema nuevo:

| Letra por pista | getAll mediana (ms) | Leído (MB) | Arranque mediana (ms) | Arranque mín–máx |
|---|---|---|---|---|
| 0 KB | 132 | 1,87 | 629 | 620–632 |
| 2 KB | 131 | 1,87 | 663 | 647–672 |
| 6 KB | 131 | 1,87 | **640** (antes 1 368) | 620–648 |

Pruebas: `db.test.ts` (v2 → v3 mueve las letras, marca `hasLyrics`, deja intactas las pistas sin letra), y `prueba-biblioteca.mjs` (letra .lrc que sigue la posición, USLT y SYLT) en verde. Migración en Chromium real (no solo `fake-indexeddb`): base v2 con 5 002 pistas y letras de 6 KB dentro de cada pista, abierta con la app nueva en `/app`: pasa a v3, las 5 002 letras quedan en `lyrics`, ninguna pista conserva `lyrics`, 5 002 con `hasLyrics`, sin errores; la biblioteca se ve a los 3,0 s (única vez, sin CPU limitada). **Límites:** no se probó una migración interrumpida a medias; si fallara, `openDB` rechaza, la app funciona sin persistencia esa sesión y los datos antiguos siguen intactos (la transacción de actualización se aborta entera).
