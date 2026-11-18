# Auditoría de animaciones y movimiento (2026-11-17)

Revisión punto por punto de la lista de 20 leyes (los 12 principios de Disney y 8 leyes de UX) más sistema, medición y accesibilidad. Complementa `docs/ANIMACIONES.md` (inventario y medición del 2026-11-13), no lo sustituye.

**Criterio de esta auditoría.** `DESIGN.md` manda: si un punto choca con él, se dice y se sigue `DESIGN.md`. Además, por decisión del usuario:

- La **frecuencia de uso** manda sobre todo lo demás. Play/pausa, siguiente, abrir la cola y cambiar de pestaña deben sentirse instantáneos: ahí no se añade anticipación ni rebotes.
- No se aplica anticipación a acciones del usuario (retrasa la acción).
- Hick: cuando el menú de una canción tenga unas 10 acciones, se agrupan (fila rápida y lista por bloques); no se recortan a 7.
- La «red lenta» pesa poco en una app de música local. Lo que importa es un Android de gama media o baja.
- La ley europea de accesibilidad no nos obliga, pero se siguen sus criterios como buena práctica.

**Lentes (skill design-motion-principles).** La de Emil Kowalski (contención, frecuencia) es la principal para todo lo que se toca a cada rato. La de Jakub Krehel (pulido de producción) es la secundaria, para paneles y hojas. La de Jhey Tompkins (juego, exploración) solo vale para el primer uso y los estados vacíos. Así lo dice la puerta de frecuencia de `DESIGN.md` §3.

**Qué se aplicó (no cambia lo que se ve).**

| Commit | Qué |
|---|---|
| `417296b` | Un solo lector de duraciones en JS (`tokenMs` en `ui/motion.ts`), usado por la salida de paneles, el paso de marca de la landing y el cierre por arrastre. El cierre por arrastre esperaba 120 ms escritos a mano (`gestures.tsx`) en vez de `--fast` (vale lo mismo, 120 ms). |
| `b0f709c` | Movimiento reducido en el cierre por arrastre: la hoja esperaba esos 120 ms aunque su transición dure 0,01 ms. |

**Qué no hizo falta aplicar.**

- Los tokens ya existían y ya estaban en un solo lugar: `ui/styles/tokens.css:42-50`, y `ui/styles/motion.test.ts` hace fallar el CSS que use una duración, curva o propiedad fuera del conjunto.
- La guarda raíz de movimiento reducido ya estaba, con 0,01 ms: `base.css:506-521`, para el sistema y para el interruptor de Ajustes.
- La pausa con la página oculta también estaba en el único bucle continuo, el fondo WebGL (`Backdrop.tsx:140-157`). Las demás animaciones son de una sola vez, salvo `Marquee` (WAAPI), y el navegador no pinta con la página oculta. Ver 5.4.

Estado: **Hecho** · **Parcial** · **Falta** · **No aplica** · **DESIGN.md** (choca con `DESIGN.md` y se sigue `DESIGN.md`). Prioridad: Alta / Media / Baja / — (nada que hacer).

## 1. Tabla de todos los puntos

### 1. Sistema de movimiento

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 1.1 | Escala de duraciones y curvas con nombre | Hecho | `tokens.css:42-48`: `--fast` 120, `--base` 220, `--slow` 280, `--exit` 140, `--page` 560 ms; `--ease` y `--ease-move`. Material pide 200/300 ms; aquí son 220 ms para componentes y 280 ms para el reproductor | Nada | — |
| 1.2 | En un solo lugar | Hecho | CSS: lo exige `motion.test.ts:34-47`. JS: el último valor suelto (120 ms en `gestures.tsx`) se corrigió en `417296b`. Quedan números en JS que **no son duraciones de transición**: la red de seguridad del carrusel (`gestures.tsx:253`, 320 ms = `--base` + 100 por si no llega `transitionend`), `BRAND_MS` 600 (lo fija `DESIGN.md`), el escalonado de la landing de 80/60 ms (el test lo permite), la velocidad de lectura de `Marquee` (30 px/s y 1,5 s quieto) y las constantes de suavizado del color del fondo (`Backdrop.tsx:109`) | Opcional: `tokenMs("--base") + 100` en lugar del 320 | Baja |
| 1.3 | Ease-out al entrar, ease-in al salir, nunca lineal | DESIGN.md | `DESIGN.md` §3 usa `--ease` (decelera) **para entradas y salidas**. Con ease-in, una salida de 140 ms arranca lenta y el primer cuadro no responde al toque; decelerando, responde de inmediato. Lineal: solo `Marquee` (velocidad constante, que es lo correcto en un texto que se desplaza) y el fondo (interpolación exponencial). Ningún panel es lineal | Seguir `DESIGN.md` | — |

