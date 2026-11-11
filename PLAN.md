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
- Herramientas de prueba: `npm run test:audio` (audio sintético con ffmpeg opcional), `node scripts/capturas.mjs <carpeta>` (capturas Playwright).

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
- **Teclado:** `Espacio` play/pausa · `←/→` ±5 s · `Shift+←/→` anterior/siguiente · `↑/↓` volumen · `M` silencio · `S` shuffle · `R` repetición · `Q` cola · `/` buscar · `E` ecualizador · `?` ayuda.

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
- **Datos estructurados:** JSON-LD `SoftwareApplication`/`WebApplication` con `offers` (gratis + Pro) y `FAQPage` en la landing.
- **Archivos:** `robots.txt`, `sitemap.xml` generado en build.
- **Rendimiento (Core Web Vitals):** LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Cargar Supabase solo en `/app` o cuando haga falta (hoy entra en el bundle principal), fuentes con `font-display: swap` y *preload*, imágenes WebP/AVIF.
- **Contenido:** páginas que respondan búsquedas reales — "reproductor FLAC online", "escuchar música local en el navegador", "ecualizador de música web", comparativas honestas. Blog opcional después.
- **Medición:** Google Search Console + analítica respetuosa de la privacidad (Plausible o Umami). Sin cookies de terceros en `/app`.

---

## 7. Monetización

Poweramp funciona con **prueba + licencia de pago único**. Lo replicamos para lo local y usamos **suscripción solo para lo que tiene costo recurrente** (la nube).

| Plan | Precio (a validar) | Incluye |
|------|-------------------|---------|
| **Gratis** | $0 | Reproducción local ilimitada (FLAC incluido), cola, shuffle/repetición, fondo Portada, búsqueda, hasta 3 playlists sincronizadas, EQ con presets |
| **Pro (pago único)** | ~MXN 99–149 | EQ de 10 bandas editable + presets propios, modo Ritmo y visualizador, temas/AMOLED, letras sincronizadas, crossfade, ReplayGain, temporizador, estadísticas, playlists ilimitadas, sincronización de ajustes |
| **Nube (suscripción)** | ~MXN 49/mes (50 GB) · ~MXN 89/mes (200 GB) | Todo Pro + biblioteca en la nube, streaming entre dispositivos, descarga sin conexión |

- Prueba de Pro: 14 días sin tarjeta.
- **Sin anuncios en el reproductor:** arruinan la experiencia que nos diferencia. Como mucho, un banner discreto en la landing para la app.
- **Pagos:** web → Stripe (tarjetas y OXXO) o Mercado Pago; Android → **Google Play Billing es obligatorio** para bienes digitales dentro de la app (comisión). Todo termina en la tabla `entitlements` vía webhook a una Edge Function.
- **Validación siempre en servidor** para la nube (la Edge Function revisa plan y cuota antes de firmar). Las funciones Pro locales se desbloquean en cliente leyendo `entitlements` (aceptable: no cuestan dinero si alguien las fuerza).
- **Margen de la nube** (estimado, verificar): 200 GB en R2 ≈ US$3/mes de costo → precio con margen sano. Revisar comisiones de pasarela.
- Durante la beta: Ko-fi / GitHub Sponsors y lista de espera para Nube para medir interés antes de construirla.
- **Legal México:** aviso de privacidad conforme a la ley federal de protección de datos personales vigente, términos de uso, política de retiro de contenido para la nube, facturación (CFDI) si se cobra como persona física/moral.

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
- [x] Atajos: Espacio, ←/→ ±5 s, Mayús+←/→ anterior/siguiente, ↑/↓ volumen, M, S, R, Q. No actúan con diálogos o campos de texto enfocados — 2026-11-10
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
- Sin ayuda de atajos visible (`?`); entra en la Fase 5.

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
- [ ] Onboarding de 1 paso y pantalla de ayuda de atajos
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
- [ ] Hosting con Caddy y cabeceras de seguridad (S4); dominio propio
- [ ] Actualizar `SUPABASE.md`

### Fase 9 — Monetización
- [ ] `entitlements` + Edge Function de webhooks (Stripe o Mercado Pago)
- [ ] Puertas de funciones Pro en UI + prueba de 14 días
- [ ] Página de precios, aviso de privacidad, términos

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
- [ ] Google Play Billing para Pro/Nube
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

- [ ] Cola sobre el reproductor sin cerrarlo (con prueba automática).
- [ ] Media Session verificada en dispositivo real (Brave y Chrome Android) y en PC: título, artista, álbum, portada,
      controles, barra de posición.
- [ ] Añadir carpeta completa funcionando (Chrome PC y móvil, con el fallback de Safari/Firefox).
- [ ] Marquee en reproductor grande/pequeño/cola.
- [ ] Sin cuadros azules ni selección accidental en móvil; foco de teclado visible y bonito.
- [ ] Reproductor grande a pantalla completa en móvil + gestos de deslizar.
- [ ] Landing legible en PC y móvil.
- [ ] Skeletons en todas las vistas con datos.
- [ ] Auditoría de diseño nº1 aplicada. (La nº2 puede ser posterior si estadísticas/fondo v2 aún no están.)
- [ ] `npm run check`, pruebas de scripts, `verificar-csp`, gitleaks y revisión de seguridad en verde.
- [ ] Variables de entorno copiadas a "Preview" en Vercel y probado el login en el preview.
- Estadísticas y fondo ambiental v2 **no bloquean** el deploy si no están: se despliegan detrás de bandera.
