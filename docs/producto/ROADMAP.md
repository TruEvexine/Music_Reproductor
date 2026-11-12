# Hoja de ruta de producto

Visión de producto por fases, sin fechas: cada fase empieza cuando se cumple su **criterio de entrada** y termina cuando se cumple su
**criterio de éxito**. El detalle técnico de cada fase sigue en `PLAN.md` §8, que manda sobre este documento en lo técnico. Las
decisiones tuyas están marcadas **[Decides tú]**.

Los umbrales numéricos de los criterios son **propuestas** para que haya algo medible; cámbialos si no te sirven.

## 1. Dónde estamos

Web funcionando en Vercel (rama `desarrollo`; producción sin publicar): biblioteca local persistente, motor de audio completo,
playlists locales con sincronización opcional, Ajustes, landing. Fases 0 a 3 de `PLAN.md` cerradas; la 4 (diseño) y el pulido previo
al despliegue (§11) están avanzados. Sin cuentas abiertas al público, sin nombre de marca, sin aviso de privacidad publicado.

## 2. Fases

### Fase 1 — Publicar la web

- **Entrada:** checklist de `PLAN.md` §11.4 completa; borrar los deployments antiguos con música (D4); responsable, domicilio y correo
  de contacto decididos (`LEGAL_BORRADORES.md`, L1 a L3).
- **Qué incluye:** despliegue a producción, aviso de privacidad, términos y página de almacenamiento local publicados (revisados por un
  abogado), FAQ publicada (`FAQ.md`).
- **Éxito:** producción en línea con los textos legales; matriz de `scripts/capturas.mjs` y pruebas de navegador en verde contra la URL
  de producción; `node scripts/verificar-csp.mjs` sin violaciones; Lighthouse ≥ 90 en rendimiento y accesibilidad en móvil.

### Fase 2 — Nombre, dominio y landing

- **Entrada:** nombre verificado en el IMPI y dominio comprado (`MARCA.md`). **[Decides tú]** el nombre.
- **Qué incluye:** cambio de nombre en toda la app, landing prerenderizada con `/funciones`, `/privacidad`, `/terminos`; logo; Search
  Console (`PLAN.md` Fase 7).
- **Éxito:** dominio propio en producción con HTTPS; landing indexada en Google; la búsqueda del nombre de marca devuelve la landing
  en primera posición.

### Fase 3 — Cuentas listas para el público

- **Entrada:** Fase 1 cerrada. Es requisito **antes** de anunciar la app en cualquier sitio, porque el registro es lo primero que se
  rompe (§3.3).
- **Qué incluye:** SMTP propio con remitente del dominio, Turnstile, contraseña mínima ≥ 10 (D9); recuperación de contraseña;
  «Eliminar cuenta» y «Datos de tu cuenta» (`AJUSTES_PRIVACIDAD.md`); proyecto de Supabase **propio** (ver §3.5).
- **Éxito:** registro, confirmación, recuperación y baja probados de punta a punta con una cuenta de prueba; ninguna tabla del
  reproductor en el proyecto compartido; correo de confirmación con SPF y DKIM válidos que no cae en spam en Gmail ni en Outlook.

### Fase 4 — Instalable y sin conexión

- **Entrada:** Fase 1 cerrada.
- **Qué incluye:** manifest, iconos (`MARCA.md` §3), service worker con la app completa en caché (`PLAN.md` Fase 6; cierra D18).
- **Éxito:** recargar la app sin red funciona en Chrome y Firefox; se instala en Android desde Chrome; ninguna regresión en la matriz.

### Fase 5 — Historial y recaps

- **Entrada:** decisión D19 de `docs/DISENO_ESTADISTICAS.md` y retención del historial (`PERFIL_Y_RECAPS.md` §2.3). **[Decides tú]**.
- **Qué incluye:** captura local de escuchas, controles de historial, recaps de semana, mes y año, compartir imagen, perfil local
  (`PERFIL_Y_RECAPS.md` §4, pasos 1 a 5). Todo en el dispositivo.
