# Ajustes de privacidad: especificación

Estado: **pasos 1 a 4 de §4 implementados el 2026-11-13** (sección «Privacidad y datos», `src/ui/PrivacySection.tsx`; prueba `scripts/prueba-privacidad.mjs`). **Pendiente y bloqueado: «Eliminar cuenta» (paso 5), la analítica (§2.4) y el historial de escucha (§2.5).** Parte del inventario de `LEGAL_BORRADORES.md` §1; si el inventario cambia, esta página cambia.
Las decisiones tuyas están marcadas **[Decides tú]**.

## 1. Qué hay hoy

`Ajustes → Datos locales` (`src/ui/SettingsView.tsx`) ya ofrece:

- **Copia de seguridad** (exportar e importar JSON): playlists (nombre e identidades de pista) y ajustes de audio (salvo volumen y silencio, que son del dispositivo: D30) y fondo
  (`src/core/backup.ts`). No incluye la biblioteca, la cola ni la sesión.
- **Borrar datos locales**: quita todas las carpetas, las copias en OPFS y vacía IndexedDB (`library.wipeAll()`), y recarga.

Y en `Ajustes → Biblioteca`, quitar una carpeta concreta.

Huecos encontrados al revisar el código:

1. **Borrar datos locales no cierra la sesión.** `storage.clear()` vacía IndexedDB, pero la sesión de Supabase vive en `localStorage`
   (`sb-<proyecto>-auth-token`). Tras borrar, la persona sigue conectada y sus playlists vuelven a bajar. El texto del diálogo lo
   avisa, pero quien quiere "borrar todo" en un equipo compartido espera que también se cierre la sesión.
2. **No hay forma de ver qué ocupa cada cosa** salvo el espacio total en la hoja de la biblioteca (`localLibrary.space()`).
3. **No se puede eliminar la cuenta** ni descargar lo que hay en ella.
4. **`playedAt`** (última reproducción por pista, alimenta la vista Recientes) no se puede borrar por separado.

## 2. La sección propuesta

Renombrar `Datos locales` a **Privacidad y datos**, en el mismo lugar de Ajustes. Cuatro bloques, en este orden:

### 2.1 Qué se guarda

Una lista de solo lectura, con cifras reales del dispositivo. Nada de texto genérico.

| Fila | Valor | De dónde sale |
|---|---|---|
| Canciones en la biblioteca | `5 002 canciones de 3 carpetas` | `useLibrary` (pistas) y `roots` |
| Portadas | `1 240 portadas · 84 MB` | almacén `covers` (sumar tamaños de los blobs) |
| Información editada | `12 canciones, solo aquí` o `Ninguna` | pistas con ediciones (`source`, `core/edits.ts`); almacén `edits` |
| Copias de música | `12,4 GB` o `Ninguna: se lee de tus carpetas` | OPFS `biblioteca/`; sin raíces `copy`, el texto alternativo |
| Playlists | `8 en este dispositivo · 6 sincronizadas` | `usePlaylists` (por `ownerId`) |
| Cambios pendientes de subir | `3` (solo si > 0) | almacén `outbox` |
| Espacio total usado | `12,6 GB de 120 GB disponibles` | `navigator.storage.estimate()` (ya expuesto como `library.space()`) |
| Cuenta | `Conectado como a…@correo.com` o `Sin cuenta: nada sale de este dispositivo` | sesión de `useAuthController` |

Debajo, una línea fija: «Tus archivos de música nunca se suben. Si tienes cuenta, solo se sincronizan tus playlists: su nombre y el
título, artista, álbum y duración de cada canción.» Esa frase tiene que seguir siendo verdad; si cambia la sincronización, se cambia.

### 2.2 Exportar

- **Copia de seguridad (JSON)**: la que ya existe. Sin cambios.
- **Datos de tu cuenta (JSON)**, solo con sesión: perfil (`display_name`, fecha de alta) y todas las playlists de la cuenta tal como
  están en Supabase. Se arma en el cliente con las mismas consultas de `src/sync/playlistService.ts`; no hace falta servidor. Cubre
  el derecho de acceso de la ley mexicana y la portabilidad del RGPD.

  Formato: `{ app: "reproductor", kind: "account", version: 1, exportedAt, profile: {...}, playlists: [{ name, tracks: [...] }] }`.
  Las playlists usan el mismo formato que la copia de seguridad, así que el archivo también se puede importar.

### 2.3 Borrar

De menor a mayor alcance, cada uno con su confirmación:

| Acción | Qué hace | Ya existe |
|---|---|---|
| Quitar una carpeta | Quita sus canciones, portadas huérfanas y copias | Sí (Biblioteca) |
| **Borrar el historial de Recientes** | Pone `playedAt` a `undefined` en todas las pistas; la vista Recientes queda con lo añadido | No |
| **Borrar datos de este dispositivo** | Lo actual **más** una casilla «Cerrar también la sesión», marcada por defecto si hay sesión. Si está marcada: `supabase.auth.signOut()` antes de vaciar | Parcial |
| **Eliminar cuenta** | Borra la cuenta y todo lo que hay en Supabase. No toca el dispositivo (para eso está la fila anterior) | No |

**Eliminar cuenta**, detalle:

- Pide la contraseña otra vez (`signInWithPassword`) para que un equipo desbloqueado no baste.
- Llama a una Edge Function nueva, `mp-delete-account`, que verifica el JWT y ejecuta `auth.admin.deleteUser(uid)` con la clave de
  servicio (que vive solo en el servidor, `AGENTS.md` §5). Las tablas ya tienen `on delete cascade` hacia `auth.users`
  (`profiles`, `playlists`; `playlist_tracks` cuelga de `playlists`), así que una sola llamada borra todo. Nombre con prefijo `mp_`
  porque el proyecto es compartido.
