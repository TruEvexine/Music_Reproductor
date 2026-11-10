# AGENTS.md — Cómo trabajar en este proyecto

> Reescrito el 2026-11-10 (Fase 1). **`PLAN.md` manda** sobre este archivo y sobre `DESIGN.md`.

## 1. Antes de tocar código

1. **Skills.** Averigua cuáles tienes y lee completo el `SKILL.md` de **ponytail** y de las de diseño que existan (design-taste-frontend, ui-ux-pro-max, design-motion-principles, impeccable, apple-design, frontend-design, anti-slop). Si falta alguna, anótalo en `DECISIONES_PENDIENTES.md` y aplica su principio con tu criterio.
2. **Documentos, en este orden:** `SECURITY_AUDIT.md` → `PLAN.md` → este archivo → `DESIGN.md` → `SUPABASE.md` → `DECISIONES_PENDIENTES.md`.
3. **Inspecciona antes de asumir:** qué existe, qué dependencias hay, qué fase toca. No inventes APIs, tablas, rutas ni credenciales; si dudas de una API (navegador, Capacitor, Android, iOS, librería), consulta su documentación oficial.

**ponytail en todo el código:** el cambio más pequeño que resuelve la tarea completa; nada de abstracciones ni dependencias que nadie pidió. Excepción: las fronteras de plataforma (§4), que tienen un segundo uso real. Al cerrar una fase con UI, añade a `PLAN.md` la línea `Skills aplicadas: …`.

## 2. Git

- Rama `desarrollo`. **Nunca** push a `main`, force push, rebase de historial público ni merge a `main`: lo decide el usuario.
- Commits a nombre del usuario. **Prohibido** `Co-Authored-By`, `Claude-Session`, "Generated with Claude Code" o cualquier atribución a un asistente, en commits y PRs. Comprueba con `git log -1 --format=%B`.
- Un commit por tarea, en español, imperativo. Antes: `npm run typecheck`, `npm test`, `npm run build`.
- Cada clon activa los hooks con `npm run setup`.
- Si algo depende del usuario (marca, dominio, cuentas, paneles, Android Studio, Apple Developer): no te detengas ni preguntes; anótalo en `DECISIONES_PENDIENTES.md` y sigue.
- `PLAN.md` es el registro: marca casillas, actualiza el snapshot (§2) y las decisiones (§3). Debe poder retomarlo otra sesión sin contexto.

## 3. Arquitectura

```text
UI (src/ui)  →  estado (src/state)  →  core (src/core) + motor (src/engine) + plataforma (src/platform) + sincronización (src/sync)
```

| Carpeta | Qué contiene | Regla |
|---|---|---|
| `src/core/` | Cola, shuffle, identidad de pista, formato, búsqueda, paleta, mensajes de Auth | **TypeScript puro**: sin `window`, `document` ni Capacitor. Todo con test en Vitest |
| `src/engine/` | `PlayerEngine`: único dueño del `<audio>` (y del grafo Web Audio) | No conoce React, la cola ni la biblioteca |
| `src/state/` | Stores Zustand: `player` (fuente única de verdad de la reproducción) y `library` | La UI solo lee el store y llama a `player.*` / `library.*` |
| `src/platform/` | Fronteras (`types.ts`) y su implementación web (`web/`) | Una interfaz por frontera, nada más |
| `src/sync/` | Supabase: cliente, Auth, playlists | Único lugar que habla con Supabase |
| `src/ui/` | Componentes, router (`router.ts`) y estilos (`styles/`, tokens en `tokens.css`) | Sin lógica de audio ni consultas |

- **Reproductor:** una sola fuente de verdad (`usePlayer`): cola, pista actual, posición, duración, repetición, shuffle. El tiempo mostrado viene del audio real, nunca de un temporizador. El fin de pista lo gestiona el motor/store.
- **Cola:** entidad lógica en `core/queue.ts` (añadir, quitar, mover, vaciar, siguiente, anterior). La pista actual se identifica por id, así que reordenar nunca la pierde. Repetición: `off` → `queue` → `track`; no cambiar esa semántica.
- **Metadatos:** nunca asumir título, artista, álbum, portada, género ni año. Respaldos: nombre de archivo, "Artista desconocido", "Álbum desconocido", degradado como portada.
- **Errores de reproducción:** marcar la pista, avisar, saltar; tras 3 seguidas, detenerse.
- **`track:v1`** (`core/track.ts`) es la identidad de las playlists guardadas: no cambiar su algoritmo. `track:v2` llegará como añadido.

