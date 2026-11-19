# PLAN.md — Plan maestro del reproductor

> **Última actualización:** 2026-11-11 · **Estado:** MVP web funcionando (Vite + React 19 + TS, Supabase compartido, hosting en Vercel). **Fases 0, 1, 2 y 3 completas; siguiente: Fase 4 (diseño Poweramp + Qobuz).** Adelantos de la Fase 4 ya hechos: menú ≡ del reproductor y fondo reactivo.
> **Rama de trabajo:** `desarrollo` (nunca `main`). Pendientes del usuario: `DECISIONES_PENDIENTES.md`. Auditoría de diseño: `docs/AUDITORIA_DISENO.md`. Arquitectura de apps: `docs/ARQUITECTURA_APP.md`.
> **Este documento manda.** Si contradice a `DESIGN.md`, `AGENTS.md`, `SUPABASE.md` o al README, gana este archivo hasta que esos documentos se actualicen (tarea de la Fase 1).
> **Antes de escribir código:** leer `SECURITY_AUDIT.md` y completar la **Fase 0**. Es bloqueante.

---

## 1. Visión

Un reproductor de música **local-first** en el navegador que **reproduce como Poweramp y se presenta como Qobuz**: rápido, denso en información útil, controles al alcance del pulgar, un fondo vivo que responde a la portada o al ritmo, y audio cuidado (FLAC, ReplayGain, ecualizador, crossfade). Primero web/PWA; después app (Android primero).

**Dos referencias, cada una con su terreno:**

- **Poweramp → la experiencia de reproducción:** reproductor expandido, controles al alcance del pulgar, gestos, información técnica del audio (formato, bitrate, sample rate), ecualizador y personalización profunda.
- **Qobuz → la presentación de la música:** jerarquía editorial, portadas grandes como protagonistas, vistas de álbum y artista con sensación de catálogo premium, tipografía cuidada, calidad de audio comunicada con elegancia (insignias Hi-Res).

No es copia literal de ninguna: tomamos principios, no assets ni layouts pixel a pixel.

### Principios (en orden de prioridad)

1. **La música del usuario es suya y es local.** La app funciona completa sin cuenta y sin red. La nube es opcional y de pago.
2. **Respuesta inmediata.** Nada bloquea la reproducción: metadatos, portadas y escaneos van en segundo plano (Web Workers) y se muestran de forma progresiva.
3. **Pulgar primero.** En móvil, todo control frecuente queda en la mitad inferior; gestos para lo demás.
4. **El usuario decide.** Fondo (portada / ritmo / estático), intensidad de animación, densidad de la lista, formato de tiempo: todo configurable y persistente.
5. **Accesible y con movimiento reducido** cuando el sistema lo pide.
6. **Sin sobreingeniería.** Cada fase entrega algo usable. Nada de abstracciones que no tengan un segundo uso real.

---

## 2. Estado actual (snapshot 2026-10-14)

### Ya funciona

- Biblioteca: importación de archivos (las pistas de prueba ya no se versionan; `src/assets/music/` se ignora en git y solo se usa localmente) (MP3, WAV, FLAC, M4A) con selector; deduplicación por nombre/tamaño/fecha.
- Metadatos con `music-metadata` (carga diferida): título, artista, álbum, artista del álbum, nº de pista, año, género, duración, bitrate, sample rate, portada embebida (límite 12 MB), fallbacks.
- Reproducción: play/pausa, anterior/siguiente, seek, repetición (off / cola / pista), auto-avance.
- Cola: agregar sin reproducir, reordenar (botones arriba/abajo), quitar, vaciar; drawer lateral.
- Playlists sincronizadas en Supabase (crear, renombrar, borrar, ordenar), con RLS correcto y RPC atómico `replace_playlist_tracks`.
- Auth email/contraseña (registro, login, logout, sesión persistente).
- Tinte de fondo derivado de la portada (`useCoverPalette`: promedio de píxeles saturados, un solo color).
- Responsive básico: 2 breakpoints (1000 px, 700 px) y `prefers-reduced-motion`.
- Build de producción OK (`npm run build`, bundle principal ~142 KB gzip).

### Falta o está incompleto

| Área | Falta |
|------|-------|
| Audio | Volumen y mute, shuffle, crossfade, gapless, ReplayGain, ecualizador, temporizador de apagado, velocidad |
| Sistema | Media Session (controles en pantalla de bloqueo/auriculares), atajos de teclado, persistencia de sesión (última pista, posición, cola, ajustes) |
| Biblioteca | ~~Carpetas, re-escaneo, caché persistente, vistas, orden, virtualización, OGG/Opus~~ → hecho en la Fase 3. Falta: re-escaneo automático en segundo plano con la pestaña cerrada (imposible en web), colecciones por artista del álbum con alias |
| Diseño | Gradientes multicolor animados, modo ritmo, selector de fondo, reproductor expandido estilo Poweramp, gestos táctiles, drag & drop en cola, skeletons |
| Producto | Landing/SEO, PWA, perfiles (avatar, ajustes sincronizados), nube de música, monetización, términos/privacidad |
| Código | Reestructurado en la Fase 1 (ver abajo). Falta virtualización y workers |
| Infra | Proyecto de Supabase compartido (aceptado); acciones manuales en paneles de Vercel/Supabase (`DECISIONES_PENDIENTES.md`) |

### Hecho en la Fase 3 (2026-11-11)

- La biblioteca persiste: pistas, raíces, portadas, playlists y outbox en IndexedDB (migración v2). Los archivos se leen de la carpeta recordada (handle de File System Access), de una copia privada en OPFS o, si no se puede copiar, de memoria durante la sesión con aviso.
- Metadatos, `track:v2` y miniaturas (96 y 600 px) en un pool de workers con tiempo máximo; portadas deduplicadas por hash.
- Vistas Canciones, Álbumes, Artistas, Carpetas, Géneros y Recientes con orden, búsqueda sin acentos por palabras y listas virtualizadas.
- Playlists locales primero (sin cuenta y sin red) con outbox hacia Supabase; copia de seguridad en JSON; letras USLT/SYLT/.lrc.

### Hecho en la Fase 0 (2026-11-10)

- Seguridad del repo en capas: `.gitignore` completo, hooks en `.githooks/` (`npm run setup`), CI con gitleaks y `npm audit`, Dependabot, guardia de build (`scripts/envGuard.ts`) que falla con secretos en `VITE_*` o con audio en el bundle.
- `vercel.json` con CSP y cabeceras, verificadas con `node scripts/verificar-csp.mjs`.
- El catálogo demo de `src/assets/music/` solo existe en desarrollo: producción arranca vacía.
- Primer código en `src/core/` (`coverMime`, `authMessages`) con Vitest (`npm test`). Errores de Auth genéricos y límite de intentos.
- Herramientas de prueba: `npm run test:audio` (audio sintético con ffmpeg opcional), `node scripts/capturas.mjs [carpeta]` (capturas Playwright).
- **Capturas: carpeta temporal por defecto.** `capturas.mjs`, `prueba-menu.mjs`, `prueba-fondo.mjs`, `prueba-hdr.mjs` y `medir-portada.mjs` escriben en una carpeta temporal del sistema (la ruta se imprime) si no se les pasa carpeta. `docs/capturas` solo se regenera con `--actualizar` (p. ej. `node scripts/capturas.mjs --actualizar`); pasar esa ruta a mano sin la bandera falla. Lógica en `scripts/salida.mjs`.

---

## 3. Decisiones de arquitectura

### 3.1 Frontend

- Se mantiene **Vite + React 19 + TypeScript**. No migrar de framework.
- **Motor de audio fuera de React:** una clase `PlayerEngine` (TS puro) dueña de los `<audio>` y del grafo Web Audio. React lo observa a través de un store pequeño (**Zustand**) — la UI nunca toca `HTMLAudioElement` directamente.
- **Workers:** pool de 2–4 Web Workers para leer metadatos, calcular hashes y generar miniaturas/paletas (`OffscreenCanvas`). El hilo principal solo pinta.
- **Persistencia local:** IndexedDB (librería `idb`, ~1 KB) para biblioteca, portadas, handles de carpetas y estado de sesión; `localStorage` solo para ajustes de UI triviales.
- **Router:** propio (`src/ui/router.ts`, ~50 líneas, sin dependencia). Decisión 2026-11-10: con tres rutas y paneles en `?panel=` no compensa `react-router`; revisar si las vistas de álbum/artista de la Fase 3 lo complican. Revisado 2026-11-11: las vistas usan `/app/<vista>/<grupo>` con el mismo router; sigue sin compensar.
- **Listas largas:** `@tanstack/react-virtual`.

### 3.2 Música local y FLAC (núcleo del producto)

El navegador no puede vigilar una carpeta del disco. La estrategia por navegador:

| Navegador | Cómo se agrega música | Persistencia entre sesiones |
|-----------|----------------------|-----------------------------|
| Chrome / Edge / Opera (escritorio y Android) | **File System Access API** → `showDirectoryPicker()` | Se guarda el `FileSystemDirectoryHandle` en IndexedDB; al volver se pide permiso con un toque y se re-escanea por diferencias |
| Firefox / Safari | `<input webkitdirectory>` + arrastrar carpetas (`webkitGetAsEntry`) | Opción "Guardar en el dispositivo": copia a **OPFS** (Origin Private File System) con aviso de espacio (`navigator.storage.estimate()`) y `navigator.storage.persist()` |
| App nativa (Fase 11) | Acceso al almacenamiento del sistema | Total |

- **Re-escaneo por diferencias:** comparar `ruta relativa + tamaño + lastModified` contra la caché; solo se leen metadatos de lo nuevo o cambiado. Botón "Buscar cambios" y re-escaneo automático al recuperar foco de la pestaña (con *throttle*).
- **Identidad de pista (`track:v2`):** SHA-256 de `tamaño + primer MB + último MB` calculado en worker. Sirve para deduplicar, enlazar playlists y emparejar con la nube. Se conserva `track:v1` (título|artista|álbum|duración, el actual) como **respaldo de coincidencia** entre dispositivos y para no romper playlists existentes.
- **Formatos:** MP3, FLAC (incluido 24-bit/96 kHz+), WAV, M4A/AAC, OGG/Opus; ALAC solo donde `canPlayType` lo confirme. Probar `audio.canPlayType()` al importar y marcar las pistas no reproducibles en vez de fallar al darles play.
- **Insignia de calidad:** "FLAC 24/96", "MP3 320" en fila y reproductor (dato ya disponible del lector de metadatos).
- **Portadas:** se deduplican por hash y se guardan como `Blob` en IndexedDB en dos tamaños (96 px para listas, 600 px para el reproductor) generados en worker. Fallback: gradiente generado del hash de álbum, nunca un gris plano. Soportar también `cover.jpg`/`folder.jpg` en la carpeta. Hecho: también `front`/`album` en JPG, PNG o WebP.

**Decisiones de implementación (Fase 3, 2026-11-11):**

- **Frontera `LocalLibrary`** (`src/platform/types.ts`, web en `platform/web/library.ts`): elegir carpeta, archivos arrastrados, permiso (consultar/pedir), recorrer, leer, copiar a OPFS, olvidar, espacio y `canPlayType`. La persistencia de pistas/portadas/playlists es la misma IndexedDB en web y en el WebView nativo, así que vive en `Storage` (tablas `tracks`, `roots`, `covers`, `playlists`, `outbox`).
- **Tres clases de raíz:** `folder` (handle guardado, se re-escanea), `copy` (OPFS en `biblioteca/<id>/…`, para todo lo que llega sin handle: `<input webkitdirectory>`, archivos sueltos y arrastre sin handles) y `session` (no se pudo copiar: cuota llena u OPFS deshabilitado; suena hasta recargar y se avisa). La copia es automática si cabe (`estimate()` con 5 % de margen) y pide `storage.persist()`. Los archivos sueltos van todos a la raíz «Archivos importados».
- **Id de pista** = `<raíz>:<ruta>`: estable entre sesiones, así la cola y la posición guardadas se restauran sin volver a leer nada. Las playlists siguen guardando `track:v1` (compatibles con las de la nube); `track:v2` se calcula siempre y también se reconoce al resolver una playlist.
- **Restaurar no lee archivos:** al recargar se pinta la biblioteca guardada y la sesión; el archivo de la pista se lee al pulsar reproducir (con ese gesto se puede pedir el permiso de la carpeta). Si el permiso está pendiente, la pista no se marca como rota: se avisa y se ofrece «Reconectar».
- **Re-escaneo:** botón «Buscar cambios» y al volver a la pestaña si pasó más de 1 minuto (solo carpetas con permiso). Lo nuevo aparece en cuanto se encuentra; los metadatos se leen al terminar el recorrido (para tener ya las portadas de carpeta y los `.lrc`); al final se quita lo que desapareció. Cancelar no borra nada; lo que quedó sin leer se retoma al recargar.
- **Workers:** uno por trabajo a la vez, entre 1 y 4 según `hardwareConcurrency / 2`, 20 s máximo por archivo (se termina el worker y se crea otro). Miniaturas JPEG con `OffscreenCanvas` (recorte cuadrado centrado); si no hay `OffscreenCanvas` se guarda la imagen original. Hash de portada: SHA-256 truncado a 128 bits.
- **URLs `blob:`**: las de audio se crean al reproducir y solo se conservan las 4 últimas; las de portada tienen conteo de uso y se revocan cuando sobran más de 120 sin usar.


### 3.3 Motor de audio (Web Audio)

```text
<audio A> ─┐                                       ┌─> AnalyserNode (fondo modo ritmo, visualizador)
           ├─> gain crossfade ─> ReplayGain ─> preamp ─> EQ 10 bandas ─> graves/agudos ─> balance ─> limitador ─> salida
<audio B> ─┘
```

- **Dos `<audio>`** alternados para crossfade (0–12 s) y para precargar la siguiente pista (gapless *aproximado*). Gapless exacto con `decodeAudioData` se descarta para FLAC largos por memoria; documentarlo.
- **ReplayGain** (pista/álbum) leído de tags; si no hay, desactivado.
- **EQ:** 10 `BiquadFilterNode` *peaking* (31 Hz–16 kHz) + preamp + *shelving* de graves/agudos + `StereoPannerNode` + `DynamicsCompressorNode` como limitador anti-clipping. Presets y presets de usuario.
- **Cuidado:** al pasar el audio por Web Audio, el audio de la nube necesita CORS (`crossorigin="anonymous"` + cabeceras en el bucket) o el analizador devuelve silencio. iOS Safari: crear/reanudar el `AudioContext` solo tras gesto del usuario; probar reproducción en segundo plano.
- **Media Session API:** título, artista, álbum, portada, posición; acciones play/pause/prev/next/seekto/seekbackward/seekforward.
- **Temporizador de apagado** (minutos o "al terminar la pista") con fade-out.
- **Persistencia de sesión:** última pista, posición (cada 5 s y en `pagehide`), cola, modo de repetición, shuffle, volumen, EQ.

### 3.4 Backend: migración de Supabase

Hoy el reproductor vive dentro del proyecto `Undefeated_Star_Web_Page` (plan gratuito, compartido con otro sitio). Hay que sacarlo de ahí.

**Recomendación: proyecto de Supabase dedicado en plan Pro + Cloudflare R2 para los archivos de audio.**

| Opción | A favor | En contra |
|--------|---------|-----------|
| **A. Supabase Pro dedicado + R2 (recomendada)** | Reusa Auth, RLS y migraciones ya escritas; Edge Functions para firmar URLs y webhooks de pago; R2 no cobra egress (clave para streaming de FLAC) | Dos proveedores; ~US$25/mes de base |
| B. Supabase Pro con Storage de Supabase | Un solo proveedor | El egress se cobra por GB: transmitir FLAC (30–60 MB por pista) se vuelve caro rápido |
| C. Self-host en Railway (Postgres + auth propia o PocketBase) | Costo bajo al inicio, control total | Hay que mantener auth, backups, seguridad y escalado; reescribir lo que hoy da Supabase |

> **Precios a verificar antes de contratar** (referencia de mediados de 2026): Supabase Pro ≈ US$25/mes por organización con 8 GB de BD, 100 GB de storage, 250 GB de egress y 100 k MAU incluidos; R2 ≈ US$0.015/GB-mes, egress gratis, 10 GB gratis. Confirmar en supabase.com/pricing y developers.cloudflare.com/r2/pricing.

