# Satin · marca definitiva

> Decidido el 2026-11-13 con el usuario, paso a paso. Este documento manda sobre `docs/producto/MARCA.md` en nombre, logo y
> animación de carga. Lo que falta verificar por fuera (IMPI, abogado, redes) está en §6.

## 1. Nombre: **Satin**

- **Por qué:** evoca suavidad, brillo y cuidado —calidad de sonido, elegancia y modernidad—, es corto, se escribe sin dudas y en
  español suena natural («satín» existe).
- **Cómo se escribe:** «Satin» en el texto, «satin» en minúsculas en el logotipo. Nunca «SATIN» ni «Satín» en la marca.
- **Proceso:** 10 propuestas, filtro por conflictos, pronunciación y disponibilidad, 3 finalistas (Legato, Satin, Overtone). Detalle
  y fuentes en [`NOMBRE.md`](NOMBRE.md).
- **Disponibilidad comprobada (2026-11-13):** `satin.app` y `satin.com` **ocupados**. Libres por RDAP: `getsatin.app`,
  `satinplayer.app`, `playsatin.app`, `satinmusic.app`, `satinplayer.com`. Usuario `satinapp` libre en GitHub, YouTube y Bluesky.
  `satin.mx`, `satin.fm` y `satin.audio` sin DNS: **sin confirmar**.
- **Riesgo conocido:** a simple vista se confunde con «Satan». El logotipo en minúsculas serif lo atenúa; tenlo en cuenta en
  campañas y en nombres de usuario.

## 2. Logo: **Trama al bies**

**Idea en una frase:** un satén de 5 lizos girado 45° —cada hilo flota sobre cuatro pasadas, por eso la tela brilla en diagonal.

Se exploraron 3 rutas (Trama, Pliegue, Brillo; ver `exploracion/`); el usuario eligió Trama y, de sus 4 variantes, la girada al bies.

### Construcción

- Lienzo de 256. Cinco hilos de 24 de grosor con 10 de separación y 214 de largo, girados −45° sobre el centro.
- Cada hilo se interrumpe una vez (hueco de 12). El orden de los cortes es el del satén de 5 lizos: hilo *c* en la posición
  `2c mod 5`, repartidos entre el 30 % y el 70 % del largo para que ningún tramo quede como un punto.
- Extremos redondeados (cápsulas), como los iconos de la app. Todo son trazados: sin texto vivo, sin máscaras, sin transformaciones
  en los maestros.
- **Versión pequeña** (16–39 px): 3 hilos de 40, mismo giro y misma lógica. A 16 px cinco hilos se empastan.
- **Logotipo:** «satin» en **Instrument Serif** (SIL Open Font License 1.1, permite su uso en logos), convertida a trazos. Altura x
  ≈ 46 % del símbolo; separación símbolo–palabra = 44 de 256.

### Versiones (`logo/svg/`)

| Archivo | Uso |
|---|---|
| `satin-logotipo-horizontal-*.svg` | Principal: cabecera, landing, documentos |
| `satin-logotipo-vertical-*.svg` | Piezas cuadradas, pantallas de presentación |
| `satin-simbolo-*.svg` | Iconos, avatar, sello; ≥ 40 px |
| `satin-simbolo-pequeno-*.svg` | Favicon y tamaños de 16 a 39 px |
| `satin-palabra-*.svg` | Cuando el símbolo ya está presente al lado |

Cada pieza existe en `oro`, `negro` (negro cálido) y `marfil`.

### Espacio de seguridad y tamaños mínimos

- Unidad **x** = grosor de un hilo (24/256 del alto del símbolo). Margen libre mínimo: **2x** en los cuatro lados.
- Mínimos: símbolo completo 40 px (10 mm); símbolo pequeño 16 px (5 mm); horizontal 20 px de alto (6 mm); vertical 56 px (16 mm).

### Color

| Nombre | HEX | OKLCH | RGB | CMYK aprox. |
|---|---|---|---|---|
| Oro arena | `#e6c686` | `0.84 0.09 85` | 230 198 134 | 0 14 42 10 |
| Negro cálido | `#0b0a08` | `0.145 0.004 70` | 11 10 8 | 0 9 27 96 |
| Marfil | `#f4f1ed` | `0.96 0.006 85` | 244 241 237 | 0 1 3 4 |

- Son los mismos valores que `--accent` de reposo, `--bg` e `--ink` de `src/ui/styles/tokens.css`: logo e interfaz son una familia.
  El acento de la interfaz cambia con la portada; **el del logo es fijo**.
