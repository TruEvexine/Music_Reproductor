# AGENTS.md — Guía de agentes para el proyecto

> Las secciones 26–30 (skills, git, seguridad, responsive, multiplataforma) son obligatorias y prevalecen sobre las anteriores si se contradicen. `PLAN.md` manda sobre todo.

## 1. Propósito

Este archivo define cómo debe trabajar cualquier agente de IA que modifique, implemente, revise o amplíe el reproductor de música.

El agente debe priorizar:

1. Funcionalidad real.
2. Arquitectura mantenible.
3. Fidelidad a `DESIGN.md`.
4. Separación entre frontend, reproducción local y Supabase.
5. No romper funcionalidades existentes.
6. No inventar APIs, dependencias, credenciales ni capacidades del framework.

---

# 2. Documentos de autoridad

Antes de realizar cambios, leer:

```text
PLAN.md
DESIGN.md
SUPABASE.md
```

Si existe documentación adicional del framework o del proyecto, leerla antes de tomar decisiones estructurales.

## Jerarquía

Para funcionalidad:

```text
PLAN.md
↓
código existente
↓
decisiones de implementación
```

Para diseño:

```text
DESIGN.md
↓
referencias visuales proporcionadas
↓
implementación
```

Para Supabase:

```text
SUPABASE.md
↓
configuración real del proyecto Supabase
↓
implementación
```

---

# 3. Regla crítica

**No empezar programando inmediatamente.**

Primero:

```text
1. Inspeccionar proyecto.
2. Identificar stack.
3. Identificar estructura.
4. Revisar dependencias.
5. Revisar estado actual.
6. Leer documentación.
7. Detectar qué ya existe.
8. Determinar cambios mínimos necesarios.
9. Implementar.
10. Probar.
```

Nunca asumir que el repositorio está vacío.

---

# 4. No inventar información

Si falta información:

- No inventar credenciales.
- No inventar tablas.
- No inventar APIs.
- No inventar rutas.
- No inventar componentes existentes.
- No asumir que una librería está instalada.
- No asumir compatibilidad de formatos de audio.

Si una decisión es necesaria:

1. Comprobar documentación oficial.
2. Inspeccionar el proyecto.
3. Elegir la solución compatible.
4. Documentar la decisión.

---

# 5. Reglas de implementación

## Mantener separación de responsabilidades

No colocar:

- lógica de audio dentro de componentes visuales,
- consultas Supabase directamente en cada botón,
- extracción de metadata dentro de la vista,
- lógica de cola duplicada en múltiples componentes.

Preferir:

```text
UI
↓
Controller / State
↓
Service
↓
Infrastructure
```

---

# 6. Reproductor

Debe existir una fuente central de verdad para:

```text
currentTrack
isPlaying
currentPosition
duration
queue
currentQueueIndex
repeatMode
```

La UI debe reaccionar a este estado.

No crear estados paralelos que puedan divergir.

---

# 7. Biblioteca

El agente debe respetar:

```text
music/
```

como fuente de archivos locales.

Al escanear:

- Detectar formatos soportados.
- Extraer metadata.
- Extraer portada.
- Aplicar fallbacks.
- Evitar duplicados.
- Manejar archivos corruptos.
- No bloquear la UI innecesariamente.

---

# 8. Metadata

Nunca asumir que una canción tiene:

- título,
- artista,
- álbum,
- portada,
- género,
- año.

Debe existir fallback.

Ejemplo:

```text
TITLE faltante
↓
filename
```

y:

```text
ARTIST faltante
↓
Artista desconocido
```

---

# 9. Audio

El agente debe garantizar:

- Play.
- Pause.
- Resume.
- Previous.
- Next.
- Seek.
- Repeat.
- Auto-next.
- Estado de reproducción.
- Manejo de errores.

Cuando una canción termine, el evento debe ser gestionado por el motor/controlador de reproducción y no por un hack de interfaz.

---

# 10. Cola

La cola debe ser una entidad lógica independiente.

Debe soportar:

```text
add
remove
move/reorder
clear
play
next
previous
```