## 4. Multiplataforma y offline-first

Una base de código, tres destinos (web, Android, iPhone con Capacitor). Ver `PLAN.md` §3.7 y `docs/ARQUITECTURA_APP.md`.

- Fronteras: `LocalLibrary`, `AudioSession`, `SecureStore`, `Storage`, `Connectivity`. Hoy solo existe la versión web; la nativa se escribe cuando haya Android Studio.
- Variantes por plataforma con `data-platform="web|android|ios"` en `<html>` y CSS; nunca forks de componentes enteros.
- `VITE_TARGET=web|android|ios`. En nativo: `base: './'`, router con hash, CSP por `<meta>`, sin dominios absolutos.
- **Todo el estado del usuario se escribe primero en IndexedDB** y funciona sin red. Supabase es sincronización opcional. La UI nunca espera a la red.
- El esquema local solo cambia **añadiendo** una migración al final de `platform/web/db.ts`.
- No ejecutar `npx cap add android|ios` ni versionar `android/`/`ios/` hasta que el usuario lo confirme.

## 5. Seguridad

- En el cliente solo existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nada de `service_role`, secret keys ni URIs de PostgreSQL (el build falla si las ve). Lo secreto vive en Edge Functions.
- **Nunca se versiona ni se despliega audio.** `src/assets/music/` es local e ignorada: no la borres ni la muevas. Para pruebas, audio sintético: `npm run test:audio`.
- Metadatos y nombres se pintan como texto: sin `innerHTML`, `dangerouslySetInnerHTML` ni `eval`. Portadas: ≤ 12 MB y MIME en lista blanca. URLs `blob:` revocadas al dejar de usarse.
- Errores de Auth sin revelar si un correo existe; sin datos sensibles en `console`.
- Cabeceras y CSP en `vercel.json`; tras cambiarlas, `npm run build` y `node scripts/verificar-csp.mjs`.
- **Supabase es un proyecto COMPARTIDO** (otras apps usan tablas `math_*`). Solo se toca: `profiles`, `playlists`, `playlist_tracks`, `create_profile_for_new_user`, `replace_playlist_tracks`, el trigger `on_auth_user_created` y lo nuevo con prefijo `mp_`. Cada cambio es una migración nueva en `supabase/migrations/`, idempotente y aditiva, con RLS por `auth.uid()` y `revoke execute` en funciones `security definer` que no sean RPC, probada en un Postgres local descartable. No aplicar al remoto sin documentarlo. Nunca desactivar RLS.
- App nativa: sin cleartext, navegación restringida, depuración de WebView apagada en release, `allowBackup=false`, tokens en Keystore/Keychain, keystore y contraseñas fuera del repo.

## 6. Diseño y responsive

`DESIGN.md` es obligatorio para cualquier cambio visual. Mobile-first: nada está terminado si falla en móvil.

- Cero scroll horizontal; `dvh`/`svh`; safe areas; correcto con el teclado virtual abierto.
- Áreas táctiles ≥ 44 px; controles principales en la mitad inferior; nada depende solo de hover ni solo de color.
- Gestos con Pointer Events y siempre con alternativa por botón y teclado.
- Tipografía y espaciado fluidos; zoom de texto al 200 %; respetar `prefers-reduced-motion`, `prefers-color-scheme` y `prefers-contrast`.
- Rendimiento en gama media: listas virtualizadas, animar solo `transform`/`opacity`, fondo dinámico pausado con la pestaña oculta.
- **Verificado, no supuesto:** `node scripts/capturas.mjs docs/capturas` debe pasar en toda la matriz y las capturas se revisan con criterio de diseño, no solo "no se rompe".

## 7. Al terminar una tarea

Comprueba: compila, tests en verde, nada roto, sin secretos, sin dependencias innecesarias, respeta `PLAN.md`/`DESIGN.md`/`SUPABASE.md`, matriz responsive correcta. Informa en corto: qué se hizo, qué se probó de verdad, qué se omitió y qué riesgos quedan. **No afirmes haber probado algo que no ejecutaste**, y no finjas una función que no se puede implementar: explica el límite y deja lo pendiente documentado.

> Primero entender. Después implementar. Después probar.
