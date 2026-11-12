# Perfil, historial de escucha y recaps

Estado: **propuesta**, sin implementar. Amplía `docs/DISENO_ESTADISTICAS.md` (panel de estadísticas) con el perfil y los recaps, y
cambia una cosa de aquella propuesta: **el servidor no recibe eventos sueltos, solo resúmenes diarios** (§2.4). Las decisiones tuyas
están marcadas **[Decides tú]**.

Principio que ordena todo: **se calcula y se guarda en el dispositivo**. La cuenta solo añade sincronización, y es opcional.

## 1. Perfil

### 1.1 Qué existe

- `profiles.display_name` (máx. 60 caracteres) se llena en el registro; `profiles.avatar_url` existe (solo `https://`, máx. 500) pero la
  app no la usa (`supabase/migrations/20261014120000_hardening_limits.sql`).
- No hay pantalla de perfil ni forma de cambiar el nombre.

### 1.2 Propuesta

| Dato | Sin cuenta | Con cuenta | Notas |
|---|---|---|---|
| **Nombre** | Opcional, en `kv` (`profile.name`). Solo se usa para el saludo del recap | `profiles.display_name` | Máx. 60 caracteres, se pinta como texto (`AGENTS.md` §5) |
| **Foto** | Opcional, en `kv` (`profile.avatar`, un blob) | Además, en un bucket **privado** de Supabase Storage, `mp-avatars/<uid>/avatar.jpg` | Ver abajo |

**Foto, con privacidad primero:**

- Se elige con un `<input type="file" accept="image/*">`. Se valida tamaño (≤ 12 MB) y MIME con la lista blanca que ya existe
  (`src/core/coverMime.ts`).
- Se recorta a cuadrado y se re-codifica a **JPEG de 256 × 256 px en un canvas**. Re-codificar elimina los metadatos EXIF, **incluida
  la ubicación GPS** de las fotos del teléfono. Resultado: 15 a 30 KB.
- Con cuenta, se sube al bucket privado con una política de Storage que solo deja leer y escribir la carpeta `auth.uid()`. Se descarga
  con el cliente de Supabase (`connect-src` ya lo permite) y se muestra como URL `blob:`: **no hay que tocar `img-src` de la CSP**.
- `profiles.avatar_url` se queda sin usar: una URL pública haría la foto visible para cualquiera que la conozca.
- No hay perfil público ni funciones sociales. Nadie más ve el perfil. **[Decides tú]** si eso cambia algún día; obligaría a revisar
  el aviso de privacidad.

## 2. Historial de escucha

### 2.1 Qué existe

Solo `track.playedAt`: la fecha de la **última** reproducción de cada pista (`library.markPlayed`), para la vista Recientes. No hay
historial.

### 2.2 Qué cuenta como reproducción

Igual que `docs/DISENO_ESTADISTICAS.md`: cuenta si se escuchó **≥ 30 s y ≥ 50 % de la pista, o ≥ 4 min**. Además se guarda el tiempo
realmente escuchado, para sumar minutos aunque no cuente como reproducción.

El tiempo escuchado sale del reloj del audio (`timeupdate` de `PlayerEngine`), nunca de un temporizador, como el resto del reproductor
(`AGENTS.md` §3): se suman los avances de `currentTime` menores de 2 s entre eventos, así un salto con la barra no cuenta como escucha.

Casos que necesitan test: pausa larga, salto hacia atrás y hacia adelante, repetición de pista (cada vuelta es un evento), cambio de
pista durante el crossfade (el evento se cierra al empezar el fundido), pista que falla, pestaña cerrada a media canción (el evento se
cierra con lo acumulado en el siguiente arranque).

### 2.3 Modelo local

Migración nueva **al final** de `platform/web/db.ts` (v3), como exige `AGENTS.md` §4:

```ts
// v3: historial de escucha.
(db) => {
  const plays = db.createObjectStore("plays", { keyPath: "id", autoIncrement: true });
  plays.createIndex("startedAt", "startedAt");
}
```

| Campo | Tipo | Ejemplo | Por qué |
|---|---|---|---|
| `trackKey` | string | `track:v2:9f3c…` | Identidad estable: `v2` si existe; si no, el id de biblioteca |
| `title`, `artist`, `album`, `genre` | string | | Desnormalizado: si la pista sale de la biblioteca, el historial sigue diciendo qué sonó |
| `year` | number? | 1997 | |
| `durationMs`, `listenedMs` | number | 241000, 198500 | |
| `counted` | boolean | `true` | Cumple la regla de §2.2 |
| `skipped` | boolean | `false` | Se pasó a otra antes de 30 s |
| `startedAt` | number | `Date.now()` | UTC en ms |
| `tzOffset` | number | -360 | Minutos; la hora local del mapa de hábitos debe ser la del momento, no la de hoy |
| `lossless`, `hiRes` | boolean | | Para la métrica de calidad |

