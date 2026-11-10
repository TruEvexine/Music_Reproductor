# Auditoría de diseño — estado previo al rediseño

**Fecha:** 2026-11-10 · **Commit auditado:** `194915f` · **Capturas:** `docs/capturas/antes/` (390×844 y 1440×900, audio sintético de `scripts/gen-test-audio.mjs`)
**Método:** revisión visual de las capturas + métricas tomadas en el navegador con `scripts/capturas.mjs` (tamaño de áreas táctiles, tamaños de fuente calculados, scroll horizontal) + lectura de `src/styles/global.css` y `src/app/*.tsx`.
**Skills usadas como lente:** impeccable (modo *Operate*: precisión y contención), apple-design (5 lentes: accesibilidad, convenciones, craft, interacción, texto), design-taste-frontend (reglas de app-screens), ui-ux-pro-max (prioridades 1–9), design-motion-principles (puerta de frecuencia), anti-slop.

**Veredicto:** *Necesita trabajo, con dos fallos críticos.* La base es correcta (oscuro, sobrio, un acento, sin gradientes gratuitos) pero es una lista con una barra: no existe el reproductor (lo Poweramp) ni la presentación de álbum/artista (lo Qobuz), y la característica central —el ambiente que sigue a la portada— casi no se percibe.

**Tesis que debe tener y hoy no tiene:** *la portada manda*. Lo único memorable del producto es que la sala cambia con la canción; hoy es un tinte al 20 % en una esquina.

---

## Crítico

| # | Qué | Evidencia | Arreglo |
|---|-----|-----------|---------|
| C1 | **Scroll horizontal en escritorio.** A 1440 px la lista se sale por la derecha: se cortan "Supabase configurado", la columna DURACIÓN, ACCIONES y el botón "Agregar música". | `03-reproduciendo-1440x900.png`; `scrollWidth > innerWidth` = true. Causa: un título largo en una celda de grid sin `min-width: 0`. | Todas las pistas de grid con `minmax(0, 1fr)` y truncado; prueba Playwright de "cero scroll horizontal" en toda la matriz. |
| C2 | **Texto ilegible por tamaño.** El 80 % del texto mide 8–11 px (móvil: 34 nodos a 9 px, 19 a 8 px; escritorio: 34 a 10 px, 17 a 8 px). El texto de cuerpo (título de pista, artista) está a 10–12 px. | Métricas de `capturas.mjs`. Mínimos de referencia: cuerpo 16 px web, nunca < 12 px (ui-ux-pro-max §6); 11 pt mínimo absoluto (apple-design, `typography.md`). | Escala fluida con `clamp()`: cuerpo 15–16 px, secundario 13–14 px, mínimo 12 px. Probar zoom de texto 200 %. |
| C3 | **Áreas táctiles bajo 44 px en todos los controles de reproducción.** Play 42, anterior/siguiente/repetir/cola 38 (móvil) y 34 (escritorio); `+` de fila 34; play de fila 32; navegación móvil 39; el seekbar mide 4 px de alto. | Métricas de `capturas.mjs`. | Mínimo 44×44 (48 en los de transporte), seekbar con zona de toque de 44 px aunque el trazo sea fino. |
| C4 | **No hay reproductor.** Solo una barra inferior. Sin vista expandida, sin portada grande, sin volumen, sin shuffle, sin información técnica legible. Es la mitad "Poweramp" de la visión y falta entera. | `03-reproduciendo-*.png`. | Reproductor expandido a pantalla completa (PLAN §4.1) con portada protagonista y controles en la mitad inferior. |

## Alto

