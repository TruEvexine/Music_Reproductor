# Preguntas frecuentes

Regla, igual que en `docs/COPY_LANDING.md`: cada respuesta se comprueba en el código de la rama `desarrollo`. La línea
**Comprobado en** es para el mantenimiento y no se publica. Si una función cambia, se cambia la respuesta. Donde la respuesta es «todavía
no», se dice así.

El nombre del producto es **Satin** (`MARCA.md`); en las respuestas se dice «la app» y los textos legales lo toman de `LEGAL_NOMBRE_APP`. Tono decidido el 2026-11-12: cercano, de tú.

**Reescrita el 2026-11-16:** solo preguntas **de usuario**, máximo 10, respuestas de 1 a 3 frases. Nada de tecnologías, pruebas,
versiones ni cómo se verificó algo (eso va en «Comprobado en»); la única explicación técnica es el ecualizador, en palabras sencillas.
`scripts/docsContent.test.ts` falla si una pregunta o respuesta publicada lleva una palabra de su lista de prohibidas. Sin medios de
contacto hasta que se decida cuál publicar.

**Cuentas (2026-11-14):** el primer lanzamiento va sin cuentas (`VITE_CUENTAS` distinto de `1`). Lo que solo es verdad en uno de los dos
estados va entre `<!-- cuentas -->…<!-- /cuentas -->` o `<!-- sin cuentas -->…<!-- /sin cuentas -->`, cada marcador en su línea; el build
publica solo el bloque que corresponde (`forAccounts` en `scripts/docsContent.ts`).

---

## Preguntas frecuentes

### ¿Cuesta algo?
No. Todo lo que hace la app con la música de tu dispositivo es gratis y no hay funciones de pago. Si ves «Comprar un café» en Ajustes,
es un apoyo voluntario que no desbloquea nada.

Comprobado en: no hay pagos en el código; `src/ui/CafeLink.tsx` solo pinta el enlace si el build trae `VITE_CAFE_URL` (https);
`MONETIZACION.md` (todo lo local, gratis). Si se activa premium, actualizar.

### ¿Mi música se sube a internet?
<!-- sin cuentas -->
No. La app lee tus canciones en tu dispositivo y nunca las envía a ningún lado.
<!-- /sin cuentas -->
<!-- cuentas -->
No. La app lee tus canciones en tu dispositivo y nunca las envía a ningún lado. Si inicias sesión, tu cuenta solo guarda tus playlists:
el nombre de cada una y, por canción, el título, el artista, el álbum y la duración.
<!-- /cuentas -->

Comprobado en: `vercel.json` (`connect-src`: el propio dominio y el servidor de cuentas), `src/sync/` (solo playlists),
`src/sync/playlistService.ts` (`track_identifier` = `track:v1` de `src/core/track.ts`: título|artista|álbum|duración).

### ¿Necesito una cuenta?
<!-- sin cuentas -->
No. La app no tiene cuentas: la usas completa sin registrarte y sin dar ningún dato personal.
<!-- /sin cuentas -->
<!-- cuentas -->
No. Sin cuenta tienes toda la app; la cuenta es opcional y solo sirve para tener tus playlists en varios dispositivos.
<!-- /cuentas -->

Comprobado en: `src/state/playlists.ts` (locales primero), `src/sync/playlistSync.ts`, `src/sync/supabaseClient.ts` (`VITE_CUENTAS`).

### ¿Cómo agrego mi música?
En **Biblioteca**, pulsa **Añadir** y elige **Carpeta completa** o **Archivos**. En la computadora también puedes arrastrar tus
canciones o carpetas a la ventana.

Comprobado en: `src/ui/LibraryView.tsx` (`AddSplit`, `dropProps`), `src/platform/web/library.ts` (`dropped`, carpetas incluidas).

### ¿Tengo que agregarla cada vez que abro la app?
No: la app la recuerda, y si algún día no puede guardarla te lo avisa. A veces el navegador vuelve a pedir permiso y basta con pulsar
**Reconectar**. Las canciones nuevas que pongas en tu carpeta no aparecen solas: en Chrome y Edge, pulsa **Buscar cambios** junto a la
carpeta en **Ajustes → Biblioteca**.

