# Decisiones y acciones pendientes del usuario

Lo que el desarrollo no puede resolver solo. Cada entrada: qué, por qué bloquea, opciones y recomendación.

## Abiertas

### D1 — Skills de diseño no instaladas
- **Qué:** no existen en este equipo `frontend-design` ni una referencia `awesome-claude-design`.
- **Bloquea:** nada. Se aplican sus principios con las instaladas (impeccable, apple-design, design-taste-frontend, ui-ux-pro-max, design-motion-principles, anti-slop, ponytail).
- **Recomendación:** instalarlas solo si se quiere esa lente adicional.

### D2 — Cambio local sin commitear en `src/assets/music/README.md`
- **Qué:** el archivo de trabajo tiene un texto antiguo ("Vite los incorpora automáticamente al compilar") distinto del versionado. No lo hizo el desarrollo y no se ha tocado.
- **Recomendación:** descartarlo con `git restore src/assets/music/README.md`.

### D3 — Prototipo de audio en segundo plano (Android)
- **Qué:** elegir cómo suena la app con la pantalla apagada: (a) audio del WebView + servicio en primer plano que mantiene vivo el proceso, o (b) reproducción nativa con Media3 mediante plugin.
- **Bloquea:** la implementación nativa de `AudioSession` (Fase 11). No bloquea la web.
- **Opciones:** (a) conserva ecualizador y analizador de Web Audio, fiabilidad por comprobar; (b) fiable, pero el EQ habría que rehacerlo en nativo.
- **Recomendación:** probar (a) primero en un dispositivo real. Requiere Android Studio instalado.

### D13 — Modo «Visualizador» (butterchurn) no incluido
- **Qué:** butterchurn (MIT) compila las ecuaciones de cada preset con `new Function`, lo que exige `'unsafe-eval'` en `script-src`. La CSP actual es `script-src 'self'` y relajarla para toda la app debilita la defensa contra XSS. Además `butterchurn-presets` pesa ≈ 11,9 MB y la atribución de cada preset (obras de la comunidad Milkdrop) no está verificada preset a preset.
- **Bloquea:** nada. El selector de fondo ofrece Portada, Ritmo, Estático y AMOLED.
- **Opciones:** (a) permitir `'unsafe-eval'` (no recomendado); (b) página aislada en un `<iframe sandbox>` con su propia CSP (el `AnalyserNode` no cruza iframes: habría que enviar el espectro por `postMessage`); (c) un visualizador propio (barras o forma de onda) en WebGL leyendo el mismo analizador, sin dependencias ni eval.
- **Recomendación:** (c) si se quiere un modo «Visualizador»; y revisar la licencia de cada preset antes de curar ~30 para (b).

### D14 — Cosas que solo se comprueban en un dispositivo real
- Escuchar el ecualizador, el balance, la velocidad y el fundido al pausar (se midieron en el grafo de audio, no a oído).
- Arrastrar la hoja del menú con un dedo y ver el fondo animado en un móvil de gama media (las pruebas usaron ratón y Chromium sin GPU real).
- Con batería baja y con ahorro de datos (solo Chromium expone esas APIs).

### D15 — Menú sin pista cargada
- **Qué:** el menú ≡ vive en el mini reproductor y en el expandido, que no existen sin pista. Sin música cargada no se pueden tocar los ajustes de sonido ni de fondo.
- **Opción:** añadir una entrada desde la navegación o los ajustes de la app cuando la biblioteca persista (Fase 3). No se hizo porque lo pedido era sacar esas opciones del flujo principal.
- **Actualización 2026-11-11:** la biblioteca ya persiste y, tras recargar, la última pista vuelve sola, así que el menú está disponible casi siempre. Los ajustes también se pueden mover con la copia de seguridad (Biblioteca → Carpetas y copia de seguridad). La entrada propia queda para «Ajustes completos» de la Fase 5.