| # | Qué | Evidencia | Arreglo |
|---|-----|-----------|---------|
| A1 | **El color de portada no se nota.** Un radial al 20 % arriba a la derecha; con cualquier portada la pantalla es el mismo gris-negro. | Comparar `02-` y `03-`: indistinguibles. | Paleta OKLCH de 3–5 colores en worker, mancha amplia detrás del reproductor expandido y acento derivado con contraste ≥ 4.5:1. |
| A2 | **Navegación móvil ambigua.** Tres iconos sin etiqueta arriba (fuera del pulgar), dos de ellos **idénticos** (Playlists y Cola usan el mismo icono) y contadores flotando a 8 px. | `01-vacio-390x844.png`. | Barra de pestañas inferior con icono + etiqueta (≤ 5), sobre el mini player. La cola deja de ser "navegación": es una acción del reproductor. |
| A3 | **La biblioteca es una tabla, no una colección.** Sin álbumes, sin artistas, sin portadas grandes, sin orden. La parte "Qobuz" no existe. | `02-biblioteca-*.png`. | Vistas Álbumes (grid editorial), Artistas, Canciones, Carpetas, Géneros; cabecera de álbum con portada grande y metadatos. |
| A4 | **Iconografía mezclada.** SVG propios junto a glifos de texto: `↑ ↓ × ✎ ♪`. Pesos y alineación distintos; `×` como botón de cerrar. | `04-cola-390x844.png`, `App.tsx`. | Un solo set (Lucide), mismo trazo, tamaño según el texto vecino. |
| A5 | **Etiquetas "eyebrow" en mayúsculas espaciadas a 8–9 px por todas partes** (BIBLIOTECA LOCAL, TU MÚSICA, REPRODUCCIÓN, CUENTA, PLAYLIST PRIVADA). No añaden información y son la marca más reconocible de interfaz generada. | Todas las capturas. | Eliminarlas. La jerarquía la dan tamaño y peso del título. |
| A6 | **Estado vacío con texto falso y sin acción.** "Las canciones demo incluidas aparecen aquí" (ya no hay demo). El CTA real está fuera de la tarjeta, que es una caja punteada con un glifo. | `01-vacio-*.png`. | Estado vacío = dos acciones grandes: "Agregar carpeta" y "Agregar archivos", con una línea que diga qué pasa con los archivos (se quedan en el dispositivo). |
| A7 | **Errores y avisos como párrafo rojo fijo** arriba de la lista; los avisos de importación ("2 archivos omitidos") usan el mismo canal que los errores. `window.confirm` nativo para borrar playlists. | `App.tsx:272`, `:542`. | Toasts con deshacer para lo destructivo; errores junto a lo que falló; pista con ⚠ cuando no decodifica. |
| A8 | **Diálogo de cuenta centrado en móvil** y con texto de desarrollo ("comprobar el acceso seguro a tu perfil", "Supabase configurado", instrucciones de `.env`). Los errores de Supabase se muestran crudos (filtran si un correo existe). | `07-cuenta-390x844.png`, `AuthDialog.tsx`. | Hoja inferior en móvil; copia orientada al usuario; errores mapeados; quitar el indicador "Supabase configurado" de la cabecera. |
| A9 | **Cola a pantalla completa en móvil** que tapa todo salvo la barra, con reordenado por flechas de texto. En escritorio es un cajón sobre el contenido. | `04-cola-*.png`. | Móvil: hoja dentro del reproductor expandido, arrastrar para reordenar (flechas como alternativa accesible). Escritorio ≥ 1440: panel fijo. |
| A10 | **`100vh`, sin `env(safe-area-inset-*)`, sin `dvh`.** En móvil real la barra del navegador y el *home indicator* tapan el reproductor. | `global.css:24,46,1372`. | `100dvh`/`svh`, safe areas en barra inferior y cabecera, `viewport-fit=cover`. |

## Medio

| # | Qué | Arreglo |
|---|-----|---------|
| M1 | Botones primarios poco distinguibles: "Agregar música" e "Iniciar sesión" son texto dorado sobre marrón casi negro; primario y secundario se parecen. | Un primario relleno con el acento; el resto, texto o tono. |
| M2 | El acento dorado `#d1b77b` es fijo y no tiene relación con la portada. Es "negro con un acento": una de las tres plantillas dominantes. | El acento sale de la portada (corregido por contraste); un neutro cálido solo como respaldo sin portada. |
| M3 | Fuente declarada `Inter` pero no se carga: cada sistema muestra algo distinto. Sin números tabulares en tiempos (el contador baila). | Fuente variable autoalojada (sin CDN, la CSP queda cerrada) con `font-variant-numeric: tabular-nums` en tiempos. |
| M4 | Formato técnico arbitrario: "FLAC 123 kbps" (el bitrate de un FLAC no informa) y "44 kHz". Falta profundidad de bits. | Insignia de calidad: `FLAC 24/96`, `FLAC 16/44.1`, `MP3 320`. |
| M5 | Sidebar de escritorio con 3 entradas y una frase decorativa ("Una biblioteca para escuchar sin distracciones") ocupando 232 px. | Sidebar con las vistas reales de la biblioteca; quitar la frase. |
| M6 | Movimiento: solo un `drawer-in` de 180 ms y las barras del ecualizador en bucle infinito. Sin transición entre mini y expandido, sin respuesta al pulsar. `transition: background` (propiedad de layout/pintado). | Tokens de duración y curva; animar solo `transform`/`opacity`; respuesta < 100 ms al pulsar; nada animado en acciones de teclado. |
| M7 | Cubierta de respaldo: glifo `♪` sobre gris. | Gradiente derivado del hash del álbum (nunca gris plano). |
| M8 | Fila de pista con dos botones que hacen lo mismo (tocar la fila y el botón ▷). | Tocar la fila reproduce; un solo botón `⋯` con el menú contextual. |
| M9 | Sin estados de carga: los metadatos "saltan" del nombre de archivo al título. | Carga progresiva con *fade* de portada; skeleton solo donde la espera supera 200 ms. |
| M10 | Semántica: la lista usa `<article>` por fila y cabeceras `aria-hidden`; el diálogo no atrapa el foco ni cierra con Escape. | Lista con roles correctos, diálogos con `<dialog>` nativo. |

---

## Qué se conserva