### 2. Los 12 principios

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 2.1 | Squash & stretch (comprimir al pulsar) | Hecho | `base.css:192-199`: `scale(var(--press))` 0,96 y `--press-wide` 0,985 durante `--fast`. Excluye el transporte (`.transport`, `.bar-mini`) y lo que se activa con teclado. En la traza aparece la pulsación del botón de cola del reproductor grande: es una respuesta de 120 ms que no retrasa la apertura (el panel empieza en el mismo toque) | Nada; no extenderla al transporte | — |
| 2.2 | Anticipación | No aplica | Criterio del usuario. Ningún panel se comprime antes de salir: `[data-closing]` va directo a su pose de salida (`base.css:319-323`) | No añadir | — |
| 2.3 | Staging (una cosa a la vez) | Parcial | Al abrir el reproductor se animan a la vez la hoja (transform), el título (`.now-copy`, opacidad) y, la primera vez, el aviso `.tip` (traza: `opacity@DIV.now-copy` en «abrir reproductor», móvil y escritorio). El fundido del título se pensó para el cambio de pista (`player.css:231-243`, `@starting-style`), pero también salta al montar | Que `.now-copy` no se funda al montar el reproductor, solo al cambiar de pista (ver B3) | Media |
| 2.4 | Pose to pose | Hecho | Transiciones entre poses declaradas (`--t0/--o0` → reposo → `--t1/--o1`, `base.css:301-323`). Fuera de eso, solo se anima cuadro a cuadro el lienzo del fondo (una simulación, no una transición) y `Marquee` (WAAPI con keyframes) | Nada | — |
| 2.5 | Follow through (escalonado al llegar) | No aplica | Puerta de frecuencia: las listas y las pestañas no se animan (`DESIGN.md` §3). Solo la landing escalona (`landing.css:174-175`, 80 ms × i) | No escalonar listas | — |
| 2.6 | Slow in & slow out | Hecho | Igual que 1.3 | — | — |
| 2.7 | Arcos | No aplica hoy | Todo recorrido es de un solo eje (hoja vertical, carrusel y filas horizontales) | Aplica en N8: la portada que viaja del mini (abajo a la izquierda) al reproductor grande (arriba, centrada) es diagonal; ahí `x` y `y` interpolan con curvas distintas (ver A1) | Con N8 |
| 2.8 | Acción secundaria | Hecho donde aporta | Vibración al armar un deslizamiento (`gestures.tsx:143,171`), la barra del deslizador que se engrosa y su tirador (`range.css:39,112`), la portada anterior que se disuelve al cambiar de pista. Sin spinners, por diseño (progreso de escaneo con barra) | Nada | — |
| 2.9 | Timing 100–300 / ≤ 500 ms | Hecho | La app va de 120 a 280 ms; 560 ms solo en la landing y el primer uso | Nada | — |
| 2.10 | Exageración solo en éxito y error | Hecho, con moderación | Error: marco `--danger`, texto y foco en el campo (`EditDialog.tsx:159`). Éxito: un aviso. Sin sacudidas | No añadir rebotes ni sacudidas | — |
| 2.11 | Solid drawing (sombras, elevación) | DESIGN.md | `DESIGN.md` separa por tono y prohíbe las sombras en reposo. Las capas se leen por el telón al 60 % (`base.css` `::backdrop`) y por la superficie. Única sombra: el cajón de la cola sobre el reproductor en escritorio (`player.css:348`) | Seguir `DESIGN.md` | — |
| 2.12 | Appeal: un solo sistema | Hecho | Lo vigila `motion.test.ts` en todo el CSS | Nada | — |

