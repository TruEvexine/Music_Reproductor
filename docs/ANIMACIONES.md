# Animaciones: inventario, medición y cambios (2026-11-13)

Criterio: simples pero fluidas y reactivas; solo `transform` y `opacity`; interrumpibles y reversibles; duraciones de los tokens (`--fast` 120, `--base` 220, `--slow` 280, `--exit` 140 ms); sin saltos de layout; con movimiento reducido, sin animación. Medición: `scripts/medir-animaciones.mjs` (CPU 6× más lenta, mediana de 5 repeticiones, contra `npm run build && npx vite preview`; en `npm run dev` el `jsxDEV` de React falsea el coste).

## Lo más importante que se encontró

1. **En producción ninguna salida se animaba.** El build minifica `--exit: 140ms` como `.14s` y `ui/motion.ts` hacía `parseFloat`, así que esperaba 0,14 ms antes de desmontar: menús, hojas, cola, reproductor grande y avisos desaparecían de golpe (en `npm run dev` sí funcionaban, por eso no se vio). Arreglado con `cssMs` (`core/format.ts`, con test) que lee la unidad.
2. **Nada era interrumpible.** Las entradas y salidas eran `@keyframes` distintos: cerrar mientras abría saltaba a la pose «abierto» y volver a abrir mientras cerraba reiniciaba desde «cerrado». Ahora son transiciones CSS con `@starting-style`: el navegador parte del valor que lleva en ese instante.
3. **El cambio de pista no tenía transición** (portada y título cambiaban de golpe).

## Inventario, uno por uno

| Animación | Antes | Ahora | Con movimiento reducido |
|---|---|---|---|
| Abrir el reproductor grande | Móvil: hoja que sube (`enter-sheet`, `--slow`). Escritorio: sube 24 px y se funde. Keyframes: no interrumpible | Igual aspecto, como transición (`--slow`); interrumpible y reversible | Sin movimiento (0,01 ms) |
| Cerrar el reproductor grande | En producción, instantáneo (bug). En dev: hoja baja o fundido, `--exit` | Hoja baja (móvil) o se funde (escritorio), `--exit`; si se vuelve a abrir a mitad, revierte desde donde estaba | Cierra al instante |
| Cola (hoja en móvil, cajón sobre el reproductor, columna fija en escritorio) | Entrada keyframes; salida instantánea en producción; la columna fija sin animación | Transición `--base` (sube 24 px y se funde) y salida `--exit`; la columna fija sigue sin animación (`transition: none`) | Sin movimiento |
| Menú ≡ (hoja en móvil, popover desde 600 px) y su telón | Keyframes; salida instantánea en producción | Hoja: sube/baja `--base`/`--exit`. Popover: `--fast` de entrada y `--exit` de salida (se funde y se desplaza 4 px). Telón: fundido con la misma duración | Sin movimiento |
| Cambio de página dentro del menú | `page-in` (desplaza ±16 px y se funde, `--base`, `--ease-move`) | Sin cambio: sustituye una página por otra al instante, así que no hay nada que interrumpir | Sin movimiento |
| Hojas y diálogos (acciones de pista, letra, cuenta, confirmaciones, atajos, biblioteca) | Keyframes; salida instantánea en producción | Un solo `Dialog`: hoja que sube (móvil) o pop de 4 px y escala 0,98 (≥ 600 px), con telón; salida `--exit`; interrumpible | Sin movimiento |
| Avisos (toast) | `enter-rise` y `exit-fade`; salida instantánea en producción | Sube 8 px y se funde `--base`; sale con fundido `--exit` | Sin movimiento |
| Botón de reproducir / pausar | El icono cambia al instante; sin escala al pulsar (transporte) | **Sin cambio, a propósito**: se usa cientos de veces (principio 5 de `DESIGN.md`). El icono cambia en el mismo fotograma del toque, que es la respuesta más reactiva | n/a |
| Salto de canción: portada | Cambio instantáneo; con el gesto de deslizar, la portada ya viaja con el dedo | Sin gesto (botón, fin de pista): la portada anterior se disuelve sobre la nueva (`opacity`, `--base`). Tras un gesto no se añade nada (ya llegó deslizando) | Cambio instantáneo |
| Salto de canción: título y artista | Instantáneo | El bloque se funde de 0 a 1 (`--fast`) | Instantáneo |
| Salto de canción: color | El acento cambia al instante en toda la interfaz; el fondo WebGL ya se acerca al color nuevo con suavizado | **Sin cambio.** Animar un color exige `color` en la transición y rompe «solo `transform`/`opacity`». Queda como límite | n/a |
| Cambio de pestaña (biblioteca y navegación) | Sin animación | **Sin cambio, a propósito**: puerta de frecuencia («pestañas y filas de lista → sin animación») | n/a |
| Filas deslizables | `transform` con `--base` y `--ease-move` al volver; sin transición mientras se arrastra | Sin cambio (ya era interrumpible) | Sin movimiento |
| Landing | `landing-rise` y reveladores con `--page` | Fuera de alcance (no es la app) | Sin movimiento |