### D16 — Safari real: copia en OPFS y reproducción sin verificar (Fase 3)
- **Qué:** en Firefox la ruta `webkitdirectory` → OPFS → recarga → reproducir pasó entera. En WebKit solo se pudo probar la degradación: el WebKit de Playwright para Windows no trae OPFS (ni en contexto persistente) ni reproduce medios (ni un `new Audio()` suelto avanza). Ahí la app avisa «sonará hasta que recargues» y carga la pista desde memoria, pero no se oyó.
- **Bloquea:** nada en Chromium/Firefox. En Safari, la biblioteca podría no persistir si su OPFS falla igual (la app lo trata como «solo esta sesión», no se rompe).
- **Cómo cerrarlo:** en un Mac/iPhone con Safari 17+: añadir una carpeta, recargar, reproducir. Si `createWritable` no existiera, el código usa un worker con `createSyncAccessHandle` (`platform/web/opfsCopy.worker.ts`), que tampoco se ha podido ejecutar aquí.

### D17 — Sincronización de playlists contra Supabase sin probar de extremo a extremo
- **Qué:** las playlists ya son locales primero con outbox (`state/playlists.ts`, `sync/playlistSync.ts`); la lógica pura (compactar, fusionar, fallos permanentes) tiene tests y la parte local se probó en navegador sin cuenta y sin red. **No** se ejecutó contra el proyecto de Supabase: hacerlo exige una cuenta de prueba en un proyecto compartido con otra app.
- **No requiere migración:** usa `playlists` (upsert por `id` generado en el dispositivo, permitido por las políticas `insert`/`update` existentes), el RPC `replace_playlist_tracks` y `delete`.
- **Riesgo:** al iniciar sesión, las playlists creadas sin cuenta pasan a esa cuenta (se suben). Si se prefiere preguntar antes, es un cambio pequeño en `adoptOwnerless`.
- **Cómo cerrarlo:** con una cuenta de prueba: crear/renombrar/borrar sin red, volver a conectar y comprobar en el panel de Supabase; repetir en dos dispositivos.

### D18 — Recargar la página sin red
- **Qué:** sin red todo lo local funciona mientras la página está abierta (probado: reproducir y crear playlists con la red cortada). **Recargar** sin red necesita el service worker de la Fase 6 (app shell offline); hoy el navegador no tiene de dónde sacar el HTML/JS.

## Manual del usuario (paneles y cuentas)

### D4 — Borrar los dos deployments antiguos de Vercel que llevaban música
- **Qué:** `music-reproductor-hx3945vym-evexine.vercel.app` y `music-reproductor-5xt592y0s-evexine.vercel.app` siguen sirviendo las pistas con copyright.
- **Por qué:** es lo único que queda abierto del hallazgo S1.
- **Cómo:** Vercel → proyecto `music-reproductor` → Deployments → menú `⋯` de cada uno → Delete. Después comprobar que una URL antigua de `/assets/*.flac` devuelve 404.

### D5 — Activar Vercel Authentication en deployments no productivos
- **Cómo:** Settings → Deployment Protection → Vercel Authentication → "Standard Protection". Así los previews de `desarrollo` no son públicos.

### D6 — Conectar Git en Vercel
- **Cómo:** Settings → Git → conectar `TruEvexine/Music_Reproductor`. `main` = producción, el resto previews. Evita desplegar desde una carpeta local (origen de S11).

### D7 — Copiar las variables a Preview
- **Cómo:** Settings → Environment Variables → `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` también en *Preview*. Sin esto los previews funcionan en local-only (sin cuenta).

### D8 — Renombrar el proyecto de Supabase
- **Qué:** se llama `Undefeated_Star_Web_Page` y aloja varias apps. Dashboard → Settings → General. Solo cosmético.

### D9 — Endurecer Auth en Supabase (S7)
- Protección de contraseñas filtradas (**requiere plan Pro**), longitud mínima ≥ 10, CAPTCHA (Turnstile), SMTP propio antes de abrir registros, *Redirect URLs* solo con dominios propios y `http://localhost:5173/**`.

### D10 — Revisar `math_record_attempt` y `rls_auto_enable`
- **Qué:** objetos de la otra app que comparte el proyecto; los advisors de Supabase los señalan. **El reproductor no los toca.** Revisarlos desde ese otro proyecto.

### D11 — Correo de autor en commits (opcional, S10)
- Los commits usan el correo institucional. Si se prefiere ocultarlo: GitHub → Settings → Emails → "Keep my email addresses private" y `git config user.email <id>+<usuario>@users.noreply.github.com`.

### D12 — Activar los hooks en cada clon nuevo
- En esta copia ya están activos. En cualquier otro clon: `npm run setup`.
