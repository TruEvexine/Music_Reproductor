# Preguntas frecuentes

Regla, igual que en `docs/COPY_LANDING.md`: cada respuesta se comprueba en el código de la rama `desarrollo` (12-11-2026). La línea
**Comprobado en** es para el mantenimiento y no se publica. Si una función cambia, se cambia la respuesta. Donde la respuesta es «todavía
no», se dice así.

«[Nombre]» se sustituye por el nombre elegido (`MARCA.md`).

---

## Tu música y tus datos

### ¿Mi música se sube a algún servidor?
No. La app lee los archivos en tu navegador y nunca los envía. Ni siquiera puede: la web solo tiene permiso para conectarse a su propio
dominio y al servidor de cuentas.

Comprobado en: `vercel.json` (`connect-src`), `AGENTS.md` §5, `src/sync/` (solo playlists).

### ¿Necesito una cuenta?
No. Sin cuenta tienes toda la app: biblioteca, playlists, ecualizador, fondos y copia de seguridad. La cuenta solo sirve para
sincronizar tus playlists entre dispositivos.

Comprobado en: `src/state/playlists.ts` (locales primero), `src/sync/playlistSync.ts`.

### Si creo una cuenta, ¿qué se guarda en ella?
Tu correo, tu nombre visible y tus playlists: el nombre de cada una y, por canción, el título, artista, álbum y duración tal como vienen
en tus archivos. No se guardan los archivos ni tu biblioteca completa.

Comprobado en: `src/core/track.ts` (identidad `track:v1`), `supabase/migrations/`.

### Hice playlists sin cuenta y luego inicié sesión. ¿Qué pasa con ellas?
Pasan a tu cuenta y se suben. Desde ese momento se sincronizan como las demás.

Comprobado en: `src/state/playlists.ts` (`adoptOwnerless`).

### ¿Usa cookies o analítica?
No usa cookies, analítica, publicidad ni rastreo de ningún tipo.

Comprobado en: `vercel.json` (CSP), búsqueda en `src/` de `document.cookie`, `gtag`, `analytics`, `sendBeacon` sin resultados.

### ¿Dónde se guardan mis datos y cómo los borro?
En el almacenamiento de tu navegador. Para borrarlos: **Ajustes → Datos locales → Borrar datos locales**. Se borran tu biblioteca, las
copias de música, tus playlists y tus ajustes; tus archivos originales no se tocan. Si tienes sesión iniciada, también conviene **cerrar
sesión**: el borrado no la cierra, y tus playlists de la cuenta volverán a aparecer.

Comprobado en: `src/ui/SettingsView.tsx`, `src/state/library.ts` (`wipeAll`), `src/platform/web/db.ts` (`clearDatabase`).

### ¿Cómo elimino mi cuenta?
Todavía no se puede desde la app. Escribe a [correo de contacto] desde el correo de tu cuenta y la eliminamos junto con tus playlists.

Comprobado en: no hay llamada de borrado de usuario en `src/sync/`.

### Olvidé mi contraseña.
La app todavía no tiene recuperación de contraseña. Escribe a [correo de contacto] desde el correo de tu cuenta.

Comprobado en: `src/sync/useAuthController.ts` (solo registro, entrada y salida).

---

## Añadir música

### ¿Qué formatos acepta?
MP3, FLAC, WAV, M4A/AAC, OGG y Opus (también `.oga` y `.webm`). Que suene depende de tu navegador: si no sabe decodificar un formato,
la canción aparece marcada desde que la añades, en lugar de fallar al darle play.

Comprobado en: `src/ui/LibraryView.tsx` (`ACCEPT`), `PLAN.md` Fase 3 (marcado por `canPlayType`).

### ¿Cómo añado mi música?
Tres formas: elegir una **carpeta completa**, elegir **archivos sueltos** o **arrastrarlos** a la ventana. Junto a la música, la app lee
las letras `.lrc` y las portadas `cover`, `folder`, `front` o `album` (.jpg, .png, .webp).

Comprobado en: `src/platform/web/library.ts` (`pickFolder`, `dropped`), `PLAN.md` Fase 3.

### ¿Tengo que volver a añadir la música cada vez que abro la app?
No. En Chrome y Edge la app recuerda la carpeta; a veces el navegador vuelve a pedir permiso y basta con pulsar **Reconectar**. En
Firefox y Safari, que no permiten recordar carpetas, la app guarda una copia privada de los archivos dentro del navegador. Si no hay
espacio para la copia, la música suena solo hasta que recargas, y la app te lo avisa.

En Safari esto todavía no se ha probado en un Mac o iPhone reales.

Comprobado en: `src/platform/web/library.ts` (`copyIn`, OPFS), `src/ui/LibrarySheet.tsx` («Reconectar»), `DECISIONES_PENDIENTES.md` D16.

### Añadí canciones a mi carpeta. ¿Aparecen solas?
No solas: en **Ajustes → Biblioteca**, pulsa **Buscar cambios** junto a la carpeta. La app solo lee los archivos nuevos o cambiados y
quita los que ya no están. Un navegador no puede vigilar una carpeta con la pestaña cerrada.

Comprobado en: `src/ui/LibrarySheet.tsx` (`library.rescan`), `PLAN.md` §2 (re-escaneo en segundo plano imposible en web).

### ¿Cuántas canciones aguanta?
Se prueba con una biblioteca de 5 000 canciones en Chrome, Firefox y WebKit. Las listas solo dibujan las filas visibles, así que el
tamaño de la biblioteca no frena el desplazamiento.