Con teclado (`html[data-input="key"]`) tampoco se anima el fundido del título ni la portada que se disuelve: los atajos no animan.

## Fotogramas perdidos (CPU 6×, producción)

Cada celda: fotogramas perdidos · peor hueco entre dos fotogramas, en la ventana de la animación. «Antes» es lo que se servía (con las salidas instantáneas por el bug: en esas filas no había animación que medir).

**Móvil 390×844**

| Paso | Antes | Después |
|---|---|---|
| Abrir el reproductor grande | 3 · 50 ms | 3 · 50 ms |
| Cambio de pista (siguiente) | 0 · 17 ms | 1 · 33 ms |
| Reproducir / pausar | 0 · 17 ms | 0 · 17 ms |
| Abrir la cola | 3 · 67 ms | 3 · 67 ms |
| Cerrar la cola | 2 · 33 ms | 2 · 50 ms |
| Abrir el menú ≡ | 2 · 50 ms | 2 · 50 ms |
| Menú: cambio de página | 1 · 33 ms | 1 · 33 ms |
| Cerrar el menú ≡ | 0 · 17 ms | 0 · 17 ms |
| Cerrar el reproductor grande | 2 · 33 ms | 2 · 50 ms |
| Cambio de pestaña de la biblioteca | 0 · 17 ms | 0 · 17 ms |
| Abrir la hoja de acciones | 0 · 17 ms | 0 · 17 ms |
| Cerrar la hoja de acciones | 0 · 17 ms | 0 · 17 ms |
| Aparece un aviso | 0 · 17 ms | 0 · 17 ms |
| Desaparece el aviso | 0 · 17 ms | 0 · 17 ms |

**Escritorio 1440×900**

| Paso | Antes | Después |
|---|---|---|
| Abrir el reproductor grande | 3 · 50 ms | 4 · 50 ms |
| Cambio de pista (siguiente) | 0 · 17 ms | 1 · 33 ms |
| Reproducir / pausar | 0 · 17 ms | 0 · 17 ms |
| Abrir la cola | 4 · 83 ms | 4 · 83 ms |
| Cerrar la cola | 3 · 50 ms | 3 · 50 ms |
| Abrir el menú ≡ | 3 · 67 ms | 3 · 67 ms |
| Menú: cambio de página | 1 · 33 ms | 1 · 33 ms |
| Cerrar el menú ≡ | 2 · 33 ms | 2 · 33 ms |
| Cerrar el reproductor grande | 3 · 50 ms | 3 · 50 ms |
| Cambio de pestaña de la biblioteca | 0 · 17 ms | 0 · 17 ms |
| Abrir la hoja de acciones | 0 · 17 ms | 0 · 17 ms |
| Cerrar la hoja de acciones | 0 · 17 ms | 0 · 17 ms |
| Aparece un aviso | 0 · 17 ms | 0 · 17 ms |
| Desaparece el aviso | 0 · 17 ms | 0 · 17 ms |

Lectura: los fotogramas perdidos **no cambian** (±1): las entradas y salidas ya eran de `transform`/`opacity`, y el cambio es de continuidad, no de coste. El cambio de pista cuesta un fotograma más (monta la portada que se disuelve y remonta el título). Los 3–4 fotogramas perdidos al abrir el reproductor y la cola son el coste de montar el componente (un único trabajo de ≈ 50–80 ms con la CPU 6× más lenta; unos 10 ms estimados sin limitar, no medidos); no se tocó.

**Interrupciones** (sin limitar la CPU; el panel debe seguir sin retroceder hacia la pose que abandonaba; 0 % = inversión limpia):

| Caso | Antes (móvil · escritorio) | Después (móvil · escritorio) |
|---|---|---|
| Cerrar a los 20 ms de abrir | 54 % · 0 % | 0–17 % · 0–17 % |
| Volver a abrir a los 20 ms de cerrar | 100 % · 100 % | 46 % · 46 % |

El 100 % del «antes» es el reinicio completo desde «cerrado» (en una traza con el código anterior, la hoja estaba en y = 0 y pasó a y = 844 al volver a abrir). El 46 % de «después» no es un salto: es la inercia de un fotograma (entre la orden y que React quita `data-closing` pasa ≈ 1 fotograma y la curva de salida es muy rápida al principio), tras el cual la hoja da la vuelta desde donde está (en la traza: 391 → 633 → 432 → 263 → … → 0, continua).

## Límites de la medición

- `requestAnimationFrame` mide al hilo principal. Una animación de `transform`/`opacity` en el compositor sigue fluida aunque el hilo se atasque, así que «perdidos» es un tope pesimista útil para comparar antes y después, no un recuento de lo que ve una persona.
- Chromium en modo headless sin GPU real (el WebGL del fondo corre por software); la CPU 6× es una emulación. No se midió en un móvil real.
- `@starting-style` (entradas) se comprobó en Chromium y Firefox; en WebKit no se pudo (la prueba se colgó al importar los archivos en este equipo). Sin `@starting-style` el panel aparece sin entrada y las salidas siguen funcionando.
- No se tocó el salto de altura del menú ≡ al cambiar de página (la hoja cambia de alto: es layout, no `transform`).
