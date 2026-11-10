# Decisiones y acciones pendientes del usuario

Lo que el desarrollo no puede resolver solo. Cada entrada: qué, por qué bloquea, opciones y recomendación.

## Abiertas

### D1 — Skills de diseño no instaladas
- **Qué:** no existen en este equipo `frontend-design` ni una referencia `awesome-claude-design`.
- **Bloquea:** nada. Se aplican sus principios con las instaladas (impeccable, apple-design, design-taste-frontend, ui-ux-pro-max, design-motion-principles, anti-slop, ponytail).
- **Recomendación:** instalarlas solo si se quiere esa lente adicional.

### D2 — Cambio local sin commitear en `src/assets/music/README.md`
- **Qué:** el archivo de trabajo tiene un texto antiguo ("Vite los incorpora automáticamente al compilar") distinto del versionado. No lo hizo el desarrollo y no se ha tocado.
- **Recomendación:** descartarlo con `git restore src/assets/music/README.md`.

### D3 — Prototipo de audio en segundo plano (Android)
- **Qué:** elegir cómo suena la app con la pantalla apagada: (a) audio del WebView + servicio en primer plano que mantiene vivo el proceso, o (b) reproducción nativa con Media3 mediante plugin.
- **Bloquea:** la implementación nativa de `AudioSession` (Fase 11). No bloquea la web.
- **Opciones:** (a) conserva ecualizador y analizador de Web Audio, fiabilidad por comprobar; (b) fiable, pero el EQ habría que rehacerlo en nativo.
- **Recomendación:** probar (a) primero en un dispositivo real. Requiere Android Studio instalado.