**Pasos de migración:**
1. Crear organización/proyecto nuevo (`music-player-prod`) en la región más cercana a los usuarios (us-east-1 o us-west para México). Activar plan Pro.
2. `supabase link` al nuevo proyecto y `supabase db push` con las migraciones existentes + la de límites (S6 de la auditoría).
3. Usuarios: si son pocos, pedir re-registro. Si importan, migrar el esquema `auth` con `pg_dump`/`pg_restore` (conserva hashes bcrypt) siguiendo la guía oficial de migración entre proyectos.
4. Exportar/importar `profiles`, `playlists`, `playlist_tracks`.
5. Configurar Auth: Site URL y Redirect URLs del dominio final, SMTP propio (Resend/Postmark), Turnstile, contraseñas filtradas, plantillas de correo en español.
6. Cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Vercel (Production y Preview) y redeploy.
7. Verificar, y luego quitar las tablas del reproductor del proyecto viejo (sin tocar lo del otro sitio).

**Esquema nuevo (además de lo actual):**

```text
profiles            + username (único), avatar_path, plan, settings jsonb, updated_at
user_settings       (si settings crece) EQ, fondo, preferencias sincronizables
tracks              id, user_id, content_hash, track_v1_id, title, artist, album, album_artist,
                    track_no, year, genre, duration, codec, bitrate, sample_rate, bit_depth,
                    cover_hash, storage_key (nullable: solo si está en la nube), size_bytes, created_at
                    unique(user_id, content_hash)
play_history        user_id, track_id, played_at, completed (para estadísticas y "recientes")
favorites           user_id, track_id
entitlements        user_id, product, status, source (stripe|mercadopago|play), current_period_end
storage_usage       vista: suma de size_bytes por user_id
```

RLS por dueño en todas. `entitlements` y `storage_usage` solo lectura para el usuario; escritura solo desde Edge Functions con `service_role` (que **nunca** sale del servidor).

### 3.5 Nube de música (de pago)

- Subida directa del navegador a R2 con **URL prefirmada PUT** que emite una Edge Function tras validar sesión, plan, cuota restante, tipo y tamaño (máx. 2 GB por archivo).
- Clave del objeto: `users/<user_id>/<content_hash>.<ext>` → deduplicación natural; si el hash ya existe para ese usuario, no se sube de nuevo.
- Reproducción con **URL firmada GET** de vida corta (≈1 h). Bucket privado, sin listados públicos, CORS solo para el dominio de la app.
- Subidas reanudables (multipart) para FLAC grandes; cola de subida visible con progreso y pausa.
- Descarga para escuchar sin conexión → OPFS.
- **Legal:** solo biblioteca privada del propio usuario (sin compartir archivos con otros), términos que exijan derechos sobre lo subido, procedimiento de retiro (aviso y baja). Eso reduce mucho el riesgo frente a un servicio de "compartir música".

### 3.6 Hosting

- **Vercel** (decisión 2026-11-10; sustituye a Railway). Proyecto `music-reproductor` (equipo evexine), framework Vite, build `npm run build`, salida `dist`. `main` = producción; las demás ramas generan previews.
- Cabeceras de seguridad y caché en `vercel.json`. Sin Dockerfile ni Caddy. Los `rewrites` para el fallback SPA se añaden cuando exista el router (Fase 1).
- Las Edge Functions de Supabase cubren el backend previsto: no hace falta un API propio.

### 3.7 Arquitectura multiplataforma y offline-first

Una base de código, tres destinos: la web responsive es la base y **Capacitor** la empaqueta para Android (primero) y iPhone. Registro de decisión completo en `docs/ARQUITECTURA_APP.md`.

```text
src/core/             lógica sin DOM ni APIs de plataforma: motor de cola, shuffle, identidad de pista,
                      escaneo por diferencias, outbox de sincronización, paleta, ecualizador como datos.
                      TypeScript puro, testeable en Node. Nada de window, document ni Capacitor.
src/platform/web/     implementación web de las fronteras (la única que existe hoy)
src/platform/native/  implementación nativa: se documenta en docs/ y se escribe cuando exista Android Studio
src/ui/               componentes compartidos
```

- **Fronteras de plataforma** (una interfaz cada una, nada más): `LocalLibrary` (elegir carpeta, escanear, leer archivo, persistir permisos), `AudioSession` (audio en segundo plano, controles de notificación y pantalla de bloqueo), `SecureStore` (tokens), `Storage`, `Connectivity`.
- **Variantes por plataforma:** atributo `data-platform="web|android|ios"` en `<html>` y CSS/props. No se bifurcan componentes enteros.
- **Build:** `VITE_TARGET=web|android|ios`. En nativo: `base: './'`, router con hash, CSP por `<meta>` (no hay cabeceras de Vercel), sin dominios absolutos.
- **Regla de reutilización por pantalla** (se documenta en `DESIGN.md` y se aplica en la Fase 4): una pantalla web se reutiliza en la app si tiene áreas táctiles ≥ 44 px, safe areas y borde a borde correctos, respeta el botón/gesto atrás del sistema, no depende de hover, mantiene 60 fps en gama media y se ve nativa a 360×800. Si falla y no se arregla con ajustes menores, se diseña una variante para Android en `docs/DISENO_ANDROID.md`; lo que difiera en iPhone va en `docs/DISENO_IOS.md`.
- **Offline-first real:** todo el estado del usuario (biblioteca, playlists, ajustes, cola, sesión) se escribe primero en **IndexedDB** y funciona sin red. Supabase es sincronización opcional mediante un **outbox** de operaciones pendientes en IndexedDB que se reintenta al volver la conexión (última escritura gana, con timestamp). La UI nunca espera a la red y muestra el estado de conexión y de sincronización.
- **Esquema local versionado con migraciones:** la app instalada se actualiza sobre datos existentes del usuario.
- **Exportar/importar** playlists y ajustes a un archivo JSON.
- **Proyectos nativos:** no se ejecuta `npx cap add android|ios` ni se versiona `android/` o `ios/` hasta que el usuario confirme Android Studio / Xcode.

---

## 4. Diseño (Poweramp en el reproductor, Qobuz en la biblioteca)

### 4.1 Estructura de pantallas

```text
MÓVIL                          ESCRITORIO (≥1000 px)
┌───────────────────┐          ┌──────────┬──────────────────────┬──────────┐
│ Búsqueda · ⚙       │          │ Nav      │ Biblioteca           │ Cola     │
│ Tabs: Canciones    │          │ Canciones│ (lista/grid          │ (panel   │
│ Álbumes Artistas   │          │ Álbumes  │  virtualizada)       │  fijo o  │
│ Carpetas Playlists │          │ Artistas │                      │  oculto) │
│                    │          │ Carpetas │                      │          │
│ lista virtualizada │          │ Playlists│                      │          │
│                    │          ├──────────┴──────────────────────┴──────────┤
├───────────────────┤          │ Mini player: portada · info · controles ·   │
│ Mini player ▲      │          │ seekbar · volumen · cola · expandir          │
└───────────────────┘          └─────────────────────────────────────────────┘

REPRODUCTOR EXPANDIDO (todas las resoluciones, pantalla completa)
┌───────────────────┐
│ ⌄            ⋯     │  ← deslizar abajo para cerrar
│                    │
│    [ PORTADA ]     │  ← deslizar ← → para cambiar pista
│                    │
│ Título             │
│ Artista · Álbum    │
│ FLAC 24/96 · ♥     │
│ ━━━━━━●━━━━━━━━━━  │  ← seekbar grande (onda opcional)
│ 1:42        -2:35  │  ← tocar el tiempo alterna restante/total
│  🔀  ⏮  ⏯  ⏭  🔁   │
│ EQ · Letra · Cola  │  ← fila de herramientas (zona del pulgar)
└───────────────────┘
```

Breakpoints: `<600` móvil, `600–999` tablet (expandido a dos columnas en horizontal: portada | controles+cola), `≥1000` escritorio, `≥1440` panel de cola fijo. Cuidar `env(safe-area-inset-*)` y altura dinámica `100dvh`.

### 4.2 Fondo dinámico — el usuario elige

Ajuste **Fondo**: `Portada` (predeterminado) · `Ritmo` · `Estático` · `Negro (AMOLED)`. Ajuste **Intensidad**: baja/media/alta. Con `prefers-reduced-motion` o "ahorro de energía", las animaciones se vuelven transiciones de color sin movimiento.

**Modo Portada**
1. En worker: portada a 64×64 en `OffscreenCanvas` → paleta de 5 colores por cuantización (k-means o *median cut*) ponderada por saturación y área.
2. Corrección en **OKLCH**: limitar luminosidad (L 0.25–0.45 para fondo oscuro), recortar croma, rotar tonos muy cercanos para dar variedad; calcular color de acento con contraste ≥ 4.5:1 contra el texto.
3. Render: *mesh gradient* de 3–4 manchas radiales difuminadas que se desplazan lento (ciclo 20–40 s). Implementación preferida: CSS con `@property` animando variables (barato); si no alcanza en calidad, un `<canvas>` WebGL con shader de ruido a resolución reducida.
4. Transición entre canciones interpolando en OKLCH durante 700–900 ms.
5. Caché de paleta por `cover_hash` en IndexedDB.

**Modo Ritmo**
1. `AnalyserNode` (FFT 2048) del grafo de audio → energía por bandas: graves (20–150 Hz), medios, agudos.
2. Detección de golpes por flujo espectral en graves con umbral adaptativo (media móvil + k·desviación).
3. Mapeo: graves → escala/brillo de las manchas; golpe → pulso corto (120 ms); agudos → velocidad de deriva. Los colores siguen saliendo de la portada.
4. Presupuesto: ≤ 2 ms por frame, `requestAnimationFrame`, se detiene con la pestaña oculta o el reproductor colapsado (en mini player solo un tinte sutil).

**Estático:** gradiente fijo de dos colores de la paleta. **AMOLED:** negro puro con acento de la portada.

### 4.3 Sistema visual

- Tema oscuro por defecto (claro opcional después). Tokens en `:root` (color, espacio 4/8, radios, sombras, duraciones, curvas).
- Tipografía: una sans con números tabulares para controles y tiempos (p. ej. Inter / Manrope) y, al estilo Qobuz, una serif o display elegante opcional para títulos de álbum/artista en vistas editoriales.
- Iconos: Lucide (`lucide-react`).
- Áreas táctiles ≥ 44×44 px. Estados hover/pressed/focus visibles y que no dependan solo del color.
- **`DESIGN.md` se reescribe en la Fase 1** con esta dirección (Poweramp para reproductor, controles y gestos; Qobuz para biblioteca, vistas de álbum/artista y presentación editorial).

### 4.4 Skeletons y estados de carga

| Lugar | Skeleton | Regla |
|-------|----------|-------|
| Fila de canción | cuadro 48 px + 2 líneas (60 % / 40 %) + duración | La fila aparece **ya** con el nombre de archivo; los metadatos rellenan después (carga progresiva, no bloquear) |
| Grid de álbum | cuadro 1:1 + 2 líneas | Portada con *fade-in* 200 ms al cargar |
| Mini player | portada + 2 líneas | Solo en el primer arranque mientras se restaura la sesión |
| Reproductor expandido | portada grande con el gradiente del hash | Nunca gris plano |
| Playlists / perfil (red) | filas genéricas | Mostrar skeleton solo si tarda > 200 ms y mantenerlo ≥ 300 ms (sin parpadeos) |
| Escaneo de carpeta | barra de progreso "Analizando 132/840" + la lista va creciendo | Cancelable |

Shimmer suave que se apaga con `prefers-reduced-motion`. Además: **estados vacíos** (sin música → CTA "Agregar carpeta"), **estados de error** con acción (reintentar, quitar pista, volver a dar permiso a la carpeta) y **toasts con deshacer** para acciones destructivas.

### 4.5 Gestos y atajos

- **Gestos:** portada ← → cambia pista; deslizar arriba el mini player abre el expandido; abajo lo cierra; mantener presionada una fila abre menú contextual; deslizar una fila de la cola la quita (con deshacer); arrastrar el asa reordena; tocar el tiempo alterna restante/total.
- **Teclado:** `Espacio` play/pausa · `←/→` anterior/siguiente · `Shift+←/→` ∓5 s · `↑/↓` volumen · `M` silencio · `X` aleatorio · `P` repetición (off → cola → canción) · `Q` cola · `?` ayuda. Se apagan en Ajustes → Accesibilidad. Mapa y reglas de foco en `core/shortcuts.ts`.

---

## 5. Flujos de interacción

```text
PRIMER USO
Abrir /app → Pantalla vacía con 2 CTAs: [Agregar carpeta] [Agregar archivos]
  → (Chromium) showDirectoryPicker → permiso → escaneo progresivo → lista crece en vivo
  → (Firefox/Safari) selector de carpeta → escaneo → ofrecer "Guardar en este dispositivo" (OPFS)
  → Toast: "840 canciones listas" → sugerir elegir fondo (Portada/Ritmo) en un sheet de 1 paso
Sin cuenta en ningún momento.

REGRESO
Abrir /app → restaurar sesión (pista, posición, cola) desde IndexedDB al instante
  → (Chromium) handle guardado: "Reconectar tu carpeta" (1 toque) → re-escaneo por diferencias en 2º plano
  → Si la pista restaurada ya no existe: quitarla de la cola + toast

REPRODUCIR
Tocar canción → se reemplaza la cola por el contexto (álbum/carpeta/lista filtrada) desde esa canción
Menú ⋯ → Reproducir siguiente | Agregar a la cola | Agregar a playlist | Ir al álbum | Ir al artista | Info

ERROR DE PISTA
Error de decodificación → marcar pista ⚠ → toast "No se pudo reproducir X" → saltar a la siguiente (máx. 3 seguidas, luego pausar)

CUENTA (opcional, cuando el usuario la necesita)
Disparadores: crear playlist sincronizada, sincronizar ajustes, nube
→ Sheet de login/registro (correo + Turnstile) → confirmación por correo → vuelve a la acción que lo disparó

MEJORAR A PRO / NUBE
Tocar función bloqueada → sheet con lo que incluye + precio → checkout (Stripe/Mercado Pago en web; Play Billing en app)
→ webhook → entitlements → la UI se desbloquea sin recargar

SUBIR A LA NUBE
Seleccionar pistas/carpeta → "Subir a mi nube" → calcular hashes → omitir las ya subidas
→ cola de subida (progreso, pausar, reanudar) → al terminar, insignia ☁ en la pista
```

---

## 6. SEO

La app (`/app`) no necesita posicionarse; la **landing** sí.

- **Separar rutas:** `/` landing prerenderizada (HTML estático en el build), `/funciones`, `/precios`, `/privacidad`, `/terminos`, `/app` con `noindex`.
- **Nombre de marca:** "Music Reproductor" es genérico e imposible de posicionar. Elegir nombre propio y dominio **antes** de invertir en SEO.
- **Metadatos:** `title` ≤ 60 caracteres, `description` ≤ 155, `canonical`, `lang="es-MX"` (y `hreflang` cuando haya inglés), Open Graph y Twitter con imagen 1200×630, favicon + iconos PWA.
- **Datos estructurados:** JSON-LD `SoftwareApplication`/`WebApplication` con `offers` (gratis) y `FAQPage` en la landing.
- **Archivos:** `robots.txt`, `sitemap.xml` generado en build.
- **Rendimiento (Core Web Vitals):** LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Supabase se descarga solo cuando hace falta (`getSupabase()`, ver `docs/PLAN_RENDIMIENTO.md` Fase 2), fuentes con `font-display: swap` y *preload*, imágenes WebP/AVIF.
- **Contenido:** páginas que respondan búsquedas reales — "reproductor FLAC online", "escuchar música local en el navegador", "ecualizador de música web", comparativas honestas. Blog opcional después.
- **Medición:** Google Search Console + analítica respetuosa de la privacidad (Plausible o Umami). Sin cookies de terceros en `/app`.

---

## 7. Monetización

