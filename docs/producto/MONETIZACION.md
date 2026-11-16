# Monetización: gratis, apoyo voluntario y premium a futuro

Estado: **decidido el 2026-11-12** (M1 y pasarela); lo fiscal sigue pendiente. Los datos de comisiones se consultaron el 12-11-2026; cada cifra lleva su fuente y si se leyó en la página
oficial o no. Las decisiones tuyas están marcadas **[Decides tú]**.

> **Resuelto el 2026-11-12:** manda este documento. **Todo lo que corre en tu dispositivo es gratis**, y solo se cobra lo que cuesta
> dinero cada mes (servidores). La licencia Pro de pago único que proponía la versión anterior de `PLAN.md` §7 se descartó; `PLAN.md`
> §7 y la Fase 9 ya dicen lo mismo que este documento. Razón: cobrar por código que ya corre en el cliente invita a desbloquearlo y
> contradice el mensaje «tu música es tuya».
>
> **Decisiones de esa fecha:** pasarela del café = **Stripe Payment Links**; se quiere **abrir el café ya**; **todavía no se ha
> consultado a un contador** → **[Pendiente: consulta con contador (M3)]**. Las dos últimas chocan entre sí: ver §6, primer riesgo.

> **Hecho 2026-11-13 (solo el botón, sin enlace real):** `src/ui/CafeLink.tsx` pinta «Comprar un café» en Ajustes y en el pie de la landing **solo si** el build trae `VITE_CAFE_URL` con un `https:` (`core/support.ts`, con test). Sin la variable no aparece en ningún sitio. Es un enlace en otra pestaña: sin SDK ni cambios en la CSP. Prueba: `scripts/prueba-cafe.mjs`. **Sigue pendiente M3 (contador) antes de poner un enlace real en producción.**

## 1. El modelo

| Nivel | Precio | Qué incluye |
|---|---|---|
| **Gratis** | $0 | Todo lo que existe hoy: reproducción local sin límite, biblioteca, ecualizador, fondos y luces, letras, playlists ilimitadas, copia de seguridad en archivo, **y la sincronización de playlists con cuenta** |
| **Apoyo** | Voluntario | Lo mismo. Agradecimiento, sin funciones a cambio |
| **Premium** (futuro) | Suscripción | Solo funciones con costo recurrente real (§4) |

**Sin anuncios.** Además de estropear la app, en Vercel Hobby los anuncios cuentan como uso comercial (ver §3.1).

La sincronización de playlists se queda gratis: ya existe, ocupa unos cientos de bytes por canción y quitarla ahora rompería la promesa
de la landing («La cuenta es opcional y solo sincroniza tus playlists»).

## 2. «Invítame un café»: comparación

### 2.1 Comisiones

Montos en pesos mexicanos. «Efectiva» = comisión + IVA del 16 % sobre la comisión, como porcentaje de la aportación.

