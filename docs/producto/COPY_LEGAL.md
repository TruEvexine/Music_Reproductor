# Textos legales: cada afirmación sobre la app y su prueba

Regla (la misma de `docs/COPY_LANDING.md`): toda frase del aviso de privacidad (`LEGAL_BORRADORES.md` §3), del texto de almacenamiento
(§5) y de los términos (`TERMINOS.md`) que diga **qué hace o qué no hace la app** debe poder comprobarse en el código. Si una función
cambia, se cambia la frase y esta tabla. Comprobado en la rama `desarrollo` el 16-11-2026. Los fundamentos jurídicos no van aquí, sino en
`INVESTIGACION_LEGAL.md`.

Estado: **Verificado** (el código lo hace hoy) · **Pendiente** (el texto describe algo que aún no existe; solo se publica con cuentas, que
siguen cerradas, y bloquea abrirlas) · **No verificable en el código** (depende de un tercero).

## Lo que la app hace y no hace

| Frase (resumida) | Dónde | Estado | Dónde se comprueba |
|---|---|---|---|
| Lee tus archivos en tu dispositivo y no los sube a ningún servidor | T1, A «Lo que nunca sale» | Verificado | Carpeta abierta con permiso de solo lectura (`platform/web/library.ts:7-8`, `:150`); los archivos se leen al reproducir (AGENTS.md §3); no hay subida de audio en `src/sync/` (solo `playlists` y `playlist_tracks`, `sync/playlistService.ts:29`, `:83`); CSP `connect-src 'self'` + Supabase (`vercel.json:9`) |
| No es tienda ni streaming; no busca canciones en Internet ni enlaza a sitios donde conseguirlas | T1 | Verificado | Ninguna URL externa en `src/` salvo la base del router (`ui/router.ts`); el único `fetch` lee archivos de demostración solo en desarrollo (`state/library.ts:521`, `demoCatalog.dev.ts`) |
| No incluye letras ni portadas de terceros: salen de tus archivos o de las imágenes de tus carpetas | T1 | Verificado | Letras de etiquetas USLT/SYLT o de un `.lrc` hermano (`core/lyrics.ts:1`, `core/library.ts:30`, `platform/web/metadata.worker.ts:64`); portadas incrustadas o `cover.jpg`/`folder.png`… de la carpeta (`core/library.ts:27`); si no hay, degradado (`core/coverArt.ts`) |
| Copias técnicas en el dispositivo: miniaturas de portadas y, en Firefox/Safari, copia de los archivos en el almacenamiento privado | T3, almacenamiento | Verificado | Miniaturas en el almacén `covers` (`platform/web/db.ts:19`, `metadata.worker.ts:19-20`); copia en OPFS cuando no se puede recordar la carpeta (`platform/web/library.ts:193-204`, `opfsCopy.worker.ts`) |
| Esas copias se borran al quitar la carpeta | T3 | Verificado | `library.removeRoot` (`ui/LibrarySheet.tsx:88`) |
| No veo ni reviso tus archivos | T3 | Verificado | Nada de los archivos ni de la biblioteca sale del dispositivo (filas anteriores) |
| La app no elude DRM ni escribe en tus archivos | T4 (implícito), `INVESTIGACION_LEGAL.md` §3 | Verificado | Sin `requestMediaKeySystemAccess` en `src/`; permiso de solo lectura; solo escribe dentro de OPFS (`library.ts:204`) |
| La app pide al navegador que conserve la copia de tus archivos | T9 | Verificado | `navigator.storage.persist` al copiar (`platform/web/library.ts:191`); no se pide en otros casos |
| Biblioteca, playlists y ajustes se guardan en el navegador | T9, A | Verificado | Almacenes de IndexedDB (`platform/web/db.ts:13-26`); AGENTS.md §4 |
| El navegador puede borrarlos (datos del sitio, ventana privada, falta de espacio, inactividad en algunos navegadores) | T9 | No verificable en el código | Comportamiento de los navegadores; la app no puede impedirlo. Se dice como posibilidad, sin nombrar plazos |
| La copia de seguridad (Ajustes → Privacidad y datos) incluye playlists y ajustes | T9 | Verificado | `core/backup.ts:1` («playlists y ajustes»); la sección se muestra en Privacidad y datos (`ui/PrivacySection.tsx:149`, `BackupSection`) |
| No guardo copia de nada de esto [salvo las playlists sincronizadas] | T9 | Verificado | Solo `sync/` habla con un servidor y solo de playlists y perfil |
| Lo que creas sin cuenta (playlists, nombre, foto) no me llega | T7 sin cuentas | Verificado | Perfil en `kv` (`state/profile.ts`), no se sincroniza; sin cuentas el SDK de Supabase no entra en el build (`vite.config.ts`, guardia) |
| Nombre y foto de perfil: la foto reducida y sin metadatos | A, almacenamiento | Verificado | Recorte y recodificación a JPEG en un canvas (`state/profile.ts:27`) |
| Sin cookies, analítica, publicidad ni rastreo | A | Verificado | Ningún SDK en `package.json`; la CSP bloquearía otras conexiones (`vercel.json:9`); `LEGAL_BORRADORES.md` §1.3 |
| Vercel recibe IP y datos técnicos del navegador y deduce país y ciudad | A «Al visitar la web» | No verificable en el código | Aviso de privacidad de Vercel (`INVESTIGACION_LEGAL.md` §2.7). La app no recibe esos datos |
| «Vercel los conserva según su propia política» | A | No verificable en el código | Vercel no fija plazo en su aviso; plazo real **no confirmado** |
| Esta versión no tiene cuentas | A, T1, T8 sin cuentas | Verificado | Sin `VITE_CUENTAS=1` no hay interfaz de cuenta ni SDK (AGENTS.md §5; `vite.config.ts`, `accountsOn`) |
| Desde la app puedes borrar tus playlists y todos los datos del dispositivo | A | Verificado | `ui/PlaylistsView.tsx` (borrar); `ui/PrivacySection.tsx:161` («Borrar datos de este dispositivo») |
| El café abre la página de un tercero en otra pestaña, fuera de la app, y no desbloquea nada | T14, A | Verificado | `ui/CafeLink.tsx:9-13`, `:29`; solo existe con `VITE_CAFE_URL` https (`core/support.ts`). Hoy no hay enlace real |
| Comprobantes y reembolsos según la página del café | T14 | No verificable en el código | La página de Stripe aún no existe (`MONETIZACION.md`); revisar al crearla |
| «De esa operación recibo solo lo que el procesador me muestre» | A café | No verificable en el código | Depende de Stripe; qué datos ve el responsable, **no confirmado** |
| Hoy todo es gratis; lo que funciona en tu dispositivo sin cuenta seguirá gratis | T15 | Verificado (hoy) / compromiso (futuro) | No hay código de cobro ni licencias en `src/`; `MONETIZACION.md` §1. La segunda parte es una promesa a decidir |
| Software y tipografía de terceros con sus licencias, lista en `/licencias-terceros.txt` | T5 | Verificado | `public/licencias-terceros.txt` generado por `scripts/licencias.mjs`; Instrument Sans OFL 1.1 (`@fontsource-variable/instrument-sans`) |
| Código bajo PolyForm Noncommercial 1.0.0 | T5 | Verificado | Archivo `LICENSE` |

