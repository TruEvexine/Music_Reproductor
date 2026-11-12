# «HDR simulado» (interruptor global)

Un solo interruptor para toda la app (`Menú ≡ → Fondo → HDR simulado en toda la app`, o Ajustes → Apariencia; `data-hdr` en `<html>`, campo `hdr` de los ajustes del fondo). Ya no es un modo del fondo: convive con Portada, Ritmo, Estático y AMOLED. Los ajustes guardados con el antiguo modo `hdr` se migran solos a Portada + interruptor encendido.

## Qué cambia con el interruptor

| Parte de la app | Efecto | Tope |
|---|---|---|
| Fondo y negro | `--bg` a negro puro; manchas del reproductor y tinte de la app con más croma (y curva de contraste y reflejos en el lienzo) | Reflejos ≤ 0,25 × techo; tinta ≥ 4,5:1 |
| Acentos (botón primario, progreso, pista actual) | `--accent` con ganancia de croma | Croma ≤ `--hdr-cmax` (0,15 sRGB / 0,18 P3), luminosidad ≤ `--hdr-peak` |
| Brillos y difuminados (`--glow`) | Misma ganancia con tope | Igual |
| Portadas y su respaldo en degradado | `filter: saturate() contrast()` estático sobre `.cover` | sRGB 1,08 / 1,04 · P3 1,16 / 1,06 |
| Error (`--danger`) | Más vivo; en P3, `color(display-p3 …)` | — |

## Qué es y qué no es

**No es HDR real.** En una página web, el HDR garantizado solo existe para imágenes y vídeo con transferencia PQ/HLG; el texto, los
colores CSS y un `<canvas>` normal se quedan en el blanco estándar (SDR) aunque la pantalla sea HDR. El modo imita el efecto con
tres cosas que sí se controlan: negro puro (en OLED, píxel apagado), luces de croma alto en una gama más ancha cuando la pantalla la
tiene, y reflejos pequeños con un techo de brillo. La etiqueta del menú dice «simulado» y el texto de ayuda lo repite.

## Cómo degrada (una sola política, en `tokens.css`)

Siempre a SDR sin romper nada: sin sintaxis de color relativo el acento queda como el de la portada; con `prefers-contrast: more` el realce se apaga (croma ×1, sin curva, sin reflejos, sin filtro en portadas); con `prefers-reduced-motion` o sin WebGL el fondo es un gradiente CSS quieto (el interruptor no añade ningún movimiento propio).

| Pantalla | Se detecta con | Croma de las luces | Curva de contraste | Reflejos (techo) | Techo de luminosidad del acento |
|---|---|---|---|---|---|
| sRGB estándar | (por defecto) | ×1,2 | 35 % | 0,6 | 0,86 |
| Gama ancha | `@media (color-gamut: p3)` | ×1,5, en Display P3 | 25 % | 0,8 | 0,86 |
| Gama ancha + rango alto | `(color-gamut: p3) and (dynamic-range: high)` | ×1,5, en Display P3 | 25 % | 1,0 | 0,90 |

- En sRGB, la «curva de contraste y saturación» es la ganancia de croma más una curva en S en el shader (negros más hondos, tonos más
  separados). En P3 la gama ya aporta la viveza, así que la curva se suaviza.
- Las variables `--hdr-chroma`, `--hdr-contrast`, `--hdr-glint` y `--hdr-peak` las leen el CSS (acento con sintaxis de color relativo,
  `oklch(from var(--accent-in) min(l, var(--hdr-peak)) calc(c * var(--hdr-chroma)) h)`, dentro de `@supports`) y el fondo WebGL
  (`ui/hdr.ts`), de modo que no pueden discrepar.
- **Display P3 de verdad:** los colores del fondo se reconvierten desde OKLCH a P3 (`core/palette.ts`, `oklchToRgb(…, "p3")`), el
  búfer del lienzo pasa a `drawingBufferColorSpace = "display-p3"` y el respaldo CSS usa `color(display-p3 r g b / a)`. Si el
  navegador no soporta el espacio, los colores se ven en sRGB: menos vivos, nunca rotos.
- **Techo de brillo:** los reflejos son un núcleo pequeño por mancha que suma como máximo `0,25 × glint` en el shader. En una pantalla
  OLED o HDR, un blanco grande sobre negro deslumbra y desgasta; por eso el techo existe también donde la pantalla podría dar más. El
  brillo máximo del fondo se mide en píxeles (`scripts/prueba-hdr.mjs`) y la tinta mantiene ≥ 4,5:1.
- Sin sintaxis de color relativo (navegadores anteriores a 2023), el acento queda como el de la portada: no se rompe nada.
- Con `prefers-reduced-motion` o sin WebGL: gradiente CSS quieto sobre negro, también en `display-p3`.

## Qué se probó y qué no

Probado (Chromium, `node scripts/prueba-hdr.mjs`; los tests de `core/` cubren la matemática):

- El interruptor se aplica, persiste, deja `--bg` en negro puro y, al apagarlo, vuelve todo a SDR (sin filtro de portadas ni `--hdr-*`).
- Las portadas reciben el filtro de la fila (1,08 en sRGB, 1,16 en P3) y `prefers-contrast: more` lo quita.
- Contraste real en el navegador: acento sobre negro y `--on-accent` sobre acento ≥ 4,5:1 en sRGB y P3 (medidos 10–12:1). El peor caso de todos los tonos (0–355°, croma 0,07–0,14, con ganancia y tope) está en `src/core/hdr.test.ts`.
- Las reglas de las tres filas de la tabla: `color-gamut` por emulación CDP y `dynamic-range: high` con `--force-color-profile=hdr10`
  (CDP no emula `dynamic-range`).
- El acento resuelto sube el croma ×1,2 / ×1,5 sin cambiar de tono y sin superar el techo de luminosidad.
- El lienzo pasa a `display-p3` solo con pantalla P3; el respaldo CSS usa `display-p3` solo entonces.
- P3 conserva más croma que sRGB al mismo tono y luminosidad (`core.test.ts`); grises idénticos.
- Contraste del fondo con la tinta ≥ 4,5:1 en los tres escenarios; sin errores en movimiento reducido ni sin WebGL.

**Solo puede verse en una pantalla real:** cómo luce el negro en un OLED, si el P3 se nota o satura de más en un panel concreto, si
el techo de reflejos es cómodo en un HDR de 1000 nits, y que Safari/Firefox respetan `drawingBufferColorSpace`. Emular el media
query cambia las reglas, no la pantalla; las capturas de la prueba son sRGB y no muestran el P3.