- Después: cerrar sesión localmente, marcar las playlists de esa cuenta como sin dueño (`ownerId: null`) para que no se pierdan del
  dispositivo, y mostrar «Tu cuenta se eliminó. Tus playlists siguen en este dispositivo.»
- **[Decides tú]** si las playlists locales de esa cuenta se conservan (propuesta) o se borran también.
- Prueba: con dos usuarios de prueba en un Postgres local, comprobar que tras borrar A no queda ninguna fila suya y B no cambia.

### 2.4 Analítica (opcional, desactivada)

**Hoy no hay analítica** y la CSP impide enviarla. Si algún día se añade, esta es la condición mínima:

- Un interruptor **«Enviar estadísticas de uso anónimas»**, **apagado por defecto**. Nunca se pregunta en el primer arranque ni con
  un diálogo que interrumpa.
- Si el navegador envía la señal Global Privacy Control (`navigator.globalPrivacyControl === true`), el interruptor queda apagado y
  se explica por qué.
- Debajo del interruptor, la lista completa de lo que se envía. Propuesta, cerrada: vista abierta (`biblioteca`, `playlists`,
  `ajustes`), navegador y sistema en versión mayor, tamaño de pantalla redondeado, y tres eventos de producto (`carpeta_añadida`,
  `playlist_creada`, `cuenta_creada`) **sin** nombres de canciones, rutas, conteos exactos ni identificadores persistentes.
- Herramienta sin cookies y, si se puede, alojada por ti (Umami o Plausible, como ya propone `PLAN.md` §6). **[Decides tú]** cuál.
- Al activarla: añadir su dominio a `connect-src` en `vercel.json`, pasar `node scripts/verificar-csp.mjs`, y actualizar el aviso de
  privacidad (nueva finalidad secundaria) y la política de almacenamiento **antes** de publicar.

**[Decides tú]** si de verdad hace falta. Para un proyecto en solitario, el panel de Supabase ya da altas y accesos sin añadir
nada al cliente. Mi recomendación: no añadir analítica en el cliente hasta que haya una pregunta concreta que solo se responda así.

### 2.5 Historial de escucha (cuando exista)

Lo especifica `PERFIL_Y_RECAPS.md`. En esta sección solo añade:

- Interruptor **«Guardar mi historial de escucha»**, encendido por defecto porque se queda en el dispositivo.
- Interruptor **«Sincronizar el historial con mi cuenta»**, apagado por defecto, solo con sesión.
- «Borrar historial» con selector de periodo (último mes, último año, todo).
- El historial entra en «Datos de tu cuenta (JSON)» y en un CSV aparte.

## 3. Textos

| Lugar | Texto |
|---|---|
| Título de la sección | Privacidad y datos |
| Subtítulo | Lo que la app guarda en este dispositivo y en tu cuenta. |
| Confirmar borrar Recientes | ¿Borrar el historial de Recientes? Las canciones siguen en tu biblioteca; solo se olvida cuándo sonaron. |
| Confirmar borrar dispositivo | Se borrarán de este navegador tu biblioteca, las copias de música, tus playlists y tus ajustes. Tus archivos originales no se tocan. |
| Casilla | Cerrar también la sesión |
| Confirmar eliminar cuenta | Se borrarán tu cuenta y tus playlists sincronizadas. Esto no se puede deshacer. Escribe tu contraseña para continuar. |
| Botón | Eliminar mi cuenta |

## 4. Orden de implementación

> **Hecho (2026-11-13):** 1 (casilla «Cerrar también la sesión», con `signOutForWipe`), 2 (`library.clearPlayed`, test en `core/library.test.ts`), 3 («Qué se guarda»; las cifras salen de `useLibrary`, `usePlaylists`, el almacén `covers`, `LocalLibrary.copiesSize` y `library.space`) y 4 («Datos de tu cuenta», `buildAccountExport` con test de importación). **No hecho: 5.** La captura del bloque no se añadió a la matriz de `scripts/capturas.mjs`.

Del cambio más pequeño al más grande; cada uno es un commit con su prueba:

1. Casilla «Cerrar también la sesión» en el borrado actual. Prueba en `prueba-biblioteca.mjs`: tras borrar con la casilla, no queda
   ninguna clave `sb-*` en `localStorage`.
2. «Borrar el historial de Recientes». Test en Vitest sobre la vista Recientes de `core/library.ts`.
3. Bloque «Qué se guarda» con cifras reales. Captura en la matriz de `scripts/capturas.mjs`.
4. «Datos de tu cuenta (JSON)». Test del formato con `parseBackup` (debe poder importarse).
5. «Eliminar cuenta» con la Edge Function. Requiere desplegar una función en el proyecto compartido: documentarlo en `SUPABASE.md`
   antes. **Decidido 2026-11-12:** se hace **antes de abrir registros** (L9), no al migrar al proyecto dedicado.

La analítica y el historial no entran aquí: dependen de decisiones previas.

## 5. Lo omitido y los riesgos

- No especifiqué el equivalente nativo (Android/iOS): allí la sesión irá en Keystore/Keychain (`SecureStore`) y el borrado debe
  limpiar también ese almacén.
- La cifra de portadas obliga a recorrer los blobs del almacén `covers`; con miles de portadas conviene calcularla al abrir la
  sección y no en el arranque.
- Mientras no exista «Eliminar cuenta», cada solicitud de cancelación es manual desde el panel de Supabase y cuenta contra el plazo
  legal de 20 días hábiles.