### 3. Leyes de UX

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 3.1 | Fitts: ≥ 44 px y cerca del dedo | Hecho | `--tap` 44, `--tap-l` 56, play expandido de 72; transporte en la mitad inferior; mini reproductor abajo. `capturas.mjs` falla con zonas táctiles < 44 px | Nada | — |
| 3.2 | Zona táctil mayor que lo visible | Hecho | La barra de progreso de 4 px conserva 44 px de zona (`range.css`); iconos de 22 px en botones de 44 px | Nada | — |
| 3.3 | Hick | Hecho hoy; propuesta para después | Hoy la hoja de una pista tiene 3–4 acciones (`LibraryView.tsx:132-138`). El menú ≡ ya agrupa por bloques con submenús (`menu.css` `.menu-group`) | Con ~10 acciones: **fila rápida** de 4 iconos con etiqueta (a continuación, a la cola, a playlist, editar), en botones de 56 px, y debajo una **lista por bloques** (ir al álbum o al artista · letra e información · quitar o borrar aparte, al final), con filas de 52 px como el menú ≡. No recortar a 7 (ver B9) | Media (cuando lleguen) |
| 3.4 | Miller: bloques pequeños | Hecho | 4 secciones (+ cuenta), 6 pestañas de biblioteca en una fila deslizable y el menú ≡ en grupos con título | Nada | — |
| 3.5 | Doherty (< 400 ms) | Referencia | Ya está en la lista de rendimiento. Aquí: abrir el reproductor y la cola cuesta una tarea de 66–81 ms con la CPU 4× más lenta, y el icono de pausa cambia en el mismo cuadro (commit `a5e7823`) | Ver B2 | — |
| 3.6 | Postel | Hecho | La búsqueda ignora acentos y mayúsculas (`format.ts:57-58`). Editar recorta y colapsa espacios (`edits.ts:81`) y los números aceptan espacios (`edits.ts:46-49`). El correo se recorta (`dialogs.tsx:19`). No hay teléfonos | Nada | — |
| 3.7 | Jakob: convención de plataforma | Hecho | Pestañas inferiores, hoja con asa, el atrás del sistema cierra paneles (`?panel=`, `router.ts`), `<dialog>` nativo | Nada | — |
| 3.8 | Frecuencia de uso | Hecho | Puerta de frecuencia de `DESIGN.md`. Trazas: cambiar de pestaña y de sección = **0 animaciones**; play/pausa sin escala | Nada | — |

### 4. Coreografía y continuidad

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 4.1 | Orquestación y elemento compartido | Falta | Del mini al grande, la hoja sube entera y la portada no viaja | A1 (N8) | Alta |
| 4.2 | Modelo espacial consistente | Parcial | Bien: la hoja sube y baja; el menú avanza desde la derecha (+16 px) y vuelve desde la izquierda (−16 px) (`menu.css:100-110`); el carrusel pasa a la siguiente hacia la izquierda. Desviación: en escritorio, el cajón de la cola (anclado a la derecha, sobre el reproductor) entra **subiendo** 24 px (`player.css:304`, `344-352`), no desde la derecha | B6 | Baja |
| 4.3 | Interrumpibilidad | Hecho | Transiciones con `@starting-style` y medidas (`docs/ANIMACIONES.md`, «Interrupciones»). El panel que sale queda `inert` y lo de debajo vuelve a ser usable en el mismo toque (`App.tsx`: `main` solo es `inert` con el reproductor abierto; `Player.tsx`: `inert={closing…}`) | Nada | — |
| 4.4 | Gestos con física | Parcial | Arrastre 1:1 (`gestures.tsx`), velocidad al soltar (0,45 px/ms en el carrusel, 0,5 px/ms al cerrar). Pero el final del gesto usa una duración fija (`--fast`/`--base`) y no hereda la velocidad. No hay resortes. Sin FLIP: subir o bajar en la cola salta; arrastrar para reordenar está pendiente (`DESIGN.md` §8) | B5 y B7 | Media / Baja |

