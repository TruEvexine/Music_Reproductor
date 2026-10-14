# Auditoría de seguridad — recursos versionados en git

**Fecha:** 2026-10-14 · **Commit auditado:** `5065a8b` (rama principal, 3 commits en total)
**Alcance:** todo lo que está en el árbol de git y en su historial, dependencias (`package-lock.json`), migraciones SQL y el código del cliente que toca archivos, metadatos y autenticación. No se auditó la configuración viva de Railway ni del panel de Supabase (no hay acceso desde el repo).

## Resumen

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| S1 | **Crítica (legal)** | 9 pistas de prueba con copyright (~353 MB) versionadas y servidas públicamente desde el deploy | **Resuelto** (historial reescrito) — falta verificar 404 tras redeploy |
| S2 | Media | `supabase/.temp/` versionado: project ref, org id, host y usuario del pooler | **Resuelto** (historial reescrito + ignorado) |
| S3 | Media | El reproductor comparte el proyecto de Supabase `Undefeated_Star_Web_Page` con otro sitio | En curso (guía en `SUPABASE.md` §16) |
| S4 | Media | Sin cabeceras de seguridad (CSP, HSTS, etc.): no hay config de hosting en el repo | Abierto |
| S5 | Baja | El MIME de la portada se toma del tag del archivo sin lista blanca | Abierto |
| S6 | Baja | Columnas de texto y RPC sin límites de tamaño (`display_name`, `avatar_url`, `track_identifier`, array del RPC) | **Resuelto** en migración `20261014120000_hardening_limits.sql` |
| S7 | Baja | Endurecimiento de Auth pendiente (CAPTCHA, protección de contraseñas filtradas, SMTP propio) | Abierto |
| S8 | Baja | 1 vulnerabilidad *high* en dependencia de desarrollo (`source-map-js`); producción: 0 | Abierto |
| S9 | Info | Documentación duplicada y desactualizada (`README (1).md`, `SUPABASE (1).md`, `CLAUDE.md` = `AGENTS.md`) | Parcial (duplicados `(1)` borrados) |
| S10 | Info | Correo institucional expuesto como autor de commits | Opcional |

**Lo que está bien:** `.env` ignorado y nunca commiteado; no hay claves (`service_role`, `sb_secret_`, JWT, contraseñas de Postgres) en ningún commit; RLS habilitado en las 3 tablas con políticas por dueño; `revoke` a `anon`; la función `security definer` fija `search_path = ''`; el RPC es `security invoker` y valida la propiedad de la playlist; no hay `dangerouslySetInnerHTML`, `eval` ni `innerHTML`; los blobs de audio y portada se revocan.

---

## S1 — Música con copyright en el repositorio (Crítica)

`src/assets/music/` contenía 9 pistas comerciales usadas solo para pruebas (Travis Scott, Post Malone, 100 gecs, David Bowie, Tainy, Mac Miller, Kanye West, The Notorious B.I.G.) en FLAC/M4A. `demoCatalog.ts` las importa con `import.meta.glob`, así que Vite las copia a `dist/` y **el deploy de Railway las distribuye a cualquiera**. El repo es público en GitHub.

**Riesgo:** reclamos DMCA contra GitHub y Railway (suspensión del repo o del servicio), responsabilidad legal, y bloqueo futuro en tiendas de apps. Además el `.git` pesa 353 MB por esto.

**Remediación:**
1. Quitar las pistas del árbol y del build ya (`git rm -r --cached src/assets/music/*.flac *.m4a`, ignorar `src/assets/music/*` salvo `README.md`).
2. Reescribir el historial para eliminarlas (`git filter-repo --path src/assets/music --invert-paths` conservando el README) y hacer `push --force`. Avisar a cualquier colaborador para que vuelva a clonar.
3. Si se quiere demo: usar 2–3 pistas con licencia libre (CC0/CC-BY con atribución) servidas desde almacenamiento de objetos, no desde el bundle. O sin demo: estado vacío con CTA "Agrega tu música".
4. Redeploy en Railway y comprobar que las URLs viejas de `/assets/*.flac` devuelven 404.

## S2 — `supabase/.temp/` versionado (Media)

Archivos generados por la CLI de Supabase. Exponen `project-ref` (`rifwgetomheljrgjfeoy`), `organization_id`, nombre del proyecto y `pooler-url` (`postgresql://postgres.<ref>@aws-0-us-east-1.pooler.supabase.com:5432/postgres`). **No incluye contraseña.** El ref ya es público vía la URL del cliente, pero el host del pooler y el org id facilitan reconocimiento (ataques de fuerza bruta a la contraseña de Postgres).

