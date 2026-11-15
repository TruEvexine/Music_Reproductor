# Plan de seguridad

> 2026-11-14 · rama `desarrollo` · base `d7067b5`. Evalúa `seguridad_auditoria.md` contra el código real, como `docs/PLAN_RENDIMIENTO.md` hizo con rendimiento.
> **Método:** skill `security-audit`, perfil `quick` y acotado a las áreas a–g que se pidieron, en modo «solo código». Hubo 4 agentes de reconocimiento, 5 cazadores, 1 crítico de cobertura y 6 verificadores independientes. Supabase solo se leyó: esquema, políticas, funciones, triggers y advisors. No se leyeron filas de usuarios ni de la tienda, ni se escribió nada. No se ejecutó código de la app como evidencia, porque este PC no tiene un sandbox que lo aísle. Lo que depende de la ejecución o de un panel queda marcado como «pendiente de validar».

## 0. Lo urgente

**No hay nada crítico.** Lo más importante es **S-01**, de gravedad media estimada. Un enlace preparado con los tokens del atacante inicia sesión en su cuenta en el navegador de la víctima, y la app le sube las playlists que la víctima creó sin cuenta. La cadena está seguida línea a línea en el código de la app y de `@supabase/auth-js` 2.117.2 (la versión fijada en `package-lock.json`). Falta verla en ejecución. El arreglo cambia un comportamiento visible y por eso queda como decisión (§5, D-1).

**Corrección de premisa.** El proyecto de Supabase del reproductor **no contiene pedidos ni direcciones**. El catálogo en vivo del proyecto que usa la app (el mismo de `vercel.json` y `SECURITY_AUDIT.md`) solo tiene `profiles`, `playlists`, `playlist_tracks` y las tablas `math_*` de la app de matemáticas. Las tablas de la tienda (pedidos, direcciones, pagos…) están en **otro** proyecto de Supabase. Lo que sí se comparte es el pool de Auth y los triggers con la app de matemáticas. Desde aquí no se puede saber si alguna web de la tienda usa la Auth de este proyecto. Tampoco existen todavía tablas `mp_*`: las del reproductor llevan los nombres antiguos.

## 1. Qué dice `seguridad_auditoria.md`

No es una auditoría con conclusiones. Es una lista de 27 controles genéricos sacada de un Reel, con la pregunta «¿está hecho, se puede hacer o no se puede, y por qué?». La respuesta, punto por punto:

| # | Control | Estado | Dónde o por qué |
|---|---|---|---|
| 1 | Autenticación bien hecha | **Parcial** | Supabase Auth (`src/sync/useAuthController.ts`). El hueco es S-01: se acepta una sesión que llega en la URL sin haber iniciado un flujo en este navegador |
| 2 | Contraseñas con hash (Argon2id) | Hecho por el proveedor | La app no guarda contraseñas: GoTrue las guarda con bcrypt. No se puede cambiar a Argon2id, y bcrypt es aceptable |
| 3 | Rutas de admin protegidas | No aplica | No hay rutas de admin ni servidor propio |
| 4 | Cookies HttpOnly, Secure y SameSite | No se puede sin servidor | No hay cookies: supabase-js guarda la sesión en `localStorage` (`src/sync/supabaseClient.ts:16-21`). Usar cookies HttpOnly exige un servidor propio (SSR o función). Lo mitiga la CSP estricta (`script-src 'self'`, sin inline) |
| 5 | Protección CSRF | Parcial | El CSRF clásico no aplica: el token va en una cabecera, no en una cookie. El CSRF de inicio de sesión sí existe (S-01) |
| 6 | Enlaces de recuperación con caducidad | Pendiente de panel | La app no tiene recuperación de contraseña (`docs/producto/FAQ.md:70`). La caducidad de los enlaces la decide el proyecto de Supabase y no se puede observar desde aquí (S-10, D-6) |
| 7 | Claves fuera del navegador | Hecho | Solo URL y clave publicable. La guardia del build rechaza secretos en `VITE_*` (`scripts/envGuard.ts`), reforzada en `7eda68e` |
| 8 | Secretos en `.env` | Hecho | `.env` y `.env.*` ignorados (`.gitignore:16-18`). `.env.example` vacío |
| 9 | Secretos en el historial de Git | Hecho | Revisé todo el historial: no hay claves, JWT, URIs con credenciales ni audio. Nunca se commiteó `supabase/.temp`. gitleaks revisa el historial completo en CI |
| 10 | Revocar claves comprometidas | No aplica | Ninguna clave se filtró. La *ref* del proyecto aparece en `vercel.json` y `SECURITY_AUDIT.md`, pero es un identificador público que ya va en el bundle, no una credencial |
| 11 | Base de datos protegida | **Hecho, con deriva** | RLS en todas las tablas, `anon` sin permisos y políticas por dueño. Hay deriva respecto al repo (S-03) y avisos del advisor (S-02, S-08) |
| 12 | Consultas parametrizadas | Hecho | Todo pasa por PostgREST con supabase-js. El RPC `replace_playlist_tracks` no usa SQL dinámico |
| 13 | Forzar HTTPS | Hecho | Vercel, HSTS con preload y `upgrade-insecure-requests` (`vercel.json`) |
| 14 | Límite de peticiones | Parcial | Los límites de Auth están en el servidor y no se ven desde aquí. El limitador del cliente vive en memoria (`src/core/authMessages.ts:41-60`). No hay tope de filas por usuario (S-04) |
| 15 | Protección contra XSS | Hecho | No hay ningún `innerHTML`, `dangerouslySetInnerHTML` ni `eval` en `src`. React pinta todo como texto y la CSP es estricta |
| 16 | CORS restringido | No aplica | No hay API propia. El CORS de Supabase lo gestiona el proveedor, y el acceso lo protegen el JWT y RLS |
| 17 | Cabeceras de seguridad | Hecho, con mejoras | CSP, HSTS, nosniff, XFO DENY, Referrer-Policy, COOP y Permissions-Policy en `vercel.json`. Mejoras posibles en S-12 |
| 18 | Validar en el servidor | **Parcial** | Hay CHECKs en la base, pero en remoto faltan dos (S-03) |
| 19 | Tipo y tamaño de archivos | Mayormente hecho | Portadas: ≤ 12 MB y MIME en lista blanca (`src/core/coverMime.ts`). `.lrc`: ≤ 512 KB. Copia de seguridad: ≤ 5 MB. Sin tope: letras SYLT, etiquetas y píxeles decodificados (S-13, solo afectan al propio usuario) |
| 20 | Precios y pagos en el servidor | No aplica | No hay pagos. El «café» es un enlace externo que solo acepta https (`src/core/support.ts:7-16`) |
| 21 | Registrar actividad sospechosa | Parcial | No hay servidor propio. Supabase guarda los logs de Auth en su panel. No hay alertas |
| 22 | Debug apagado en producción | Hecho | Los ganchos de depuración dependen de `import.meta.env.DEV` (`src/state/player.ts:207` y otros) |
| 23 | Dependencias vulnerables | Hecho | `npm audit`: 0 vulnerabilidades (14-11-2026). Dependabot semanal y `npm audit --omit=dev --audit-level=high` en CI |
| 24 | Paquetes sin uso | Hecho | Lo trató `PLAN_RENDIMIENTO.md` (H8): `@tokenizer/http` ya no está |
| 25 | Archivos expuestos | Hecho, con un pendiente | Solo se despliega `dist/` (en `public/` hay 3 iconos). Pendiente: `SECURITY_AUDIT.md` (D4) menciona dos despliegues viejos de Vercel sin cabeceras. No los verifiqué |
| 26 | Revisión completa | Este documento | Perfil `quick`: es una pasada parcial (§7) |
| 27 | Probar protecciones e informar | Este documento | Suite y capturas en §7 |

## 2. Hallazgos

Gravedad según la escala de la skill. Las marcadas como *estimada* no se han validado en ejecución.