### 5. Rendimiento técnico

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 5.1 | RAIL: input < 100 ms, 16 ms por cuadro, fondo < 50 ms | Parcial | Medido (§2): el toque que abre el reproductor o la cola es una tarea de 66–81 ms con la CPU 4× más lenta y hace caer 3–5 cuadros. **Tras importar 5 000 pistas, durante 24–33 s, la biblioteca aplica metadatos cada 250 ms y cada lote rehace las vistas: tareas de 61–71 ms** (9 en 2,4 s sin tocar nada) | B1 y B2 | Alta |
| 5.2 | Solo `opacity` y `transform` | Hecho | Lo exige el test, y en las trazas todas las animaciones de Blink son `transform` u `opacity` (§2). En una de dos pasadas, Chromium marcó la salida de la cola (`opacity` de `ASIDE.queue-panel`) como no compuesta: `compositeFailed` 131104 = *target has invalid compositing state* + *animation has no visible change* (tabla de DevTools). No es layout; **no sé la causa con certeza** | Mirarlo en el panel Performance → «Animations» en el teléfono | Baja |
| 5.3 | `will-change` solo si se midió | Hecho | No hay ninguno en el CSS | Nada | — |
| 5.4 | Pausa oculta o fuera de pantalla; CLS y LCP | Hecho / parcial | Fondo: se para con `visibilitychange` (`Backdrop.tsx:140-157`). `Marquee` (bucle WAAPI infinito) no se pausa por código: con la página oculta el navegador no pinta (no lo verifiqué en un móvil). Fuera de pantalla: el `Marquee` del mini sigue corriendo debajo del reproductor grande, que lo tapa. CLS: el símbolo de carga solo aparece pasados 300 ms; el mini aparece de golpe y encoge el contenido una vez por sesión (A2). LCP: el paso de marca nunca va en la landing | B8; A2 | Baja |
| 5.5 | Android barato | Sin verificar | No hay dispositivo en esta sesión | Ver «Flujos para grabar» | Alta (verificar) |

### 6. Accesibilidad

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 6.1 | Movimiento reducido desde la raíz, en JS y con 0,01 ms | Hecho | Raíz: `base.css:506-521` (sistema e interruptor de Ajustes). JS: las salidas no esperan (`motion.ts`), y `Marquee`, el fondo, el fundido de la portada y el desplazamiento de la letra tienen guarda; **faltaba el cierre por arrastre** (`b0f709c`). Excepción documentada: el paso de marca de la landing es un fundido corto | Nada | — |
| 6.2 | Sin disparadores vestibulares | Hecho | Sin parallax ni movimiento ligado al scroll; con movimiento reducido, el fondo queda quieto y la letra salta sin desplazarse suave (`Player.tsx:204-205`) | Nada | — |
| 6.3 | ≤ 3 destellos/s · pausar lo que se mueve > 5 s · foco | Parcial | Destellos: separación mínima de 340 ms (`rhythm.ts:126`, test en `rhythm.test.ts:154`). Más de 5 s: `Marquee` y el fondo Ritmo se mueven indefinidamente; se paran con «Reducir movimiento» o con el fondo Estático, en Ajustes y en el menú ≡, no junto al contenido. Foco: el menú lo mueve al cambiar de página (`PlayerMenu.tsx:532`), los diálogos son nativos y Ajustes enfoca el título. No verifiqué a dónde vuelve el foco al cerrar el reproductor o la cola | B8 | Baja |
| 6.4 | Ley europea (como buena práctica) | Parcial | Cumple 2.3.1 y el movimiento reducido; 2.2.2 a medias (el mecanismo existe, pero lejos) | B8 | Baja |

### 7. Estados y micro-interacciones

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 7.1 | Todos los estados | Parcial (no revisado componente por componente) | Presionar, hover (solo con `hover: hover`, lo exige el test), foco, deshabilitado (`DESIGN.md` §3, `base.css`). Éxito: aviso; error: junto al campo | Revisión de estados en la próxima auditoría de diseño | Baja |
| 7.2 | Esqueletos y optimista | Falta / Hecho | Esqueletos pendientes (`DESIGN.md` §8). Portada: la funda generada aparece al instante. Optimista: la cola y la edición son locales e inmediatas | B10 | Baja |
| 7.3 | Prueba de propósito | Hecho, con una excepción | Inventario en `docs/ANIMACIONES.md`. El fundido del título al **abrir** el reproductor no informa de nada (la pista no cambió) | B3 | Media |

### 8. Medición y pruebas

| # | Punto | Estado | Evidencia | Propuesta concreta | Prioridad |
|---|---|---|---|---|---|
| 8.1 | Performance, Paint Flashing, Layers | Parcial | Performance: hecho en esta auditoría (§2). Paint Flashing y Layers: no (sin GPU real, sus capas no representan un móvil) | Mirarlos en el teléfono con `chrome://inspect` | Media |
| 8.2 | Cámara lenta y regresión visual de transiciones | Falta | `capturas.mjs` cubre los estados finales, no las transiciones | Flujos para grabar (abajo) | Media |
| 8.3 | Consistencia antes que velocidad | Hecho | Los cuadros perdidos se concentran en el primer cuadro (el montaje), no salpicados durante la animación | B2 | — |