**Peso:** unos 250 bytes por evento. Con 50 canciones al día: ~12 KB diarios, **~4,5 MB al año**. Cabe sin problema en IndexedDB.

**Retención:** eventos completos durante **24 meses**; después se compactan en resúmenes diarios (la misma forma que §2.4) y se
borran los eventos. **[Decides tú]** el plazo.

**Controles** (ver `AJUSTES_PRIVACIDAD.md` §2.5): guardar historial (encendido, porque no sale del dispositivo), sincronizar
(apagado), borrar por periodo, exportar CSV, y **sesión privada**: un interruptor en el menú del reproductor que deja de registrar
hasta que lo apagas o pasan 6 horas.

### 2.4 Modelo en la nube (opcional)

Solo si la persona activa «Sincronizar el historial con mi cuenta». Se suben **resúmenes diarios**, no eventos: el servidor no sabe a
qué hora sonó cada canción, solo cuánto sonó cada día.

```sql
create table if not exists public.mp_play_daily (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,               -- día local del dispositivo
  track_key   text not null check (char_length(track_key) <= 512),
  title       text check (char_length(title) <= 300),
  artist      text check (char_length(artist) <= 300),
  album       text check (char_length(album) <= 300),
  genre       text check (char_length(genre) <= 100),
  plays       integer not null default 0 check (plays >= 0),
  listened_ms bigint  not null default 0 check (listened_ms >= 0),
  hours       smallint[] ,                  -- 24 posiciones con minutos por hora local; null si el usuario lo desactiva
  primary key (user_id, day, track_key)
);
alter table public.mp_play_daily enable row level security;
-- Políticas select/insert/update/delete con user_id = auth.uid(); upsert por lotes de ≤ 500 filas con una función RPC.
```

- `hours` permite el mapa de hábitos multidispositivo. **[Decides tú]** si se sube; sin él, el mapa solo existe en local.
- Tamaño: ~250 bytes por fila contando el índice de la clave primaria. 30 canciones distintas al día = **~2,7 MB por usuario y año**. Es el dato que más crece en la base
  (`ROADMAP.md` §3).
- Borrado en cascada al eliminar la cuenta. Migración aditiva e idempotente, probada en un Postgres local (`AGENTS.md` §5).
- Diferencia con `docs/DISENO_ESTADISTICAS.md`, que proponía `mp_play_events` en bruto: los eventos sueltos dicen a qué hora exacta
  escuchas cada cosa y multiplican el volumen por ~3. Los recaps no los necesitan.

## 3. Recaps

### 3.1 Qué son

Una secuencia corta de tarjetas a pantalla completa (vertical, 9:16) que resume un periodo: **semana**, **mes** y **año**. Se abre
desde una entrada «Tu resumen» en la vista Recientes y, en diciembre, con un aviso discreto. Funcionan **sin cuenta y sin red**,
calculados en el dispositivo. Con premium (`MONETIZACION.md` §4), suman todos los dispositivos y guardan el archivo de años anteriores.

Requisito para mostrar un recap: **≥ 60 minutos escuchados en el periodo**. Por debajo: «Todavía no hay suficiente música en este
periodo. Vuelve cuando hayas escuchado al menos una hora.»

### 3.2 Métricas y cálculo

Todas salen de los eventos de `plays` del periodo, en hora local (`startedAt + tzOffset`).

| Métrica | Cálculo |
|---|---|
| Minutos escuchados | Σ `listenedMs` ÷ 60 000 |
| Reproducciones | Nº de eventos con `counted` |
| Canciones y artistas distintos | Nº de `trackKey` y de `artist` normalizados distintos |
| Top 5 canciones | Orden por reproducciones; empate por minutos |
| Top 5 artistas | Orden por minutos (un artista con canciones largas no queda por debajo de uno con muchas cortas) |
| Top género | Por minutos, tras normalizar: minúsculas, sin acentos, separar «Rock; Pop» y «Rock/Pop», alias (`hip hop` = `hip-hop`) |
| Racha más larga | Máximo de días locales consecutivos con al menos un evento contado |
| Hábitos | Matriz 7 × 24: minutos por día de la semana y hora local |
| Hora pico | Celda de hora (sumando los 7 días) con más minutos |
| Evolución | Minutos por día (recap de semana y de mes) o por semana ISO (recap de año) |
| Descubrimientos | Artistas cuyo primer evento de todo el historial cae dentro del periodo |
| Calidad | Minutos con `lossless` ÷ minutos totales; aparte, la parte en Hi-Res |
| Saltadas | Eventos con `skipped` ÷ eventos totales |