Comprobado en: `scripts/prueba-biblioteca.mjs`, `scripts/gen-biblioteca.mjs`, `src/ui/VirtualList.tsx`.

---

## Reproducción y sonido

### ¿Qué ajustes de sonido tiene?
Ecualizador de 10 bandas de ±12 dB con 7 ajustes de partida (Plano, Graves, Agudos, Voz, Rock, Electrónica, Acústica), ReplayGain por
pista o por álbum, fundido entre canciones de hasta 12 segundos, fundido al pausar, velocidad de 0,5× a 2×, balance y temporizador de
apagado (a una hora o al terminar la canción).

Comprobado en: `src/core/audio.ts` (`EQ_BANDS`, `EQ_LIMIT_DB`, `EQ_PRESETS`, `MAX_CROSSFADE`, `SPEED_RANGE`), `src/ui/PlayerMenu.tsx`.

### ¿El sonido es bit-perfect?
No. El audio pasa por el motor de audio del navegador (Web Audio), que es lo que permite el ecualizador y los fundidos.

Comprobado en: `src/engine/PlayerEngine.ts`, `docs/COPY_LANDING.md` (no se afirma bit-perfect).

### ¿Qué significa la etiqueta Hi-Res?
Que el archivo es sin pérdida y tiene más de 16 bits o más de 48 kHz. Los archivos sin pérdida muestran su resolución (por ejemplo
«FLAC 24/96») y los comprimidos su tasa de bits («MP3 320»).

Comprobado en: `src/core/format.ts` (`isHiRes`, `qualityLabel`).

### ¿Muestra letras?
Sí, si vienen con tu música: archivos `.lrc` junto a la canción o letras incrustadas en el archivo (USLT, y SYLT sincronizada). La app no
busca letras en internet.

Comprobado en: `src/core/lyrics.ts`, CSP sin dominios de letras.

### ¿Tiene atajos de teclado?
Sí: **Espacio** reproduce o pausa; **← / →** retroceden o avanzan 5 segundos; **Mayús + ← / →** cambian de canción; **↑ / ↓** suben o
bajan el volumen; **M** silencia; **S** activa el orden aleatorio; **R** cambia la repetición; **Q** abre o cierra la cola.

Comprobado en: `src/ui/useShortcuts.ts`.

### ¿Funciona con los controles de la pantalla de bloqueo y los auriculares?
La app los usa a través del navegador (Media Session): reproducir, pausar, siguiente, anterior y avanzar o retroceder. Está probado en
Chrome de escritorio; en un teléfono real todavía no.

Comprobado en: `src/platform/web/index.ts` (`audioSession`), `docs/COPY_LANDING.md` (lo no verificado).

### Una canción aparece marcada o no suena. ¿Por qué?
Tres causas posibles: el navegador no sabe decodificar ese formato (aparece marcada desde que la añades), el archivo está dañado (se
marca al intentar reproducirla y la app pasa a la siguiente; tras tres fallos seguidos se detiene), o el navegador retiró el permiso de
la carpeta (la app te pide **Reconectar**).

Comprobado en: `AGENTS.md` §3 (errores de reproducción), `src/state/library.ts` (`markUnplayable`, `accessFor`).

---

## La app

### ¿Funciona sin internet?
Mientras la página está abierta, sí: puedes reproducir y crear playlists sin conexión, y los cambios se suben cuando vuelve la red.
Lo que todavía no funciona es **abrir o recargar** la página sin conexión.

Comprobado en: `src/core/outbox.ts`, `DECISIONES_PENDIENTES.md` D18.

### ¿Se puede instalar como app? ¿Hay app para Android o iPhone?
Todavía no. No existen apps nativas ni versión instalable; están en el plan.

Comprobado en: `PLAN.md` Fases 6 y 11, `index.html` sin manifest.

### ¿El fondo animado gasta batería?
Se detiene cuando la pestaña no está visible. Si quieres que gaste menos, en **Ajustes** puedes activar **Reducir movimiento** (el fondo
se queda quieto) o elegir el fondo **AMOLED** (negro puro).

Comprobado en: `src/ui/Backdrop.tsx` (`visibilitychange`), `src/ui/SettingsView.tsx`, `src/core/background.ts`.

### ¿Cómo paso mis playlists a otro dispositivo sin cuenta?
Con la copia de seguridad: **Ajustes → Datos locales → Exportar** y luego **Importar** en el otro dispositivo. Incluye playlists y
ajustes de sonido y fondo. Las canciones se reconocen por sus datos (título, artista, álbum y duración) o por su huella, así que el
otro dispositivo necesita tener los mismos archivos.

Comprobado en: `src/core/backup.ts`, `src/ui/LibrarySheet.tsx` (`BackupSection`).

### ¿Cuánto cuesta?
Nada. No hay funciones de pago.

Comprobado en: no hay pagos en el código. (Actualizar si se activa el apoyo voluntario: `MONETIZACION.md`.)

---

## Preguntas que quedan fuera hasta que exista la función

No publicar respuestas sobre: recaps y estadísticas (`PERFIL_Y_RECAPS.md`), perfil y foto, eliminar cuenta desde la app
(`AJUSTES_PRIVACIDAD.md`), premium y apoyo (`MONETIZACION.md`), app instalable. Se añaden aquí cuando estén en el código.

## Riesgos

- Dos respuestas remiten a [correo de contacto], que no existe todavía. Sin él, la FAQ no se puede publicar.
- La respuesta sobre Safari depende de D16; al probarla en un dispositivo real, actualizarla.