## 2. Medición (panel Performance de Chromium, CPU 4× más lenta)

Build de producción (`npm run build`, `vite preview`), Chromium sin ventana de Playwright y solo audio sintético (`tests/fixtures`). Móvil: 390×844, táctil, DPR 2. Escritorio: 1440×900. Una traza por paso, desde el toque hasta 700 ms después. Para ver las trazas en el panel Performance, se cargan los `.json` que deja el script (se guardaron fuera del repo).

Columnas: **tareas largas** = `RunTask` del hilo principal ≥ 50 ms · **caídos** = cuadros `STATE_DROPPED` (+ parciales) / cuadros con actualización, según `PipelineReporter` (lo que pinta la pista «Frames» del panel) · **layout** = número de `Layout` (ms) · **qué se anima** = eventos `Animation` de Blink.

| Paso | Móvil: tareas largas · caídos · layout | Escritorio: tareas largas · caídos · layout | Qué se anima |
|---|---|---|---|
| Abrir el reproductor | 81 ms · 5 (+1) / 49 · 12 (29 ms) | 66 ms · 3 (+2) / 47 · 10 (17 ms) | `transform` de `.now-playing` (+ `opacity` en escritorio), `opacity` de `.now-copy` y `.tip` (+ `transform`) |
| Abrir la cola (desde el reproductor) | 67 ms · 3 / 53 · 9 (14 ms) | 66 ms · 4 / 56 · 8 (16 ms) | `transform` + `opacity` de `.queue-panel`; `transform` del botón (pulsación) |
| Abrir la cola (barra, columna fija) | — | 0 · 1 / 5 · 6 (11 ms) | Solo la pulsación del botón (la columna no se anima) |
| Cerrar la cola | 0 · 0 (+1) / 50 · 7 (4 ms) | 0 · 0 (+3) / 52 · 8 (8 ms) | `opacity` de `.queue-panel` (en la 1.ª pasada: 53 ms de tarea y `compositeFailed`, ver 5.2) |
| Cerrar el reproductor | 0 · 1 / 26 · 6 (4 ms) | 0 · 2 / 29 · 10 (9 ms) | `transform` (móvil) u `opacity` (escritorio) de `.now-playing`, `opacity` de `.tip` |
| Pestaña Álbumes / Canciones | 0 · 0 / 10 · 0 / 4 | 0 · 1 / 11 · 1 / 6 | Nada |
| Sección Playlists / Biblioteca | 0 · 0 / 4 · 0 / 6 | 0 · 0 / 6 · 1 / 8 | Nada |
| Desplazar la biblioteca (5 000, en reposo) | 0 · 27 (+2) / 61 · 30 (135 ms) | 59, 66, 67, 87, 119, 127 ms · 33 / 95 · 30 (149 ms) | Nada |
| Desplazar la biblioteca (5 000, con metadatos aún en curso) | 9 tareas de 61–71 ms (sin desplazar: ver límites) | 65–82 ms ×7 · 55 / 121 · 54 (172 ms) | Nada |

**Lectura.**

- **Ninguna animación usa otra propiedad que `transform` u `opacity`**, y ningún paso hace layout por cuadro: 6–12 layouts por paso, casi todos al montar.
- Abrir el reproductor o la cola cuesta **una** tarea de 66–81 ms en el toque (≈ 80 % React montando el panel y el resto estilo y layout). Ahí caen los 3–5 cuadros; el resto de la animación ya corre en el compositor. Coincide con lo medido con la CPU 6× más lenta el 2026-11-13 (≈ 50–80 ms).
- Cambiar de pestaña y de sección no anima nada y no pierde cuadros: cumple «instantáneo».
- Desplazar en escritorio con la rueda muy rápido (12 000 px en ≈ 0,5 s) da tareas de 59–127 ms. Una de ellas es el manejador de `scroll` (React re-renderiza la lista virtual, ≈ 27 ms, más el layout); las demás no tienen hijos atribuibles en la traza. En móvil, el mismo desplazamiento no da tareas largas, pero cae el 44 % de los cuadros.
- **El hallazgo más caro no es una animación**: tras importar, la biblioteca aplica los metadatos en lotes cada 250 ms (`state/library.ts:108-122`, `applyPatches` hace un `tracks.map` de las 5 000 pistas). Con la CPU 4× más lenta, cada lote es una tarea de 61–71 ms, durante 24 s (móvil) a 33 s (escritorio). Cualquier animación en esa ventana pierde cuadros.