**Artista normalizado:** minúsculas, sin acentos, sin «feat.» ni lo que sigue; «Artista desconocido» no entra en los rankings.

El cálculo es una sola pasada sobre los eventos (O(n)) y va en un worker para no bloquear la interfaz. Un año con uso intenso son
~18 000 eventos; se mide con 100 000 sintéticos, como ya pide `docs/DISENO_ESTADISTICAS.md`. El resultado (unos pocos KB) se guarda en
`kv` como `recap:<periodo>:<inicio>` y se recalcula solo si hay eventos nuevos en ese periodo.

### 3.3 Las tarjetas

Forma elegida según el trabajo de cada dato (skill dataviz, `choosing-a-form`): casi todo es **una sola serie**, así que casi todo
es un número, una barra o una rampa de un solo tono. No hay donas, ni varias series de colores, ni doble eje.

| # | Tarjeta | Forma | Detalle |
|---|---|---|---|
| 1 | «Escuchaste 4 812 minutos» | **Cifra destacada** (≥ 48 px, cifras tabulares) | Debajo, en texto secundario: reproducciones, canciones y artistas distintos |
| 2 | Tus artistas | **Barras horizontales ordenadas**, una sola tinta | Nombre a la izquierda, minutos al final de la barra; la nº 1 con su portada más usada al lado |
| 3 | Tus canciones | **Lista con medidor**: portada de 48 px, título, artista y una barra fina alineada | Barras con la misma escala (máximo = la nº 1) |
| 4 | Cuándo escuchas | **Mapa de calor 7 × 24** con rampa secuencial | Celdas vacías en `--surface-3`, leyenda de escala de 5 pasos, hora pico señalada con texto |
| 5 | Tu año, semana a semana | **Área de una serie** (línea de 2 px y relleno suave) | Etiqueta directa solo en la semana máxima; guía vertical y tooltip al tocar |
| 6 | Tu racha | **Cifra** («17 días seguidos») + tira de calendario del periodo, un cuadro por día | Cuadro lleno si hubo escucha |
| 7 | Cómo suena | **Medidor**: parte sin pérdida sobre el total | «El 62 % de tus minutos fue sin pérdida; el 18 %, en alta resolución» |
| 8 | Tus géneros | **Barras horizontales**, top 5 y «Otros» | No dona: cinco partes parecidas se comparan mejor en barras |
| 9 | Cierre | Portada del álbum más escuchado, grande, con el nombre y las tres cifras principales | Es la tarjeta pensada para compartir |

**Color:**

- Las marcas usan el **acento de la portada del álbum más escuchado del periodo**, el mismo sistema que ya tiñe la app
  (`usePalette`). Si ese acento no llega a **3:1 de contraste** contra `--surface-1`, se usa el acento fijo `oklch(0.84 0.09 85)`.
- El mapa de calor usa una **rampa de un solo tono**: el tono del acento con cinco luminosidades fijas, OKLCH L = 0.45, 0.56, 0.67, 0.77
  y 0.88. Con el acento por defecto (`#675223 · #8a713a · #af9151 · #cfb070 · #f0d49b`) pasa las cuatro comprobaciones del validador de
  la skill contra `--surface-1` (`#151311`): luminosidad monótona, saltos ≥ 0,06, extremo claro a 2,48:1 (mínimo 2:1) y un solo tono.
  Para otros tonos, la app comprueba en tiempo de ejecución el contraste del paso más oscuro y, si falla, sube las cinco luminosidades
  0,04.
- **Los textos nunca van en el color de la serie**: cifras y etiquetas en `--ink` y `--ink-2`.
- Rejilla y ejes, si aparecen, en líneas finas sólidas un tono por encima de la superficie. Nunca discontinuas.

**Accesibilidad:** cada tarjeta tiene «Ver como tabla» con los mismos datos; el mapa de calor y el área llevan una descripción en texto
(«Escuchas sobre todo los viernes entre 22 y 24 h»). La navegación entre tarjetas funciona con flechas, botones visibles y deslizar.
Nada depende solo del color: los rankings llevan número de posición.