- **Éxito:** recap de un año calculado en < 300 ms con 100 000 eventos sintéticos en un móvil de gama media; chunk de recaps ≤ 15 KB
  gzip; tests de la regla de conteo en verde.

### Fase 6 — Apoyo voluntario

- **Entrada:** régimen fiscal resuelto con un contador (`MONETIZACION.md`, M3); cuenta de Stripe en México activa.
- **Qué incluye:** enlace «Apoyar el proyecto» en Ajustes y en la landing con Stripe Payment Links; cláusula 7 de los términos.
- **Éxito:** el primer pago llega a tu cuenta bancaria; el aviso de privacidad y los términos coinciden con lo que hace el botón.

### Fase 7 — App Android

- **Entrada:** Android Studio instalado; prototipo de audio en segundo plano decidido (D3); cuenta de Google Play Console.
- **Qué incluye:** Capacitor, implementación nativa de `LocalLibrary` y `AudioSession`, tokens en Keystore, formulario de seguridad de
  datos de Play, borrado de cuenta dentro de la app (`PLAN.md` Fase 11).
- **Éxito:** una hora de reproducción con la pantalla apagada en un teléfono real sin cortes; controles en notificación y pantalla de
  bloqueo; app aprobada en Play.

### Fase 8 — Backend con margen

- **Entrada:** cualquiera de estas: un límite del plan gratuito de Supabase por encima del 70 % (§3.2), decisión de lanzar premium, o
  necesidad de backups diarios.
- **Qué incluye:** Supabase Pro en el proyecto propio (`PLAN.md` §3.4), sincronización incremental de playlists (§3.4), tablas
  `mp_play_daily` y `entitlements`.
- **Éxito:** migración sin pérdida de datos (recuento de filas por tabla antes y después); RLS probada con dos usuarios; ningún límite
  por encima del 50 %.

### Fase 9 — Premium

- **Entrada:** lista de espera con al menos **tres veces** los suscriptores del punto de equilibrio (`MONETIZACION.md` §4.2);
  Fase 8 cerrada; Vercel Pro contratado (Hobby no permite uso comercial).
- **Qué incluye:** sincronización completa, copias de seguridad en la nube, recaps multidispositivo (`MONETIZACION.md` §4); Stripe
  Billing en web y Google Play Billing en Android.
- **Éxito:** ingresos netos ≥ costo fijo durante tres meses seguidos; tasa de cancelación mensual medida y documentada.

### Fase 10 — iPhone

- **Entrada:** Fase 7 estable; Mac y cuenta de Apple Developer.
- **Éxito:** app aprobada en App Store con audio en segundo plano probado en un iPhone real.

### Fase 11 — Nube de música (opcional)

- **Entrada:** premium sostenible (Fase 9 cumplida) y revisión legal de la política de retiro de contenido (`PLAN.md` §3.5).
  **[Decides tú]** si se hace.
- **Éxito:** costo de almacenamiento y transferencia por usuario medido y cubierto por su precio.

Orden de las fases 4 a 7: pueden ir en paralelo o en otro orden; lo que no cambia es que la 3 va antes de anunciar la app y la 8 antes de
la 9.

## 3. Escalabilidad

### 3.1 Cuánto pesa una visita

Medido sobre el build actual (`dist/`, 12-11-2026):

| Recurso | Peso transferido (gzip) |
|---|---|
| JavaScript principal | 190 KB |
| CSS | 8 KB |
| Tipografías | 76 KB |
| Imágenes de la landing | ~440 KB |
| Worker de metadatos (solo al añadir música) | 36 KB más ~25 KB de lectores de formato |

Primera visita con landing: **~0,7 MB en ~10 peticiones**. Las siguientes visitas casi no transfieren: los archivos de `/assets/` se
sirven con caché inmutable de un año (`vercel.json`) y solo se revalida el HTML. **La música no pasa por Vercel nunca.**