## 3. Propuestas que cambian lo que se ve, por impacto

### A. Entra en N8 (transición mini → grande guiada por el dedo, mini reproductor, indicador de la barra inferior)

**A1. Mini → grande guiada por el dedo, con la portada como elemento compartido.** Alta.

- Arrastrar hacia arriba el mini: la hoja sigue al dedo 1:1 (`translateY`) y la portada del mini viaja hacia la grande con FLIP: los dos rectángulos se miden una vez por gesto y se interpola `translate` + `scale`, solo `transform`.
- `x` sigue la curva `--ease` e `y` va lineal al progreso del dedo, así la portada hace un arco en vez de una diagonal (2.7).
- Al soltar, se completa pasado un tercio del recorrido o con más de 0,45 px/ms (el mismo umbral del carrusel). El resto dura en proporción a lo que falta, acotado entre `--fast` (120 ms) y `--slow` (280 ms), con `--ease` y sin rebote.
- Tocar el mini sigue abriendo con `--slow`, como hoy. Cerrar es el mismo gesto al revés: el arrastre hacia abajo ya existe y solo falta que la portada vuelva al mini.
- Interrumpible: un `pointerdown` durante la animación agarra desde la posición actual. Con movimiento reducido: sin seguimiento, abre al soltar sin transición.
- **Condición:** el reproductor tiene que estar montado cuando empieza el gesto. Hoy se monta al tocar (tarea de 66–81 ms con la CPU 4×), así que el primer cuadro caería justo cuando el dedo espera respuesta. Va con B2.

**A2. Mini reproductor.** Media.

- **Aparición:** hoy el mini aparece de golpe al sonar la primera pista y encoge el contenido (`PlayerBar` devuelve `null` sin pista). Propuesta: que entre como los avisos (sube 8 px y se funde, `--base`), una vez por sesión.
- **Cambio de pista:** hoy el título cambia de golpe. Propuesta: fundido del título con `--fast`, como en el grande, solo sin teclado y sin movimiento reducido. Es transporte y se ve a menudo, pero no retrasa nada (el texto nuevo ya está en el primer cuadro). Si se considera ruido, dejarlo como está; el criterio de frecuencia del usuario lo permite.
- Play/pausa y siguiente del mini **sin** escala ni animación (como hoy).
- La línea de progreso (`scaleX`, `player.css:69-75`) avanza a saltos cada ≈ 250 ms. En 390 px es menos de 1 px por salto: no merece transición.

**A3. Indicador de la barra inferior.** Baja.

- Hoy la sección activa cambia de fondo y color al instante (`shell.css:41-46`). Por el criterio de frecuencia (cambiar de pestaña = instantáneo), **la recomendación es no animarlo**.
- Si se quiere un indicador que se desplace, que sea `translateX` con `--fast` y `--ease-move`, sin rebote, y que la vista cambie en el mismo cuadro del toque. El indicador acompaña, nunca retrasa. Con teclado y con movimiento reducido, salta.

### B. Lo demás