- Tema oscuro sobrio, sin gradientes decorativos, sin sombras en reposo, sin vidrio salvo la sidebar.
- Un solo acento a la vez y texto principal casi blanco cálido (`#f3f2ee`) sobre casi negro: contraste alto (≈ 17:1; el secundario `#96999a` da ≈ 6.6:1).
- Orden de transporte y `aria-label` en todos los botones de icono; `aria-pressed` en repetición.
- `prefers-reduced-motion` ya contemplado.
- Truncado con elipsis en móvil (funciona; falla solo en el grid de escritorio).
- La lógica de cola y repetición: correcta, se traslada al `core` sin cambios de semántica.

## Qué se rehace

Navegación, estructura de pantallas, tipografía y escala, sistema de color (pasa a derivarse de la portada), reproductor (nuevo), biblioteca (vistas nuevas), cola, diálogos, estados vacío/carga/error, iconos, movimiento. El CSS actual (1 701 líneas, valores sueltos) se sustituye por tokens y archivos por componente.

---

## Dirección propuesta

**Una frase:** *una sala oscura donde la portada enciende la luz.* El reproductor se maneja como Poweramp; la colección se hojea como Qobuz.

### Reparto de las dos referencias

| | Poweramp → reproductor y controles | Qobuz → biblioteca y presentación |
|---|---|---|
| Qué tomamos | Controles grandes en la mitad inferior, gestos en la portada, datos técnicos a la vista, ecualizador, personalización profunda | Portada como protagonista, cabeceras de álbum con metadatos, rejilla limpia, calidad comunicada con sobriedad, tipografía cuidada |
| Qué no | Su estética de skins y brillos | Su barra de navegación y su tienda |
| Densidad | Alta en el reproductor (todo a un toque) | Media en la biblioteca (aire alrededor de las portadas) |

### Sistema (alimenta `DESIGN.md` en la Fase 1)

- **Color.** Tres capas: `fondo` (casi negro, L≈0.14 en OKLCH), `superficie` (+0.03 L, sin bordes: se separa por tono) y `tinta` (blanco cálido). El **acento no es fijo**: se extrae de la portada, se recorta en croma y se ajusta en L hasta ≥ 4.5:1 sobre el fondo. Sin portada: neutro cálido de respaldo. El color aparece en tres sitios y solo en tres: fondo del reproductor expandido, acento de la pista actual, botón primario.
- **Tipografía.** Una familia variable autoalojada para toda la interfaz, con cifras tabulares en tiempos. En vistas editoriales (título de álbum y de artista) el mismo tipo a gran tamaño y peso alto, interlineado apretado: la escala hace el trabajo editorial, no una segunda familia. Cuatro tamaños visibles: título de vista, título de pista, secundario, técnico. Mínimo 12 px.
- **Espacio y forma.** Base 4 px; radio pequeño y constante (portadas 6 px, controles circulares solo los de transporte). Sin tarjetas alrededor de las filas, sin líneas divisorias: separación por espacio y por tono.
- **Iconos.** Lucide, trazo 1.75, 20–24 px; rellenos solo para play/pausa.
- **Movimiento** (puerta de frecuencia): transporte y teclado → sin animación, solo respuesta al pulsar; abrir/cerrar reproductor → 280 ms con `transform`, sigue al dedo; cambio de pista → fundido de portada y de paleta 700–900 ms; hojas → 220 ms entrada, 160 ms salida. Todo con equivalente sin desplazamiento en `prefers-reduced-motion`.
- **Elemento firma.** El reproductor expandido: la portada ocupa el ancho, la paleta inunda el fondo y todos los controles quedan bajo el pulgar. Es lo único "audaz"; lo demás calla.

### Estructura

```text
MÓVIL (<600)                    TABLET (600–999)                ESCRITORIO (≥1000)
┌──────────────────┐            ┌───────────────────────┐       ┌────────┬───────────────┬────────┐
│ Título     🔍 ⋯  │            │ igual que móvil con   │       │ vistas │ biblioteca    │ cola   │
│ lista / rejilla  │            │ rejilla más ancha;    │       │        │ (rejilla/     │ fija   │
│                  │            │ expandido horizontal: │       │        │  lista)       │ ≥1440  │
├──────────────────┤            │ portada | controles   │       ├────────┴───────────────┴────────┤
│ mini player      │            └───────────────────────┘       │ barra del reproductor           │
├──────────────────┤                                            └─────────────────────────────────┘
│ ♪  ◫  👤  ☰  ⚙  │  ← pestañas con etiqueta, ≤ 5
└──────────────────┘
```

### Orden de trabajo (accesibilidad → convenciones → craft → pulido)

1. Fase 1: tokens, escala tipográfica, áreas táctiles, `dvh` y safe areas, C1 (overflow). Quita los cuatro críticos que no requieren pantallas nuevas.
2. Fase 2–3: lo que el diseño necesita para existir (volumen, shuffle, vistas de biblioteca).
3. Fase 4: reproductor expandido, fondo dinámico, vistas de álbum/artista, gestos, estados, toasts.

### Límites de esta auditoría

- No se midió contraste sobre fondos dinámicos (aún no existen) ni rendimiento de animación.
- No se probó con lector de pantalla ni en dispositivo físico; solo Chromium emulado.
- Las vistas con sesión iniciada (playlists con datos) se revisaron en código, no en captura: requieren una cuenta real en el Supabase compartido.