### 3.4 Animación

Sin dependencias nuevas: CSS y la Web Animations API, animando solo `transform` y `opacity` (`AGENTS.md` §6).

| Elemento | Animación | Tiempo |
|---|---|---|
| Cifra destacada | Cuenta de 0 al valor | 600 ms, desacelerando (`--ease`) |
| Barras | `scaleX` desde la base (`transform-origin` a la izquierda), una tras otra | 400 ms cada una, 40 ms entre barras |
| Mapa de calor | `opacity` por filas, de lunes a domingo | 30 ms entre filas |
| Área | Se revela con una máscara que avanza de izquierda a derecha (`transform` sobre el rectángulo de recorte) | 700 ms |
| Cambio de tarjeta | Desplazamiento horizontal + fundido | `--base` (220 ms) |

Con «Reducir movimiento» (de la app o del sistema): todo aparece en su estado final, sin cuentas ni barras creciendo.

### 3.5 Cuánto pesan

| Qué | Peso | Cómo se mantiene |
|---|---|---|
| Código de los recaps | Objetivo **≤ 15 KB gzip** | Chunk aparte con carga diferida (`import()` al abrir el recap). SVG escrito a mano: escalas lineales y la ruta del área son unas pocas líneas; no hace falta librería de gráficas |
| Datos leídos | ~4,5 MB por año de eventos | Se leen por el índice `startedAt` solo del periodo, dentro del worker |
| Resultado guardado | Unos KB por recap | `kv` |
| Imagen para compartir | ~200 KB (JPEG 1080 × 1920, calidad 0,9) | Se genera solo al pulsar «Compartir» |

Medición pendiente al implementar: tiempo de cálculo con 100 000 eventos en un móvil de gama media (objetivo < 300 ms) y el tamaño
real del chunk en `npm run build`.

### 3.6 Cómo se comparten

- **Todo en el dispositivo.** La tarjeta se dibuja en un `OffscreenCanvas` de 1080 × 1920 (dentro del worker cuando el navegador lo
  permite). Las portadas son URLs `blob:` del mismo origen, así que el canvas no queda bloqueado. Sin librerías de captura de HTML.
- **Web Share API** con archivos: si `navigator.canShare({ files })` es verdadero, se abre el menú de compartir del sistema. Si no,
  se descarga la imagen (`<a download>`).
- **Antes de compartir**, dos interruptores: «Ocultar títulos de canciones» y «Ocultar portadas». Es lo que alguien puede no querer
  enseñar.
- **Sin enlace público.** Un enlace exigiría guardar el recap en un servidor, con su aviso de privacidad y su moderación. Fuera de
  alcance. **[Decides tú]** si algún día se quiere.
- En la app nativa, el plugin de compartir de Capacitor sustituye a la Web Share API (Fase 11).

## 4. Orden de implementación

1. Captura de eventos y migración v3, sin interfaz; tests de la regla de conteo y de los casos de §2.2.
2. Controles de historial en Ajustes (guardar, sesión privada, borrar, exportar CSV).
3. Recap de mes, tarjetas 1, 2, 3 y 9 (las que no necesitan gráficas complejas) y compartir.
4. Mapa de calor, área, racha, calidad y géneros; recaps de semana y año.
5. Perfil local (nombre y foto).
6. Con cuenta: foto en Storage y, si se decide, `mp_play_daily`.

Cada paso con capturas en la matriz de `scripts/capturas.mjs` revisadas con criterio de diseño (`AGENTS.md` §6).

## 5. Lo omitido y los riesgos

- No diseñé las tarjetas en alta fidelidad ni validé otras paletas que no sean la del acento por defecto; la comprobación en tiempo
  de ejecución de §3.3 cubre los demás tonos, pero hay que verla con portadas reales (muy saturadas, casi grises).
- Los pesos de §2.3 y §3.5 son estimaciones de diseño; se miden al implementar.
- **Riesgo:** el historial revela hábitos (horarios, estado de ánimo, gustos). Por eso el servidor solo recibe resúmenes diarios y
  solo si la persona lo activa. Si la sincronización se activa sin `hours`, el mapa de hábitos multidispositivo no existe: es el
  costo de la privacidad, y está bien así.
- **Riesgo:** «Tu resumen» del año se parece por fuerza a otros recaps anuales conocidos. Evitar copiar su estética, sus textos o su
  formato de diapositivas: la identidad sale de las portadas de la propia biblioteca y de la paleta de la app.