1. **Lotes de metadatos tras importar** (rendimiento; no cambia lo que se ve, pero no entraba en lo que se pidió aplicar). Alta. Hoy: un `setState` cada 250 ms durante 24–33 s, con tareas de 61–71 ms con la CPU 4×. Opciones, de menor a mayor cambio: lote cada 1 s mientras dure el escaneo; aplicar con `startTransition` para que React lo interrumpa; o no rehacer vistas si ninguna pista del lote está visible.
2. **Montaje del reproductor y de la cola en el toque** (rendimiento). Alta. Una tarea de 66–81 ms con la CPU 4×. Opciones: montar el reproductor oculto e `inert` al tener pista (cuesta memoria y el lienzo WebGL: crear el lienzo solo al abrir), o diferir el `Backdrop` un cuadro. Lo necesita A1.
3. **El título no se funde al abrir el reproductor.** Media. Que el fundido de `.now-copy` solo ocurra cuando cambia la pista con el reproductor ya abierto; por ejemplo, un atributo que se pone tras el primer montaje y condiciona la regla `@starting-style`. Quita una de las tres cosas que se mueven a la vez (2.3, 7.3).
4. **Desplazamiento rápido en escritorio.** Media. 33 de 95 cuadros caídos y tareas de hasta 127 ms. Mirar el `overscan` y el `flushSync` de `VirtualList.tsx` (TanStack Virtual) y las columnas extra de la fila ancha. Primero hay que confirmarlo con un perfil de CPU.
5. **El final del gesto hereda la velocidad.** Media-baja. En el cierre de hoja y en el carrusel, duración = distancia restante ÷ velocidad al soltar, acotada a [`--fast`, `--base`], con `--ease`. Un gesto rápido termina rápido; sin resorte con rebote.
6. **El cajón de la cola en escritorio entra desde la derecha.** Baja. `--t0/--t1: translateX(24px)` en `.shell[data-panel="player"] .queue-panel` desde 1000 px (hoy sube 24 px).
7. **FLIP al subir o bajar en la cola.** Baja. La fila se desplaza 64 px con `transform`, `--base` y `--ease-move`; con teclado, sin animación. No es frecuente a diario.
8. **`Marquee` y fondo: pausa más cerca y fuera de pantalla.** Baja. Pausar el `Marquee` del mini mientras el reproductor grande lo tapa (no se ve). Para WCAG 2.2.2, el texto que se desplaza se para al tocarlo o enfocarlo.
9. **Hoja de acciones con ~10 acciones** (3.3). Media, cuando lleguen. Fila rápida de 4 y bloques, sin animación propia (es un diálogo y entra como los diálogos).
10. **Esqueletos** (`DESIGN.md` §8). Baja. Filas de 64 px con la portada y dos líneas en `--surface-2`, solo si la restauración pasa de 300 ms (hoy es < 1 s con 5 000), sin pulso con movimiento reducido.

## 4. Flujos para grabar en el celular y ver a 0,25×

En un Android de gama media o baja, con la grabación de pantalla del sistema (o la cámara lenta de otro teléfono apuntando a la pantalla), reproducidos a 0,25×. Con depuración remota (`chrome://inspect`) se pueden activar a la vez Paint Flashing y Layers.

1. Tocar el mini → abre el reproductor; cerrar con ⌄. Luego cerrar arrastrando hacia abajo, una vez lento y otra rápido. Buscar: el primer cuadro tras el toque (¿se congela?), y que el título no parpadee.
2. Abrir y cerrar la cola desde el reproductor. Cerrar a mitad de la entrada y reabrir a mitad de la salida: no debe saltar ni reiniciarse.
3. Deslizar la portada: lento sin llegar al tercio (vuelve), rápido (se completa) y sin vecina (resiste y vuelve). El fondo debe interpolar sin escalones.
4. «Siguiente» con el botón (la portada se disuelve y el título se funde) frente a con el gesto (sin fundido extra).
5. Cambiar de pestaña de biblioteca y de sección: debe ser instantáneo, sin cuadro intermedio.
6. Desplazar rápido una biblioteca grande. Repetirlo **justo después de importar** (con los metadatos en curso) y un minuto después.
7. Menú ≡: abrir, entrar a Sonido → Ecualizador, volver y cerrar arrastrando. El alto del panel no debe saltar.
8. Deslizar una fila hasta armar la acción (vibra) y soltar; soltar antes de armarla.
9. Aviso con «Deshacer»; abrir y cerrar la hoja de acciones con una pulsación larga.
10. Con «Reducir movimiento» activado: repetir 1, 2, 3 y 7. Todo instantáneo, nada a medias ni con retraso.
11. Fondo Ritmo sonando: bloquear el teléfono o cambiar de app y volver. Sin salto de luces ni ráfaga de animación.
12. Un título largo en el mini y en la cola (`Marquee`): velocidad constante y pausa en los extremos, sin tirones.

## 5. Límites de esta auditoría

- **Sin dispositivo real.** La CPU 4× es una emulación en un PC, y Chromium sin ventana dibuja sin GPU, así que los cuadros caídos del compositor pueden ser más o menos que en un teléfono.
- **El arrastre táctil sintético no desplazaba** la lista en Chromium sin ventana (ni `synthesizeScrollGesture` ni `dispatchTouchEvent`), así que el desplazamiento en móvil se midió con la rueda. Por eso la fila «con metadatos en curso» del móvil es en realidad la página quieta: las 9 tareas largas son solo los lotes de metadatos.
- La causa del `compositeFailed` de la salida de la cola no está confirmada; apareció en una de dos pasadas.
- No se revisó cada componente en sus seis estados (7.1), ni a dónde vuelve el foco al cerrar el reproductor y la cola (6.3).
- WebKit (iPhone) no se probó.
