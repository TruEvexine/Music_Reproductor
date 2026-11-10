# Decisión de arquitectura: cómo llegar a Android y iPhone

**Fecha:** 2026-11-10 · **Estado:** aceptada (documento; no hay nada implementado) · **Sustituye a:** "TWA primero" de la Fase 11 de `PLAN.md`.

## Contexto

Una sola persona mantiene un reproductor web (Vite + React 19 + TypeScript) que debe ser además app de Android y de iPhone, **funcionando sin internet**, leyendo la música del dispositivo y sonando con la pantalla apagada.

## Opciones

| Criterio | **Capacitor** (la web empaquetada) | **React Native** | **Nativo** (Kotlin/Compose + Swift) |
|---|---|---|---|
| Reutilización de código | ~100 % de UI y lógica. Se añaden plugins en las fronteras de plataforma | Lógica en TS sí; **toda la UI se reescribe** (no hay DOM ni CSS) | Nada de UI; la lógica se reescribe dos veces (o se comparte con KMP, otra tecnología más) |
| Audio en segundo plano | **Punto débil.** El audio de un WebView no está garantizado con la app en segundo plano. Hace falta código nativo: en Android un servicio en primer plano de tipo `mediaPlayback` con `MediaSessionService` (Media3); en iOS el modo de fondo de audio | Resuelto por librerías de la comunidad, que envuelven lo mismo | El mejor: Media3/ExoPlayer y AVFoundation directos |
| Archivos locales | Plugin: selector de carpeta/archivos del sistema. En iOS no hay carpetas libres: selector de documentos | Igual, vía módulos | Total (MediaStore, SAF, selector de documentos) |
| Rendimiento | WebView: suficiente para listas virtualizadas y CSS con `transform`/`opacity`. El fondo "Ritmo" hay que medirlo en gama media | Listas nativas; mejor arranque | El mejor |
| Mantenimiento (1 persona) | **Una base de código.** Dos proyectos nativos generados que casi no se tocan | Dos UIs (web y RN) que divergen | Tres bases de código |
| Tiendas | Aceptado en ambas. Mismas obligaciones que cualquier app (privacidad, borrado de cuenta, compras dentro de la app) | Igual | Igual |
| Riesgo principal | Audio en segundo plano y EQ: si el audio lo reproduce un servicio nativo, el grafo Web Audio (EQ, analizador) no se aplica a ese audio | Coste de reescribir y de mantener dos UIs | Tiempo: meses antes de igualar a la web |

**TWA** (lo que proponía el plan) queda descartada como destino: es Chrome a pantalla completa, así que hereda las dos carencias que justifican hacer una app —no hay servicio de reproducción propio ni acceso persistente a la música del dispositivo— y no existe en iPhone.

## Decisión

**Capacitor ahora**, con dos condiciones que mantienen abierta la salida:

1. **`src/core/` en TypeScript puro** (cola, shuffle, identidad de pista, escaneo por diferencias, outbox, paleta, EQ como datos): sin `window`, sin `document`, sin Capacitor. Se prueba en Node y se podría reutilizar tal cual en React Native, o portar a Kotlin/Swift con los tests como especificación.
2. **Una interfaz por frontera de plataforma** en `src/platform/`: `LocalLibrary`, `AudioSession`, `SecureStore`, `Storage`, `Connectivity`. Hoy solo existe la implementación web. La nativa se escribe cuando exista Android Studio.

Android primero; iPhone después (necesita Mac y cuenta de Apple Developer).

### Cuándo se revisaría

- Si en un Android de gama media la lista o el reproductor no sostienen 60 fps tras optimizar.
- Si el audio en segundo plano vía plugin resulta poco fiable y obliga a escribir tanto código nativo que el WebView deja de compensar.
- Si el ecualizador nativo (necesario cuando el audio no pasa por Web Audio) no alcanza la paridad con el de la web.

## Hechos verificados en documentación oficial (2026-11-10)