| # | Gravedad | Hallazgo | Evidencia | Arreglo propuesto | Esfuerzo | Estado |
|---|---|---|---|---|---|---|
| S-01 | **Media** (estimada) | Un enlace con tokens en el fragmento inicia sesión con la cuenta del atacante, y `adoptOwnerless` le sube las playlists creadas sin cuenta. Si la víctima ya tenía sesión, se la cambia en silencio | `src/sync/supabaseClient.ts:16-21,33`; `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:21,3268,3320,421`; `src/ui/App.tsx:59`; `src/sync/playlistSync.ts:41`; `src/state/playlists.ts:127-131`; `src/sync/playlistService.ts:29`. Rompe la promesa de `src/ui/PrivacySection.tsx:58` | `flowType: "pkce"` en `createClient`. Adoptar las playlists solo tras un inicio de sesión hecho en esta pestaña, o preguntando antes. Adaptar `scripts/prueba-enlace-magico.mjs` como prueba de regresión | S | **Corregido** (D-1 = sí): PKCE, `?code` canjeado una vez y nunca sobre una sesión abierta, tokens del hash descartados, aviso si el enlace se abre en otro navegador; `emailRedirectTo` en el registro |
| S-02 | Baja | Protección de contraseñas filtradas desactivada (advisor de Supabase). El mínimo de 10 caracteres solo se exige en el cliente (`src/ui/dialogs.tsx:74`). No se ve el mínimo del servidor | Advisor `auth_leaked_password_protection` | Activarla en Auth → Passwords y fijar un mínimo ≥ 10 en el servidor. Afecta a las dos apps del pool | XS | Panel (D-6) |
| S-03 | Baja | Deriva del esquema remoto: (a) `playlists.name` sin CHECK de 1–120 caracteres y `playlist_tracks.position` sin `>= 0`, porque `create table if not exists` reutilizó tablas que ya existían; (b) políticas antiguas duplicadas («Users can …»), solo del dueño pero con `auth.uid()` sin `select`; (c) `20261014120000_hardening_limits` aplicada pero sin registrar, y la de revocación registrada con otra versión | Catálogo en vivo frente a `supabase/migrations/20260928180000_initial_music_player.sql:11,19` | Migración nueva: recortar datos, añadir los dos CHECK y borrar las políticas antiguas. Después, `supabase migration repair` para cuadrar el historial | S | Propuesta (D-4) |
| S-04 | Baja (estimada) | No hay tope de filas ni de tamaño por usuario: cualquier cuenta del pool puede crecer sin límite en un proyecto gratuito compartido. Insertar directamente en `playlist_tracks` se salta el tope de 5 000 del RPC, y `playlists.name` no tiene límite en remoto | `supabase/migrations/20260928180000_initial_music_player.sql:34-37`; `20261014120000_hardening_limits.sql:65` | Revocar el INSERT directo en `playlist_tracks` y dejar solo el RPC. Tope de playlists por usuario con un trigger. CAPTCHA y límites de Auth. Depende de D-2 | M | Diferido por el crítico; propuesta |
| S-05 | Informativa | D25: si el nombre opcional queda vacío, el disparador guarda la parte del correo antes de la «@», pero el borrador del aviso dice «el nombre visible que elijas». **Solo lo ve su dueño**: el SELECT de RLS es del dueño, no hay vistas, buckets ni RPC que lo expongan, la UI nunca lo pinta y solo lo lee la exportación del propio usuario | `supabase/migrations/20261014120000_hardening_limits.sql:41-47`; `docs/producto/LEGAL_BORRADORES.md:111` | Migración `supabase/migrations/20261114120000_profile_display_name_sin_correo.sql` (**sin aplicar**): `NULL` si no se da nombre, y vaciar los nombres ya derivados del correo | XS | Archivo en `7f7f559`, D-4 |
| S-06 | Informativa | Pool de Auth compartido: cada registro en cualquiera de las dos apps crea un perfil del reproductor (con el nombre sacado del correo) y otro de matemáticas | `supabase/migrations/20260928180000_initial_music_player.sql:152-155` y el trigger `math_create_profile_after_signup` en vivo | Proyecto propio (D-2). Si se sigue compartiendo: crear el perfil solo en registros del reproductor o al primer inicio de sesión. La app ya tolera que no exista (`src/sync/account.ts:24`) | S | Decisión D-2 |
| S-07 | Baja (diseño) | Borrar la identidad de Auth borra en cascada los datos de **las dos** apps: `profiles`, `playlists` y los tres `math_*` usan `ON DELETE CASCADE` en vivo, y el plan gratuito no tiene copias. El texto de borrado solo menciona las playlists | `docs/producto/AJUSTES_PRIVACIDAD.md:70-72,115`; `docs/producto/FAQ.md:65` | §6 | — | Decisión D-2 y D-3 |
| S-08 | Baja | `rls_auto_enable()` (SECURITY DEFINER) aparece como ejecutable por `anon` y `authenticated` (advisors 0028/0029). Es inocua: devuelve `event_trigger` y Postgres rechaza la llamada directa. `math_record_attempt` es ejecutable por `authenticated`, como pide su RPC | Advisors y catálogo | `revoke execute on function public.rls_auto_enable() from public, anon, authenticated`. No es un objeto del reproductor: hay que coordinarlo | XS | Propuesta (D-4) |
| S-09 | Fiabilidad (no es seguridad) | Ids de pista de más de 512 caracteres (etiquetas largas en CJK o cirílico, o una copia de seguridad) hacen que el servidor rechace la operación, el outbox la descarte y la fusión deje la copia remota: se pierden ediciones locales sin aviso | `src/core/track.ts:67-71`; `src/core/backup.ts:53`; `src/core/outbox.ts:70,79`; `src/sync/playlistSync.ts:26-32` | Limitar o resumir con hash los ids `track:v1` largos, exigir ≤ 512 en `parseBackup` y no descartar en silencio | S | Propuesta |
| S-10 | Endurecimiento | `signUp` no envía `emailRedirectTo`. Las plantillas, el remitente y la Site URL son del proyecto compartido. La guía recomienda `http://localhost:5173/**` en las Redirect URLs | `src/sync/useAuthController.ts:117-121`; `SUPABASE.md:423-425` | Pasar `emailRedirectTo` con el origen del reproductor. Quitar localhost de producción. SMTP propio (D9) | XS | D-1 y D-6 |
| S-11 | Endurecimiento | Si el `signOut()` global falla, la sesión sigue en el dispositivo (solo se muestra un error) | `src/sync/useAuthController.ts:139-142` frente a `src/sync/account.ts:14-18` | Recurrir a `scope: "local"`, como ya hace el borrado | XS | Propuesta (cambia lo que se ve) |
| S-12 | Endurecimiento | `worker-src` permite `blob:` sin necesidad: los workers son del mismo origen. Las compilaciones nativas no tendrán meta CSP. Nada comprueba que la ref de `connect-src` coincida con `VITE_SUPABASE_URL` (si cambian, falla cerrado y la sincronización se rompe) | `vercel.json:9`; `index.html`; `vite.config.ts:84-87` | Quitar `blob:` de `worker-src`. Meta CSP para nativo. Comprobar en `buildGuard` que la ref coincide | XS–S | Propuesta (configuración de Vercel) |
| S-13 | Endurecimiento | Sin tope: letras SYLT, etiquetas y píxeles decodificados de portada y avatar. Solo afecta a la pestaña del propio usuario | `src/core/lyrics.ts:51-53`; `src/platform/web/metadata.worker.ts:30,66-73`; `src/state/profile.ts:17` | Aplicar los mismos topes que a `.lrc` y comprobar las dimensiones antes de decodificar | S | Propuesta |
| S-14 | Baja | Un enlace con un «%» mal formado (`/app/albumes/%E0`) dejaba la app en blanco: `decodeURIComponent` falla y no hay ErrorBoundary | `src/ui/LibraryView.tsx` | `try/catch` local | XS | **Corregido** `8f16358` |
| S-15 | Endurecimiento | `.oga` y `.webm` (que la app acepta) no estaban en `.gitignore`, el pre-commit ni la guardia del build | `src/core/library.ts:13,15` | Añadidos | XS | **Corregido** `dd33675` |
| S-16 | Endurecimiento | La guardia del build solo detectaba una URI de PostgreSQL al principio del valor | `scripts/envGuard.ts:23` | Detectarla en cualquier parte del valor, con prueba | XS | **Corregido** `7eda68e` |
| S-17 | Privacidad (borradores) | Varios desajustes entre los borradores y el código: el aviso simplificado (§3.2) no aparece en el registro (`src/ui/dialogs.tsx:49-91`); §3.1 no menciona la adopción de playlists al iniciar sesión (sí la explica `FAQ.md:31-32`); la exportación no incluye los datos de Auth que el aviso dice tratar (correo, fechas, IP); la fila de letras sigue en `tracks` (`LEGAL_BORRADORES.md:25`); los ids `track:v2` (hash) de una copia de seguridad también se sincronizan | §3 f | Corregir los borradores antes de publicar. Añadir el aviso simplificado bajo «Crear cuenta» | S | Propuesta (texto legal y UI) |