El agente debe preservar correctamente:

```text
currentQueueIndex
```

después de operaciones de reordenamiento.

---

# 11. Repeat

Los modos mínimos son:

```text
OFF
REPEAT_QUEUE
REPEAT_TRACK
```

No cambiar silenciosamente la semántica de estos estados.

---

# 12. Tiempo

El tiempo mostrado debe provenir del estado real del reproductor.

Mostrar:

```text
elapsed
duration
remaining
```

cuando corresponda.

El slider debe permitir seek.

No utilizar temporizadores visuales que simplemente "cuenten" sin consultar el estado real del audio.

---

# 13. Diseño

`DESIGN.md` es obligatorio para cualquier modificación visual.

El agente no debe reemplazar el diseño con:

- una plantilla genérica,
- una interfaz estándar del framework,
- una copia de Spotify,
- una copia literal de Qobuz,
- una copia literal de Poweramp.

La intención es:

```text
Qobuz
+
Poweramp
+
identidad propia
```

---

# 14. Color dinámico de portada

Esta es una característica fundamental.

Cada canción debe poder producir una paleta visual basada en su portada.

Flujo:

```text
cover
↓
color extraction
↓
palette
↓
contrast correction
↓
player background
```

El fondo debe cambiar al cambiar la canción.

## Reglas

Nunca permitir que el color dinámico:

- destruya contraste,
- vuelva ilegible el texto,
- oculte controles,
- genere saturación excesiva.

Preferir:

```text
color dominante
→ oscurecer
→ suavizar
→ aplicar gradiente
```

La transición entre canciones debe ser suave.

---

# 15. Responsive

No implementar responsive únicamente reduciendo tamaños.

Debe existir adaptación estructural.

## Desktop

Puede utilizar:

```text
sidebar + content + persistent player
```

## Mobile

Debe priorizar:

```text
cover
track information
progress
controls
queue
```

El agente debe probar tamaños extremos.

---

# 16. Accesibilidad

Los controles deben poder utilizarse con:

- mouse,
- teclado cuando aplique,
- touch.

No depender únicamente de color.

Los elementos interactivos deben tener áreas suficientemente grandes.

---

# 17. Supabase

Toda interacción con Supabase debe pasar por una capa de servicio.

No repartir credenciales ni configuración por los componentes.

Nunca utilizar una service role key en frontend/cliente.

Si no hay conexión:

```text
Supabase falla
↓
La reproducción local continúa
```

cuando la función no dependa de backend.

---

# 18. Cambios en base de datos

Antes de modificar Supabase:

```text
1. Inspeccionar estructura actual.
2. Revisar RLS.
3. Revisar policies.
4. Determinar impacto.
5. Crear migración.
6. Probar.
```

Nunca eliminar tablas o policies existentes sin comprobar su uso.

---

# 19. Dependencias

Antes de instalar una dependencia:

- Verificar si ya existe una solución instalada.
- Comprobar compatibilidad con el stack.
- Evitar dependencias redundantes.
- Preferir librerías maduras para audio/metadata.

No añadir una dependencia únicamente para resolver algo que puede hacerse correctamente con el stack existente.

---

# 20. Pruebas obligatorias

Después de cambios importantes comprobar:

### Audio

- Play.
- Pause.
- Resume.
- Previous.
- Next.
- Seek.
- Fin de canción.
- Repeat Track.
- Repeat Queue.
- Loop Off.

### Biblioteca

- MP3.
- FLAC.
- WAV.
- M4A/AAC.
- OGG/Opus si está soportado.
- Metadata completa.
- Metadata incompleta.
- Sin portada.
- Archivo inválido.

### Responsive

- Desktop.
- Tablet.
- Mobile.
- Portrait.
- Landscape.

### Backend

- Registro.
- Login.
- Logout.
- Sesión.
- RLS.
- Error de red.

---

# 21. Antes de finalizar

El agente debe comprobar:

```text
[ ] Compila.
[ ] No existen errores nuevos.
[ ] No rompió funcionalidades existentes.
[ ] No dejó secretos.
[ ] No añadió dependencias innecesarias.
[ ] Respeta PLAN.md.
[ ] Respeta DESIGN.md.
[ ] Respeta SUPABASE.md.
[ ] Responsive funciona.
[ ] Audio funciona.
[ ] Cola funciona.
[ ] Metadata funciona.
```

---

# 22. Comunicación de cambios

Al terminar una tarea, informar de forma breve:

```text
Qué se hizo
Qué archivos cambiaron
Qué se probó
Qué queda pendiente
```

No afirmar que algo fue probado si realmente no se ejecutó.

---

# 23. Si algo no puede implementarse

No hacer una implementación falsa para aparentar funcionalidad.

En su lugar:

```text
1. Explicar la limitación.
2. Identificar la causa.
3. Proponer la solución técnicamente viable.
4. Implementarla si está dentro del alcance.
5. Documentar lo pendiente.
```

---

# 24. Regla contra sobreingeniería

El proyecto debe crecer de forma controlada.

No introducir:

- microservicios,
- arquitecturas innecesarias,
- capas artificiales,
- patrones excesivos,
- sistemas de recomendación complejos,

si el MVP no los necesita.

La prioridad es un reproductor local sólido con backend básico y una UI premium.

---

# 25. Regla de oro

> **Primero entender el proyecto. Después implementar. Después probar.**

La apariencia no sustituye la funcionalidad.

La funcionalidad no justifica romper el diseño.

El backend no debe acoplarse innecesariamente al reproductor local.

Cada decisión debe mantener esas tres áreas separadas y coordinadas:

```text
┌──────────────────┐
│       UI         │
└────────┬─────────┘
         │
┌────────▼─────────┐
│ Playback / State │
└───────┬───┬──────┘
        │   │
   ┌────▼┐ ┌▼─────────┐
   │Local│ │ Supabase │
   │Audio│ │  / Auth  │
   └─────┘ └──────────┘
```

---

# 26. Antes de empezar: skills (obligatorio)

1. Averiguar qué skills hay disponibles (usuario, proyecto, plugins).
2. Leer completo el `SKILL.md` de **ponytail** y de las de diseño que existan: taste-skill / design-taste-frontend, ui-ux-pro-max, design-motion-principles, impeccable, apple-design, frontend-design, anti-slop.
3. Si falta alguna, anotarlo en `DECISIONES_PENDIENTES.md` y aplicar su principio con criterio propio.
4. **ponytail en todo el código:** el cambio más pequeño que resuelve la tarea completa, sin abstracciones ni dependencias que nadie pidió. Excepción: las fronteras de plataforma de la §30, que tienen un segundo uso real (Android e iPhone).
5. Al cerrar una fase con UI, añadir a `PLAN.md` la línea `Skills aplicadas: ...` con las usadas de verdad.

`PLAN.md` manda sobre este archivo y sobre `DESIGN.md`.

# 27. Git y commits

- Rama de trabajo: `desarrollo`. **Nunca** push a `main`, force push, rebase de historial público ni merge a `main`: lo decide el usuario.
- Commits a nombre del usuario. **Prohibido** `Co-Authored-By`, `Claude-Session`, "Generated with Claude Code" o cualquier atribución a un asistente de IA, en commits y en PRs. Comprobar después con `git log -1 --format=%B`.
- Un commit por tarea, en español, imperativo. Antes de cada commit: `npm run typecheck`, `npm test`, `npm run build` en verde.
- Cada clon nuevo activa los hooks con `npm run setup` (`.githooks/pre-commit` bloquea `.env`, audio, keystores, archivos > 2 MB y patrones de secretos; `.githooks/commit-msg` quita atribuciones).
- Si algo requiere una decisión o acción del usuario, no detenerse: anotarlo en `DECISIONES_PENDIENTES.md` y seguir con lo siguiente.

# 28. Seguridad