| Hecho | Fuente |
|---|---|
| Capacitor 8 (`@capacitor/core` 8.6.0, MIT). Requiere Node 22+, Android Studio 2025.2.1 como mínimo, SDK API 24+; iOS: Xcode 26.0 y macOS. Usa Swift Package Manager por defecto | capacitorjs.com/docs/getting-started/environment-setup |
| `npx cap add android`, `npx cap sync` (copia el build de `webDir`) | capacitorjs.com/docs/getting-started |
| `server.cleartext` = `false` por defecto; `server.allowNavigation` = `[]` ("not intended for use in production"); `server.androidScheme` = `https`; `android.webContentsDebuggingEnabled` e `ios.webContentsDebuggingEnabled` = `false` por defecto (se activan solos en desarrollo); `android.allowMixedContent` = `false` | capacitorjs.com/docs/config |
| Botón atrás: `App.addListener('backButton', …)` (solo Android; desactiva el manejo por defecto, hay que llamar a `history.back()`); `App.exitApp()`; `appUrlOpen` para enlaces. La página no menciona *predictive back* | capacitorjs.com/docs/apis/app |
| Tokens: no persistirlos o usar Keychain (iOS) / Keystore (Android) mediante plugin; CSP por `<meta http-equiv>`; nunca datos sensibles por esquemas de URL propios, preferir App Links / Universal Links | capacitorjs.com/docs/guides/security |
| Servicio en primer plano de medios: `android:foregroundServiceType="mediaPlayback"`, permisos `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_MEDIA_PLAYBACK`; declarar el tipo es obligatorio desde API 34 | developer.android.com/develop/background-work/services/fgs/service-types |
| Reproducción en segundo plano: `Player` + `MediaSession` dentro de un `MediaSessionService` | developer.android.com/media/media3/session/background-playback |
| Copias de seguridad: `android:allowBackup="false"` en `<application>` (por defecto es `true`); `android:dataExtractionRules` para Android 12+ | developer.android.com/guide/topics/data/autobackup |
| Play App Signing: clave de subida (firma lo que subes; Google puede restablecerla) y clave de firma de la app (la custodia Google) | support.google.com/googleplay/android-developer/answer/9842756 |
| Google Play: si la app permite crear cuentas debe ofrecer **una ruta dentro de la app y un enlace web** para pedir el borrado de la cuenta y sus datos | support.google.com/googleplay/android-developer/answer/13327111 |
| App Store 3.1.1: desbloquear funciones dentro de la app exige compra dentro de la app; no valen claves de licencia propias | developer.apple.com/app-store/review/guidelines |
| `showDirectoryPicker()`: experimental, no es *Baseline*, exige HTTPS y gesto del usuario | developer.mozilla.org/docs/Web/API/Window/showDirectoryPicker |

### Sin verificar (no usar como hecho hasta comprobarlo)

- **iOS, audio en segundo plano:** la página de Apple no se pudo leer. Lo esperado (modo de fondo de audio + categoría de reproducción en la sesión de audio) queda como hipótesis en `docs/DISENO_IOS.md`.
- **App Store 5.1.1(v)** (borrado de cuenta dentro de la app): se obtuvo solo en resumen, no la cita literal.
- **Tabla de compatibilidad de `showDirectoryPicker`** por navegador: no se obtuvo. El código decide por detección de la función, no por navegador.

## Plugins candidatos (existencia, versión y licencia comprobadas en npm el 2026-11-10; APIs sin revisar todavía)

| Frontera | Candidato | Versión · licencia | Nota |
|---|---|---|---|
| `SecureStore` | `@aparajita/capacitor-secure-storage` | 8.0.1 · MIT | Sigue la versión mayor de Capacitor. Alternativa: `capacitor-secure-storage-plugin` 0.13.0 (MIT, sin llegar a 1.0) |
| `LocalLibrary` | `@capawesome/capacitor-file-picker` + `@capacitor/filesystem` | 8.1.1 · MIT / 8.1.5 · MIT | Falta confirmar selección de carpeta y permisos persistentes en Android |
| `AudioSession` | `@capawesome-team/capacitor-android-foreground-service` | 8.1.0 · MIT | Mantiene vivo el proceso; no reproduce audio |
| `AudioSession` | `@capgo/capacitor-media-session`, `@capgo/capacitor-native-audio` | 8.1.8 / 8.4.40 · MPL-2.0 | MPL-2.0 es compatible con app cerrada, pero obliga a publicar cambios hechos al propio plugin |
| — | `@jofr/capacitor-media-session` | 4.0.0 · **GPL-3.0** | **Descartado** por licencia y sin actualizar desde 2024 |
| `Connectivity` | `@capacitor/network` | 8.0.1 · MIT | Oficial |
| `Storage` | IndexedDB del WebView | — | Mismo código que la web |

La elección final de plugins de audio se hace con un prototipo en dispositivo (ver `DECISIONES_PENDIENTES.md`): es la única parte que no se puede decidir sobre el papel.

## Consecuencias para el código de hoy

- `VITE_TARGET=web|android|ios`; en nativo `base: './'`, router con hash y CSP por `<meta>`.
- Nada de `https://dominio` absoluto en el cliente.
- Estado del usuario en IndexedDB con esquema versionado; Supabase es sincronización opcional.
- Las pantallas se diseñan para pasar la regla de reutilización (táctil ≥ 44 px, safe areas, botón atrás, sin hover, 60 fps, nativa a 360×800).