**Decisión 2026-11-12 (reemplaza la licencia Pro de pago único):** todo lo que corre en el dispositivo es **gratis**; solo se cobra lo que cuesta dinero cada mes en servidor. Razón: cobrar por código que ya corre en el cliente invita a desbloquearlo y contradice «tu música es tuya». Detalle, comisiones y fiscalidad en `docs/producto/MONETIZACION.md`, que manda en este tema.

| Nivel | Precio | Incluye |
|-------|--------|---------|
| **Gratis** | $0 | Todo lo que existe hoy: reproducción local sin límite (FLAC incluido), biblioteca, ecualizador, fondos y luces, letras, playlists ilimitadas, copia de seguridad en archivo y sincronización de playlists con cuenta |
| **Apoyo** | Voluntario | Lo mismo. Enlace «Apoyar el proyecto» con Stripe Payment Links; sin funciones a cambio |
| **Premium** (futuro, precio sin decidir) | Suscripción | Solo funciones con costo recurrente: sincronización completa, copias en la nube, recaps multidispositivo. La nube de música sería un nivel aparte |

- **Sin anuncios** en la app ni en la landing (en Vercel Hobby los anuncios cuentan como uso comercial).
- **Pagos:** web → Stripe (la misma cuenta servirá para premium con Stripe Billing); Android → **Google Play Billing es obligatorio** para bienes digitales dentro de la app. Todo termina en la tabla `entitlements` vía webhook a una Edge Function.
- **Validación siempre en servidor:** las funciones premium viven en el servidor, así que no hay nada que proteger en el cliente.
- Antes de construir premium: lista de espera medida (`docs/producto/MONETIZACION.md` §4.2). Premium obliga a Vercel Pro y Supabase Pro dedicado.
- **Legal México:** aviso de privacidad conforme a la ley federal vigente, términos de uso, política de retiro de contenido para la nube y facturación (CFDI) si se cobra. **El régimen fiscal con un contador está sin resolver** (`DECISIONES_PENDIENTES.md`, D21).

---

## 8. Hoja de ruta por fases

Cada fase termina con build verde, prueba manual en móvil y escritorio, y un commit propio. Marcar casillas al completar.

### Fase 0 — Seguridad e higiene del repo (BLOQUEANTE)
- [x] Quitar las pistas de prueba del árbol y del historial (`git filter-repo`) y `push --force` (S1) — 2026-10-14
- [ ] **Manual del usuario:** borrar los dos deployments antiguos de Vercel con música y verificar 404 (`DECISIONES_PENDIENTES.md` D4)
- [x] Demo pública: **sin demo**, producción arranca con estado vacío; el catálogo de `src/assets/music/` solo se carga en desarrollo — 2026-11-10
- [x] El build falla si la salida contiene audio o si una `VITE_*` es un secreto (S11) — 2026-11-10
- [x] `supabase/.temp` fuera del historial + `.gitignore` (S2) — 2026-10-14
- [x] Borrar `README (1).md` y `SUPABASE (1).md` (S9) — 2026-10-14
- [x] `CLAUDE.md` → una línea que apunta a `AGENTS.md` (S9); `AGENTS.md` §26–§30 con skills, commits, seguridad, responsive y multiplataforma — 2026-11-10
- [x] Migración de límites en BD (S6) — `20261014120000_hardening_limits.sql`
- [x] Decisión 2026-11-10: **el proyecto de Supabase se queda compartido** (`Undefeated_Star_Web_Page`, también lo usa la app de matemáticas `math_*`). Se descarta la limpieza y el proyecto dedicado por ahora (S3 aceptado); reabrir en Fase 8 si se necesita plan Pro o aislamiento.
- [x] Migraciones del reproductor aplicadas en ese proyecto, incluidos los límites (S6) y `20261110120000_revoke_profile_trigger_execute.sql`
- [ ] **Manual del usuario:** renombrar el proyecto de Supabase (D8)
- [ ] **Manual del usuario:** protección de contraseñas filtradas (requiere plan Pro) y resto de Auth (D9)
- [ ] **Manual del usuario:** Vercel Authentication en previews (D5), conectar Git (D6), variables en Preview (D7)
- [x] `npm audit fix` (0 vulnerabilidades) + Dependabot (S8) — 2026-11-10
- [x] Lista blanca de MIME en portadas con test (S5) — 2026-11-10
- [x] `.gitignore` completo, hooks `pre-commit` y `commit-msg` versionados y probados, `npm run setup` — 2026-11-10
- [x] CI: typecheck, tests, build, `npm audit`, gitleaks; permisos mínimos — 2026-11-10
- [x] `vercel.json` con CSP y cabeceras, verificado con la app corriendo (S4) — 2026-11-10
- [x] Revisión de código: errores de Auth genéricos, límite de intentos, sin `innerHTML`/`eval`/`console` — 2026-11-10

**Fase 0 cerrada el 2026-11-10.** Lo que queda sin marcar depende de paneles a los que solo accede el usuario.

### Fase 1 — Base para crecer
- [x] `App.tsx` y `global.css` sustituidos por `src/ui/` (`App`, `LibraryView`, `PlaylistsView`, `Player` con barra/mini, expandido y cola, `dialogs`, `parts`) y estilos por área con tokens (`src/ui/styles/`) — 2026-11-10
- [x] `PlayerEngine` (`src/engine/`) + stores Zustand (`src/state/player.ts`, `library.ts`) — 2026-11-10
- [x] Router propio sin dependencia (`src/ui/router.ts`): `/` landing provisional, `/app`, `/app/playlists`; paneles en `?panel=` para que el botón atrás los cierre; hash en nativo. `rewrites` en `vercel.json` — 2026-11-10
- [x] Persistencia de sesión en IndexedDB con esquema versionado por migraciones (`src/platform/web/db.ts`, test con `fake-indexeddb`): cola, pista, posición, repetición y shuffle — 2026-11-10
- [x] Vitest para cola, repetición, shuffle, identidad de pista, formato, búsqueda y paleta (38 tests) — 2026-11-10
- [x] Separación `core` / `platform` / `ui` / `state` / `engine` / `sync` (§3.7) y `VITE_TARGET` (`base: './'` en nativo, `data-platform` en `<html>`) — 2026-11-10
- [x] `DESIGN.md` y `AGENTS.md` reescritos (tokens, dirección de la auditoría, regla de reutilización por pantalla) — 2026-11-10
- [x] Críticos de la auditoría resueltos: C1 scroll horizontal, C2 texto < 12 px, C3 áreas táctiles, C4 reproductor expandido; además A2, A4, A5, A6, A8, A10 — verificado con `node scripts/capturas.mjs` en los 9 viewports

Skills aplicadas: ponytail (router y diálogos sin dependencias, sin capas extra), impeccable (modo Operate, auditoría previa), apple-design (áreas táctiles, pestañas inferiores, hojas), design-taste-frontend (reglas de app-screens: sin eyebrows, sin bordes, sin degradados decorativos), ui-ux-pro-max (prioridades de accesibilidad y táctil), design-motion-principles (puerta de frecuencia), anti-slop (copia sin jerga).

Límites conocidos de la Fase 1 (se resuelven en la fase indicada):
- ~~La biblioteca todavía no persiste~~ → resuelto en la Fase 3 (2026-11-11).
- ~~Playlists siguen siendo solo en línea~~ → resuelto en la Fase 3: locales primero + outbox.
- ~~Metadatos en el hilo principal, sin timeout~~ → resuelto en la Fase 3: pool de workers con 20 s de tiempo máximo.
- ~~Borrar playlist usa `window.confirm`~~ → resuelto 2026-11-10 con `ConfirmDialog` (`ui/dialogs.tsx`); el toast con deshacer sigue en la Fase 4.
- Landing sin prerender ni SEO (Fase 7).

### Fase 2 — Motor de audio
- [x] Volumen + silencio (por Web Audio, también válido en iOS), aleatorio sin repetir hasta agotar la cola, anterior reinicia si pasaron > 3 s — 2026-11-10
- [x] Grafo Web Audio (§3.3): dos `<audio>`, ReplayGain, preamp automático, EQ de 10 bandas, limitador y analizador; precarga de la siguiente pista (gapless aproximado) y crossfade 0–12 s — 2026-11-10
- [x] Media Session (frontera `AudioSession`, `src/platform/web`): metadatos, portada, estado y posición, play/pausa/anterior/siguiente/seek — 2026-11-10
- [x] ReplayGain por pista o álbum leído de las etiquetas; sin etiqueta no se toca — 2026-11-10
- [x] Temporizador de apagado (15/30/60 min o al terminar la canción) con fundido final de 5 s — 2026-11-10
- [x] Atajos: Espacio, ←/→ ±5 s, Mayús+←/→ anterior/siguiente, ↑/↓ volumen, M, S, R, Q. No actúan con diálogos o campos de texto enfocados — 2026-11-10 *(mapa cambiado el 2026-11-12, ver §11.1g)*
- [x] Ecualizador con preajustes y bandas editables, ajustes de audio persistentes en IndexedDB — 2026-11-10

Verificado con `node scripts/prueba-audio.mjs` (19 comprobaciones en Chromium con tonos sintéticos): reproducir, avance real del tiempo, pausa/reanudar, fin de pista, repetir pista, anterior/siguiente, seek, volumen, silencio, EQ y crossfade persistentes, crossfade efectivo, archivo corrupto, temporizador y restauración de sesión. 47 tests unitarios en `core`.

Skills aplicadas: ponytail (un solo motor con dos decks, ajustes como datos puros, sin librería de audio), source-driven-development (Media Session y Web Audio con APIs estándar), design-motion-principles (sin animación en el transporte).

Límites conocidos de la Fase 2:
- **No verificado a oído ni en dispositivo:** la prueba comprueba el comportamiento (estado, tiempos, títulos), no la calidad del sonido. El efecto real del EQ y la ausencia de clics en el crossfade requieren escucharlos.
- **Media Session no se puede comprobar en Chromium sin interfaz**: está implementada con la API estándar pero falta probarla en pantalla de bloqueo y con auriculares en un móvil real.
- **ReplayGain** solo tiene test unitario del cálculo; no hay fixture con etiquetas `REPLAYGAIN_*`.
- **Gapless exacto no se promete:** con dos `<audio>` el hueco depende del navegador (documentado en §3.3).
- **Modo Ritmo:** el analizador existe (`player.analyser()`) pero aún no hay fondo que lo use (Fase 4).
- Audio en segundo plano con la pantalla apagada en móvil: en la web depende del navegador; la garantía real llega con la app nativa (Fase 11).
- ~~Sin ayuda de atajos visible (`?`)~~: hecha el 2026-11-12 (§11.1g).

### Fase 3 — Biblioteca local
- [x] Abrir carpetas: File System Access (handle recordado) en Chromium; `<input webkitdirectory>` y arrastrar (handles en Chromium, `webkitGetAsEntry` en el resto) con copia a OPFS — 2026-11-11
- [x] Pool de workers (1–4, 20 s máximo por archivo) para metadatos, hash `track:v2` (conservando `track:v1`) y miniaturas de 96 y 600 px; portadas deduplicadas por hash. Paletas: siguen en el hilo principal desde la miniatura de 96 px (32×32 muestras, coste despreciable) — 2026-11-11
- [x] Caché en IndexedDB (migración v2: `tracks`, `roots`, `covers`, `playlists`, `outbox`) + re-escaneo por diferencias (ruta + tamaño + fecha) + reconexión de permisos con un toque; escaneo progresivo y cancelable; lecturas interrumpidas se retoman al recargar — 2026-11-11
- [x] OPFS para Firefox/Safari con comprobación de espacio (`estimate()`), `persist()` y aviso si no cabe o no está disponible (la música suena en esa sesión) — 2026-11-11
- [x] Vistas: Canciones, Álbumes (rejilla), Artistas, Carpetas, Géneros, Recientes, con detalle de grupo; ordenar; búsqueda sin acentos por palabras en cualquier orden — 2026-11-11
- [x] Virtualización (`ui/VirtualList.tsx`, también en la cola y la rejilla); probado con 5 000 pistas sintéticas (`node scripts/gen-biblioteca.mjs`) — 2026-11-11
- [x] OGG/Opus marcados al importar según `canPlayType` (no fallan al darles play), insignias de calidad con Hi-Res, portada desde `cover`/`folder`/`front`/`album` (.jpg/.png/.webp) — 2026-11-11
- [x] Letras: etiquetas USLT y SYLT y archivos `.lrc` hermanos; diálogo «Letra» en el reproductor que sigue la posición real — 2026-11-11
- [x] Playlists locales primero (sin cuenta y sin red) con outbox hacia Supabase (`sync/playlistSync.ts`): compactación, reintento al volver la red y cada 30 s, fallos permanentes descartados, fusión con la nube. Exportar/importar playlists y ajustes en JSON validado campo a campo — 2026-11-11
- [x] Sesión: cola guardada al cambiar y posición en su propia clave cada 2 s (antes se perdía al recargar en los primeros 5 s y podía guardarse con la posición de la pista anterior) — 2026-11-11

Verificado (2026-11-11, todo con audio sintético):
- `node scripts/prueba-biblioteca.mjs <url>` — **54 comprobaciones** en Chromium, Firefox y WebKit: carpeta con File System Access (handle real de OPFS en lugar del diálogo nativo), etiquetas, `track:v2`, portada de carpeta, deduplicación, archivo corrupto, letras .lrc/USLT/SYLT, persistencia y reproducción tras recargar, re-escaneo (1 nuevo, 1 borrado, **1 sola lectura**), permiso en «prompt» → aviso → Reconectar, arrastrar, vistas, búsqueda, playlist sin cuenta, exportar/importar (incluido un nombre con HTML que se pinta como texto y un JSON inválido); Firefox: `webkitdirectory` → OPFS → recarga → suena.
- **5 000 pistas**: listadas en ≈ 10 s y etiquetadas en ≈ 36 s (copia a OPFS incluida); 18 filas en el DOM; scroll a 900 px por cuadro con p50 16,7 ms y p95 24–28 ms; búsqueda «nandu marea» pintada en ≈ 35 ms; 500 álbumes con 55 celdas en el DOM; **restaurar biblioteca, cola y posición en 387–419 ms** desde la navegación; cancelar a mitad no borra nada y al recargar se completan las ≈ 4 940 lecturas pendientes; un archivo de 150 MB se procesa en el worker con el peor cuadro en 183 ms; con la red cortada suena la música local y se crean playlists.
- `prueba-audio.mjs` ampliada a **24** (sesión restaurada sin reimportar, posición y reproducción desde la copia guardada, archivo corrupto marcado), `prueba-menu.mjs` y `prueba-fondo.mjs` en verde, `verificar-csp.mjs` sin violaciones con el build real (worker y portadas `blob:` bajo `script-src 'self'`), matriz de 9 viewports con las vistas nuevas (`capturas.mjs`, que ahora mide también el desborde dentro de `.main`, la cola y los diálogos). 100 tests unitarios.

Skills aplicadas: ponytail (sin librerías nuevas además de `@tanstack/react-virtual`, ya prevista en §3.1; una frontera `LocalLibrary` con segundo uso real en nativo; código muerto del visualizador fuera del commit), impeccable (modo Operate: patrones conocidos, precisión antes que expresión; `craft-floor` leído: estados vacío/carga/error, sin eyebrows, contraste), apple-design y design-taste-frontend aplicadas a través de `DESIGN.md` (hojas inferiores, áreas de 44 px, color solo en lo activo; no se releyeron en esta sesión), design-motion-principles (sin animación en pestañas ni en soltar archivos; letra sin suavizado con movimiento reducido).

Límites conocidos de la Fase 3:
- **Safari real sin probar** (D16): el WebKit de Playwright en Windows no tiene OPFS ni reproduce medios; se verificó solo la degradación a «solo esta sesión».
- **Sincronización con Supabase sin probar contra el servidor** (D17): la lógica pura tiene tests y lo local se probó; falta una cuenta de prueba.
- **Recargar sin red** necesita el service worker de la Fase 6 (D18).
- El diálogo nativo de `showDirectoryPicker` y el arrastre de **carpetas** reales no se pueden automatizar: se probó con un handle de OPFS y con archivos arrastrados sintéticos. Falta probarlo a mano con una carpeta del disco.
- Álbumes con varios artistas sin etiqueta «artista del álbum» se separan por artista (como en la mayoría de reproductores).
- El primer escaneo de miles de archivos por la ruta de copia duplica el espacio (la música queda en OPFS); en Chromium la carpeta recordada no copia nada.
- Las miniaturas se generan en JPEG; si el navegador no tiene `OffscreenCanvas` en workers se guarda la imagen original (≤ 12 MB).