Comprobado en: `src/platform/web/library.ts` (carpeta recordada o copia privada en Firefox y Safari, aviso si no hay espacio),
`src/ui/LibrarySheet.tsx` (`Reconectar`, `Buscar cambios en …` solo en carpetas recordadas), `DECISIONES_PENDIENTES.md` D16.

### ¿Qué formatos reproduce?
MP3, FLAC, WAV, M4A/AAC, OGG y Opus. Que suene depende de tu navegador: si no puede con un archivo, la canción aparece marcada desde que
la agregas, en lugar de fallar al darle play.

Comprobado en: `src/ui/LibraryView.tsx` (`ACCEPT`), `PLAN.md` Fase 3 (marcado por `canPlayType`), `src/state/library.ts` (`markUnplayable`).

### ¿Por qué una canción no tiene portada?
Porque el archivo no trae portada (o la que trae no se puede leer) y junto a él no hay una imagen llamada cover, folder, front o album.
En ese caso la app le pone una funda de color con una onda, la misma para todas las canciones del álbum.

Comprobado en: `src/platform/web/metadata.worker.ts` (portada incrustada, si no la de la carpeta; ≤ 12 MB y tipo admitido),
`src/core/library.ts` (`isFolderCover`), `src/core/coverArt.ts` (funda estable por álbum), `DESIGN.md` «Funda generada».

### ¿Funciona sin internet?
Mientras la app está abierta, sí: puedes escuchar tu música y crear playlists sin conexión.
<!-- cuentas -->
Si tienes cuenta, tus cambios se suben cuando vuelve la conexión.
<!-- /cuentas -->
Lo que todavía no se puede es abrirla o recargarla sin internet.

Comprobado en: `src/core/outbox.ts`, `index.html` y `src/` sin service worker, `DECISIONES_PENDIENTES.md` D18.

### ¿Para qué sirve el ecualizador?
Sube o baja zonas del sonido: las primeras barras son los graves (el bajo y el bombo), las del centro los medios (las voces y las
guitarras) y las últimas los agudos (los platillos y el brillo). Si no sabes por dónde empezar, usa un preajuste como Graves, Voz o
Rock. Lo encuentras en el menú ≡ del reproductor, en **Sonido → Ecualizador**, y en **Ajustes → Reproducción**.

Comprobado en: `src/core/audio.ts` (`EQ_BANDS` de 31 Hz a 16 kHz en orden, `EQ_PRESETS`), `src/ui/PlayerMenu.tsx` («Preajuste»;
elegir uno enciende el ecualizador), `src/ui/SettingsView.tsx`.

### ¿Puedo cambiar el fondo?
Sí, en **Ajustes → Apariencia y luces** o en el menú ≡ del reproductor, en **Fondo**. Puedes elegir Portada (los colores de la canción en
movimiento), Ritmo (se mueve con la música), Estático (quieto) o AMOLED (negro puro).

Comprobado en: `src/ui/PlayerMenu.tsx` (`modes`, `BackgroundPage`), `src/ui/SettingsView.tsx`.

---

## Preguntas que se quitaron el 2026-11-16

- **De ingeniería:** cookies y analítica, cuántas canciones aguanta, la lista de ajustes de sonido, bit-perfect, Hi-Res, letras
  incrustadas, atajos (ya están en Ayuda), pantalla de bloqueo y auriculares.
- **Con medio de contacto** (no decidido): eliminar la cuenta y olvidé mi contraseña.
- **De detalle:** qué guarda la cuenta, playlists al iniciar sesión, descargar la cuenta, dónde se guardan los datos y cómo borrarlos
  (Ajustes → Privacidad y datos se explica sola), nombre y foto, si se puede instalar, batería del fondo, pasar playlists a otro
  dispositivo, una canción que no suena (va dentro de formatos).

No publicar respuestas sobre: recaps y estadísticas (`PERFIL_Y_RECAPS.md`), la foto en la nube, eliminar cuenta desde la app
(`AJUSTES_PRIVACIDAD.md`), premium (`MONETIZACION.md`), app instalable. Se añaden cuando estén en el código.

## Riesgos

- «¿Tengo que agregarla…?» depende de D16 (Safari sin probar en un dispositivo real); si cambia, actualizarla.
