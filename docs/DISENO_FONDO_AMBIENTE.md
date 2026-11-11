# Diseño: fondo ambiental v2 del reproductor grande

Estado: **propuesta para aprobar**. Base existente: lienzo WebGL propio (`Backdrop.tsx`, `backdropRenderer.ts`), energía por
bandas y detección de golpes en `src/core`, modos Portada / Ritmo / Estático / AM…

## Opinión

La idea es buena y encaja con Poweramp. El riesgo no es técnico sino de gusto: demasiado movimiento cansa, resta contraste al
texto y quema batería. Mi recomendación es **un fondo en capas, contenido y con jerarquía**: una sola cosa llama la atención
(la portada), el resto respira.

## Capas (de atrás hacia delante)

1. **Base:** degradado en OKLCH tomado de la paleta de la portada (2–3 tonos análogos). Oscurecido para que el texto cumpla
   contraste AA sobre cualquier portada (se fija un techo de luminosidad).
2. **Resplandor de la portada:** la propia portada muy desenfocada, escalada, con deriva lenta (20–40 s por ciclo).
3. **Luces ambientales:** 3–5 orbes aditivos grandes y suaves. Reparto por banda: graves → un orbe grande, pulso corto
   (120–200 ms, ataque rápido y caída lenta); medios → desplazamiento; agudos → destellos pequeños. Así "se mueven con el
   ritmo" sin parpadear.
4. **Figura protagonista (una sola, elegible):** anillos que laten con el golpe, anillo espectral alrededor de la portada,
   barrido cónico de luz tipo vinilo/disco (da la sensación de "disco" que pidió el usuario), o partículas escasas.
5. **Grano fino** muy sutil: evita bandas de color en degradados y da textura premium.
6. **Velo de legibilidad** bajo textos y controles (degradado local), no sobre toda la pantalla.

## Reglas de armonía y contraste

- Paleta: análoga a la portada + **un** acento complementario de baja saturación; nunca arcoíris.
- Movimiento lento de fondo + pulso corto en golpe: dos escalas de tiempo, no más.
- Todo escala con una "intensidad" 0–100 % (por defecto ~60 %).
- Texto y controles: contraste ≥ 4.5:1 medido contra el fondo ya renderizado (prueba con capturas).
- `prefers-reduced-motion` → estático (solo degradado y portada). Modo "ahorro": sin figuras, 30 fps.
- Degradación automática: si el tiempo de fotograma supera ~24 ms sostenido, baja resolución interna y quita capas
  (figura primero, luego orbes).

## Modos de usuario (menú ≡)

Portada (por defecto) · Pulso (más reactivo) · Aurora (lento, sin figura) · Disco (barrido cónico + anillos) · Partículas ·
Estático. Más control de intensidad y "Ahorro de batería".

## Qué NO se hace

- Visualizador estilo MilkDrop (butterchurn): exige `'unsafe-eval'` en el CSP → sigue bloqueado (D13). Si se quisiera, sería
  un modo opcional en una ruta aislada con CSP propio; decisión del usuario.
- MP4 de fondo: no puede reaccionar al audio en tiempo real. Solo como vídeo de demostración o modo "Bucle" de bajo consumo.
- Librerías con licencia AGPL (audiomotion-analyzer).

## Plan de implementación

1. Refactor del renderizador en capas con presupuesto de rendimiento y medición de fotogramas.
2. Luces ambientales por banda + figura "Disco" (la de mayor impacto) → revisar con el usuario en el preview.
3. Resto de figuras y modos; ajuste de contraste con capturas automáticas sobre portadas claras, oscuras y saturadas.
4. Pruebas: unitarias de mapeo energía→parámetros (señales sintéticas), `prueba-fondo.mjs` ampliada, comprobación de
   contraste, y prueba de móvil de gama baja (CPU ×4 de estrangulamiento en DevTools).