### Fase 4 — Diseño Poweramp + Qobuz
- [ ] Tokens + tipografía + set de iconos
- [ ] Mini player y reproductor expandido estilo Poweramp (§4.1), layouts tablet/horizontal
- [ ] Vistas de álbum y artista estilo Qobuz: cabecera con portada grande y fondo derivado, metadatos (año, nº de pistas, duración total, calidad), lista de pistas numerada; grid de álbumes editorial
- [x] Fondo dinámico: Portada, Ritmo, Estático, AMOLED + selector, intensidad, velocidad, paleta y tope de cuadros (§4.2) — 2026-11-10. Sin modo «Visualizador» (butterchurn): ver `DECISIONES_PENDIENTES.md` D13
- [ ] Gestos (§4.5) y drag & drop en cola y playlists
- [ ] Skeletons, estados vacíos, errores y toasts con deshacer (§4.4)
- [x] Ecualizador con UI (sliders verticales) dentro del menú ≡ — 2026-11-10
- [ ] Curva del ecualizador y pantalla de letra sincronizada

#### Adelanto de la Fase 4 — Menú del reproductor ≡ (2026-11-10)
- [x] Icono ≡ en el mini reproductor, la barra de escritorio y el reproductor expandido (`ui/PlayerMenu.tsx`): hoja inferior con arrastre en móvil (<600 px), popover anclado al icono en ancho. Es un `<dialog>` modal (foco atrapado, Esc cierra, el foco vuelve al icono); los submenús se navegan en profundidad con flecha de volver.
- [x] Contenido: Repetir (apagado/cola/canción) y Aleatorio; Sonido (Ecualizador con presets, 10 bandas, preamp, graves, agudos y balance; ReplayGain; fundido 0–12 s; fundido al pausar/reanudar; velocidad 0,5–2× conservando el tono); Temporizador (5–90 min o al terminar la canción, con fundido final). Todo lee y escribe el store `player`; los ajustes nuevos se guardan con el resto de `audio` en IndexedDB (`sanitizeAudioSettings` rellena los valores neutros en ajustes antiguos).
- [x] Decisión: el expandido **conserva** Aleatorio y Repetir a un toque (son de uso constante); el menú los refleja porque ambos leen el mismo estado.
- [x] `Settings.tsx` eliminado: no quedaba nada que fuera de la app y no del reproductor; `VolumeControl` pasó a `Player.tsx` y la pestaña «Sonido» de la navegación desapareció. Límite: sin pista no hay mini reproductor ni menú, así que los ajustes de sonido solo se tocan con música cargada.
- [x] `window.confirm` de borrar playlist → `ConfirmDialog` propio.
- [x] Motor: graves/agudos (estantes a 120 Hz / 6 kHz), balance (`StereoPannerNode`), velocidad (`playbackRate` con `defaultPlaybackRate`), `pause(fade)`/`play(fade)` (sustituye a `fadeOutAndPause`) y `snapshot()` para que las pruebas lean el grafo real. En desarrollo el motor cuelga de `window.__engine`.
- [x] Verificado: `scripts/prueba-menu.mjs` (46 comprobaciones: móvil con toque y escritorio con teclado, arrastre para cerrar, sin scroll horizontal, áreas ≥ 44 px, y cada ajuste leído en el grafo real), `scripts/prueba-audio.mjs` actualizado al menú (20) y la matriz de 9 viewports con el menú abierto desde mini y expandido (`scripts/capturas.mjs`). Capturas: `docs/capturas/menu-*.png`.
- Límites: el sonido real (EQ, balance, velocidad, fundido al pausar) no se ha escuchado, solo medido en el grafo; el arrastre de la hoja se probó con ratón, no con un dedo en un móvil.

#### Adelanto de la Fase 4 — Fondo que reacciona al ritmo (2026-11-10)
- [x] Decisión técnica: un video renderizado no puede reaccionar a la música; el efecto en vivo es un lienzo WebGL que lee el `AnalyserNode` del motor. **Sin librerías nuevas** (un shader de ~40 líneas, `ui/backdropRenderer.ts`): bundle principal 153,9 → 159,8 KB gzip contando también el menú.
- [x] `src/core` (puro, con test): `rhythm.ts` (energía de graves/medios/agudos y detector de golpes por flujo espectral con umbral adaptativo media + 1,6·σ, mínimo absoluto y separación de 200 ms), `quality.ts` (3 niveles de calidad, gobernador que baja solo con cuadros lentos, nivel inicial por dispositivo/batería), `background.ts` (ajustes, origen de paleta, gradiente CSS de respaldo) y `palette.ts` ampliado (`oklchToRgb`, hasta 4 colores de tonos distintos de la portada). Los tests de ritmo pasan señales sintéticas (bombo de 55 Hz + hi-hats + colchón) por ventana de Blackman, FFT, suavizado y escala dB→byte como el analizador real. 76 tests en total.
- [x] Modos: **Portada** (manchas animadas con la paleta de la portada), **Ritmo** (graves hinchan, golpes pulsan 120 ms, agudos aceleran el giro), **Estático** (degradado CSS fijo de dos colores), **AMOLED** (negro puro en toda la app vía `<html data-bg>`). Ajustes en el menú ≡ → Fondo con vista previa en vivo: intensidad, velocidad, paleta (portada / acento / elegida con tono), tope 30/60/auto y ahorro de batería automático. Se guardan en IndexedDB (clave `background`).
- [x] Rendimiento y robustez: lienzo a 0,35× (degradados suaves), medido ≈ 0,03–0,13 ms de JS por cuadro (presupuesto 2 ms); solo existe con el reproductor expandido (colapsado: tinte CSS al 18 %, sin bucle ni contexto); se detiene con la pestaña oculta; degrada solo (5→3→2 manchas, 60→30→20 fps, menor resolución) si mide cuadros lentos, es un dispositivo flojo o hay batería ≤ 20 % / ahorro de datos; respaldo CSS sin WebGL, con contexto perdido o con `prefers-reduced-motion` (queda estático). Banda inferior más oscura para que el texto se lea con cualquier portada.
- [x] Verificado: `scripts/prueba-fondo.mjs` (el lienzo se monta/libera, cambio de modo, intensidad, paleta y tope de 30 cuadros llegan al render, Estático y movimiento reducido no se mueven comparando capturas del fondo, pestaña oculta, contexto perdido, sin WebGL, degradación con cuadros lentos, persistencia, móvil sin scroll horizontal ni áreas < 44 px), matriz de 9 viewports con las páginas Fondo (`capturas.mjs`) y `verificar-csp.mjs` ampliado: el lienzo WebGL y el menú funcionan con la CSP real, sin violaciones.
- [x] Corregido de paso: recargar con `?panel=player` y sin pista hacía `history.back()` y sacaba al usuario de la app (la prueba cayó a `about:blank`); ahora se reemplaza la entrada del historial.
- Backlog (no hecho): la skill HTML→MP4 (HyperFrames) sirve para (a) un video de demo para la landing y la ficha de Play Store y (b) un modo opcional «Bucle» de videos ligeros (≤ 3 MB cada uno) para móviles flojos; no se usa para el fondo reactivo.
- Límites: el aspecto y la fluidez en una GPU/móvil real no se han visto (Chromium headless con SwiftShader); no se midió el tiempo de GPU, solo el de JavaScript; la detección de golpes se probó con señales sintéticas, no con música real de géneros distintos; el contexto WebGL perdido no se restaura solo (queda el respaldo CSS hasta reabrir el reproductor).

Skills aplicadas: ponytail (WebGL directo en vez de `ogl`, sin librería de visualizador, un solo componente de fondo con respaldo CSS reutilizado como tinte y como Estático), apple-design (hoja con grabber y arrastre, popover sin cascadas, Atrás ≠ Cerrar), design-taste-frontend/app-screens (pantalla de trabajo: sin bordes ni eyebrows, color solo en lo activo; sombra solo en lo que flota), ui-ux-pro-max (áreas táctiles, foco, contraste y prioridades de accesibilidad), design-motion-principles (puerta de frecuencia: el transporte no se anima, el fondo se mueve solo con el reproductor abierto; `prefers-reduced-motion` obligatorio), impeccable (modo Operate: precisión antes que expresión). No se ejecutaron los scripts de esas skills ni se abrieron todas sus referencias: se leyeron sus `SKILL.md`, el encabezado de app-screens y las páginas de hojas y popovers de la HIG.

### Fase 5 — Calidad de vida
- [ ] Favoritos, historial y estadísticas locales
- [ ] Multiselección en listas (agregar a cola/playlist en lote)
- [ ] Ajustes completos (audio, fondo, densidad, formato de tiempo, idioma)
- [ ] Onboarding de 1 paso
- [x] Pantalla de ayuda de atajos (`?` y Ajustes) — 2026-11-12
- [ ] Auditoría de accesibilidad (teclado, lector de pantalla, contraste)

### Fase 6 — PWA
- [ ] `manifest.webmanifest`, iconos, `theme-color` dinámico según portada
- [ ] Service worker (Workbox): app shell offline; la reproducción local funciona sin red
- [ ] Prompt de instalación propio en el momento adecuado (tras 3ª sesión)

### Fase 7 — SEO y landing
- [ ] Nombre de marca + dominio
- [ ] Landing prerenderizada, `/funciones`, `/precios`, `/privacidad`, `/terminos` (§6)
- [ ] Metadatos, OG, JSON-LD, sitemap, robots
- [ ] Separar Supabase del bundle inicial; Lighthouse ≥ 90 en las 4 categorías

### Fase 8 — Backend dedicado y perfiles
- [ ] Proyecto Supabase dedicado en Pro (§3.4) + migración de datos/usuarios
- [ ] Migración de límites (S6) + endurecimiento de Auth (S7)
- [ ] Perfiles: username, avatar (bucket de Supabase pequeño, imágenes ≤ 2 MB, recortadas), ajustes sincronizados
- [ ] Tablas `tracks`, `favorites`, `play_history` con RLS
- [ ] Dominio propio en Vercel (las cabeceras de seguridad, S4, ya están en `vercel.json`)
- [ ] Actualizar `SUPABASE.md`

### Fase 9 — Monetización
- [ ] Enlace «Apoyar el proyecto» (Stripe Payment Link) en Ajustes y landing; cláusula 7 de los términos (sin SDK ni cambios de CSP)
- [ ] Premium (solo con lista de espera ≥ 3× el punto de equilibrio): `entitlements` + Edge Function de webhooks de Stripe; funciones validadas en servidor
- [ ] Aviso de privacidad y términos actualizados con datos de cobro

### Fase 10 — Nube de música
- [ ] Bucket R2 privado + CORS + Edge Functions de firma (PUT/GET) con validación de cuota
- [ ] Subida multipart reanudable con cola visible; deduplicación por hash
- [ ] Streaming firmado + descarga offline a OPFS
- [ ] Política de retiro de contenido y monitoreo de uso

### Fase 11 — App
Arquitectura: **Capacitor** sobre la misma base web (§3.7 y `docs/ARQUITECTURA_APP.md`). TWA descartada: no da servicio de reproducción propio ni acceso persistente a la música, y no existe en iPhone.

- [ ] Preparación sin Android Studio (Fase 6): `capacitor.config.ts`, scripts `build:native` y `cap:sync`, `docs/ANDROID.md`, `docs/IOS.md`
- [ ] Android: `npx cap add android` (cuando el usuario confirme Android Studio), implementación nativa de `LocalLibrary` (selector de carpeta con permisos persistentes) y `AudioSession` (servicio en primer plano `mediaPlayback` + sesión de medios en notificación y pantalla de bloqueo)
- [ ] Android: tokens en Keystore (`SecureStore`), botón/gesto atrás, borde a borde, variante de diseño si alguna pantalla no pasa la regla de reutilización (`docs/DISENO_ANDROID.md`)
- [ ] Android: firma con Play App Signing, formulario de seguridad de datos, política de privacidad, borrado de cuenta dentro de la app y por enlace web
- [ ] Google Play Billing para premium/Nube
- [ ] iPhone cuando Android esté estable (requiere Mac y cuenta de Apple Developer): audio en segundo plano, selector de documentos, compras dentro de la app (`docs/DISENO_IOS.md`)

### Fase 12 — QA continuo
- [ ] Playwright: humo en viewport móvil y escritorio (importar, reproducir, cola, repetición)
- [ ] Matriz manual: MP3/FLAC 16 y 24 bit/WAV/M4A/OGG/Opus, sin metadatos, sin portada, archivo corrupto, archivo borrado, 1 pista, 5 000 pistas, cola vacía, rotación, pantalla bloqueada, auriculares Bluetooth, sin red
- [ ] Navegadores: Chrome, Edge, Firefox, Safari macOS, Safari iOS, Chrome Android
- [ ] Lighthouse CI en cada PR

---

## 9. Criterios de "terminado" (v1.0 web)

- Agrego mi carpeta de FLAC una vez y, al volver, mi biblioteca y mi sesión están ahí en < 1 s.
- 5 000 pistas: scroll fluido a 60 fps y búsqueda instantánea.
- Controles desde la pantalla de bloqueo y los auriculares.
- Puedo elegir fondo Portada o Ritmo y se ve fluido en un Android de gama media sin vaciar la batería.
- Todo se usa con una mano en móvil y con teclado en escritorio.
- Sin cuenta funciona todo lo local; con cuenta se sincronizan playlists y ajustes.
- Cero hallazgos abiertos de severidad media o mayor en `SECURITY_AUDIT.md`.
- Responsive verificado en la matriz de viewports (320×568, 360×800, 390×844, 412×915, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080) sin scroll horizontal.
- La app Android reproduce la biblioteca local y las playlists sin internet.

---

## 10. Reglas para la siguiente sesión de desarrollo

1. Leer las skills (`AGENTS.md` §26) y después, en este orden: `SECURITY_AUDIT.md` → `PLAN.md` → `AGENTS.md` → `DESIGN.md` → `SUPABASE.md` → `DECISIONES_PENDIENTES.md`.
2. Trabajar **una fase a la vez**, empezando por la Fase 0. No saltar fases sin decirlo.
3. Cambios mínimos y completos; nada de abstracciones sin un segundo uso real.
4. Nunca commitear audio, `.env`, `supabase/.temp` ni claves; `service_role` solo en Edge Functions.
5. Los commits no deben incluir líneas de coautoría ni enlaces de sesión de asistentes de IA.
6. Verificar precios y APIs de terceros en su documentación oficial antes de implementarlos; no inventar.
7. Al terminar cada fase: marcar casillas aquí, actualizar el snapshot de la §2 y anotar decisiones nuevas en la §3.

---

## 11. Pulido previo al deploy a producción (pedido del 2026-11-11)

**Regla del usuario:** nada de esto llega a `main` hasta que lo móvil y la calidad de vida estén bien. Se prueba en el
preview HTTPS de Vercel de la rama `desarrollo` (no en el servidor local por LAN: sin HTTPS no hay File System Access,
service worker ni Media Session fiable). Ficha por ítem: **síntoma → causa encontrada/hipótesis → arreglo → prueba**.

### Orden recomendado (cada bloque = una sesión/commit grande)

| Bloque | Contenido | Modelo sugerido |
|---|---|---|
| P1 | Bugs: cola cierra el reproductor, Media Session, carpeta completa, marquee, toque azul/foco | Sonnet 5.5 |
| P2 | Móvil: reproductor grande a pantalla completa, gestos de deslizar, hoja de acciones, landing | Sonnet 5.5 |
| P3 | Auditoría de diseño nº1 (tipografía y pesos) + skeletons + brillo "premium" | Sonnet 5.5 |
| P4 | Fondo ambiental v2 (ver `docs/DISENO_FONDO_AMBIENTE.md`) | Sonnet 5.5 / Opus 5.5 |
| P5 | Estadísticas (ver `docs/DISENO_ESTADISTICAS.md`): primero captura de eventos, luego panel | Opus 5.5 |
| P6 | Auditoría de diseño nº2 (con capturas reales móvil+PC) y revisión de seguridad de lo nuevo | Fable / Opus |
| Deploy | Merge `desarrollo` → `main` solo con checklist §11.4 completo | — |