### 3.2 Límites de hoy

Consultados el 12-11-2026 en las páginas oficiales ([vercel.com/pricing](https://vercel.com/pricing),
[vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby), [supabase.com/pricing](https://supabase.com/pricing),
[billing de Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)).

| Servicio y plan | Límite | Qué significa aquí |
|---|---|---|
| Vercel Hobby | 100 GB de transferencia y **1 M de peticiones** al mes; **solo uso no comercial**; al pasarse, espera 30 días (no se puede pagar el excedente) | ~100 000 primeras visitas al mes antes de topar con las peticiones |
| Vercel Pro | US$20 por asiento al mes; 1 TB y 10 M de peticiones incluidos; después US$0,15 por GB y US$2 por millón de peticiones | Obligatorio con premium o anuncios |
| Supabase Free | 500 MB de base de datos, **5 GB de transferencia**, 50 000 usuarios activos al mes, 1 GB de archivos; **pausa tras una semana sin actividad**; sin backups; 2 proyectos gratis | Ver §3.3 |
| Supabase Pro | Desde US$25 al mes por organización (incluye US$10 de cómputo: un proyecto Micro); 8 GB de base, 250 GB de transferencia, 100 000 usuarios activos; backups diarios de 7 días; después US$0,125 por GB de base, US$0,09 por GB transferido, US$0,00325 por usuario activo | Fase 8 |

### 3.3 Qué se rompe primero

En orden, con la app tal como está:

1. **El correo de confirmación.** El registro usa el servidor de correo integrado de Supabase, pensado para pruebas y con un límite de
   envíos por hora muy bajo (no verifiqué la cifra actual: revísala en Authentication → Rate Limits). En cuanto se anuncie la app, los
   registros fallarán sin aviso claro. Se resuelve en la Fase 3 con SMTP propio.
2. **El proyecto compartido en plan gratuito.** Sin backups: un error borra datos sin vuelta atrás. Comparte límites con otra app.
   Y si ninguna de las dos tiene actividad en una semana, se pausa y la sincronización deja de funcionar.
3. **La transferencia de Supabase (5 GB).** Cada sincronización, que ocurre medio segundo después de cada cambio, al volver la red y al
   iniciar sesión, **vuelve a descargar todas las playlists de la cuenta** (`src/sync/playlistSync.ts`, `fetchUserPlaylists`). Una
   cuenta con 1 000 canciones en playlists son ~150 KB por sincronización; con 50 cambios al mes, ~7,5 MB. **5 GB alcanzan para ~650
   usuarios así.** Es el primer límite técnico de la base, antes que el espacio.
4. **Las peticiones de Vercel Hobby (1 M).** ~100 000 primeras visitas al mes.
5. **El espacio de la base (500 MB).** Una fila de `playlist_tracks` ocupa unos 300 bytes con sus índices. Con 100 canciones en
   playlists por usuario (~30 KB) caben ~16 000 usuarios; con 1 000, ~1 600. Si se sincroniza el historial (`PERFIL_Y_RECAPS.md`
   §2.4), ~2,7 MB por usuario y año: **500 MB se llenan con menos de 200 usuarios-año**. Por eso el historial sincronizado es premium
   y va en Pro.
6. **Los 50 000 usuarios activos al mes.** El último en romperse.

Las cifras de bytes por fila y de cambios al mes son estimaciones; se confirman midiendo `pg_total_relation_size` en el proyecto propio.

### 3.4 Arreglos baratos antes de pagar

- **Sincronización incremental** (para el punto 3): añadir `updated_at` a `playlists` y pedir solo lo cambiado desde la última
  sincronización. Reduce la transferencia en uno o dos órdenes de magnitud. Migración aditiva.
- **Proyecto propio en plan gratuito** (para el punto 2): Supabase da dos proyectos gratis; sacar el reproductor del proyecto compartido
  no cuesta nada y separa límites y responsabilidades. La pausa por inactividad y la falta de backups siguen, así que es un paso
  intermedio, no el destino.
- **Imágenes de la landing en AVIF o WebP** (para el punto 4): son el 60 % del peso de la primera visita.

### 3.5 Costo esperado por tamaño

Estimación mensual en dólares, solo con lo que existe hoy más la Fase 3 (sin premium ni historial sincronizado). «Usuarios» = usuarios
activos al mes con cuenta; se suponen tres visitas sin cuenta por cada uno.

| Usuarios | Vercel | Supabase | Total aprox. | Qué vigilar |
|---|---|---|---|---|
| 100 | Hobby, $0 | Free en proyecto propio, $0 | **$0** + SMTP y dominio | Pausa por inactividad; sin backups |
| 1 000 | Hobby, $0 | Free, $0, si hay sincronización incremental; si no, la transferencia ya roza el límite | **$0** + SMTP y dominio | Transferencia de Supabase |
| 10 000 | Hobby cerca del límite de peticiones → Pro, $20 | Pro, $25 (el espacio pasa de 500 MB) | **~$45** | Espacio y cómputo de la base |
| 100 000 | Pro, $20 + excedente de peticiones (~$0 a $10) | Pro, $25 + cómputo Small o Medium ($15 a $60 sobre el crédito de $10) + transferencia | **~$80 a $150** | Cómputo de la base; plan Team ($599) si se necesitan más backups o soporte |

No incluyo el SMTP (depende del proveedor, no lo verifiqué), el dominio, la cuenta de Google Play ni la de Apple Developer.

## 4. Plan de crecimiento

Sin presupuesto de publicidad y sin analítica en el cliente (`AJUSTES_PRIVACIDAD.md` §2.4), así que todo se mide con lo que ya dan los
paneles.

### 4.1 Canales

| Canal | Qué se hace | Cuándo |
|---|---|---|
| **Buscadores** | Páginas de la landing para lo que la gente busca de verdad: «reproductor FLAC en el navegador», «escuchar mi música sin subirla», «reproductor con ecualizador web». Cada una con su captura real | Fase 2 |
| **Comunidades** | Presentarlo una vez, con capturas y sin exagerar, en foros de audio y de música local en español e inglés. Responder preguntas; no repetir el anuncio | Tras la Fase 3 |
| **Recaps compartidos** | La imagen del recap lleva el nombre de la app en pequeño en una esquina. Es el único bucle de crecimiento que no depende de ti | Fase 5 |
| **Google Play** | La ficha de la tienda es un canal de búsqueda por sí misma | Fase 7 |
| **Código abierto** | Si eliges una licencia abierta, el repositorio público atrae a desarrolladores y genera confianza en la promesa de privacidad («el código lo demuestra») | **[Decides tú]** (L6) |

### 4.2 Cómo se mide

| Pregunta | De dónde sale |
|---|---|
| ¿Llega gente? | Peticiones al HTML en el panel de Vercel; Search Console |
| ¿Se queda? | Altas y últimos accesos en Supabase (solo quien tiene cuenta) |
| ¿Le sirve? | Correos recibidos; preguntas repetidas (alimentan `FAQ.md`) |
| ¿La apoya? | Pagos en Stripe; altas en la lista de espera de premium |

Lo que no se puede saber sin analítica: cuánta gente usa la app sin cuenta. Es el costo de la promesa de privacidad, y está bien así.

## 5. Lo omitido y los riesgos

- Las cifras de §3.3 y §3.5 son estimaciones con supuestos declarados; los precios son del 12-11-2026 y cambian.
- No incluí el costo de tu tiempo, que es el recurso más escaso de un proyecto en solitario. Las fases 3 y 8 son las de más trabajo y
  menos visibles.
- **Riesgo:** anunciar la app antes de la Fase 3. Los registros fallarían por el correo y las bajas serían manuales.
- **Riesgo:** dejar el reproductor en el proyecto compartido. Un cambio de la otra app o la pausa por inactividad afectan a usuarios
  reales sin backups.
