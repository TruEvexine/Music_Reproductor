# Texto de la landing: cada afirmación y su prueba

Regla: toda frase de `src/ui/Landing.tsx` debe poder comprobarse en el código o en un documento del repo. Si una frase no tiene fila aquí,
sobra. Si una función cambia, se cambia la frase. Se evitó expresamente el relleno («pensado para…», «calidad que se nota», «como suena de
verdad», «experiencia», «potente», «intuitivo», «sin complicaciones»).

| Frase | Qué afirma | Dónde se comprueba |
|---|---|---|
| «Tus FLAC y MP3, sin subirlos» | Se reproducen FLAC y MP3 locales; no hay subida | `LibraryView.tsx` (`ACCEPT`), `core/library.ts` (tipos MIME), AGENTS.md §4 y §5 («nunca se versiona ni se despliega audio»; todo en IndexedDB) |
| «Elige una carpeta» | Hay entrada de carpeta completa | `LibraryView.tsx` («Carpeta completa»), `platform/web/library.ts` |
| «lee las etiquetas, las portadas y la calidad de cada archivo sin salir del navegador» | Metadatos leídos en un worker, local | `platform/web/metadata.worker.ts`, README («Sus metadatos se leen localmente»), `core/format.ts` (`qualityLabel`) |
| «Acepta FLAC, WAV, MP3, M4A, OGG y Opus» | Lista de formatos | `LibraryView.tsx:19` (`.mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus,.webm`). La reproducción final depende del navegador (README) |
| «no pide cuenta y no envía tu música a ningún servidor» | Cuenta opcional; nada de audio sale | `sync/` solo toca playlists; `core/outbox.ts`; PLAN.md §1 (principio 1) |
| «Desliza una canción a la derecha para tocarla a continuación o a la izquierda para añadirla a la cola» | Gestos de fila | `ui/gestures.tsx` (`SwipeRow`), `core/queue.ts` (`playNext`), PLAN.md §11.1c |
| «el aviso permite deshacerlo» | Toast con «Deshacer» (6 s) | `ui/toast.tsx` (`queueAction`) |
| «Una pulsación larga abre sus acciones» | Hoja de acciones a los 500 ms | `ui/gestures.tsx` (`PRESS_MS`), `ui/ActionSheet.tsx` |
| «diez bandas de ±12 dB» | 10 bandas, tope 12 dB | `core/audio.ts` (`EQ_BANDS`, `EQ_LIMIT_DB`) |
| «siete ajustes de partida» | Plano, Graves, Agudos, Voz, Rock, Electrónica, Acústica | `core/audio.ts` (`EQ_PRESETS`) |
| «ReplayGain por pista o por álbum» | Modos `track` y `album` | `core/audio.ts` (`ReplayGainMode`) |
| «En los archivos sin pérdida… (FLAC 24/96); en los demás… (MP3 320)» | Forma de la insignia | `core/format.ts` (`qualityLabel`, `isHiRes`) |
| «Las de alta resolución llevan la etiqueta Hi-Res» | Sin pérdida y > 16 bit o > 48 kHz | `core/format.ts` (`isHiRes`) |
| «colores de la portada, sigue el ritmo… negro puro para pantallas OLED» | Modos Portada, Ritmo, AMOLED | `core/background.ts` |
| «La cuenta es opcional y solo sincroniza tus playlists» | Supabase solo para playlists | SUPABASE.md, `sync/playlistSync.ts` |
| «Los archivos se quedan en el dispositivo donde están» | Los archivos se leen al reproducir | AGENTS.md §3 («los archivos se leen solo al reproducir»), README |
| «Todo lo que corre en tu dispositivo… es gratis» (sección «Qué es gratis hoy») | Nada de lo local tiene precio ni límite de pago | `docs/producto/MONETIZACION.md` §1 («Todo lo que corre en tu dispositivo es gratis», decidido 2026-11-12); no hay código de compra ni de licencias en `src/` |
| «reproducir» · «la biblioteca» | Reproducción local y biblioteca persistente con vistas y búsqueda | `engine/PlayerEngine.ts`, `core/library.ts`, `ui/LibraryView.tsx` |
| «el ecualizador» | Diez bandas, ajustes de partida y ReplayGain | `core/audio.ts` (`EQ_BANDS`, `EQ_PRESETS`) |
| «los fondos» | Modos Portada, Ritmo, Estático y AMOLED | `core/background.ts` (`BackgroundMode`) |
| «las playlists» | Playlists locales primero, en IndexedDB y sin cuenta | `state/playlists.ts` (cabecera: «Playlists locales primero… funciona sin cuenta ni red»). No se dice «ilimitadas»: hay tope de 5 000 pistas por playlist (`MAX_PLAYLIST_TRACKS`) |
| «la copia de seguridad en un archivo» | Exportar e importar JSON | `ui/LibrarySheet.tsx` (`Copia de seguridad`), `core/backup.ts` |
| «No hace falta cuenta» | Todo lo anterior funciona sin sesión; «Entrar» es opcional | `ui/App.tsx` (`auth.session ? "Cuenta" : "Entrar"`), AGENTS.md §4 («funciona completo sin cuenta») |
| «no hay anuncios» | Ni código ni dominios de anuncios | Búsqueda en `src/` e `index.html` sin ningún SDK publicitario; CSP de `vercel.json` (`script-src 'self'`, `connect-src` solo el propio dominio y Supabase) los bloquearía; `MONETIZACION.md` §1 («Sin anuncios») |
| «Si más adelante hay extras que cuesten servidor, serán opcionales» | Intención decidida, sin fecha, precio ni plan | `MONETIZACION.md` §1 (Premium futuro solo para funciones con costo recurrente, §4). No existe ninguna de esas funciones hoy, por eso es condicional («si… hay») |

**Lo que no se afirma porque no está verificado:** planes, precios, contador o nombre registrado (no existen aún), funcionamiento sin conexión como PWA (no hay service worker todavía), controles en la
pantalla de bloqueo en un móvil real (código y prueba en Chromium de escritorio; falta el dispositivo), apps de Android o iPhone (no
existen aún), fidelidad «bit-perfect» (el audio pasa por Web Audio).

**Pie de página:** nombra a los intérpretes y la licencia (CC0 o dominio público); la lista por pista, con el enlace de cada archivo en
Wikimedia Commons, está en `CREDITOS.md` (la genera `scripts/descargar-musica-landing.mjs` tras verificar cada licencia).