- Contraste medido (WCAG): oro/negro **12.0:1**, oro/AMOLED **12.8:1**, marfil/negro **17.6:1**, oro/blanco **1.6:1** (prohibido).
- Fondos aprobados: negro cálido, AMOLED (#000), marfil o blanco **solo con el logo en negro**. Una tinta: negro o marfil.
- Los CMYK son conversiones aproximadas: pide prueba de color a la imprenta. **Sin Pantone asignado** (necesita guía física).
- Color a evitar en la marca: **verde** (decisión del usuario).

### Usos incorrectos

Estirar o comprimir · girar el símbolo · cambiar el color (sobre todo a verde) · degradados · oro sobre fondo claro · contornos ·
sombras y brillos · reordenar, quitar o añadir hilos · otra tipografía para «satin» · sobre fotos sin contraste. Ejemplos en
`logo/capturas/usos-incorrectos.png`.

### Iconos (`logo/iconos/`)

| Archivo | Destino |
|---|---|
| `favicon.svg`, `favicon.ico` (16, 32, 48), `favicon-16/32/48.png` | Pestaña. Símbolo pequeño sobre azulejo negro cálido: se lee con tema claro y oscuro |
| `apple-touch-icon.png` (180) | iOS: cuadrado lleno sin transparencia; el sistema redondea |
| `icon-192.png`, `icon-512.png` | Manifest de la PWA (`purpose: any`) |
| `maskable-512.png` | Manifest (`purpose: maskable`); el rombo queda dentro del círculo seguro del 80 % |
| `monocromo-512.png` | Manifest (`purpose: monochrome`) e icono temático |
| `android-primer-plano.png`, `android-fondo.png`, `android-monocromo.png` | Icono adaptable de Android (108 dp, dibujo dentro de 66 dp) cuando exista el proyecto nativo |

Las fuentes SVG de cada icono están en `logo/iconos/fuente/`.

## 3. Animación de carga

- **Qué hace:** el símbolo aparece y un brillo recorre los hilos en diagonal, como la luz sobre el satén. Solo cambia la opacidad
  (sin `transform` de layout, sin JavaScript, 1,8 KB).
- **Solo mientras carga de verdad:** vive dentro de `#root` en `index.html`; React lo sustituye al montar. Empieza invisible y
  aparece a los **300 ms**: si la app monta antes, no se ve nada. No retrasa nada: la app nunca espera a la animación.
- **Movimiento reducido:** aparece a los 300 ms y queda quieta, sin brillo.
- **Paso de marca (2026-11-13):** al pulsar «Abrir el reproductor» en la landing, el mismo símbolo cubre 600 ms el paso a la app (`DESIGN.md` §3, Movimiento).
- **De paso:** `html{background:#0b0a08}` quita el destello blanco antes de que cargue el CSS.
- **Tamaño:** `clamp(88px, 24vmin, 136px)` (≈ 94 px en un móvil de 390 px; 136 px en escritorio). Ampliado a petición del usuario.
- **Solo el símbolo:** no muestra textos, porcentajes ni tiempos. El panel de botones de `demo.html` es solo para simular cargas y no
  forma parte del fragmento (`demo.html?limpio&ms=3000` lo oculta).
- **Accesibilidad:** `role="status"` con `aria-label="Cargando Satin"`; el SVG es decorativo.
- Fragmento listo: [`animacion/fragmento-index.html`](animacion/fragmento-index.html). Demo con cargas simuladas:
  `animacion/demo.html`. Vídeo: `animacion/carga-3s.mp4` y `animacion/carga.gif`. Capturas en `animacion/capturas/`.

**Verificado en Chromium (Playwright, 390 × 844):** carga de 150 ms → opacidad 0 a los 100 ms y el cargador ya no existe a los 250 ms;
carga de 3 s → opacidad 0 a 200 ms, 0.87 a 450 ms, 1 desde 700 ms; con movimiento reducido → 0 a 200 ms, 1 a 500 ms y los cinco hilos
a opacidad 1 (sin brillo). No probado en Firefox ni WebKit todavía.

## 4. Integración (pendiente de tu aprobación final)

Un commit aparte, cuando lo apruebes:

1. `index.html`: fragmento de carga, `<title>Satin</title>`, enlaces a `favicon.ico`, `favicon.svg` y `apple-touch-icon.png`;
   `theme-color` a `#0b0a08`.
2. Iconos copiados a `public/` (y `manifest.webmanifest` con los de §2 cuando llegue la Fase 4 del ROADMAP, que es la que crea el
   manifest y el service worker).
3. Comprobación: `npm run typecheck`, `npm test`, `npm run build`, `node scripts/verificar-csp.mjs` y la matriz de capturas.

**Fuera de este commit:** cambiar «Music Reproductor» por «Satin» en textos de la landing, FAQ, legales, repositorio y Vercel. Conviene
hacerlo de una vez cuando el nombre esté verificado en el IMPI (ROADMAP Fase 2).

## 5. Herramientas usadas

- Skill `logo-design` (github.com/kaankiziltug/logo-design-skill, MIT), instalada de forma global tras revisar su `SKILL.md` y sus
  scripts (sin red; solo renderizadores locales). Skill `impeccable` para `PRODUCT.md`.
- Instrument Serif (OFL) convertida a trazos con opentype.js; renderizado y vídeo con Playwright (Chromium) y ffmpeg.

## 6. Lo que tienes que hacer tú

1. **IMPI (Marcanet):** búsqueda fonética y figurativa de «Satin» en clases 9 y 42 (y 41 si hay contenido), con variantes Saten/Satín.
   Incluye el símbolo en la búsqueda figurativa.
2. **Abogado de propiedad industrial:** registrabilidad de «Satin» (palabra común en inglés, no descriptiva de un reproductor) y del
   logo, antes de solicitar.
3. **Instagram, TikTok, X, Threads:** `@satin`, `@satinapp`, `@satinplayer` (no los pude verificar).
4. **Google Play y App Store:** búsqueda exacta de «Satin».
5. **Dominio:** confirmar `satin.mx` y el precio de `getsatin.app` o `satinplayer.app` en un registrador.
6. **Imprenta:** prueba de color del oro y elección de Pantone si habrá impresos.
7. **Búsqueda inversa de imagen** del símbolo (Google Lens, TinEye) para descartar parecidos que no encontré.