- En el cliente y en la app solo existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nada de `service_role`, secret keys ni URIs de PostgreSQL: el build falla si las detecta (`scripts/envGuard.ts`). Lo secreto vive en Edge Functions.
- **Nunca se versiona ni se despliega audio.** `src/assets/music/` es local e ignorada: no borrarla ni moverla. Para pruebas, audio sintético (`npm run test:audio`).
- Metadatos, nombres de archivo y de playlists se pintan como texto: sin `innerHTML`, `dangerouslySetInnerHTML` ni `eval`.
- Al importar: portada ≤ 12 MB y MIME en lista blanca (`src/core/coverMime.ts`); el parseo no debe colgar la app con archivos corruptos o enormes.
- URLs `blob:` siempre revocadas al dejar de usarse.
- Errores de Auth sin revelar si un correo existe (`src/core/authMessages.ts`); sin datos sensibles en `console`.
- Cabeceras y CSP en `vercel.json`; verificar cualquier cambio con `node scripts/verificar-csp.mjs`. En la app nativa la CSP va por `<meta>`.
- **Supabase es un proyecto COMPARTIDO** con otras apps (tablas `math_*`). Solo se toca: `profiles`, `playlists`, `playlist_tracks`, `create_profile_for_new_user`, `replace_playlist_tracks`, el trigger `on_auth_user_created` y lo nuevo con prefijo `mp_`. Cada cambio es una migración nueva, idempotente y aditiva, con RLS por `auth.uid()`, probada en un Postgres local descartable. No desactivar RLS jamás.
- App nativa: sin cleartext, navegación restringida, depuración de WebView apagada en release, `allowBackup=false`, tokens en Keystore/Keychain, keystore y contraseñas fuera del repo.

# 29. Responsive (requisito transversal)

Mobile-first. Nada está terminado si falla en móvil.

- Matriz obligatoria en Playwright: 320×568, 360×800, 390×844, 412×915, 844×390 (móvil horizontal), 768×1024, 1024×768, 1440×900, 1920×1080.
- Cero scroll horizontal. `dvh`/`svh` (no `100vh`), `env(safe-area-inset-*)`, correcto con el teclado virtual abierto.
- Controles principales en la mitad inferior; áreas táctiles ≥ 44×44 px; nada depende solo de hover.
- Gestos con Pointer Events, siempre con alternativa por botón y por teclado.
- Tipografía y espaciado fluidos (`clamp()`), zoom de texto al 200 % sin romper. Respetar `prefers-reduced-motion`, `prefers-color-scheme` y `prefers-contrast`.
- Rendimiento en gama media: listas virtualizadas, imágenes al tamaño justo, animar solo `transform`/`opacity`, fondo dinámico pausado con la pestaña oculta.
- **Diseño verificado, no supuesto:** ninguna tarea de UI termina sin capturas de la matriz revisadas con criterio de diseño. Al cerrar cada fase de UI, capturas de cada vista en 390×844 y 1440×900 en `docs/capturas/` (`node scripts/capturas.mjs`).

# 30. Arquitectura multiplataforma (web + Android + iPhone)

Una base de código, tres destinos. Ver `docs/ARQUITECTURA_APP.md` y `PLAN.md` §3.7.

```text
src/core/             lógica pura: sin window, document ni Capacitor. Se prueba en Node (Vitest).
src/platform/web/     implementación web de las fronteras
src/platform/native/  implementación nativa (se escribe cuando exista Android Studio)
src/ui/               componentes compartidos
```

- Fronteras, una interfaz cada una: `LocalLibrary`, `AudioSession`, `SecureStore`, `Storage`, `Connectivity`.
- Variantes por plataforma con `data-platform="web|android|ios"` en `<html>` y CSS/props; nunca forks de componentes enteros.
- `VITE_TARGET=web|android|ios`. En nativo: `base: './'`, router con hash, sin dominios absolutos.
- **Offline-first:** todo el estado del usuario se escribe primero en IndexedDB (esquema versionado con migraciones). Supabase es sincronización opcional mediante outbox. La UI nunca espera a la red.
- No ejecutar `npx cap add android|ios` ni versionar `android/` o `ios/` hasta que el usuario confirme Android Studio / Xcode.
