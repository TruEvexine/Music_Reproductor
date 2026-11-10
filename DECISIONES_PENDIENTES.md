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

## Manual del usuario (paneles y cuentas)

### D4 — Borrar los dos deployments antiguos de Vercel que llevaban música
- **Qué:** `music-reproductor-hx3945vym-evexine.vercel.app` y `music-reproductor-5xt592y0s-evexine.vercel.app` siguen sirviendo las pistas con copyright.
- **Por qué:** es lo único que queda abierto del hallazgo S1.
- **Cómo:** Vercel → proyecto `music-reproductor` → Deployments → menú `⋯` de cada uno → Delete. Después comprobar que una URL antigua de `/assets/*.flac` devuelve 404.

### D5 — Activar Vercel Authentication en deployments no productivos
- **Cómo:** Settings → Deployment Protection → Vercel Authentication → "Standard Protection". Así los previews de `desarrollo` no son públicos.

### D6 — Conectar Git en Vercel
- **Cómo:** Settings → Git → conectar `TruEvexine/Music_Reproductor`. `main` = producción, el resto previews. Evita desplegar desde una carpeta local (origen de S11).

### D7 — Copiar las variables a Preview
- **Cómo:** Settings → Environment Variables → `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` también en *Preview*. Sin esto los previews funcionan en local-only (sin cuenta).

### D8 — Renombrar el proyecto de Supabase
- **Qué:** se llama `Undefeated_Star_Web_Page` y aloja varias apps. Dashboard → Settings → General. Solo cosmético.

### D9 — Endurecer Auth en Supabase (S7)
- Protección de contraseñas filtradas (**requiere plan Pro**), longitud mínima ≥ 10, CAPTCHA (Turnstile), SMTP propio antes de abrir registros, *Redirect URLs* solo con dominios propios y `http://localhost:5173/**`.

### D10 — Revisar `math_record_attempt` y `rls_auto_enable`
- **Qué:** objetos de la otra app que comparte el proyecto; los advisors de Supabase los señalan. **El reproductor no los toca.** Revisarlos desde ese otro proyecto.

### D11 — Correo de autor en commits (opcional, S10)
- Los commits usan el correo institucional. Si se prefiere ocultarlo: GitHub → Settings → Emails → "Keep my email addresses private" y `git config user.email <id>+<usuario>@users.noreply.github.com`.

### D12 — Activar los hooks en cada clon nuevo
- En esta copia ya están activos. En cualquier otro clon: `npm run setup`.