## Solo con cuentas (se publican con `VITE_CUENTAS=1`)

| Frase (resumida) | Dónde | Estado | Dónde se comprueba |
|---|---|---|---|
| La cuenta solo sincroniza playlists | T1 | Verificado | `sync/playlistSync.ts`, `sync/playlistService.ts`; el perfil solo se lee (`sync/account.ts:24`) |
| Se guarda: correo y contraseña cifrada | A | Verificado | `auth.signUp` con correo y contraseña (`sync/useAuthController.ts:123-126`); el hash lo guarda Supabase Auth |
| Nombre visible; si no escribes uno, se guarda la parte del correo antes de la «@» | A | Verificado | Disparador `create_profile_for_new_user` (`supabase/migrations/20261014120000_hardening_limits.sql:41-47`). Cuando se aplique `20261114120000_profile_display_name_sin_correo.sql`, **cambiar la frase** |
| Fechas de registro, confirmación y último acceso; IP y navegador por sesión en un registro de seguridad | A | Verificado (12-11-2026) | Consulta de solo lectura al esquema `auth` (`auth.users`, `auth.sessions.ip`/`user_agent`, `auth.audit_log_entries.ip_address`), `LEGAL_BORRADORES.md` §1.2 |
| Playlists: nombre y, por canción, título, artista, álbum y duración, o una huella que no permite reconstruir el archivo | A, T6 | Verificado | `track:v1` (`core/track.ts:66-73`), `track:v2` SHA-256 de tamaño + primer y último MiB (`core/track.ts:22`, `:76`); se suben los identificadores (`core/outbox.ts:7`, `sync/playlistService.ts:83`) |
| Las playlists anteriores solo se suben si eliges «Subir» | A | Verificado | `AdoptDialog` (`ui/dialogs.tsx:296-313`) |
| Supabase con servidores en EE. UU. | A | Verificado (configuración) | Región del proyecto en `SUPABASE.md`; inventario §1.2 |
| Descargar lo que guarda tu cuenta en Ajustes → Privacidad y datos → Datos de tu cuenta | A, T8 | Verificado | `ui/PrivacySection.tsx:90-102` (`fetchAccountData`: perfil y playlists; no incluye correo, fechas ni IP) |
| Cada cuenta solo puede leer y cambiar sus propios datos | A «Seguridad» | Verificado | RLS activada (`supabase/migrations/20260928180000_initial_music_player.sql:28-30`) con políticas por `auth.uid()` (`:42`, `:47`) |
| Conexión cifrada (HTTPS) | A «Seguridad» | Verificado | CSP con `upgrade-insecure-requests` (`vercel.json:9`); Vercel sirve por HTTPS |
| Eliminar la cuenta escribiendo al correo de privacidad | T8, A | Verificado (procedimiento manual) | No hay botón: se borra a mano en el panel de Supabase (`LEGAL_BORRADORES.md` §1.3). **Pendiente:** «Eliminar cuenta» en la app (L9) |
| Aceptación expresa de los términos al crear la cuenta y registro de la versión aceptada | T2 | **Pendiente** | No existe en el registro (`ui/dialogs.tsx`); requiere UI y migración aditiva |
| Aviso simplificado bajo «Crear cuenta» | A §3.2 | **Pendiente** | No se muestra (S-17 de `PLAN_SEGURIDAD.md`) |
| Retirar contenido tras un aviso, contra-aviso, cierre de cuentas reincidentes | T6, T8 | **Pendiente (operativo)** | No hay herramienta: se haría a mano en Supabase. Basta mientras el volumen sea bajo |
| Aviso por correo de cambios y de vulneraciones | T16, A | **Pendiente (operativo)** | Sin SMTP propio (D9); hoy solo con el correo de privacidad, a mano |

## Lo que se dejó fuera a propósito

- **«Funciona sin conexión»:** no hay service worker (`docs/COPY_LANDING.md`); el texto de almacenamiento dejó de decirlo el 16-11-2026.
- **«Elige tu carátula»:** la app no deja elegir portadas a mano; solo la foto de perfil.
- **Plazos de conservación de Vercel o Supabase:** no confirmados; los textos remiten a sus políticas.
- **Un tope de responsabilidad en dinero:** omitido por la LFPC (art. 90, fr. II); pregunta para la abogada.
