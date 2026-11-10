# Auditoría de seguridad

**Última revisión:** 2026-11-10 (Fase 0 completa) · **Primera auditoría:** 2026-10-14 sobre `5065a8b`
**Alcance:** árbol e historial de git, dependencias, migraciones SQL, código del cliente (archivos, metadatos, autenticación) y configuración de hosting versionada. Los paneles de Vercel y Supabase se revisan a mano (ver `DECISIONES_PENDIENTES.md`).

## Resumen

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| S1 | **Crítica (legal)** | Pistas con copyright versionadas y servidas desde el deploy | **Resuelto.** Historial reescrito; el build ya no puede incluir audio. Falta borrar a mano dos deployments antiguos (D4) |
| S2 | Media | `supabase/.temp/` versionado | **Resuelto** (historial reescrito + ignorado + bloqueado por hook) |
| S3 | Media | Proyecto de Supabase compartido con otras apps (`math_*`) | **Aceptado** (decisión 2026-11-10). Mitigado con reglas de alcance en `AGENTS.md` §28 |
| S4 | Media | Sin cabeceras de seguridad | **Resuelto** en `vercel.json`, verificado con `scripts/verificar-csp.mjs` |
| S5 | Baja | MIME de portada sin lista blanca | **Resuelto** (`src/core/coverMime.ts` + test) |
| S6 | Baja | Columnas y RPC sin límites de tamaño | **Resuelto** (`20261014120000_hardening_limits.sql`, aplicada) |
| S7 | Baja | Endurecimiento de Auth en el panel (CAPTCHA, contraseñas filtradas, SMTP) | **Abierto — manual** (D9). Los mensajes de error ya no revelan si un correo existe |
| S8 | Baja | Vulnerabilidades en dependencias de desarrollo | **Resuelto** (`npm audit`: 0). Dependabot semanal + `npm audit` en CI |
| S9 | Info | Documentación duplicada | **Resuelto** (`CLAUDE.md` apunta a `AGENTS.md`) |
| S10 | Info | Correo institucional como autor de commits | Opcional (D10) |
| S11 | **Alta** | `npm run build` en local empaquetaba la música de `src/assets/music/` en `dist/` (así llegó a producción) | **Resuelto** (2026-11-10): catálogo demo solo en desarrollo + el build falla si la salida contiene audio |

**Hallazgos abiertos de severidad media o mayor: 0** (S3 aceptado; S1 solo tiene pendiente una limpieza manual).

## Defensa en profundidad (qué impide que vuelva a pasar)

| Capa | Qué hace | Dónde |
|------|----------|-------|
| `.gitignore` | Ignora `.env*`, audio en todo el repo, claves, keystores, `supabase/.temp`, builds | `.gitignore` |
| Hook `pre-commit` | Bloquea `.env`, audio, keystores, `supabase/.temp`, archivos > 2 MB y patrones de secretos (asignaciones de service role, claves `sb_secret`, JWT largos, URI de PostgreSQL con usuario y contraseña, bloques de clave privada PEM) | `.githooks/pre-commit` |
| Hook `commit-msg` | Quita atribuciones a asistentes de IA; rechaza mensajes vacíos | `.githooks/commit-msg` |
| Guardia de build | Falla si una `VITE_*` es un secreto (por nombre, por valor o por JWT con rol `service_role`) o si el bundle contiene audio | `scripts/envGuard.ts`, `vite.config.ts` |
| CI | typecheck, tests, build, `npm audit --omit=dev --audit-level=high`, gitleaks sobre todo el historial; permisos `contents: read`; acciones fijadas por SHA | `.github/workflows/ci.yml` |
| Dependabot | npm y GitHub Actions, semanal | `.github/dependabot.yml` |
| Cabeceras | CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP; caché inmutable en `/assets/` | `vercel.json` |

Los hooks se activan por clon con `npm run setup` (ya activados en esta copia). Probados el 2026-11-10 con un `.env`, un `.flac` y una clave `sb_secret_` falsos: los tres bloqueados.

## Lo que está bien

`.env` nunca commiteado; ninguna clave en ningún commit; RLS en las 3 tablas con políticas por dueño; `revoke` a `anon`; funciones `security definer` con `search_path = ''` y sin `EXECUTE` público; el RPC es `security invoker` y valida la propiedad; sin `innerHTML`, `eval` ni `dangerouslySetInnerHTML`; sin `console.*` en el cliente; blobs de audio y portada revocados.

## CSP vigente

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self';
connect-src 'self' https://rifwgetomheljrgjfeoy.supabase.co wss://rifwgetomheljrgjfeoy.supabase.co;
worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- `style-src 'unsafe-inline'` es necesario: React escribe estilos en línea (variables CSS de progreso y paleta). No hay `unsafe-inline` ni `unsafe-eval` en scripts.
- Si cambia el proyecto de Supabase o se añade un origen (bucket de audio, analítica), hay que actualizar `connect-src`/`media-src` y volver a correr `node scripts/verificar-csp.mjs`.
- Verificado el 2026-11-10: importar audio, portadas `blob:`, reproducción y petición a Supabase Auth funcionan con 0 violaciones.

## Detalle de hallazgos

### S1 / S11 — Música con copyright
Nueve pistas comerciales estuvieron versionadas y desplegadas. El historial se reescribió, pero la causa seguía viva: `demoCatalog.ts` usaba `import.meta.glob` sobre `src/assets/music/`, así que cualquier `npm run build` hecho en una máquina con música la copiaba a `dist/`, y un deploy desde esa carpeta la publicaba. Ahora el catálogo se carga con un `import()` que solo existe en desarrollo y el build aborta si la salida contiene un archivo de audio. **Pendiente manual:** borrar los dos deployments antiguos que aún la sirven (D4).

### S3 — Supabase compartido
El proyecto `rifwgetomheljrgjfeoy` aloja también tablas `math_*` de otra app. Riesgo: una migración o un fallo de RLS de un producto afecta al otro, y comparten cuotas y usuarios de Auth. Se acepta; el reproductor solo toca sus objetos y lo nuevo lleva prefijo `mp_`.

### S7 — Auth en el panel
Pendiente en Dashboard: confirmación de correo, longitud mínima ≥ 10, protección de contraseñas filtradas (plan Pro), CAPTCHA, SMTP propio, *Redirect URLs* sin comodines. En el cliente: mensajes genéricos y bloqueo de 30 s tras 5 intentos fallidos (solo frena al usuario honesto; el límite real es el del servidor).

## Pendiente para fases posteriores

- Pruebas automáticas de aislamiento RLS con dos usuarios contra un Postgres local (Fase 8/12).
- Parseo de metadatos en worker con timeout (Fase 3): hoy un archivo patológico se procesa en el hilo principal.
- CSP por `<meta>` y configuración de seguridad de Capacitor (Fase 6).
- Diseño del borrado de cuenta (Edge Function con `service_role`) exigido por las tiendas (Fase 8).