### 11.1 Hallazgos del diagnóstico (código real de `desarrollo`, commit 2b40f33)

1. **Cola cierra el reproductor grande — causa confirmada.** `router.ts` guarda UN solo `?panel=` (`player` | `queue`).
   `openPanel("queue")` *reemplaza* `player` por `queue`, y `App.tsx` solo pinta `NowPlaying` si `panel === "player"`.
   Arreglo: la cola es una **capa sobre el reproductor**, no un panel hermano. Modelo: `?panel=player` + `&queue=1`
   (o `panel=player,queue`). Atrás cierra primero la cola; luego el reproductor. Escape igual. Con el reproductor cerrado,
   la cola sigue abriéndose sola como hoy. Prueba nueva en `scripts/prueba-menu.mjs`: abrir player → abrir cola → el player
   sigue montado → atrás → cola cerrada y player abierto → atrás → player cerrado.
2. **Biblioteca: ya existen** pestañas Canciones/Álbumes/Artistas/Carpetas/Géneros/Recientes, orden y agrupar
   (`LibraryView.tsx`, `core/library`). Lo que el usuario vio probablemente es un preview anterior. **Verificar en el preview
   actual antes de reescribir nada**; si falta, es lo que falta: filtros dentro de cada vista (año, formato/hi-res, género
   dentro de artista…), orden por duración/año en canciones, "agrupar por" también en Canciones.
3. **Media Session: el código existe** (`platform/web/index.ts`, `state/player.ts#syncSession`) pero tiene huecos reales:
   - `artwork` se manda sin `sizes` ni `type`; Chrome/Brave Android suelen exigir al menos un tamaño ≥ 128 y conviene
     96/192/512. La portada es una URL `blob:`: debe vivir mientras suena la pista (comprobar `holdCover`).
   - Los metadatos se fijan al cambiar la pista, pero antes de que el `<audio>` esté reproduciendo; Android a veces ignora la
     sesión hasta que hay reproducción real. Reaplicar en el evento `playing`.
   - El motor usa dos `<audio>` (crossfade) y Web Audio: la notificación se ata al elemento que reproduce. Comprobar que el
     elemento activo es el que tiene `src` y que el que no suena no reclama la sesión.
   - Brave: puede bloquear/limitar la API según Shields; probar en Chrome Android y Brave. **Solo se cierra con prueba en
     dispositivo real** (remote debugging vía `chrome://inspect` sobre el preview HTTPS).
   - Es posible que lo que vio el usuario sea un preview anterior al commit del motor (1bb5335). Confirmar versión.
4. **Landing minúscula en PC:** `Landing.tsx` son 23 líneas con estilos mínimos. Se rehace en la Fase 7, pero como el enlace
   público lo ve cualquiera, **se sube de prioridad**: tipografía fluida con `clamp()`, ancho máximo, un visual (captura o
   reproductor animado), CTA claro. Mientras tanto, mínimo viable en P2.
5. **Tipografía:** no hay `@font-face`; se usa `var(--font)` del sistema con pesos 400/550/600/650/700 (sin fuente variable
   ⇒ 550/650 se redondean y todo se ve igual). Arreglo en la auditoría nº1: fuente variable autoalojada
   (`font-src 'self'` ya compatible con el CSP), escala tipográfica con tokens, y pesos con intención (números tabulares
   para tiempos, títulos más pesados, metadatos ligeros, versalitas pequeñas para etiquetas).
6. **Toque azul/cuadros del navegador:** `-webkit-tap-highlight-color` ya es transparente; lo que queda son `:focus-visible`
   (`outline: 2px`) disparado por táctil/clic en algunos controles, selección de texto al mantener pulsado y `<select>`.
   Arreglo: `:focus-visible` solo con teclado (`:focus:not(:focus-visible)` sin contorno y aro propio y sutil para teclado),
   `user-select: none` en controles y filas, `-webkit-touch-callout: none`, `touch-action: manipulation` en todo lo pulsable.
   **No quitar el foco de teclado**: se rediseña, no se elimina (accesibilidad).

### 11.1b Resultado del bloque P1 (2026-11-11)

- **Cola:** `?panel=player&queue=1`; `useRoute()` devuelve `queue`; atrás y Escape cierran primero la cola. En escritorio es un
  cajón a la derecha y el reproductor cede su ancho; el reproductor queda `inert` debajo.
- **Media Session:** artwork 96/192/512 con `type: image/jpeg` (la portada grande es un JPEG de 600 px); metadatos y estado se
  reaplican en el evento `playing` del deck activo (`EngineEvents.onStarted`, filtrado por `whenActive`: el deck que
  precarga o se apaga en un crossfade no cuenta). La URL `blob:` de la portada la retiene `holdCover` (una ref viva) mientras
  suena la pista; no se revoca. Probado en Chromium: ficha, tamaños, `playbackState` y reaplicado tras `metadata = null` + pausa/play.
- **Biblioteca (verificado antes de tocarla):** el preview de `desarrollo` es el commit 0343688, que ya incluye la biblioteca
  (2b40f33). Existen pestañas Canciones/Álbumes/Artistas/Carpetas/Géneros/Recientes; orden de canciones: Título, Artista,
  Álbum, Añadidas hace poco, Duración; orden de grupos: Nombre, Nº de canciones y, solo en álbumes, Artista y Año.
  **Falta** (no hecho en P1): filtros (año, formato/Hi-Res, género dentro de artista), orden por año/formato en Canciones,
  «agrupar por» en Canciones. Confirmado en el navegador contra el código de ese commit; el preview real está tras Vercel
  Authentication (D5) y no se abrió.
- **Pendiente en dispositivo real** (Media Session y carpeta; vía `chrome://inspect` sobre el preview HTTPS):
  1. Chrome Android y Brave: aparece la notificación con título, artista, álbum y portada; play/pausa/siguiente/anterior y
     la barra de posición funcionan con la pantalla bloqueada. Brave: comprobar con Shields arriba y abajo.
  2. Que el cambio de pista (con y sin crossfade) actualiza la notificación sin parpadear la portada.
  3. «Carpeta completa» en Chrome/Brave Android (Brave suele tener File System Access desactivado, y `webkitdirectory` en
     Android no siempre deja elegir carpetas: hoy cae a `<input webkitdirectory>`), Safari iOS y Firefox.
  4. Pulsación larga sobre filas, portada y botones: sin selección ni cuadro azul.
  5. Marquee a 60 fps en un móvil de gama media.
- Skills aplicadas: ponytail (leída completa). Las de diseño (taste, ui-ux-pro-max, design-motion-principles) **no se
  cargaron** en esta sesión: el criterio visual (foco con tinta translúcida + halo del acento; marquee a 30 px/s con pausas
  de 1,5 s) sale de §11.2 y debe pasar por la auditoría nº1.

### 11.1c Resultado del bloque P2 (2026-11-11)

- **Reproductor grande en móvil:** sube desde abajo como hoja (`sheet-up`), ocupa toda la pantalla y se cierra arrastrando hacia
  abajo desde la cabecera, la portada o el texto (asa visible arriba). No arrastra desde botones, deslizadores ni la letra.
  Alternativas: botón ⌄ y Escape. El arrastre solo responde al dedo (el ratón no).
- **Gestos de fila** (`ui/gestures.tsx`, Pointer Events, `touch-action: pan-y`): derecha = «Siguiente» (reproducir a continuación),
  izquierda = «A la cola» en la biblioteca o «Quitar» en la cola. Umbral de 88 px con vibración corta al armarse (donde exista
  `navigator.vibrate`), resistencia más allá, y aviso con **Deshacer** (`ui/toast.tsx`, 6 s). La que suena no se quita deslizando.
- **Pulsación larga (500 ms), clic derecho o tecla de menú** → hoja de acciones (`ActionSheet`): reproducir, a continuación,
  a la cola / quitar. El arrastre de cabecera cierra cualquier `Dialog` y el menú ≡ con el mismo hook (`useDragDismiss`).
- **Núcleo:** `playNext` en `core/queue.ts` (mueve si ya estaba; con aleatorio coloca en el orden barajado y en el original), con tests.
- **Foco tras tocar:** Chromium dibuja el aro al abrir un diálogo aunque se abriera con el dedo; `html[data-input="key"]` (main.tsx)
  lo limita a cuando la última interacción fue de teclado.
- **Landing:** `Landing.tsx` + `styles/landing.css`: título en dos líneas, un solo par de márgenes, capturas reales de la app
  (`scripts/gen-landing.mjs`, audio sintético), entradas escalonadas con `prefers-reduced-motion`. Inspector de la skill taste:
  0 FAIL; WARN defendidos: paleta (es el tono oscuro cálido de `DESIGN.md`), sin vídeo (no hay clip honesto), 14 elementos con
  movimiento, y «sección sin título» a 768/390 px (medido mientras el título aún está oculto por la entrada).
- **Pendiente en dispositivo real (P2):** deslizar/pulsar largo/arrastrar con el dedo en Chrome y Brave Android y Safari iOS
  (en iOS no hay vibración ni `contextmenu` al pulsar largo: ahí vale el temporizador de 500 ms); que el scroll vertical de
  listas largas no se corte al empezar el gesto en diagonal; barra del navegador móvil con el reproductor a pantalla completa.
- **No hecho en P2:** «Añadir a playlist» en la hoja de acciones (pide elegir playlist y pasar por `trackV1Id`); «ir al álbum/artista».
- **Nota de pruebas:** tras una secuencia táctil cruda por CDP, Chromium pierde el primer toque siguiente; la prueba lo «asienta»
  con un toque neutro (`settle`). `prueba-biblioteca.mjs` se agotó una vez de 5 con el servidor frío y pasó al repetir.
- Skills aplicadas: ponytail; design-taste-frontend (reglas de la casa y `inspect.mjs` sobre la landing); design-motion-principles
  (puerta de frecuencia: gestos y entradas ocasionales, sin animar lo frecuente; todo con reduced-motion); ui-ux-pro-max cargada
  (áreas ≥ 44 px, gesto con alternativa, foco), sin su buscador (no hay Python en esta máquina).

### 11.1d Correcciones (2026-11-12)

- **«A la cola» no admitía repetidas.** Causa: la cola eran ids de pista (`enqueue` descartaba la que ya estaba, la lista usaba
  el id como `key`, quitar borraba todas las copias y la biblioteca ocultaba «A la cola» si ya estaba). Arreglo: cada entrada es
  `{ key, id }` con clave propia; la actual, quitar, «a continuación» desde la cola y la lista van por `key`. Las sesiones
  guardadas con ids sueltos se convierten al cargar (`upgradeQueue`). Prueba: `core/queue.test.ts` (repetidas, quitar una
  copia, aleatorio, deshacer, la que suena no se quita) y `prueba-movil.mjs` (deslizar dos veces y quitar una copia).
- **La cola sobre el reproductor grande bloqueaba todo.** Causa: `App.tsx` pasaba `inert={queue}` a `NowPlaying`, y la cola no
  tenía clic fuera, arrastre ni botón que alternara desde el reproductor. Arreglo: en ancho (≥ 1000 px) el reproductor ya no es
  `inert` (en estrecho la cola lo tapa entero y sigue `inert` por accesibilidad); la cola se cierra con Escape, clic en zona
  vacía de fuera (los controles de fuera funcionan sin cerrarla), su botón (ahora alterna también desde el reproductor) y
  arrastrando la cabecera en móvil (con asa). Auditoría del resto: `Dialog` (hoja de acciones, letra, cuenta, biblioteca,
  confirmaciones), menú ≡ y «Añadir ▾» ya cerraban con Escape y clic fuera (y arrastre en móvil); no había un fallo común en
  `Dialog`. Prueba: `prueba-menu.mjs` (no inert, control usable, botón, clic fuera, arrastre en móvil).
