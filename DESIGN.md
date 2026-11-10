# DESIGN.md — Sistema de diseño

> Reescrito el 2026-11-10 (Fase 1) a partir de `docs/AUDITORIA_DISENO.md`. `PLAN.md` manda si hay conflicto.
> Los valores viven en `src/ui/styles/tokens.css`: este documento explica el porqué; el CSS es la verdad.

## 1. Dirección

**Una sala oscura donde la portada enciende la luz.** Se maneja como Poweramp y se hojea como Qobuz.

| | Poweramp → reproductor y controles | Qobuz → biblioteca y presentación |
|---|---|---|
| Tomamos | Controles grandes bajo el pulgar, gestos en la portada, datos técnicos a la vista, ecualizador, personalización | Portada protagonista, cabeceras de álbum con metadatos, rejilla limpia, calidad comunicada con sobriedad |
| No tomamos | Skins y brillos | Su navegación ni su tienda |
| Densidad | Alta: todo a un toque | Media: aire alrededor de las portadas |

No es copia de ninguna, ni de Spotify. **Elemento firma:** el reproductor expandido (portada a todo el ancho, su paleta inunda el fondo, controles en la mitad inferior). Es lo único audaz; lo demás calla.

## 2. Principios

1. **La portada manda.** El color de la interfaz sale de la pista que suena; no hay color de marca fijo.
2. **Pulgar primero.** En móvil, todo control frecuente está en la mitad inferior.
3. **Separar por tono y espacio**, no por bordes, líneas ni sombras.
4. **Una familia tipográfica.** La escala y el eje de anchura hacen el trabajo editorial.
5. **El movimiento informa o no existe.** Nada se anima en acciones de teclado ni en el transporte.
6. **Nada depende solo del color** ni solo de hover.

## 3. Tokens

### Color (OKLCH)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `0.145 0.004 70` | Fondo de la app |
| `--surface-1/2/3` | L `0.19 / 0.235 / 0.29` | Navegación y barra / campos y controles / hover y selección |
| `--ink` | `0.96 0.006 85` | Texto principal (≈ 17:1 sobre `--bg`) |
| `--ink-2` | `0.78 0.008 85` | Texto secundario (≈ 9:1) |
| `--ink-3` | `0.66 0.008 85` | Texto terciario (≈ 6:1). Nada más tenue lleva texto |
| `--danger` | `0.76 0.14 25` | Errores y pistas que no se pueden reproducir (siempre con icono) |
| `--accent`, `--on-accent`, `--glow` | dinámicos | Los calcula `src/core/palette.ts` desde la portada |

**Color dinámico.** Portada → 32×32 px → media ponderada por croma → se fuerza a rangos seguros: `--accent` L 0.82 y C 0.07–0.14 (contraste ≥ 4.5:1 sobre `--bg`, comprobado por test), `--glow` L 0.32 (ambiente del reproductor), `--on-accent` L 0.2. Portada gris o ausente → paleta neutra cálida. El acento aparece solo en: pista actual, botón primario/play, estados activos, progreso.

Prohibido: degradados decorativos (el único degradado es el ambiente del reproductor y el respaldo de portada), vidrio/blur, sombras en reposo, texto sobre color saturado sin pasar por `--on-accent`.

### Tipografía

`Instrument Sans Variable`, autoalojada (sin CDN; la CSP queda cerrada). Tamaños en `rem` para respetar el zoom de texto.

| Token | Tamaño | Uso |
|---|---|---|
| `--text-xl` | `clamp(1.875rem … 3rem)` | Título de vista. Anchura 80 %, peso 650, interlineado 1.02 |
| `--text-l` | `clamp(1.125rem … 1.375rem)` | Subtítulos de sección, título de diálogo. Anchura 88 % |
| `--text-m` | `clamp(0.9375rem … 1rem)` | Cuerpo y títulos de pista (peso 550) |
| `--text-s` | 13 px | Secundario (artista, contadores) |
| `--text-xs` | 12 px | Tiempos y calidad, con `tabular-nums`. **Mínimo absoluto** |

Sin mayúsculas espaciadas, sin etiquetas "eyebrow", sin monoespaciada, sin segunda familia. Campos de texto a 16 px (por debajo, iOS hace zoom).

### Espacio, forma y tamaño táctil

- Base 4 px: `--s1`…`--s7` = 4, 8, 12, 16, 24, 32, 48. Margen lateral fluido `--gutter: clamp(16px, 4vw, 40px)`.
- Radios: `--radius-s` 6 px (portadas, filas, campos), `--radius-m` 12 px (portada grande, hojas). Círculo completo solo en botones.
- `--tap` 44 px mínimo para todo lo interactivo; `--tap-l` 56 px en transporte ampliado y pestañas; play expandido 72 px. Un control visualmente fino (barra de progreso de 4 px) conserva 44 px de zona de toque.

### Movimiento

Solo `transform` y `opacity`. `--fast` 120 ms (respuesta al pulsar: escala 0.94), `--base` 220 ms (hojas, cola), `--slow` 280 ms (abrir reproductor), curva `--ease`. Salidas más rápidas que entradas. Cambio de pista: fundido de portada y paleta 700–900 ms (Fase 4). `prefers-reduced-motion`: todo instantáneo.