Descartados por los verificadores, porque ningún principal de menor confianza cruza una frontera (quedan como notas): la URL y las plantillas de correo compartidas (S-10), el borrado en cascada como «vulnerabilidad» (es diseño, S-07) y los ids largos como «seguridad» (es fiabilidad, S-09).

## 3. Por área

### a) RLS, grants, funciones, vistas y triggers
- **Aislamiento entre usuarios: correcto.** `anon` no tiene ningún permiso sobre las tablas del reproductor. `authenticated` tiene S/I/U en `profiles` y S/I/U/D en `playlists` y `playlist_tracks`. Todas las políticas atan `auth.uid()` en USING y en WITH CHECK, así que no se puede pasar una playlist ni una pista a otro usuario. Un `upsert` con el id de una playlist ajena da 42501. El RPC es SECURITY INVOKER, comprueba que la playlist sea del usuario y da el mismo error si no existe, de modo que no revela qué ids existen. Las políticas duplicadas también son solo del dueño.
- **Nada de la tienda es alcanzable con la clave publicable:** no está en este proyecto. De `math_*`, `anon` solo puede leer `math_topics` y `math_questions`, que son públicas por diseño de esa app.
- **SECURITY DEFINER:** `create_profile_for_new_user` y `math_create_profile` llevan `search_path=''` y ni `anon` ni `authenticated` pueden ejecutarlas. Lo de `rls_auto_enable` se trata en S-08.
- **Vistas:** ninguna. **Buckets:** ninguno.
- **Triggers sobre `auth.users`:** `on_auth_user_created` (reproductor) y `math_create_profile_after_signup` (matemáticas). Los dos se disparan en cada registro (S-06). Si uno lanza una excepción, bloquea el registro de las dos apps.
- **Privilegios por defecto:** las tablas que cree `supabase_admin` desde el panel heredan todos los permisos para `anon` y `authenticated`. El event trigger `ensure_rls` les activa RLS. Si alguien lo quitara, una tabla nueva quedaría abierta. Ver la propuesta en D-4.