- **Por la LAN (`http://<ip>:5173`) no dejaba añadir ni leía metadatos.** Reproducido con Playwright (Pixel 7) contra la IP:
  `isSecureContext` es falso, así que no existen `crypto.randomUUID`, `crypto.subtle`, OPFS ni `showDirectoryPicker`.
  Causas: (1) `crypto.randomUUID()` lanzaba al crear la raíz al añadir → nada se añadía; (2) en el worker, el hash de la
  portada (`crypto.subtle`) estaba fuera del `try` → la lectura entera fallaba y se perdían las etiquetas. Descartado: CSP (en
  dev no hay; solo en `vercel.json`/preview), hosts de Vite (las IP se aceptan) y Supabase (no interviene al añadir).
  Arreglo: `core/id.ts` (UUID v4 con `getRandomValues` si falta `randomUUID`; Supabase guarda el id de playlist como `uuid`),
  hash de portada dentro del `try` (sin contexto seguro: etiquetas sí, portada no) y aviso «Sin HTTPS…» al caer a música de
  sesión. Script `npm run dev:lan` (`vite --host`); `dev` sigue solo en localhost. Prueba: `scripts/prueba-lan.mjs <url-lan>`.
  **Para probar en el móvil con todo (guardar la biblioteca):** Chrome/Brave Android → `adb reverse tcp:5173 tcp:5173` por USB
  y abrir `http://localhost:5173` (localhost sí es contexto seguro), o `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
  con la URL de la LAN. iPhone: el preview HTTPS de Vercel. No se añadió HTTPS local (certificado propio = dependencia y aviso
  de certificado en el móvil).

### 11.1e Luces, HDR simulado, movimiento y landing (2026-11-12)

1. **Luces reactivas.** Causa de «la velocidad no responde» y de los destellos: el shader multiplicaba el tiempo acumulado por los agudos
   (`time * (1 + treble*1.5)`), así que cada cambio de agudos desplazaba las manchas de golpe, y el brillo seguía al bombo cuadro a cuadro.
   Arreglo: `createLight` (`core/rhythm.ts`) entrega `swell`, `rate` y `drift` ya suavizados (ver `docs/DISENO_FONDO_AMBIENTE.md`).
   Medido con `core/rhythm.test.ts` (señal sintética → FFT → detector → luz, a 60 fps): a 240 BPM el brillo antiguo daba 4,0 destellos/s y
   saltos de 28 % en 100 ms; el nuevo, 2,5 destellos/s y 7 %. A 300 BPM y con el detector disparando en todos los cuadros, ≤ 3/s. La velocidad
   pasa de ×0,77 (suave) a ×1,41 (fuerte) en unos segundos, sin cambiar más de 1/s y sin saltos de fase. `prueba-fondo.mjs` (Chromium) sigue en verde, con
   movimiento reducido incluido.

2. **HDR simulado.** Modo `hdr` junto a AMOLED (`docs/DISENO_HDR.md`): negro puro, luces en OKLCH con ganancia de croma, Display P3 de verdad
   (`oklchToRgb(…, "p3")`, `drawingBufferColorSpace`, `color(display-p3 …)` en el respaldo), reflejos con techo de brillo y curva de contraste/saturación
   en SDR. La política vive en `tokens.css` bajo `@media (color-gamut: p3)` y `(dynamic-range: high)`; CSS y WebGL leen las mismas `--hdr-*`. Probado con
   `scripts/prueba-hdr.mjs` (CDP para el gamut, `--force-color-profile=hdr10` para el rango alto) y tests de `core/`. **Solo en pantalla real:** el aspecto en OLED/P3/HDR.

3. **Movimiento consistente.** Conjunto cerrado de tokens (`--fast/--base/--slow/--exit/--page`, `--ease/--ease-move`, `--press/--press-wide`) y tabla de estados en
   `DESIGN.md` §3. Auditoría previa: la entrada de `.dialog` no existía, había cuatro nombres de keyframes para lo mismo (`rise`, `sheet-in`, `sheet-up`, `pop-in`,
   `toast-in`), la escala al pulsar era 0.94 en botones y 0.98 en filas, ninguna salida se animaba (DESIGN.md la prometía) y el transporte se hundía al pulsar. Ahora:
   tres entradas y tres salidas compartidas (`base.css`), `ui/motion.ts` (`useExit`, `usePresence`) para que diálogos, menú, reproductor grande, cola y avisos salgan en
   `--exit`, pulsar a 0.96 salvo transporte y teclado. Pruebas: `ui/styles/motion.test.ts` (solo transform/opacity, solo tokens, solo dos curvas, todo `:hover` en
   `@media (hover: hover)`, mutación comprobada), `scripts/prueba-movimiento.mjs` (estilos calculados en Chromium, escritorio, móvil y movimiento reducido). `prueba-menu.mjs`
   ahora espera la salida de 140 ms tras Escape.

4. **Landing.** Texto reescrito en español concreto (`docs/COPY_LANDING.md`: cada frase con su prueba en el código; lo que no está verificado, como el uso sin
   conexión, no se afirma). Se quitaron «Pensado para el pulgar», «Calidad que se nota» y «Tu música, como suena de verdad». Capturas nuevas con música real CC0 o de
   dominio público: `scripts/descargar-musica-landing.mjs` (`npm run landing:musica`) baja 10 pistas y 5 portadas de Wikimedia Commons, **aborta si una licencia no es CC0
   o dominio público**, las etiqueta con ffmpeg y escribe `CREDITOS.md`; `scripts/gen-landing.mjs` (`npm run landing:capturas`) hace las capturas con ellas. El audio vive
   en `tests/fixtures/landing/` (ignorada). Sin CC-BY: no hay atribución obligatoria, pero el pie de la landing nombra a los intérpretes. Inspector de la skill taste: 0 FAIL;
   mismos 4 WARN que antes (paleta cálida = tono oscuro de `DESIGN.md`; sin vídeo: no hay clip honesto; 14 elementos con movimiento; «sección sin título» a 768/390 px, medido
   mientras el título aún está oculto por la entrada). Landing sin scroll horizontal, texto ≥ 13 px y áreas ≥ 44 px en los 9 tamaños.
   Skills aplicadas: ponytail; design-taste-frontend (inspector sobre la landing); ui-ux-pro-max (leída; sin buscador: no hay Python); design-motion-principles (puerta de
   frecuencia, salidas más cortas que entradas, reduced-motion); impeccable (leída; sin su lanzador de contexto); make-interfaces-feel-better (existe y se aplicó: 0.96 al
   pulsar, sin `transition: all`, un solo conjunto de curvas, sin animar lo frecuente); anti-slop (revisión manual de patrones: no hay Python para sus scripts).

### 11.1f Cola, HDR global y Ajustes (2026-11-12)

1. **`useHdrLook`.** `getSnapshot` corre en cada render y llamaba a `getComputedStyle` siempre. Ahora guarda la lectura y solo la repite si cambia `<html data-hdr>` o salta
   `color-gamut`/`dynamic-range`. Medido en Chromium con el mismo recorrido: llamadas desde `hdr.ts` en la carga 37 → 2; en HDR durante el recorrido 41 → 1. Cada llamada ya costaba ~0,006 ms
   (el estilo estaba limpio): la mejora es de cantidad, no de milisegundos visibles.

2. **Filas de la cola.** La cola solo contiene canciones (`QueueEntry` = clave + id de pista): no hay tarjetas de playlist ni de álbum, así que se rediseñó la fila de canción. Dos propuestas
   capturadas en los 9 tamaños: **A** (la que suena en pastilla de tono `--surface-3` con el estado escrito junto al artista; ya sonaron en tinta terciaria) y **B** (estado como velo con icono sobre la
   portada y duración a la derecha). Se eligió A: B tapa la portada (principio 1 de `DESIGN.md`), deja el estado solo en un icono y aprieta el título contra «Siguiente»; A separa por tono (principio 3), mantiene la
   portada limpia y nombra el estado. Acciones: con puntero, subir/bajar/quitar aparecen al pasar o enfocar; en táctil, un «⋯» que abre la hoja (ahora con Subir y Bajar). Gestos sin cambios.

3. **HDR global.** Deja de ser un modo del fondo: interruptor `hdr` (`data-hdr`) que realza fondo, acentos, `--glow`, portadas (filtro estático) y respaldo, con topes de croma y luminosidad y
   desactivado por `prefers-contrast: more`. Detalle y límites en `docs/DISENO_HDR.md`. Pruebas: `core/hdr.test.ts` (peor caso de todos los tonos), `scripts/prueba-hdr.mjs`. **Solo en pantalla real:** cómo luce en OLED/P3/HDR.

4. **Ajustes** (`/app/ajustes`, `ui/SettingsView.tsx`): reúne los controles que ya existían (fondo y HDR, sonido, ecualizador, carpetas, copia de seguridad) sin duplicarlos
   (`PlayerMenu` y `LibrarySheet` los exportan). Nuevos y reales: «Reducir movimiento» (`data-motion` en `<html>`, lo leen CSS, `useReducedMotion` y `motionReduced()`) y «Borrar datos locales»
   (`library.wipeAll` + `storage.clear`). **No hay** ajuste de tema (solo existe el oscuro) ni de idioma (solo español): no se inventaron. Prueba: `scripts/prueba-ajustes.mjs`.
   Skills aplicadas: ponytail; make-interfaces-feel-better, design-motion-principles, design-taste-frontend, ui-ux-pro-max e impeccable (cargadas y aplicadas a criterio; no se ejecutaron su buscador, su lanzador
   de contexto ni `inspect.mjs`: no hay Python y es una pantalla de app, no una página).

### 11.1g Atajos, calidad de portada y portada generativa (2026-11-12)

1. **Atajos.** Mapa nuevo: `Espacio` play/pausa · `←/→` anterior/siguiente · `Mayús+←/→` ∓5 s (antes las flechas solas buscaban) · `X` aleatorio · `P` repetición
   (`off` → `queue` → `track` → `off`, el `cycleRepeat` del núcleo, sin tocar) · `↑/↓` volumen · `M` · `Q` · `?` ayuda. **Se quitaron `S` y `R`.** Puro y con test en
   `core/shortcuts.ts`; `ui/useShortcuts.ts` solo lo adapta al DOM. Regla de foco por tecla: cada elemento se queda con las teclas que ya usa (campo de texto: todas; deslizador y
   grupos de opciones: las flechas; botón, enlace e interruptor: Espacio), así nunca hay doble acción y X/P siguen vivos tras arrastrar la barra. Con Ctrl/Alt/Meta o un diálogo abierto no actúan;
   mantener pulsada la tecla solo repite buscar y volumen. Se apagan con `BackgroundSettings.shortcuts` (Ajustes → Accesibilidad; WCAG 2.1.4). Avisos «Aleatorio activado» y estado de repetición
   por `toast` (`role=status`; un aviso sin «Deshacer» ya visible se reescribe sin repetir la entrada, DESIGN: nada se anima por teclado). Hoja de ayuda: `ui/ShortcutsHelp.tsx`.
   Pruebas: `core/shortcuts.test.ts` y `scripts/prueba-atajos.mjs` (foco en cuerpo, campo, deslizadores, botones, enlace, Ctrl/Alt/Meta, apagar y persistir).
   Skills aplicadas: ponytail; make-interfaces-feel-better, design-motion-principles, design-taste-frontend, ui-ux-pro-max e impeccable (cargadas y aplicadas a criterio; sin buscador ni lanzador de contexto: no hay Python y `PRODUCT.md` no existe).

2. **Calidad de la portada.** Las portadas se generan desde la imagen original incrustada (nunca desde una miniatura): `platform/web/metadata.worker.ts` guarda `small` (96 px), `large` (600 px) y un
   `master` (el original si pesa ≤ 512 KiB; si no, ≤ 1024 px en JPEG .82) más `largeSide` en el registro de `covers` (campos nuevos, sin migración de esquema). Las portadas grandes (reproductor expandido y cabecera de álbum,
   prop `sharp` de `Cover`) miden su ancho real × densidad (`ResizeObserver`, redondeo a múltiplos de 64, tope 1280; `core/resample.ts`) y, si lo guardado queda corto, `state/covers.ts` pide a `platform/web/covers.ts`
   (worker propio, creado solo la primera vez que hace falta) una versión a medida desde el `master`; el resultado se cachea con el mismo conteo de uso y las mismas URLs `blob:` revocables. Pipeline (`platform/web/coverScale.ts`): mitades
   exactas en el canvas mientras haya ≥ 2× de sobra; al reducir, el último tramo lo hace el canvas; al ampliar, Lanczos 3 separable y unsharp mask sobre la luminancia con umbral y tope (`core/resample.ts`, puro, con test). Medido con 5 portadas
   reales de dominio público a 300 px mostradas a 640 px (`scripts/medir-portada.mjs`, referencia = el original reducido a 640 px): PSNR +0,17…+0,79 dB (media +0,44), SSIM +0,004…+0,034, energía de bordes por debajo de la del original (sin halos).
   **La mejora es real pero modesta: ningún algoritmo clásico devuelve el detalle que se perdió al bajar a 300 px; evita el desenfoque del navegador, no lo inventa.** Costes: escanear una portada distinta pasa de ~5 a ~28 ms (en el worker de metadatos);
   ampliar 300 → 640 px ~50 ms y → 1088 px ~140 ms (worker, una vez); espacio por portada distinta: 3 KB + 72 KB + hasta 263 KB de master (peor caso medido: una pintura con textura). Con densidad 1 y 2 la portada llega a 576 y 1088 px reales
   sin tareas largas en el hilo principal. Arranque con 5 002 pistas (`prueba-biblioteca.mjs`, pestaña nueva): 483 ms antes y 440 ms después (ruido: el worker de portadas no existe hasta que hace falta y esas pistas sintéticas no traen portada).
   Captura de detalle (antes · después · original, zoom 3×): `docs/capturas/portada-baja-resolucion.png`. **Límites:** las portadas guardadas antes de este cambio no tienen `master` (se amplían desde `large`, ≤ 600 px; para regenerarlas hay que quitar la carpeta y volver a añadirla o usar «Borrar datos locales»);
   sin `OffscreenCanvas` se queda lo de antes. **IA de superresolución:** no vale la pena todavía: un modelo (Real-ESRGAN pequeño, ONNX/WebGPU) pesa unos 5–20 MB, tarda segundos por portada en gama media y puede inventar texto y rostros.

3. **Portada generativa** (pistas sin carátula). `core/coverArt.ts` (puro, con test): hash FNV-1a del título y el artista normalizados → tres tonos dentro de los rangos del acento y tres composiciones de campos de color planos. Semilla: título + artista en pistas; `group.key` en álbumes,
   artistas y carpetas. Listas: un `background` estático por fila; reproductor grande y cabecera de grupo (`sharp`): una capa más que se mueve con `transform` (token `--drift`) solo mientras suena y con la pestaña visible, sin existir con movimiento reducido (sistema o Ajustes), con
   `role="img"` y texto alternativo. Tres propuestas capturadas en los 9 tamaños (la de campos era la final, con tres composiciones por hash; las láminas se borraron al sustituirla); elegida **campos de color**: sin degradados ni sombras (DESIGN.md §3), se distingue
   del fondo ambiente (la aurora se fundía con él), se lee a 48 px y es la más barata. Bug encontrado al capturar: en Chromium `overflow: hidden` + `border-radius` no recortaba la capa en movimiento (se veía
   fuera del borde); se recorta con `clip-path` (`.cover[data-art]`). Pruebas: `core/coverArt.test.ts` (determinismo, normalización, 2 000 canciones sin colisiones, rangos de tono, CSS válido) y `scripts/prueba-portada-generativa.mjs` (estable tras recargar, siete pistas siete fondos, barata en filas,
   aria, movimiento solo al sonar y con pestaña visible, sin capa con movimiento reducido del sistema y de Ajustes, AMOLED, HDR y portadas reales intactas).
   **Límites:** «bloque dentro de bloque» se parece a la abstracción geométrica clásica (no a una obra concreta); el filtro HDR sobre una capa que se mueve cuesta algo de GPU (una sola capa); con 5 002 pistas sin carátula (todas con arte generativo) `prueba-biblioteca.mjs` da restaurar en 487 ms (base 483 ms) y scroll p95 41,3 ms (base 38,8 ms; entre dos ejecuciones sin cambios ya varió 38,8 → 39,9): no hay diferencia que se pueda separar del ruido, pero tampoco la medí repetida.
   Skills aplicadas (puntos 2 y 3): ponytail; make-interfaces-feel-better, design-motion-principles, design-taste-frontend, ui-ux-pro-max e impeccable (cargadas y aplicadas a criterio; `impeccable context` avisó de que no existe `PRODUCT.md` y no se creó; sin buscador de ui-ux-pro-max: no hay Python).

### 11.1h Chasquido, pulsación larga, carrusel de portadas y deslizadores (2026-11-13)

1. **Chasquido al pausar y reanudar con fundido.** Causa raíz, en `engine/PlayerEngine.ts`: (a) tras `audio.pause()` el volumen volvía de golpe a su valor mientras `MediaElementAudioSourceNode` aún entregaba unos milisegundos; (b) la pausa se disparaba con el reloj de JS, que puede ir por delante del de audio; (c) al reanudar, la rampa arrancaba antes de que el `<audio>` diera muestras (empezaba a media subida); (d) una rampa lineal nueva sin rampa en curso interpola desde el evento anterior (`cancelAndHoldAtTime` no ancla en ese caso). Ahora `rampMaster` calcula el valor exacto actual de la última rampa, ancla con `cancelScheduledValues` + `setValueAtTime` y sube o baja en lineal (nunca exponencial a 0); el `<audio>` se pausa cuando `context.currentTime` pasó el fin de la rampa; el volumen se queda en 0 durante la pausa; la subida empieza cuando `audio.play()` resuelve; un turno descarta una reanudación que se cruzó con una pausa; `applyVolume` usa una rampa de 15 ms y no pisa un fundido de pausa. Medido con `scripts/prueba-chasquido.mjs` (el motor real sobre un `OfflineAudioContext` renderizado al ritmo del reloj de pared; `<audio>` simulado con 60 ms de arranque y 20 ms de cola tras `pause()`): mayor salto entre muestras pausa 0,49 → 0,035, reanudar 0,096 → 0,035, alternar rápido 0,57 → 0,035 (tono sonando: 0,035). **Límite:** el arranque y la cola son supuestos; el oído en un móvil real queda pendiente.

2. **Pulsación larga que cerraba la hoja al soltar.** El `click` que el navegador genera al soltar caía en el fondo del `<dialog>` recién abierto (capa superior, fuera de la fila): el filtro de la fila no lo veía y `Dialog` lo tomaba como clic fuera. `gestures.tsx` lo descarta en `window`, caiga donde caiga, hasta el siguiente toque o 400 ms. `prueba-movil.mjs` emula un teléfono (`isMobile`, que es lo que genera ese clic) y repite la pulsación 10 veces (520–952 ms): antes 0/10, ahora 10/10.

3. **Carrusel de portadas** en el reproductor grande (`useCoverSwipe` en `ui/gestures.tsx`, `NowPlaying`). Regla en `DESIGN.md` §5. La anterior y la siguiente son las entradas que tomarían «anterior» y «siguiente» (`currentIndex`, `previousInQueue`); con «repetir cola» al final la vecina siguiente es la primera de la vuelta siguiente (con aleatorio, `planRound` fija el orden rebarajado —sin empezar por la última— al entrar en la última pista; se guarda en `queue.nextRound` y se descarta si cambia la cola, se apaga el aleatorio o se sale de la última; no se persiste). Cada portada lleva la clave de su entrada: la vecina que llega al centro es el mismo nodo (sin parpadeo) y el carril vuelve a 0 en el mismo cuadro (`useLayoutEffect` sobre la entrada actual). Bloqueo de eje: `useDragDismiss` ya no captura el puntero al bajar el dedo sino al decidir que el gesto es vertical. Color: la paleta sale del worker de portadas (`platform/web/cover.worker.ts`, `createImageBitmap` a 32×32 + `OffscreenCanvas`), una vez por portada, en memoria y guardada en su registro de `covers` (campo nuevo `palette`, sin migración); `usePaletteOf` sustituye a la lectura por canvas en el hilo principal. El lienzo del fondo mezcla hacia la paleta de la vecina con `backdropPreview` (sin re-render). Prueba: `prueba-movil.mjs` (vecina fuera de pantalla en reposo, corto vuelve, a mitad asoma, izquierda pasa, derecha vuelve, sin anterior resiste; el cierre hacia abajo sigue). **Límites:** sin `OffscreenCanvas` (Safari < 16.4) la paleta es la neutra; una paleta guardada no se recalcula si cambia el algoritmo de `core/palette.ts` (habría que vaciar ese campo); la mezcla del color se comprobó en una captura, no midiendo píxeles del lienzo.

4. **Deslizador único** (`ui/Range.tsx`, `ui/styles/range.css`; regla en `DESIGN.md` §5) en progreso, volumen, velocidad, fundido entre canciones, preamplificación, graves, agudos, balance, bandas del ecualizador, intensidad, velocidad y tono del fondo (también en Ajustes, que reutiliza los mismos controles). El `<input type="range">` nativo sigue debajo para teclado, aria y lectores; la capa de puntero hace el engrosado, el tirador, la difuminación del relleno y el ajuste fino. Se quitaron los estilos `::-webkit-slider-*`/`::-moz-range-*` de `player.css` y `menu.css`. Los gestos que cerraban hojas o la cola ignoran `.range`; la navegación por flechas del menú reconoce las bandas por `aria-orientation`. Prueba: `prueba-movil.mjs` (se engrosa y aparece el tirador; a 120 px en vertical avanza a ¼ y muestra «fino ¼»; de vuelta en la barra, velocidad normal; al soltar vuelve a su grosor); `prueba-audio`, `prueba-atajos`, `prueba-menu`, `prueba-ajustes` y `prueba-fondo` siguen en verde. **Límites:** en un menú con scroll, un arrastre que empiece en vertical sobre un deslizador desplaza (como el nativo); sin tirador en reposo, un valor en el extremo (fundido desactivado) solo se lee en el texto de al lado.

   Skills aplicadas (puntos 3 y 4): ponytail; make-interfaces-feel-better, design-motion-principles, design-taste-frontend, ui-ux-pro-max e impeccable (cargadas y aplicadas a criterio: tokens de movimiento, solo `transform`/`opacity`, movimiento reducido, áreas de 44 px, semántica nativa; `impeccable context` leyó `PRODUCT.md` y `DESIGN.md`; sin buscador de ui-ux-pro-max: no hay Python).

### 11.1i Luces reactivas que se adaptan a cada canción (2026-11-13)

Explicación con diagrama, diagnóstico y cifras: `docs/LUCES_REACTIVAS.md`.

1. **Diagnóstico.** `scripts/medir-luces.ts` decodifica audio local con ffmpeg y lo pasa por una simulación del analizador (`core/rhythm.sim.ts`, la misma que usan los tests) y por `core/rhythm.ts`; `--antes <ref>` carga la versión de otra revisión. Causas de que *The Spins* casi no se moviera: graves saturados en 255 (rango de serie del analizador hasta −30 dB), umbral de golpe absoluto (0,25) que la música real no alcanza (flujo p99 ≈ 0,08) y ganancias fijas por banda.
2. **Arreglo** (`core/rhythm.ts` `createAnalysis`): analizador de −100 a −10 dB (`ANALYSER_DB`, lo fija el motor); bandas sin solaparse (20–150 / 250–4000 / 4000–16000 Hz); nivel de cada banda frente a su media y variación móviles (~4 s); ataques por flujo espectral con umbral media + k·σ; velocidad por densidad de ataques de agudos. Ajuste **Sensibilidad** (Baja · Auto · Alta, Auto por defecto) en el menú ≡ → Fondo y en Ajustes, solo en Ritmo. Topes intactos (340 ms entre destellos, subida 2,5/s, movimiento reducido) y uno nuevo más estricto: bajada ≤ 0,65/s, que garantiza ≤ 2,9 destellos/s por construcción.
3. **Métrica** (`lightMetrics`): actividad = desviación típica del brillo en ventanas de 2 s. Canciones completas: *Highest in the Room* 0,73 → 2,55, *The Spins* 0,09 → 2,11; otras siete pistas 0,46–1,45 → 2,44–3,01; peor ventana ≤ 3 destellos/s y paso ≤ 0,070 en 100 ms en todas. Prueba de navegador: `prueba-fondo.mjs` comprueba el control. **Límite:** la medición es una simulación del analizador, no el navegador; falta mirarlo en un móvil real.

   Skills aplicadas: ponytail; design-taste-frontend, ui-ux-pro-max, design-motion-principles, make-interfaces-feel-better e impeccable (control con el `Segmented` de la casa, sin movimiento nuevo, revisado en capturas de 1440 y 390 px).

### 11.1j Filas sin línea de color, portada por defecto y animaciones (2026-11-13)

1. **Filas de la biblioteca** (`LibraryView.tsx`, `library.css`): sin la barra de acento; la pista actual lleva una pastilla de tono en la fila entera, estado escrito («Sonando»/«En pausa» con icono) y título en acento; las ya sonadas de la cola van en `--ink-3` (`hasPlayed` en `core/queue.ts`, con test). Quitada también la línea de acento de la playlist elegida.
2. **Portada por defecto**: tres propuestas implementadas (inicial, nota, tarjeta) detrás de `COVER_STYLE` (sigue en «campos» hasta decidir; ver D27) y recomendación (A · Inicial) en `docs/PORTADA_POR_DEFECTO.md`, con la valoración sin implementar de Cover Art Archive.
   **Decidido 2026-11-14 (D27, tras 11.1j.2):** ninguna de las tres; funda de forma de onda, estática y mate, estable por álbum o por pista suelta, con el tono tiñendo el ambiente del reproductor (`DESIGN.md` «Funda generada»). Borrados «campos», inicial, nota, tarjeta, `COVER_STYLE`, `--drift` y `scripts/portadas-propuestas.mjs`; `scripts/prueba-portada-generativa.mjs` reescrito (12 comprobaciones). Skills aplicadas: design-taste-frontend, ui-ux-pro-max, design-motion-principles, make-interfaces-feel-better, impeccable.
3. **Animaciones**: inventario, medición con CPU 6× y cambios en `docs/ANIMACIONES.md`. Hallazgo: en producción las salidas duraban 0,14 ms (el build minifica `--exit` a `.14s`); arreglado con `cssMs`. Entradas y salidas pasan de keyframes a transiciones con `@starting-style` (interrumpibles y reversibles); el cambio de pista sin gesto disuelve la portada y funde el título.

   Skills aplicadas: ponytail; design-taste-frontend, ui-ux-pro-max, design-motion-principles, make-interfaces-feel-better e impeccable (`impeccable context` leyó `PRODUCT.md` y `DESIGN.md`; sin buscador de ui-ux-pro-max: no hay Python).

### 11.1k Ayuda, tutoriales, privacidad, perfil, apoyo y páginas legales (2026-11-13)

Lo pendiente o bloqueado (foto en la nube, `mp_play_daily`, eliminar cuenta, SMTP, recaps) **no** se implementó.

1. **Ayuda** (`/app/ayuda`, `HelpView.tsx`): atajos (`SHORTCUTS`), gestos (`core/gestures.ts`, con las etiquetas y umbrales que usa `gestures.tsx`), preguntas de `docs/producto/FAQ.md` (módulo virtual `virtual:docs` de `vite.config.ts`, parser en `scripts/docsContent.ts` con test) y «Nosotros» anónimo (D26). Al comprobar la FAQ contra el código se corrigió una afirmación (el temporizador ofrece 5–90 min o fin de canción, no «una hora»). Prueba: `scripts/prueba-ayuda.mjs`.
2. **Tutoriales de primera vez** (`core/tutorials.ts`, `state/tutorials.ts`, `ui/Tutorial.tsx`): avisos en el flujo (no tapan), uno a la vez, al encontrar fila deslizable, reproductor grande o atajos; se omiten todos, se guardan en IndexedDB (`tutorials`) y Ajustes → «Ver tutoriales otra vez». Sin transición con movimiento reducido. Pruebas: `core/tutorials.test.ts` y `scripts/prueba-tutoriales.mjs` (incluye un deslizamiento táctil real por CDP).

3. **Privacidad y datos** (`PrivacySection.tsx`, `sync/account.ts`; pasos 1–4 de `AJUSTES_PRIVACIDAD.md` §4): «Qué se guarda» con cifras reales, casilla «Cerrar también la sesión» al borrar los datos del dispositivo (sin ella, la sesión sigue), «Borrar el historial de Recientes» y «Datos de tu cuenta» (JSON importable). **Sin hacer: «Eliminar cuenta» (bloqueado, necesita Edge Function en el proyecto compartido).** La sección «Datos locales» pasó a llamarse «Privacidad y datos»: se actualizaron FAQ, borradores legales y `prueba-ajustes.mjs`. Prueba: `scripts/prueba-privacidad.mjs` (Supabase interceptado).

4. **Perfil básico, solo local** (`ProfileSection.tsx`, `state/profile.ts`, `core/profile.ts`): nombre opcional (empieza vacío, ≤ 60) y foto (≤ 12 MB, mismas reglas de MIME que las portadas, recortada a 256 px y recodificada, así que sin EXIF/GPS) en `kv` (`profile.name`, `profile.avatar`). No se sincroniza con la cuenta; el nombre del registro (D25) sigue sin reconciliar. Prueba: `scripts/prueba-perfil.mjs` (foto con EXIF de prueba) y `core/profile.test.ts`.

5. **Botón «Comprar un café»** (`CafeLink.tsx`, `core/support.ts`): solo existe si el build trae `VITE_CAFE_URL` (https; cualquier otra cosa se ignora). Ajustes y pie de la landing; enlace en otra pestaña con `noopener noreferrer`, sin SDK ni CSP nueva. **No hay ningún enlace real en el repositorio**; sigue pendiente M3/D21 antes de poner uno en producción. Prueba: `scripts/prueba-cafe.mjs` (dos servidores, con y sin variable).

6. **Páginas legales** (`LegalPage.tsx`, `virtual:docs`): `/privacidad`, `/terminos` y `/almacenamiento` renderizan los borradores de `LEGAL_BORRADORES.md` sin las notas internas, sin enlace en la navegación pública, con `noindex` (meta y `X-Robots-Tag`) y rewrites en `vercel.json` (`verificar-csp.mjs` sin violaciones). Los `{{MARCADORES}}` se completan al compilar con `LEGAL_*` y **el build falla si el resultado contiene alguno** (`writeBundle` en `vite.config.ts`, `unfilledMarkers` con test). Comprobado a mano: sin variables `npm run build` sale con 1 y lista los tres marcadores; con valores de prueba sale con 0 y `dist/` no tiene marcadores. Prueba: `scripts/prueba-legal.mjs` (desarrollo y build servido).

   **Consecuencia:** `npm run build` en local exige esas tres variables (o valores de prueba). Skills aplicadas en los seis puntos: ponytail; design-taste-frontend, ui-ux-pro-max (sin buscador: no hay Python), design-motion-principles, make-interfaces-feel-better e impeccable (no se ejecutó `impeccable context`: solo se leyó su guía).

   **2026-11-16 — textos legales verificados:** los términos pasan a `docs/producto/TERMINOS.md` (`parseLegal` los lee de su sección «Texto»; `prueba-legal.mjs` actualizada), el aviso se reescribe con plazos de ley citados y cada afirmación sobre la app queda en `COPY_LEGAL.md`; investigación en `INVESTIGACION_LEGAL.md`, avisos de terceros generados por `scripts/licencias.mjs` y preguntas para la abogada en `REVISION_ABOGADO.md` (D28). Las páginas siguen sin enlace público salvo Ajustes → Acerca de.

### 11.1l Barra de progreso «confirmar al soltar» y animación de carga (2026-11-13)

1. **Barra de progreso**: antes buscaba en cada movimiento del arrastre (se oía a trompicones, como a doble velocidad). Ahora `Range` tiene `commit`: arrastrando solo se mueven el tirador y el tiempo de destino; al soltar, tocar o con cada flecha, una sola búsqueda. `PlayerEngine.seek`, sonando con Web Audio, baja el volumen general 40 ms (reloj de audio), salta y lo sube al llegar `seeked` (respaldo de 1 s si no llega); una búsqueda a mitad de otra anula la anterior, y cambiar de pista o parar devuelve el volumen. En pausa o sin Web Audio salta directo. Pruebas: `scripts/prueba-progreso.mjs` (cuenta escrituras de `currentTime` con audio real: 0 arrastrando, 1 al soltar, 1 por toque y por flecha; volumen entero tras interrumpir) y `scripts/prueba-chasquido.mjs` (mayor salto entre muestras al buscar: **0,55 antes, 0,035 después**, igual que el tono sonando; también interrumpida por otras dos).

2. **Animación de carga** (decisión del usuario: opción b). Medido antes con `scripts/medir-carga.mjs` (build servido, 390×844, fotograma a fotograma): sin limitación no aparecía nunca (LCP landing 152 ms, /app 120 ms); con Slow 4G y CPU ×4, unos 500 ms en la landing y en /app directo; al pulsar «Abrir el reproductor», nunca. Ahora ese clic (y «Abrir» de la cabecera) muestra el símbolo de `index.html` 600 ms sobre el fondo, sin duplicar el SVG (`Landing.tsx` lo copia antes del montaje), navega cuando ya tapa la landing y empieza la descarga del SDK de Supabase; con movimiento reducido, fundido de ≈ 260 ms. La carga en frío sigue igual (300 ms). Después: clic visible ≈ 520 ms (reducido ≈ 185 ms); LCP sin cambio (landing 152 → 172 ms sin limitación y 3536 → 3524 ms con ella; /app 120 → 124 ms), dentro del ruido de la medición.

   Skills aplicadas en los dos puntos: ponytail; design-motion-principles (evento raro: movimiento de marca permitido, sin bucle, salida más corta que la entrada), make-interfaces-feel-better, impeccable (contexto cargado), design-taste-frontend y ui-ux-pro-max (sin buscador: no hay Python).

### 11.1m Ajustes, Ayuda y menú ≡ en escritorio (2026-11-14)

Inventario a 1024, 1280, 1440, 1920 y 2560 px: Ajustes y Ayuda eran una columna de 592 px pegada a la izquierda; el menú ≡ no dejaba ver el ecualizador entero en su alto fijo. Biblioteca, playlists, cola, reproductor y diálogos, bien. Elegido por el usuario: Ajustes con índice + contenido, Ayuda en dos columnas, menú de 31 rem desde 1000 px (ecualizador en una fila). Móvil y lo de N3-1 (alto del menú, vuelta aleatoria) sin cambios.

Skills aplicadas: ponytail, impeccable (contexto cargado) y make-interfaces-feel-better (revisión rápida).

### 11.1n Editar la información de cada canción (2026-11-16)

- [x] **Datos:** migración v4, que solo añade el almacén `edits` `{ id, campos editados }` con la clave del id de pista (`raíz:ruta`, que sobrevive al reescaneo). Una clave presente significa que el campo está editado; `null`, que se vació a propósito. `tracks` sigue guardando solo lo leído del archivo. Prueba de migración interrumpida como la de v3.
- [x] **Superposición** (`core/edits.ts`): la pista en memoria muestra lo editado y guarda los originales en `source`. La biblioteca la reaplica al arrancar, en cada parche de metadatos (reescaneo o archivo cambiado) y al insertar pistas. Álbumes (por álbum y artista del álbum editados), artistas, búsqueda, orden (con n.º de disco, que ahora se lee del archivo), carrusel, funda por defecto estable por álbum, Media Session y fondo usan lo editado.
- [x] **Identidad:** `trackV1Id` lee siempre `source`: playlists y nube usan lo del archivo. Cola, historial y letras van por id; `track:v2` es el contenido. Comprobado en `core/edits.test.ts` y `scripts/prueba-edicion.mjs`.
- [x] **Carátula elegida:** JPEG/PNG/WebP comprobado por los primeros bytes (`sniffImageType`), ≤ 12 MB y ≤ 40 MP. Se recodifica en el worker de portadas a ≤ 1024 px sin EXIF, con miniaturas de 600 y 96 y paleta con `paletteVersion`. Se guarda en `covers` al pulsar «Guardar» y se borra al restablecerla si ya nadie la usa. Manda sobre la del archivo y sobre la funda (D27).
- [x] **UI** (`ui/EditDialog.tsx`): se abre desde la hoja de acciones de la fila (biblioteca y cola) y con el lápiz del reproductor grande. «Original» y restablecer por campo, «Restablecer todo», errores junto al campo con foco. Hoja en móvil con «Guardar» fijo abajo; desde 1000 px, carátula a la izquierda y campos en dos columnas (patrón de Ajustes). Usa la entrada y salida de los diálogos y no se anima con movimiento reducido.
- [x] **Privacidad:** local y sin subir; «Borrar datos de este dispositivo» vacía `edits`. Fila «Información editada» en Privacidad y datos; aviso, almacenamiento, FAQ y `COPY_LEGAL.md` al día.
- [ ] Edición en lote y «aplicar a todo el álbum»: D29.

Skills aplicadas: ponytail, impeccable (contexto y craft floor), make-interfaces-feel-better, design-taste-frontend, ui-ux-pro-max, design-motion-principles (solo los tokens existentes, sin animación nueva).

### 11.1ñ Cinco retoques (2026-11-16)

- [x] «Sobre Satin» con el texto definitivo del usuario; comprobado con y sin cuentas (D26).
- [x] Ajustes en escritorio: elegida la opción C de tres maquetadas (anclado; tarjetas en dos columnas desde 66 rem; sin índice ahí). Por debajo de 1000 px, posiciones y tamaños iguales en 320, 360, 390, 412, 844×390, 768×1024 y 999 (solo cambia el texto de «Sobre Satin»).
- [x] Progreso: la burbuja del tiempo dice la velocidad y cómo cambiarla mientras se arrastra; «Ajuste fino de la barra» en Ayuda → Gestos.
- [x] Volumen en el reproductor grande de escritorio (mismo estado que la barra). **Riesgo en móvil anotado:** `audio.volume`/`muted` se guardan y viajan en la copia de seguridad, y en móvil no hay control para recuperarlos (ver DECISIONES_PENDIENTES).
- [x] Páginas legales: «Volver a la app» devuelve a Ajustes → Acerca de si se llegó desde ahí; por URL, a /app.

Skills aplicadas: ponytail, impeccable (contexto cargado) y make-interfaces-feel-better. design-taste-frontend, ui-ux-pro-max y design-motion-principles no se cargaron en esta tanda; se siguió `DESIGN.md` (sin animación nueva: la pista del progreso es transporte).

### 11.1o Audio en Android: arranque, chasquido, segundo plano y D30 (2026-11-17)

Síntomas del usuario en Android/Chrome por HTTPS (en PC todo bien): silencio breve en la primera reproducción, chasquido y toques perdidos al pausar rápido, audio que raspa en segundo plano, volumen sin control en móvil.

- [x] **Panel de diagnóstico** `?diag=1` (`ui/diag.ts`, carga aparte): estado, sampleRate, baseLatency/outputLatency y latencyHint del AudioContext, cadena de nodos activa, eventos del `<audio>` y de la página con marca de tiempo, deriva del reloj de audio y del `<audio>` frente a `performance.now()` y, si el navegador las expone, sus estadísticas de subdesbordamiento (`playbackStats`). No hace peticiones; «Copiar» lleva el informe al portapapeles.
- [x] **Pausa y reanudación** (`engine/PlayerEngine.ts`, `state/player.ts`): el motor guarda la intención (`wanted`) y avisa en el mismo toque; un toque durante `resume()` o `audio.play()` ya no se pierde (antes `paused` leía el `<audio>`, que cambia tarde, y `play()` no comprobaba el turno tras `resume()`); una pausa cancela un arranque que aún lee el archivo; rampa mínima de 20 ms (`CUT_RAMP`) al pausar y reanudar aunque el fundido esté apagado. `prueba-chasquido.mjs`, sin fundido: mayor salto entre muestras 0,58 → 0,035 (tono sonando: 0,035).
- [x] **Arranque**: la ruta de audio ya se montaba antes de sonar; Recientes (`markPlayed`) se actualiza 5 s después de empezar (rehacía las vistas de la biblioteca en el primer segundo). Medido en Chromium con CPU ×4 y 5 000 pistas, 4 s tras tocar: tareas largas ≈ 800 → 620 ms.
- [x] **Segundo plano**: `latencyHint: "playback"` (el motor programa rampas y pausas en el reloj de audio; no necesita baja latencia); el bucle del fondo ya se paraba con la página oculta, y ahora el análisis y las luces no ven el hueco al volver (sin salto).
- [x] **D30** (decidido por el usuario): volumen y silencio fuera de la copia de seguridad; en la disposición móvil se arranca al 100 % y sin silencio.
- [x] Pruebas: `engine/PlayerEngine.test.ts` (máquina de pausa con `resume()` lento y rampa), `scripts/prueba-pausa.mjs` (20 y 21 toques en < 2 s con `resume()` retrasado 150 ms como en un móvil; página oculta y vuelta). Con el código anterior, 21 toques acababan sonando. `prueba-biblioteca` y `prueba-privacidad` esperan los 5 s de Recientes y pausan para que el avance automático no anote otra pista. Suite completa en verde (246 unitarias, 25 pruebas de navegador, `capturas.mjs` en los 9 viewports, build y CSP); sin `prueba-lan*`.
- **Sin confirmar en el teléfono:** que «playback» quite el raspado y el silencio inicial (hipótesis; ver el informe de `?diag=1`). Con «playback» las luces del modo Ritmo van unos ms por detrás del sonido (la latencia de salida).

### 11.1p Auditoría de animaciones (2026-11-17)

- [x] `docs/AUDITORIA_ANIMACIONES.md`: las 20 leyes y el resto de la lista, punto por punto (estado, evidencia, propuesta y prioridad), medición con trazas de Chromium con la CPU 4× más lenta, propuestas que cambian lo visible (N8 aparte) y flujos para grabar en el teléfono a 0,25×.
- [x] Aplicado sin cambiar lo que se ve: un solo lector de duraciones en JS (`tokenMs`) y movimiento reducido en el cierre por arrastre.
- [x] B1 (lotes de metadatos tras importar), B2 (reproductor y cola montados y ocultos, precarga en reposo, foco de ida y vuelta con prueba), B3 (el título no se funde al abrir) y la salida de la cola que no pasaba al compositor (2026-11-18): cero tareas largas en esos flujos con la CPU 4×; tabla antes y después en `docs/AUDITORIA_ANIMACIONES.md` §5. Queda la ingesta (≈ 1,8 s al elegir la carpeta y ≈ 0,3 s al escribir las pistas en IndexedDB). N8 ya puede partir de un reproductor montado.

Skills aplicadas: ponytail, design-motion-principles (modo auditoría), make-interfaces-feel-better, impeccable (contexto y animate), ui-ux-pro-max. En B1–B3 (2026-11-18): ponytail, design-motion-principles (modo crear), make-interfaces-feel-better, impeccable.

- [x] Vite 8 + plugin-react 6 (2026-11-18): aplicados y revertidos porque Vite 8 sube el objetivo de navegadores y el CSS deja `oklch()` y media queries de rango que Chrome 107–110 y Safari 16.0–16.3 no entienden. Detalle y vía para retomarlo (fijar `build.target`) en `docs/DEPENDENCIAS.md`.

### 11.1q Auditoría de CSS (2026-11-17)

- [x] `docs/AUDITORIA_CSS.md`: los 20 detalles de la lista (estado, evidencia y decisión), con la comprobación de geometría en móvil y escritorio y lo que no se pudo verificar.
- [x] Aplicado sin cambiar lo que se ve: `scrollbar-gutter: stable` (solo con puntero fino), `overscroll-behavior`, `text-wrap` en h2/h3/p, `tabular-nums` en contadores y hora del temporizador, `scroll-margin-top` en Ajustes y áreas seguras (landing y acciones fijas del editor).
- [x] Aplicado por decisión del usuario: degradados CSS del fondo en OKLCH (con respaldo), fundido en pestañas y lista de playlists, radio concéntrico del menú «Añadir» y trazo 2.25 en iconos de botones.
- Descartado: icono con desenfoque (choca con §3 y `motion.test.ts`; el transporte no se anima) y `mix-blend-mode: multiply` (las portadas no son fotos sobre blanco).

Skills aplicadas: ponytail, impeccable, make-interfaces-feel-better, design-taste-frontend, ui-ux-pro-max (solo lectura de criterio; sin cambios de tema).

### 11.1r Pausas rápidas desde los controles del sistema con la página oculta (2026-11-18)

Síntoma (Poco F7 Pro, Chrome, audífonos Bluetooth, producción 271b726): con Satin en segundo plano, varias pausas rápidas desde la isla de HyperOS (MediaSession) dejaron un silencio largo y la música volvió despacio. El informe de `?diag=1` no lo recogió: el búfer de 300 líneas ya lo había desplazado.

- [x] **`?diag=1`**: cada orden con su origen (`orden: pause ← mediaSession:pause`, botón, teclado, barra o la app); inicio y fin de cada rampa (pausa, reanudación, búsqueda, volumen, fundido entre pistas) con el valor final; lo ocurrido con la página oculta se guarda aparte (hasta 5 000 líneas) y va en su propia sección del informe. Falso «corte» del `<audio>` corregido: una pausa más corta que un tic (250 ms) caía entre dos medidas; ahora `play`/`pause` reinician la medida.
- [x] **Reproducción en Chromium** con la página oculta de verdad (Chromium lanzado a mano y CDP: con Playwright conectado nunca pasa a `hidden`): 10 alternancias por MediaSession cada 150–250 ms → la ganancia vuelve a 1 en ≤ 27 ms y `currentTime` avanza en ≤ 72 ms, también con el frenado de un móvil emulado (temporizadores a 1 s, sin rAF). **Hipótesis descartada para nuestro código:** el camino de play no usa temporizadores ni rAF, las rampas ya iban en el reloj de audio y el contexto se reanuda antes de subir la ganancia. Chromium de escritorio ni siquiera frena los temporizadores de una página oculta con el AudioContext en marcha.
- [x] **Lo que sí dependía de temporizadores** (con el frenado de 1 s): el `<audio>.pause()` tras la rampa (el `<audio>` seguía mudo hasta 1 s y la canción avanzaba 0,6–1 s en silencio en cada pausa) y el salto de una búsqueda (`seekto` callado hasta 1 s). Ahora los dispara el `ended` de una fuente muda programada en el reloj de audio (`atAudioTime`), con un temporizador de respaldo por si el contexto se para. Con el frenado: pausa real en 40 ms (antes 588 ms) y `seekto` en 74 ms (antes 1 021 ms).
- [x] Pruebas: `prueba-pausa.mjs` §3 (oculta, con y sin frenado: reanudación, pausa real, el último toque gana, `seekto`; con el motor anterior fallan 2), 3 unitarias nuevas en `PlayerEngine.test.ts`; `prueba-audio.mjs` «Espacio reanuda» espera a que avance la posición (hasta 3 s) en vez de 600 ms fijos: 10 de 10.
- **Sin confirmar en el teléfono:** la causa del silencio largo. Lo que queda fuera de nuestro código: Android/HyperOS cerrando la salida de audio o el Bluetooth al quedar la página en silencio, y su vuelta lenta. El panel nuevo debería registrarlo.

### 11.2 Funciones nuevas (alcance)

- **Agregar carpeta completa:** el botón de añadir pasa a *split button* ("Añadir ▾": archivos / carpeta), visible en el
  estado vacío y en la barra. Ya existe la ruta de carpeta recordada (File System Access) y `webkitdirectory`; es mostrar
  las dos entradas siempre y unificar el flujo de progreso.
- **Texto desplazable (marquee):** componente `<Marquee>` que mide con `ResizeObserver`; solo anima si el texto desborda;
  pausa en los extremos (~1,5 s), velocidad constante (~30 px/s), degrada a `text-overflow: ellipsis` con
  `prefers-reduced-motion`. Se usa en reproductor grande, mini reproductor, cola. No en listas largas (coste).
- **Gestos móviles:** deslizar fila → derecha "Reproducir a continuación", izquierda "Quitar de la lista / Añadir a cola";
  pulsación larga → hoja de acciones; con umbral, háptico (`navigator.vibrate`) y deshacer. Implementar con Pointer Events
  sobre `VirtualList` sin romper el scroll vertical (`touch-action: pan-y`).
- **Reproductor grande en móvil a pantalla completa:** hoja que sube desde el mini reproductor, arrastrar hacia abajo para
  cerrar, portada grande, controles al alcance del pulgar, respeta `safe-area-inset-*`. Hoy móvil no lo muestra igual que PC.
- **Brillo "premium":** barrido de brillo sutil (no continuo) en botón de play y barra de progreso al reproducir/arrastrar;
  la parte reproducida de la línea se acerca a blanco con gradiente de la paleta de la portada; todo detrás de
  `prefers-reduced-motion` y de un interruptor de "efectos" en el menú ≡.
- **Skeletons:** biblioteca (filas y mosaico), detalle de álbum/artista, playlists, panel de estadísticas, landing. Forma
  idéntica al contenido real (sin saltos de layout), pulso lento y apagado con reduced-motion.

### 11.3 Auditorías de diseño (mínimo 2)

- **Nº1 — tras P1/P2:** tipografía, pesos, jerarquía, espaciado, estados (hover/active/focus/disabled/loading/empty/error),
  móvil primero. Entregable `docs/AUDITORIA_DISENO_2.md` con capturas antes/después (`scripts/capturas.mjs` en 360×800,
  390×844, 768×1024, 1440×900).
- **Nº2 — tras P4/P5:** coherencia del conjunto (fondo ambiental + estadísticas + reproductor), contraste AA sobre fondos
  dinámicos, rendimiento percibido, movimiento (skill `design-motion-principles`). Entregable `docs/AUDITORIA_DISENO_3.md`.
- Usar las skills de diseño disponibles (taste-skill, UI UX Pro Max, design-motion-principles, awesome-claude-design) y el
  enfoque *ponytail* en el código.

### 11.4 Checklist para poder hacer deploy a producción

- [x] Cola sobre el reproductor sin cerrarlo (con prueba automática: `scripts/prueba-menu.mjs`, móvil y escritorio).
- [ ] Media Session verificada en dispositivo real (Brave y Chrome Android) y en PC: título, artista, álbum, portada,
      controles, barra de posición. *Código y prueba en Chromium de escritorio hechos (P1); falta solo el dispositivo real,
      ver «Pendiente en dispositivo real» abajo.*
- [ ] Añadir carpeta completa funcionando (Chrome PC y móvil, con el fallback de Safari/Firefox). *Botón «Añadir» dividido
      hecho y probado en Chromium; falta probar la carpeta en Chrome/Brave Android y Safari iOS.*
- [x] Marquee en reproductor grande/pequeño/cola (`ui/Marquee.tsx`, probado con desborde y con movimiento reducido).
- [x] Sin cuadros azules ni selección accidental en móvil; foco de teclado visible y bonito. *Probado en Chromium (clic sin
      aro, Tab con aro); la selección por pulsación larga solo se confirma en un móvil real.*
- [x] Reproductor grande a pantalla completa en móvil + gestos de deslizar. *Probado con toques reales de Chromium
      (`scripts/prueba-movil.mjs`); falta el dedo en un móvil real (ver «Pendiente en dispositivo real (P2)»).*
- [x] Landing legible en PC y móvil (versión de transición; la definitiva es la Fase 7).
- [ ] Skeletons en todas las vistas con datos.
- [ ] Auditoría de diseño nº1 aplicada. (La nº2 puede ser posterior si estadísticas/fondo v2 aún no están.)
- [ ] `npm run check`, pruebas de scripts, `verificar-csp`, gitleaks y revisión de seguridad en verde.
- [ ] Variables de entorno copiadas a "Preview" en Vercel y probado el login en el preview.
- Estadísticas y fondo ambiental v2 **no bloquean** el deploy si no están: se despliegan detrás de bandera.