Puerta de frecuencia: transporte, teclado y navegación entre pestañas → sin animación. Abrir reproductor/cola → sí. Primer uso y estados vacíos → se permite algo más expresivo.

### Iconos

Lucide, trazo 1.75, 22 px (18 px en acciones de fila). Rellenos solo play, pausa, anterior y siguiente. Todo botón de icono lleva `aria-label` y `title`.

## 4. Estructura

```text
MÓVIL (<1000)                       ESCRITORIO (≥1000)
┌────────────────────┐              ┌────────┬─────────────────┬────────┐
│ Título de vista    │              │ nav    │ contenido       │ cola   │
│ contenido (scroll) │              │ 220 px │                 │ 22rem  │
├────────────────────┤              ├────────┴─────────────────┴────────┤
│ mini reproductor   │              │ barra: pista · transporte · cola   │
├────────────────────┤              └────────────────────────────────────┘
│ pestañas (≤5)      │
└────────────────────┘
```

- **Navegación:** pestañas inferiores con icono y etiqueta en móvil; columna lateral en escritorio. La cola no es navegación: es una acción del reproductor.
- **Mini reproductor (móvil):** portada, título, artista, play/pausa, siguiente, y una línea de progreso. Tocarlo abre el expandido.
- **Barra (escritorio):** pista (abre el expandido) · transporte y progreso · calidad y cola.
- **Reproductor expandido:** pantalla completa en todas las resoluciones. Vertical: portada arriba, controles en la mitad inferior. Horizontal o ancho: portada | controles.
- **Cola:** pantalla completa en móvil, columna fija en escritorio.
- **Diálogos:** `<dialog>` nativo; hoja inferior en móvil, centrado desde 600 px.
- El reproductor y la cola se abren con `?panel=` en la URL: el botón o gesto **atrás** del sistema los cierra.

Unidades: `dvh` (nunca `100vh`), `env(safe-area-inset-*)` en barra, pestañas, reproductor y hojas, `viewport-fit=cover`.

## 5. Componentes

| Componente | Regla |
|---|---|
| Fila de pista | Tocar la fila reproduce (la cola pasa a ser la lista visible). 64 px de alto, portada 48 px. Desde 700 px añade álbum, calidad y duración en columnas. Pista actual: título en acento **y** barra a la izquierda |
| Portada | Siempre 1:1. Sin imagen: degradado derivado del nombre del álbum, nunca gris plano ni un glifo |
| Botón | Uno primario por pantalla (relleno de acento). El resto, tono `--surface-2` o enlace |
| Menú del reproductor (≡) | Una sola entrada para lo avanzado (repetir, sonido, temporizador, fondo). Móvil: hoja inferior con grabber y arrastre (<600 px); ancho: popover anclado al icono. Los submenús se abren dentro del mismo panel con flecha de volver, nunca menús flotantes anidados. Filas de 52 px, opciones con marca ✓ además del color, interruptores cuya posición comunica el estado. Los controles de uso constante (aleatorio, repetir) siguen a un toque en el reproductor |
| Insignia de calidad | Texto, sin caja: `FLAC 24/96`, `MP3 320` (`core/format.ts`) |
| Estado activo (shuffle, repetir) | Color de acento **y** punto bajo el icono; `aria-pressed` |
| Estado vacío | Un título, una frase y una acción. Sin ilustraciones ni cajas punteadas |
| Errores | Junto a lo que falló, en lenguaje del usuario, sin jerga técnica (ni "Supabase", ni mensajes crudos del servidor) |

## 6. Regla de reutilización por pantalla (web → app)

Una pantalla de la web **se reutiliza tal cual** en Android/iPhone si cumple todo:

1. Áreas táctiles ≥ 44 px.
2. Safe areas y borde a borde correctos.
3. Respeta el botón/gesto atrás del sistema.
4. No depende de hover.
5. Mantiene 60 fps en gama media.
6. Se ve nativa a 360×800.

Si falla algo y no se arregla con ajustes menores, se diseña una **variante para Android** basada en la web (no desde cero) en `docs/DISENO_ANDROID.md`; lo que difiera en iPhone, en `docs/DISENO_IOS.md`. Las variantes se aplican con `[data-platform="android|ios"]` en CSS, no bifurcando componentes. La regla se aplica pantalla por pantalla en la Fase 4.

## 7. Verificación

Ninguna tarea de UI está terminada sin `node scripts/capturas.mjs docs/capturas`: recorre 320×568, 360×800, 390×844, 412×915, 844×390, 768×1024, 1024×768, 1440×900 y 1920×1080, falla con scroll horizontal, áreas táctiles < 44 px o texto < 12 px, y deja capturas de 390×844 y 1440×900 que hay que **mirar** con criterio de diseño.

## 8. Pendiente de diseñar (Fase 4)

Vistas de álbum y artista, rejilla de álbumes, fondo dinámico (Portada/Ritmo/Estático/AMOLED) con selector, gestos en la portada, arrastrar para reordenar, skeletons, toasts con deshacer, ecualizador, letras.