### b) D25 (`display_name` con la parte del correo)
Solo lo ve su dueño (§2, S-05). El riesgo es de minimización y de exactitud del aviso, no de exposición: el dato sale del correo, que el mismo encargado ya guarda. Por ser un pool compartido, también se guarda para usuarios que solo usan la app de matemáticas (S-06). Dejé escrita la migración correctiva, **sin aplicar**. Incluye un `update` que vacía los nombres que coinciden con la parte del correo cuando el usuario no dio nombre al registrarse. No la probé en un Postgres local, como pide `AGENTS.md`: en este PC no hay Docker ni psql.

### c) Autenticación
- **Contraseñas:** S-02.
- **Enumeración de correos:** el inicio de sesión devuelve un mensaje genérico. El registro trata «ya existe» igual que «enviado» (`src/core/authMessages.ts:16-36`). Queda un resto si la confirmación de correo está **desactivada**: un correo nuevo recibe sesión al instante y uno existente no, y la propia API de Auth lo revela con `user_already_exists`. Mantener la confirmación activada (D-6).
- **Intentos:** el limitador del cliente se reinicia al recargar y el registro no tiene. El límite real es el del servidor, que no se puede observar.
- **URLs de redirección:** desde el código no se ve si hay comodines. La guía recomienda `dominio/**`, que cubre solo rutas del propio origen estático (sin contenido de usuarios), y `localhost:5173/**`, que conviene quitar en producción. El problema real no es el comodín, sino que se acepten tokens que llegan en la URL (S-01).
- **Sesión en `localStorage` frente a la CSP:** la CSP impide el robo por XSS (`script-src 'self'`, sin inline ni eval, `connect-src` solo hacia el proyecto). Tampoco hay un sink XSS donde empezar. Es el compromiso estándar de supabase-js en una SPA.
- **Recuperación (pista diferida):** la app no tiene recuperación, pero el endpoint está activo en todo el proyecto. Con `detectSessionInUrl`, un enlace de recuperación que aterrice en el reproductor inicia sesión sin pedir una contraseña nueva, porque no hay ningún manejador de `PASSWORD_RECOVERY`. Lo cubre en parte el paso a PKCE (D-1).