**Remediación:** `git rm -r --cached supabase/.temp`, agregar `supabase/.temp/` y `supabase/.branches/` a `.gitignore`. Confirmar que la contraseña de la base es larga y aleatoria; activar *Network Restrictions* en Supabase si no se necesita conexión directa desde fuera.

## S3 — Proyecto de Supabase compartido (Media)

`linked-project.json` muestra que el reproductor usa el proyecto **`Undefeated_Star_Web_Page`**. Usuarios, tablas y cuotas de dos productos distintos viven juntos: un error de RLS o una migración en uno afecta al otro, y no se puede pasar uno a plan de pago sin el otro.

**Remediación:** proyecto dedicado para el reproductor (ver Fase 8 de `PLAN.md`).

## S4 — Sin cabeceras de seguridad (Media)

No hay `Dockerfile`, `railway.json`, `Caddyfile` ni `nginx.conf`: Railway sirve el build con su configuración por defecto. Faltan `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `frame-ancestors`.

**Remediación:** servir `dist/` con un servidor estático propio (Caddy o nginx) y definir cabeceras. CSP base:
`default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: https://<bucket>; connect-src 'self' https://<proyecto>.supabase.co wss://<proyecto>.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
Cachear `assets/*` con `immutable` y `index.html` con `no-cache`.

## S5 — MIME de portada sin lista blanca (Baja)

`metadataReader.ts` crea el `Blob` de la portada con `picture.format` tal cual viene en el tag. Un archivo manipulado puede declarar `image/svg+xml` o `text/html`. Dentro de `<img>` no ejecuta scripts, pero si algún día la URL `blob:` se abre en una pestaña (p. ej. "ver portada"), corre con el origen de la app.

**Remediación:** aceptar solo `image/jpeg`, `image/png`, `image/webp`, `image/gif`; cualquier otro valor → `image/jpeg` o descartar. Opcional: verificar *magic bytes*.

## S6 — Límites de tamaño en BD (Baja)

`profiles.display_name`, `profiles.avatar_url` y `playlist_tracks.track_identifier` no tienen `check` de longitud; `replace_playlist_tracks` acepta arrays de cualquier tamaño. Un usuario autenticado puede inflar su fila o mandar arrays enormes (abuso de cuota y CPU).

**Remediación (migración nueva):** `check (char_length(display_name) <= 60)`, `check (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)`, `check (char_length(track_identifier) <= 512)`, y en el RPC `if cardinality(p_track_identifiers) > 5000 then raise ...`. Límite de playlists por usuario según plan (Fase 12).

## S7 — Endurecimiento de Auth (Baja)

Revisar en el panel: confirmación de correo activada, CAPTCHA (Cloudflare Turnstile) en registro/login, protección de contraseñas filtradas (plan Pro), longitud mínima ≥ 10, SMTP propio (el SMTP integrado tiene límite muy bajo de envíos), *Site URL* y *Redirect URLs* solo con dominios propios (quitar comodines y los de Vercel si ya no se usan). Los mensajes de error de Supabase se muestran crudos en `AuthDialog`; mapearlos a mensajes propios para no filtrar si un correo existe.

## S8 — Dependencias (Baja)

`npm audit`: **0** en producción; **1 high** en desarrollo (`source-map-js`, GHSA-68fv-2mgg-jv7q, DoS en tooling local). Ejecutar `npm audit fix`. Agregar Dependabot o Renovate.

## S9 — Documentación duplicada (Info)

`README (1).md` y `SUPABASE (1).md` son versiones viejas que hablan de Vercel; `CLAUDE.md` es idéntico a `AGENTS.md`. Generan instrucciones contradictorias para personas y agentes. Borrar los `(1)` y dejar `CLAUDE.md` como una línea que apunte a `AGENTS.md`.

## S10 — Correo del autor (Info)

Los commits usan `rceja711@uvaq.edu.mx`. Es normal, pero si se prefiere no exponerlo, configurar el correo `noreply` de GitHub para commits futuros (los pasados ya son públicos).

---

## Checklist de remediación (ejecutar en orden — Fase 0 de PLAN.md)

- [x] S1: sacar música del árbol, `.gitignore`, `git filter-repo`, `push --force`
- [ ] S1: redeploy en Railway y verificar 404 de los `.flac` viejos
- [x] S2: `supabase/.temp` fuera del historial e ignorado
- [ ] S2: revisar/rotar la contraseña de Postgres del proyecto viejo
- [x] S9: borrar documentos `(1)` duplicados
- [ ] S8: `npm audit fix` + Dependabot
- [ ] S5: lista blanca de MIME de portada
- [ ] S4: servidor estático con cabeceras (al migrar el hosting, Fase 8)
- [x] S6: migración con límites (aplicar en el proyecto nuevo)
- [ ] S7: ajustes de Auth en el proyecto nuevo
- [ ] S3: proyecto dedicado (Fase 8)
