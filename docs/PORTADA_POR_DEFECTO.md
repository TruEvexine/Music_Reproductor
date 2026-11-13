# Portada por defecto: tres propuestas (2026-11-13)

Las portadas generativas actuales («campos de color») se descartan por parecer formas al azar. Hay tres propuestas implementadas en el código real, sin formas aleatorias: un **tono plano que sale del título** (mismo título, mismo tono; luminosidad y croma fijos, solo cambia el matiz) y, encima, otra cosa. Sin degradados, sin sombras, sin movimiento.

Cómo verlas: `ESTILOS=inicial,nota,tarjeta node scripts/portadas-propuestas.mjs <carpeta>` contra `npm run dev` (reescribe la constante `COVER_STYLE` al servir el módulo; no hay interruptores en la app). Capturas ya hechas en `docs/capturas/portadas/` (láminas por estilo: lista de 48 px y reproductor grande en los 9 tamaños de la matriz; AMOLED y HDR simulado a 390×844 y 1440×900; y comparativas `comparar-390.jpg` y `comparar-1440.jpg`).

| | A · Inicial | B · Nota | C · Tarjeta |
|---|---|---|---|
| Qué es | Placa oscura (L 0,28) con la inicial del título en el tono claro (L 0,80), Instrument Sans 650 al 88 % de anchura | Placa media (L 0,50) con una corchea doble dibujada a mano en SVG (L 0,95) | Placa clara (L 0,86) con el título en la tinta oscura del mismo tono y el artista abajo |
| A 48 px | Se lee a primera vista (una letra a 32 px) | Se lee a primera vista; en una lista todas se parecen salvo el tono | Título a 12 px (mínimo del sistema), palabras largas cortadas («Sincroniz…»); es lo más débil |
| En grande | Limpia, pero grande y vacía | Reconocible como «sin carátula» al instante | La más informativa y la más editorial |
| Con el tema oscuro | Calla: no compite con las carátulas reales | Neutra, algo más viva | **Es lo más brillante de la pantalla**; empuja la mirada fuera del título |
| AMOLED / HDR | La placa (L 0,28) se ve sobre el negro puro; HDR le aplica el filtro de `.cover` | Bien | Bien, pero deslumbra más |
| Coste | Un nodo de texto y un color | Un SVG por fila | Dos nodos de texto con `line-clamp` por fila |
| Duplica texto | No | No | Sí (el título ya está al lado; por eso va `aria-hidden`) |

## Recomendación: A · Inicial

1. **Calla** (principio 2 de `DESIGN.md`: «lo demás calla»): una placa oscura con un tono sobrio no compite con las portadas reales ni con el reproductor grande, que es lo único audaz.
2. **Se lee a cualquier tamaño** porque lleva un solo carácter; B también, pero C depende del tamaño y a 48 px se corta.
3. **Distingue canciones**: B dibuja el mismo glifo en todas las filas sin carátula; A reparte letra y tono, así que dos filas seguidas casi nunca se parecen.
4. **Usa la tipografía de la casa** y es la más barata de pintar.
5. Funciona en AMOLED (la placa se separa del negro) y con HDR sin tocar nada.

Pros y contras de las otras: **B** es la que más se parece a Apple Music y Spotify y la que mejor comunica «aquí falta la carátula», pero es más genérica y repetitiva. **C** es la más bonita en grande, pero se corta en las filas y es la más brillante sobre el tema oscuro.

**Límites de A.** Muchas canciones empiezan por la misma letra (en listas ordenadas por título salen letras repetidas seguidas, distinguidas solo por el tono). El matiz sale de un hash: títulos distintos pueden tener tonos parecidos (en las pruebas, dos de siete salieron casi iguales).

## Para adoptar la elegida

Cambiar `COVER_STYLE` en `src/core/coverArt.ts` y borrar lo que sobre: las otras dos ramas de `FlatArt` (`ui/parts.tsx`), su CSS (`base.css`), y, si se descarta «campos», `artBackground`, `artOf`, la capa `art-drift`, el token `--drift` y la sección «Portada generativa» de `DESIGN.md`. No se tocó nada de eso: `COVER_STYLE` vale `"campos"` (el actual) hasta que se decida.

## Opción opt-in: buscar portadas que faltan en Cover Art Archive (sin implementar)

Sería un ajuste apagado por defecto («Buscar portadas que faltan en internet») que, para las pistas sin carátula, consultaría MusicBrainz con título, artista y álbum para obtener un identificador de lanzamiento y pediría la imagen a Cover Art Archive (`coverartarchive.org`, que redirige a archive.org), guardándola en el mismo almacén de portadas con el límite de 12 MB y la lista blanca de MIME. Su coste de privacidad es real y choca con la promesa del producto: cada búsqueda envía a un tercero (MusicBrainz, y después archive.org) el título, el artista y el álbum de tu música, además de tu IP, y deja ver qué escuchas aunque nunca se suba un archivo; los emparejamientos son aproximados (puede poner una portada equivocada) y la imagen llega de un dominio ajeno. Además toca la CSP (`connect-src` y `img-src` hoy cierran al propio dominio y al servidor de cuentas; habría que añadir `musicbrainz.org`, `coverartarchive.org` y `archive.org`, o proxificar por una Edge Function, que entonces vería esos datos), exige actualizar el aviso de privacidad y la promesa de «tu música no se sube» (decir con exactitud qué sale y a quién), respetar la tasa de MusicBrainz (1 petición por segundo y un `User-Agent` identificable, que no debe incluir datos personales) y un caché negativo para no repetir consultas. Recomendación: no hacerlo ahora; si se hace, que sea opt-in explícito por carpeta, con la lista de lo que se envía visible en el propio ajuste y sin lanzarlo en bloque sobre toda la biblioteca.