### d) Cliente
- **CSP y cabeceras:** existen y coinciden con lo que la app carga: fuentes empaquetadas, `blob:` para portadas y audio, y Supabase por https y wss. Nada de lo que la app necesita queda bloqueado. Las mejoras están en S-12.
- **XSS:** las etiquetas, las letras, los nombres de playlist (locales, de la copia de seguridad o remotos), las carpetas y el Markdown legal se pintan como texto de React. El Markdown no tiene sintaxis de enlaces y se genera en el build. La copia de seguridad no permite contaminar prototipos.
- **`rel="noopener"`:** el único `target="_blank"` es el del café, y lo lleva (`src/ui/CafeLink.tsx:12`). Además, COOP same-origin.
- **`VITE_CAFE_URL`:** solo acepta `https:` con host. `javascript:`, `data:`, `http:` y texto suelto se descartan y el botón no aparece (`src/core/support.ts:7-16`).
- **Límites al importar:** ver el punto 19 y S-13. No hay forma de salirse de la carpeta privada (OPFS).

### e) Repo público
No hay secretos, correos personales ni datos del responsable en el árbol ni en el historial: los textos legales usan marcadores y `docs/producto/privado/` está ignorado. El build falla si queda un marcador sin rellenar. `npm audit`: 0. `.gitignore` cubre `supabase/.temp`, `src/assets/music/` y `docs/producto/privado/`, y ahora también `.oga` y `.webm` (S-15). La ref del proyecto es pública (va en el bundle). CI: permisos `contents: read`, acciones fijadas por SHA y gitleaks sobre el historial completo. Los hooks locales solo se activan con `npm run setup`.

### f) Código frente a los borradores del aviso
Coinciden en lo importante: no hay cookies, analítica, CDNs ni scripts de terceros; los encargados son Supabase y Vercel; las playlists se sincronizan como nombre más título, artista, álbum y duración; el borrado local cubre todos los almacenes; el café no envía datos. Los desajustes están en S-05 y S-17. El borrado de cuenta se promete solo por correo, no dentro de la app, así que el aviso no promete algo que no exista.

### g) Proyecto compartido
Ver §6.

## 4. Arreglos hechos (un commit por arreglo)

| Commit | Cambio | Verificación |
|---|---|---|
| `dd33675` | `.oga` y `.webm` en `.gitignore`, en `.githooks/pre-commit` y en `findBundledAudio` | Prueba de `envGuard` y build |
| `8f16358` | `decodeKey` con `try/catch` en `LibraryView.tsx` | Typecheck y build. En el navegador, navegar desde la app a `/app/albumes/%E0` ya no lanza errores |
| `7eda68e` | `envGuard` detecta `postgres://` en cualquier parte del valor | Prueba nueva y build con el `.env` real |
| `7f7f559` | Migración de D25, solo el archivo, **sin aplicar** | Sin probar en Postgres (no hay Docker ni psql) |

## 5. Decisiones que necesito

- **D-1 · S-01 (prioridad).** Pasar a PKCE y adoptar las playlists solo con consentimiento. Efecto visible: el enlace de confirmación del correo solo inicia sesión si se abre en el mismo navegador donde se hizo el registro. Si se abre en otro, el correo queda confirmado, pero hay que entrar con la contraseña. Mi recomendación es hacerlo **ya**, con `emailRedirectTo` y una prueba de regresión.
- **D-2 · Proyecto compartido o propio** (§6). Mi recomendación es un proyecto propio antes de abrir los registros.
- **D-3 · Borrado de cuenta.** Mientras se siga compartiendo, no publicar `mp-delete-account` con `auth.admin.deleteUser`. Y antes de borrar nada a mano, comprobar que la petición viene de verdad del dueño de la cuenta (no basta con el remitente del correo).
- **D-4 · Migraciones al remoto.** Aplicar, tras probarlas en local: la de D25, una nueva para S-03 (CHECKs y borrar las políticas antiguas), el `revoke` de S-08 (coordinado con la app de matemáticas) y opcionalmente `alter default privileges … revoke … from anon, authenticated`. Después, `supabase migration repair`.
- **D-5 · Arreglos que cambian lo que se ve:** S-09, S-11, S-13 y S-17 (aviso en el registro, textos legales).
- **D-6 · Panel de Supabase (lo haces tú):** protección de contraseñas filtradas; mínimo ≥ 10; confirmación de correo activada; Site URL y Redirect URLs (sin localhost en producción, ¿hay comodines?); caducidad de enlaces; límites de Auth y CAPTCHA; SMTP propio. En Vercel: comprobar que las cabeceras se sirven en producción y borrar los despliegues viejos (D4 de `SECURITY_AUDIT.md`).

