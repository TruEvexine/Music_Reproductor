# PLAN.md — Plan maestro del reproductor

> **Última actualización:** 2026-11-10 · **Estado:** MVP web funcionando (Vite + React 19 + TS, Supabase compartido, hosting en Vercel). **Fases 0, 1 y 2 completas; siguiente: Fase 3 (biblioteca local).**
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
| Biblioteca | Abrir **carpetas**, re-escaneo, caché persistente (IndexedDB), vistas por álbum/artista/carpeta/género, ordenamiento, virtualización para miles de pistas, OGG/Opus |
| Diseño | Gradientes multicolor animados, modo ritmo, selector de fondo, reproductor expandido estilo Poweramp, gestos táctiles, drag & drop en cola, skeletons |
| Producto | Landing/SEO, PWA, perfiles (avatar, ajustes sincronizados), nube de música, monetización, términos/privacidad |
| Código | Reestructurado en la Fase 1 (ver abajo). Falta virtualización y workers |
| Infra | Proyecto de Supabase compartido (aceptado); acciones manuales en paneles de Vercel/Supabase (`DECISIONES_PENDIENTES.md`) |

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
- **Router:** propio (`src/ui/router.ts`, ~50 líneas, sin dependencia). Decisión 2026-11-10: con tres rutas y paneles en `?panel=` no compensa `react-router`; revisar si las vistas de álbum/artista de la Fase 3 lo complican.
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
- **Portadas:** se deduplican por hash y se guardan como `Blob` en IndexedDB en dos tamaños (96 px para listas, 600 px para el reproductor) generados en worker. Fallback: gradiente generado del hash de álbum, nunca un gris plano. Soportar también `cover.jpg`/`folder.jpg` en la carpeta.

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
- La biblioteca todavía no persiste: los archivos importados se pierden al recargar; la sesión guardada se restaura cuando vuelven a estar las mismas pistas (Fase 3: carpetas + IndexedDB).
- Playlists siguen siendo solo en línea (Fase 3: locales primero + outbox).
- Metadatos en el hilo principal, sin timeout (Fase 3: worker).
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
- [ ] Abrir carpetas (File System Access + fallback `webkitdirectory` + arrastrar carpeta)
- [ ] Pool de workers para metadatos, hash `track:v2`, miniaturas y paletas
- [ ] Caché en IndexedDB + re-escaneo por diferencias + reconexión de carpeta
- [ ] OPFS opcional para Firefox/Safari con aviso de espacio
- [ ] Vistas: Canciones, Álbumes, Artistas, Carpetas, Géneros, Recientes; ordenar; búsqueda con tolerancia a acentos
- [ ] Virtualización; probar con 5 000 pistas
- [ ] OGG/Opus, insignias de calidad, portada desde `cover.jpg`
- [ ] Letras: tags USLT/SYLT y archivos `.lrc` hermanos

### Fase 4 — Diseño Poweramp + Qobuz
- [ ] Tokens + tipografía + set de iconos
- [ ] Mini player y reproductor expandido estilo Poweramp (§4.1), layouts tablet/horizontal
- [ ] Vistas de álbum y artista estilo Qobuz: cabecera con portada grande y fondo derivado, metadatos (año, nº de pistas, duración total, calidad), lista de pistas numerada; grid de álbumes editorial
- [ ] Fondo dinámico: Portada (mesh gradient OKLCH), Ritmo (analizador), Estático, AMOLED + selector + intensidad (§4.2)
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