| Opción | Tarifa | Efectiva en $50 | Efectiva en $100 | Fuente |
|---|---|---|---|---|
| **Stripe Payment Links** | 3.6 % + $3.00 por tarjeta nacional; +0.5 % tarjeta internacional; +2 % si hay conversión de moneda. OXXO: 4 % + $3.00. Transferencia bancaria: $7.00. Todo **más IVA**. Payment Links no cobra extra | **11.1 %** | **7.7 %** | Oficial, leído: [stripe.com/mx/pricing](https://stripe.com/mx/pricing), [métodos locales](https://stripe.com/mx/pricing/local-payment-methods), [Payment Links](https://stripe.com/payments/payment-links) |
| **Mercado Pago** (link de pago) | 3.49 % al instante, 3.19 % a 7 días o 2.95 % a 30 días, **+ $4.00 + IVA** | 13.3 % (al instante) · 12.7 % (30 días) | 8.7 % · 8.1 % | Página oficial vista solo en resultados de búsqueda ([mercadopago.com.mx, link de pago](https://www.mercadopago.com.mx/herramientas-para-vender/link-de-pago)); el sitio bloqueó la lectura directa. Una fuente secundaria dice que el Checkout no cobra el fijo ([alfa.digital](https://alfa.digital/radar/comisiones-pasarelas-de-pago-mexico/)): **confirmar en tu cuenta** |
| **PayPal** | 3.95 % + $4.00 + IVA (nacional); internacional entre 4.4 % y 5.4 % según la fuente | 13.9 % | 9.2 % | **No verificado en fuente oficial**: PayPal bloqueó la lectura. Cifras de [Wise](https://wise.com/mx/blog/comisiones-paypal-mexico) y [Finan.mx](https://finan.mx/blog/entidades-financieras/que-es-paypal-y-como-se-usa/) |
| **Buy Me a Coffee** | 5 % de plataforma, sin cuota mensual; el cobro lo procesa Stripe (y Wise). La comisión del procesador va aparte según fuentes secundarias | ≈ 16 % (estimado: 5 % + Stripe nacional) | ≈ 12.7 % | Oficial, leído: [FAQ](https://buymeacoffee.com/faq), [países con pago](https://help.buymeacoffee.com/en/articles/6258038-supported-countries-for-payouts-on-buy-me-a-coffee). El procesador aparte: [schoolmaker.com](https://schoolmaker.com/blog/buy-me-a-coffee-pricing) |
| **Ko-fi** | 0 a 5 % de servicio según el tipo de pago; Gold (US$12 al mes) elimina la comisión. Comisión de PayPal o Stripe aparte | ≈ 11 % si las propinas sueltas son 0 % (dato contradictorio) | ≈ 8 % | **No verificado en fuente oficial**: Ko-fi bloqueó la lectura. Resumen de su centro de ayuda en buscador ([help.ko-fi.com](https://help.ko-fi.com/hc/en-us/articles/360005506873-What-is-Ko-fi-Gold)) |

Con aportaciones pequeñas manda el **cargo fijo**: en $20, Stripe se queda con casi el 22 %. Por eso conviene que el monto mínimo sugerido
sea $50. **[Decides tú]** montos sugeridos (propuesta: $50, $100, $200 y «otro»).

### 2.2 Retiro en México, requisitos y fricción

| Opción | Retiro a banco mexicano | Requisitos para ti | Fricción para quien aporta |
|---|---|---|---|
| Stripe Payment Links | A tu CLABE. El primer pago suele llegar en 7 a 14 días; después, calendario automático ([docs.stripe.com/payouts](https://docs.stripe.com/payouts)). Comisión de retiro: no la encontré | Cuenta Stripe en México (país admitido, [stripe.com/global](https://stripe.com/global)); RFC y datos fiscales en el alta (**no verificado**) | Baja: página de pago de Stripe, sin crear cuenta; tarjeta u OXXO |
| Mercado Pago | A tu cuenta bancaria; el plazo depende de la tarifa elegida (al instante, 7 o 30 días) | Cuenta Mercado Pago; requisitos fiscales no verificados | Muy baja en México: saldo de Mercado Pago, tarjeta, SPEI y efectivo en OXXO |
| PayPal | No verificado | Cuenta PayPal | Media: empuja a iniciar sesión en PayPal |
| Buy Me a Coffee | A tu banco vía Stripe; **México sí está** en su lista de países | Cuenta Stripe conectada (los mismos requisitos que Stripe) | Baja; página pública con muro de apoyos |
| Ko-fi | Directo a tu PayPal o Stripe (no verificado en fuente oficial) | Cuenta PayPal o Stripe | Baja; página pública |

### 2.3 Lo fiscal (para tu contador)

Esto no es asesoría fiscal; son las preguntas que tienes que llevarle a un contador **antes** de activar cualquier botón:

1. **Lo que recibas es ingreso tuyo.** No eres donataria autorizada, así que no puedes llamarlo «donativo deducible» ni emitir recibos
   de donativo. La LISR prevé exenciones limitadas para donativos (art. 93); no verifiqué si aplican a aportaciones de usuarios de un
   servicio.
2. **Régimen y RFC:** qué régimen te conviene como persona física (por ejemplo RESICO o actividad empresarial) y si debes emitir CFDI
   por cada aportación o una factura global.
3. **Retenciones de plataformas en 2026:** la prensa reporta cambios en las retenciones de ISR e IVA a quienes cobran a través de
   plataformas digitales ([El Contribuyente](https://www.elcontribuyente.mx/2025/11/en-2026-vender-en-plataformas-digitales-sera-mas-caro-habra-nuevas-retenciones/),
   [blog de Mercado Pago](https://www.mercadopago.com.mx/blog/nuevas-retenciones-ventas-en-plataformas)). Las cifras no coinciden entre
   fuentes y no pude leer el sitio del SAT. Pregunta: ¿alguna de estas opciones te retiene, y cuánto, con y sin RFC?
4. **IVA:** si cobras premium, si el precio publicado incluye IVA.

### 2.4 Recomendación

**Empezar con Stripe Payment Links.**

- Es la opción más barata que pude verificar en la fuente oficial, cobra en pesos y acepta tarjeta y OXXO.
- No tiene cuota mensual ni comisión propia por el enlace.
- **La misma cuenta servirá para premium** (suscripciones con Stripe Billing): no habrá migración de proveedor.
- Buy Me a Coffee también paga a México, pero usa una cuenta de Stripe por debajo y añade el 5 %. Solo vale la pena por su página
  pública con muro de apoyos.

Integración, en la línea de la app: un enlace «Apoyar el proyecto» en Ajustes y en el pie de la landing que abre el Payment Link en una
pestaña nueva. Sin SDK, sin cambios en la CSP (es un enlace, no una conexión) y sin datos de pago en la app. Nunca un diálogo que
interrumpa la escucha. Después del pago, Stripe muestra su propia página de agradecimiento; no hace falta guardar nada.

**Cuándo pasar a otra (o añadirla):**

| Señal | Movimiento |
|---|---|
| En el panel de Stripe, muchas sesiones de pago abiertas y pocas completadas, o te piden Mercado Pago | Añadir un link de Mercado Pago junto al de Stripe. Es la forma de pago más cómoda para quien no tiene tarjeta |
| La mayoría de quienes aportan pagan desde fuera de México y en dólares | Considerar Buy Me a Coffee o Ko-fi por su página pública y su moneda; asumir el 5 % |
| Quieres aportaciones mensuales sin premium | Payment Link recurrente de Stripe; no hace falta otro proveedor |
| Sale premium | Stripe Billing con la misma cuenta. En Android, Google Play Billing es obligatorio para bienes digitales dentro de la app (`PLAN.md` §7); **verifica** también la política de Play sobre enlaces de donación antes de publicar la app |

## 3. Restricciones de la infraestructura

### 3.1 Vercel

- El plan **Hobby es solo para uso personal no comercial**. Pedir donaciones **no** cuenta como uso comercial; cobrar a los usuarios
  y los anuncios sí ([vercel.com/docs/limits/fair-use-guidelines](https://vercel.com/docs/limits/fair-use-guidelines), leído).
- Consecuencia: el botón de apoyo cabe en Hobby; **premium obliga a pasar a Pro** (US$20 al mes por asiento,
  [vercel.com/pricing](https://vercel.com/pricing), leído).

### 3.2 Supabase

El proyecto actual es compartido y está en el plan gratuito. Premium necesita un proyecto dedicado en Pro (ya decidido en
`PLAN.md` §3.4): backups diarios, sin pausas por inactividad, límites que no comparte con otra app. Detalle de límites y costos en
`ROADMAP.md` §3.

## 4. Premium: solo lo que cuesta cada mes

Criterio: una función es premium solo si **cada usuario que la usa genera un costo de servidor que no existe para quien no la usa**.
Las cuatro candidatas, de menor a mayor costo:

| Función | Qué es | Por qué cuesta | Infraestructura |
|---|---|---|---|
| **Sincronización completa** | Ajustes, favoritos, historial y cola entre dispositivos (las playlists siguen gratis) | Escrituras frecuentes y filas que crecen con el uso | Tablas `mp_settings`, `mp_favorites`; reutiliza el outbox |
| **Copias de seguridad en la nube** | Copia automática diaria de playlists, ajustes e historial, con 30 días de versiones y restauración en un dispositivo nuevo | Almacenamiento por usuario y por versión | Bucket privado de Supabase Storage o fila `jsonb` por versión; Edge Function programada para podar versiones |
| **Recaps avanzados** | Historial de todos tus dispositivos sumado, archivo de todos los años, comparación año contra año, imagen del recap generada para compartir | El historial es lo que más crece en la base (ver `ROADMAP.md` §3) | `mp_play_events` y `mp_play_daily` (`docs/DISENO_ESTADISTICAS.md`), agregación diaria en servidor |
| **Nube de música** | Subir tu biblioteca y escucharla desde cualquier dispositivo | Almacenamiento y transferencia de archivos de 30 a 60 MB por canción | Cloudflare R2 + URLs firmadas (`PLAN.md` §3.5). Nivel aparte por su costo y su riesgo legal |

**Gratis para siempre**, aunque haya premium: todo lo local, las playlists sincronizadas, los recaps calculados en el dispositivo
(`PERFIL_Y_RECAPS.md`) y la copia de seguridad en archivo.

### 4.1 Lo que exige cobrar

- Tabla `entitlements` (usuario, producto, estado, origen, fin del periodo) de solo lectura para el usuario; la escribe una Edge
  Function que recibe los webhooks de Stripe y verifica su firma (`PLAN.md` §3.4).
- Las funciones premium se validan **en el servidor**, porque todas viven ahí. No hay que proteger código del cliente.
- Vercel Pro, Supabase Pro dedicado, aviso de privacidad y términos actualizados (datos de facturación, reembolsos, cancelación),
  y alta fiscal resuelta (§2.3).

### 4.2 Punto de equilibrio

Costo fijo mínimo con premium: Vercel Pro (US$20) + Supabase Pro (US$25, incluye US$10 de cómputo para un proyecto Micro) =
**US$45 al mes** antes de uso adicional ([vercel.com/pricing](https://vercel.com/pricing),
[supabase.com/pricing](https://supabase.com/pricing), leídos).

Suscriptores necesarios = 45 ÷ (lo que te queda en dólares por suscriptor tras comisión, IVA e impuestos). Ejemplo: si a cada
suscriptor le quedan US$2 netos, hacen falta **23**. **[Decides tú]** el precio; para calcular el neto necesitas el tipo de cambio del
día y tu tasa de impuestos, que no incluyo.

**Criterio para construir premium:** que antes haya demanda medida, no supuesta. Propuesta: una lista de espera en la landing y
lanzar cuando tenga al menos tres veces el punto de equilibrio en correos (≈ 70 con el ejemplo anterior). Está en `ROADMAP.md`.

## 5. Decisiones tuyas

| # | Decisión |
|---|---|
| M1 | **Resuelta 2026-11-12:** todo lo local gratis; se cobra solo servidor. `PLAN.md` §7 actualizado |
| M2 | Montos sugeridos del botón de apoyo |
| M3 | **[Pendiente: consulta con contador]** régimen fiscal y RFC, antes del primer cobro. No se ha consultado |
| M4 | Política de reembolso de aportaciones |
| M5 | Precio de premium y si se ofrece prueba gratuita |
| M6 | Si la nube de música llega a existir (riesgo legal y de costo: `PLAN.md` §3.5) |

## 6. Lo omitido y los riesgos

- **Riesgo de la decisión de abrir el café ya sin contador:** se decidió abrirlo ya (2026-11-12), pero M3 sigue pendiente. Recibir dinero sin régimen dado de alta es el riesgo más concreto de este documento. Lo que se puede hacer ya sin ese riesgo es **construir** el enlace en la app; lo que lo activa es crear el Payment Link real y publicarlo. Recomendación: no publicar el enlace hasta resolver M3.
- **Sin verificar en fuente oficial:** comisiones de PayPal y Ko-fi, la comisión fija del link de Mercado Pago, requisitos fiscales de
  alta en Stripe y Mercado Pago, la comisión de Stripe Billing y las retenciones del SAT para 2026. Las páginas bloquearon la lectura
  automática; revísalas a mano antes de decidir.
- **Las tarifas cambian.** Volver a consultar las fuentes justo antes de activar el botón.
- **Riesgo fiscal:** recibir dinero sin régimen dado de alta. Es el riesgo más concreto de este documento; por eso el botón no debe
  publicarse hasta resolver M3.
- No comparé GitHub Sponsors (`PLAN.md` §7 lo menciona). Exige que quien aporta tenga cuenta de GitHub, que no es el público de la app.