## 6. Proyecto compartido: opciones

Hoy: un pool de Auth para dos apps, triggers de perfil que se disparan para todos y borrado en cascada hacia los dos lados. Las plantillas de correo, el remitente, la Site URL, la política de contraseñas y los límites son del proyecto, no de cada app. Un solo aviso de privacidad cubre a una persona que es usuaria de dos productos.

| | A. Seguir compartido, borrando solo lo del reproductor | B. Proyecto propio |
|---|---|---|
| Borrar cuenta | RPC `SECURITY INVOKER` que borra `playlists` y `profiles` de `auth.uid()`. No hace falta clave de servicio. La identidad (correo, hash, IPs) **se queda**: el aviso tiene que decirlo, y el borrado completo sería un paso manual coordinado con la otra app | `auth.admin.deleteUser` borra todo de forma limpia, sin tocar a nadie más |
| Recuperación y correos | La plantilla, el remitente y la URL son los mismos para las dos apps. `emailRedirectTo` ayuda con la URL, no con la marca | Plantillas, remitente (SMTP propio) y Site URL propios |
| Aviso de privacidad | Tiene que explicar que la identidad es compartida y que existen los triggers cruzados | Un aviso por producto y por identidad |
| Riesgo operativo | Una migración, un fallo de trigger o la pausa por inactividad de una app afecta a la otra. Las cuotas del plan gratuito se comparten | Aislado |
| Coste | Nulo ahora | Supabase da dos proyectos gratuitos. Hay que migrar el esquema (4 migraciones), mover las variables de Vercel, cambiar la ref en `connect-src` y pedir a los usuarios que vuelvan a registrarse (o migrarlos) |

**Recomendación: B antes de abrir los registros.** Hoy apenas hay usuarios, que es el momento más barato para migrar. B resuelve de golpe S-06, S-07, el correo y la recuperación y el doble aviso, y encaja con `docs/producto/ROADMAP.md:41,160`. Mientras tanto vale la opción A, sin publicar nunca `deleteUser`.

## 7. Qué se probó y qué no

- **Auditoría:** las 14 unidades del ledger pasan el validador de la skill, y `findings.json` (6 registros) pasa el suyo. Los dos validadores se corrieron con un envoltorio, porque no arrancan en Windows (Node sin `O_NOFOLLOW`). Hay 3 unidades diferidas (S-04, recuperación y la semántica general del outbox) y 1 fuera de alcance (el esquema de `math_*`). Los artefactos están fuera del repo, en la carpeta de la auditoría del usuario.
- **No verificado:** S-01 en ejecución; la configuración de Auth y de Vercel en producción; si alguna web de la tienda usa la Auth de este proyecto; la migración en Postgres; si el job de build de CI falla por no tener valores `LEGAL_*` (el cazador lo sospechó y aquí no hay `gh`); cómo trata Vercel una URL directa con un «%» mal formado (`vite preview` devuelve 404).
- **Suite y capturas (14-11-2026, tras los 4 commits):** `typecheck`, `test` (26 archivos y 206 pruebas), `build` y `verificar-csp.mjs` en verde. Las 19 `prueba-*.mjs` también están en verde, sin contar `prueba-lan.mjs` (no la toqué ni la corrí). Dos necesitaron una segunda pasada:
  - `prueba-biblioteca`: el p95 del scroll dio 51,8 ms frente a un umbral de 50 en la primera pasada y 49,4 ms en la segunda. Es variabilidad de la medición, no una regresión.
  - `prueba-legal`: en local hay valores `LEGAL_*` reales, que no coinciden con los que espera el script. Con los valores ficticios del propio script (modo `completo`) pasa.
  
  `capturas.mjs`: «matriz correcta, 9 viewports sin scroll horizontal ni áreas táctiles pequeñas». Se ejecutó sin `--actualizar`, así que `docs/capturas` no cambió.
