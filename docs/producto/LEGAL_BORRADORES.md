# Aviso de privacidad y almacenamiento local (borradores)

> **Borrador para revisión de una persona abogada; no es asesoría jurídica ni está listo para publicarse.** Reescrito el 16-11-2026 a partir
> del código de la rama `desarrollo` y del texto vigente de la ley, leído ese día (`INVESTIGACION_LEGAL.md` tiene las fuentes y lo que no se
> pudo confirmar). Cada afirmación sobre lo que hace la app tiene su fila en `COPY_LEGAL.md`. Lo marcado **[Decides tú]** es una decisión
> pendiente; lo marcado **[Abogado]**, una duda jurídica. Esas notas llegan hasta el final de su párrafo y no se publican.

> **Cómo se publica.** `/privacidad` sale de §3.1 y `/almacenamiento` de §5 (`src/ui/LegalPage.tsx`, vía `virtual:docs`); los términos
> están en `TERMINOS.md`. Solo aviso y términos se enlazan, desde Ajustes → Acerca de; ninguna otra navegación pública. Las páginas llevan
> «Borrador pendiente de revisión legal» y piden no indexarse. Los `{{MARCADORES}}` se completan al compilar con `LEGAL_RESPONSABLE`,
> `LEGAL_DOMICILIO`, `LEGAL_CORREO_PRIVACIDAD`, `LEGAL_NOMBRE_APP`, `LEGAL_FECHA_ACTUALIZACION` y `LEGAL_URL_APP` (entorno o `.env`;
> valores en `docs/producto/privado/`, nunca en el repositorio) y **`npm run build` falla si queda alguno**. Lo que solo vale con cuentas va
> entre `<!-- cuentas -->…<!-- /cuentas -->` y lo que solo vale sin ellas entre `<!-- sin cuentas -->…<!-- /sin cuentas -->`. El primer
> lanzamiento va **sin cuentas** (`VITE_CUENTAS` distinto de `1`).

---

## 1. Inventario: qué datos existen y dónde viven

Comprobado leyendo el código (`src/platform/web/db.ts`, `src/platform/web/library.ts`, `src/state/*.ts`, `src/sync/*.ts`), la CSP de
`vercel.json`, las migraciones de `supabase/migrations/` y, el 12-11-2026, una consulta de solo lectura al esquema `auth` de Supabase.

### 1.1 En el dispositivo (no sale de él)

| Dónde | Qué guarda | Cuándo | Cómo se borra hoy |
|---|---|---|---|
| IndexedDB `reproductor`, almacén `kv` | `audio` (ecualizador, volumen, velocidad, fundidos, ReplayGain), `background` (fondo, HDR, reducir movimiento), `session` (cola y posición), `position` (pista y segundo actuales) | Al cambiar un ajuste o al reproducir | Ajustes → Privacidad y datos → Borrar datos de este dispositivo |
| IndexedDB, `kv`, claves `profile.name` y `profile.avatar` | Nombre visible (opcional, hasta 60 caracteres) y foto de perfil (opcional: JPEG de 256 × 256 px recortado y recodificado, sin metadatos). No se suben ni se sincronizan | Si la persona los pone en Ajustes → Perfil | Ajustes → Perfil, o borrar los datos del dispositivo |
| IndexedDB, almacén `tracks` | Por pista: título, artista, álbum, artista del álbum, año, género, número, duración, formato y calidad, ReplayGain, nombre de archivo, ruta relativa, tamaño, fecha de modificación, huella `track:v2`, fecha en que se añadió y **fecha de la última reproducción** (un valor por pista, no un historial) | Al añadir música o reproducir | Quitar la carpeta, o borrar los datos del dispositivo |
| IndexedDB, almacén `lyrics` | Letras sacadas de las etiquetas del archivo o de un `.lrc` con el mismo nombre (migración v3) | Al leer metadatos | Ídem |
| IndexedDB, almacén `edits` | Lo que la persona edita de cada canción (título, artista, artista del álbum, álbum, año, género, n.º de pista y de disco) y, si elige una, el hash de su carátula, guardada en `covers` recodificada a ≤ 1024 px y sin metadatos (migración v4). Nunca se escribe en el archivo ni se sube: las playlists y la nube siguen usando lo que trae el archivo | Al guardar en «Editar información» | «Restablecer» en «Editar información», quitar la carpeta, o borrar los datos del dispositivo |
| IndexedDB, almacén `roots` | Nombre de cada carpeta elegida y su permiso de **solo lectura** | Al elegir una carpeta | Ídem |
| IndexedDB, almacén `covers` | Portadas sacadas de los archivos o de la imagen de la carpeta del álbum, las carátulas elegidas en «Editar información», y sus miniaturas | Al leer metadatos | Ídem |
| IndexedDB, almacén `playlists` | Nombre de cada playlist, identidades de sus pistas, dueño (id de usuario o ninguno) | Al crear o editar playlists | Borrar datos del dispositivo (con sesión abierta, las de la cuenta vuelven a bajar) |
| IndexedDB, almacén `outbox` | Cambios de playlists pendientes de subir, con el id de usuario | Con sesión, hasta que el cambio llega a Supabase | Se vacía al sincronizar o al borrar los datos del dispositivo |
| OPFS, carpeta `biblioteca/` | **Copia de los archivos de audio**, solo si el navegador no permite recordar la carpeta (Firefox, Safari); la app pide almacenamiento persistente | Al añadir música en esos navegadores | Quitar la carpeta, o borrar los datos locales |
| `localStorage`, `sb-<proyecto>-auth-token` | Sesión de Supabase (tokens y datos de la cuenta, incluido el correo) | Al iniciar sesión | Cerrar sesión, o «Cerrar también la sesión» al borrar los datos del dispositivo |
| Memoria | Archivos sueltos que no se pueden guardar | Durante la sesión | Al recargar |
| Sistema operativo (Media Session) | Título, artista, álbum y portada de la pista actual para la pantalla de bloqueo | Al reproducir | Lo gestiona el sistema; no pasa por ningún servidor |

### 1.2 Fuera del dispositivo

| Quién | Dónde | Qué recibe | Cuándo |
|---|---|---|---|
| **Vercel** (alojamiento de la web) | Red global; procesamiento principal en EE. UU. | La petición de cada archivo de la web: **IP**, datos de configuración del navegador y ruta; Vercel deriva de la IP la ciudad y el país. No hay funciones de servidor ni analítica de Vercel activas. **[No confirmado]** cuánto conserva Vercel esos datos en un sitio estático y en qué plan está el proyecto (su DPA solo cubre Pro y Enterprise) | Cada visita, con y sin cuentas |
| **Supabase** (autenticación y base de datos) | Proyecto en la región del este de **EE. UU.** (`us-east-1`) | Correo, contraseña cifrada (hash), nombre visible (`display_name`; **si la persona no da uno, el disparador guarda la parte del correo antes de la «@»** hasta que se aplique la migración `20261114120000_profile_display_name_sin_correo.sql`), fechas de alta, confirmación y último acceso; por sesión, **IP y navegador**; registro de auditoría con IP; `playlists` (nombre) y `playlist_tracks` (identidad de cada pista y posición) | Solo con cuentas, si la persona crea una |
| Supabase (correo) | Ídem | Correos de confirmación con el servidor de correo integrado de Supabase (sin SMTP propio, D9) | Al registrarse |
| Procesador del café (Stripe) | — | Lo que la persona escriba en la página de pago. **[No confirmado]** qué datos de la operación ve el responsable en Stripe | Solo si el café se publica y alguien aporta. Hoy no está publicado |

**Identidad de las pistas sincronizadas:** `track:v1` es `título|artista|álbum|duración` en texto y `track:v2` es una huella SHA-256 de
tamaño + primer y último MiB del archivo (`src/core/track.ts`; v2 se usa si la pista se añadió así). La nube no recibe audio, pero sí los
títulos y artistas de cada playlist (los del archivo: lo editado en la app no cambia `track:v1` ni se sube), y una huella que identifica un archivo concreto sin permitir reconstruirlo. Las playlists creadas
antes de iniciar sesión solo se suben si la persona elige «Subir» en el diálogo de adopción.

### 1.3 Lo que no existe (comprobado)

- **Cookies:** ninguna. La sesión va en `localStorage`.
- **Analítica, publicidad, rastreo, píxeles, reporte de errores a terceros:** no hay. La CSP (`connect-src 'self'` y el dominio de
  Supabase) bloquearía cualquier otra conexión.
- **Fuentes, scripts o imágenes de terceros:** la tipografía va empaquetada y todo se sirve desde el propio dominio.
- **Audio en servidores:** los archivos se leen en el dispositivo y nunca se suben.
- **Recuperar contraseña, cambiar correo, eliminar la cuenta o aceptar los términos desde la app:** no existen. Eliminar una cuenta hoy
  se hace a mano en el panel de Supabase. «Datos de tu cuenta» (exportación del perfil y las playlists de la nube) sí existe, en Ajustes →
  Privacidad y datos; no incluye los datos de Auth (correo, fechas, IP).
- **Datos sensibles** (art. 2, fr. VI): no se piden. **[Abogado]** Los títulos de una playlist podrían revelar creencias religiosas o
  políticas; la app no los interpreta ni los clasifica.

---

## 2. Ley aplicable (resumen; fuentes y detalle en `INVESTIGACION_LEGAL.md` §2.5)

LFPDPPP nueva (DOF 20-03-2025), última reforma DOF 14-11-2025; autoridad: Secretaría Anticorrupción y Buen Gobierno. Lo que fija el texto:

| Tema | Artículo | En el aviso |
|---|---|---|
| Contenido mínimo | 15, fr. I a VI | Todas las fracciones cubiertas en §3.1 |
| Simplificado | 16, fr. II (fr. I a IV del 15 y dónde está el integral) | §3.2, con domicilio (el borrador anterior lo omitía) |
| Consentimiento | 7 (tácito, revocable), 9 fr. IV (no hace falta para la relación jurídica) | Finalidades necesarias, sin secundarias |
| **Plazos de derechos** | 31: respuesta en **20 días hábiles**, ejecución en los **15 siguientes**, ampliables una vez por igual periodo; art. 2, fr. VIII: días hábiles | Sustituyen los `[30]` y `[15]` del borrador anterior |
| Eliminar la cuenta | Es una solicitud de cancelación (arts. 24 y 31). La ley **no fija** otro plazo de borrado; art. 10: suprimir previo bloqueo | Se usan los plazos del art. 31 |
| Ante la autoridad | 40: solicitud de protección en los **15 días** siguientes a la respuesta, o tras vencer el plazo sin respuesta | Se dice en el aviso |
| Encargados | 2, fr. XII y XX: no son transferencias. Lineamientos 2013, Vigésimo sexto: no hace falta nombrarlos **[No confirmado: vigencia]** | Se nombran igual, por transparencia |
| Vulneraciones | 19: aviso inmediato si afectan de forma significativa | Se promete |
| Menores | La ley no dice nada; CCF arts. 646 y 450 | Cuentas: 18 años o autorización |
| Domicilio | 15, fr. I sin precisar; Lineamientos: completo y el de oír y recibir notificaciones | `{{DOMICILIO}}`; opciones en `INVESTIGACION_LEGAL.md` §5 |

**Sin cuentas:** la app no recaba datos; Vercel recibe la IP de cada visita. **[Opinión]** Puede bastar para que haga falta aviso (art. 2,
fr. V); se mantiene uno breve que lo dice (`INVESTIGACION_LEGAL.md` §2.7).

---

## 3. Aviso de privacidad (borrador)

### 3.1 Aviso de privacidad integral

> **Aviso de privacidad de {{NOMBRE_APP}}**
> Última actualización: {{FECHA_ACTUALIZACION}}
>
> **Quién es responsable.** Yo, {{RESPONSABLE}}, persona física, con domicilio para oír y recibir notificaciones en {{DOMICILIO}}, soy
> responsable de los datos personales que se tratan en {{NOMBRE_APP}} ({{URL_APP}}). Para cualquier asunto de privacidad escríbeme a
> {{CORREO_PRIVACIDAD}}.
>
> **Lo que nunca sale de tu dispositivo.** Tus archivos de audio: la app los lee en tu navegador y no los sube a ningún servidor. Tampoco
> salen tu biblioteca, las letras y portadas, lo que edites de tus canciones, tu cola, tus ajustes ni el nombre y la foto de perfil que pongas: se guardan en el
> almacenamiento de tu navegador y los borras desde Ajustes → Privacidad y datos. No uso cookies, analítica, publicidad ni herramientas
> de rastreo.
>
> **Al visitar la web.** La web está alojada en Vercel, que, como cualquier servidor, recibe la dirección IP y datos técnicos de tu
> navegador para entregarte la página, y puede deducir de la IP tu país y ciudad aproximados. No uso esos datos para
> identificarte ni los combino con nada, y Vercel los conserva según su propia política.
>
> <!-- sin cuentas -->
> **Esta versión de la app no tiene cuentas,** así que no te pido ni recabo ningún otro dato personal. Lo único que llega a un servidor
> es lo descrito en «Al visitar la web», y su única finalidad es entregarte la página.
> <!-- /sin cuentas -->
> <!-- cuentas -->
> **Si usas la app sin cuenta,** no trato más datos que los de «Al visitar la web».
>
> **Si creas una cuenta,** trato:
> - Tu correo y tu contraseña (guardada cifrada; nadie puede leerla).
> - El nombre visible que elijas. Si no escribes ninguno, por ahora se guarda la parte de tu correo antes de la «@».
> - Las fechas de registro, confirmación y último acceso, y la dirección IP y el navegador de cada sesión, que quedan en un registro de
>   seguridad.
> - Tus playlists sincronizadas: su nombre y, por cada canción, el título, el artista, el álbum y la duración que trae tu archivo, o una
>   huella del archivo que no permite reconstruirlo. Nunca recibo los archivos de audio. Las playlists que ya tenías antes de iniciar
>   sesión solo se suben si eliges «Subir».
>
> No trato datos personales sensibles.
>
> **Para qué.** Solo para: (a) crear y mantener tu cuenta; (b) sincronizar tus playlists entre tus dispositivos; (c) proteger tu cuenta y
> el servicio (detectar accesos indebidos y limitar intentos); (d) enviarte los correos necesarios del servicio, como la confirmación de
> registro o un aviso de seguridad. Son necesarias para darte lo que pides; no hay finalidades secundarias: no uso tus datos para
> publicidad ni perfiles y no los vendo.
>
> **Quién me ayuda.** Dos proveedores tratan datos por mi cuenta y bajo mis instrucciones: Supabase (autenticación, base de datos y
> correos de la cuenta), con servidores en Estados Unidos, y Vercel (alojamiento de la web). No transfiero tus datos a terceros; solo los
> entregaría si una autoridad competente lo ordena conforme a la ley.
>
> **Cuánto tiempo.** Mientras tengas tu cuenta. Puedes pedir su eliminación en cualquier momento (ver «Tus derechos»): es una solicitud de
> cancelación y se rige por los mismos plazos. Los registros técnicos y las copias de respaldo de los proveedores pueden conservar datos
> durante el tiempo que fijen sus políticas, hasta que se sobrescriban.
>
> **[Decides tú]** Si se quiere un plazo de borrado más corto que el legal, ponerlo aquí. **[Abogado]** Si hay que bloquear (no borrar) algún
> dato durante un plazo de prescripción.
> <!-- /cuentas -->
>
> **Si aportas con «Comprar un café».** El pago se hace en la página de un procesador de pagos, fuera de la app, y se rige por su propio
> aviso de privacidad. De esa operación recibo solo lo que el procesador me muestre, y lo uso únicamente para registrar la aportación,
> atender aclaraciones y cumplir mis obligaciones fiscales.
>
> **[Decides tú]** Este párrafo solo tiene sentido con el café publicado; confirmar contra Stripe qué datos se ven (nombre, correo, importe).
> **[Abogado]** Si el importe cuenta como dato patrimonial y exige consentimiento expreso (art. 7).
>
> **Tus derechos.** Puedes pedirme acceso, rectificación, cancelación u oposición, o revocar tu consentimiento, escribiendo a
> {{CORREO_PRIVACIDAD}}.
> <!-- cuentas -->
> Escríbeme desde el correo de tu cuenta, que me sirve para comprobar que eres tú.
> <!-- /cuentas -->
> Indica tu nombre, un medio para responderte, qué datos y qué derecho quieres ejercer y, si es una rectificación, el dato correcto. Te
> respondo en un máximo de 20 días hábiles y, si procede, lo aplico en los 15 días hábiles siguientes; si un caso lo justifica, puedo
> ampliar cada plazo una sola vez por el mismo tiempo y te lo diré. Es gratuito.
> <!-- cuentas -->
> En la app también puedes cerrar sesión, borrar tus playlists, descargar lo que guarda tu cuenta (Ajustes → Privacidad y datos → Datos
> de tu cuenta) y borrar todos los datos de tu dispositivo.
>
> **Menores de edad.** Para crear una cuenta hay que tener 18 años o la autorización de madre, padre o tutor. Si sé que una persona menor
> creó una cuenta sin esa autorización, la eliminaré.
>
> **Seguridad.** La conexión va cifrada (HTTPS), la contraseña se guarda cifrada y la base de datos solo deja a cada cuenta leer y cambiar
> sus propios datos. Si ocurre una vulneración que afecte de forma significativa tus derechos, te avisaré por correo de inmediato.
> <!-- /cuentas -->
> <!-- sin cuentas -->
> Desde la app también puedes borrar tus playlists y todos los datos de tu dispositivo.
> <!-- /sin cuentas -->
>
> **Si no estás conforme** con mi respuesta, o no te respondo a tiempo, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno en
> los 15 días hábiles siguientes a mi respuesta o al vencimiento del plazo.
>
> **Cambios a este aviso.** Publicaré cada versión con su fecha en {{URL_APP}}/privacidad.
> <!-- cuentas -->
> Si un cambio afecta lo que hago con tus datos, te avisaré por correo antes de aplicarlo, y si quisiera usarlos para algo nuevo te
> pediría tu consentimiento.
> <!-- /cuentas -->

### 3.2 Aviso simplificado (bajo «Crear cuenta»)

> {{RESPONSABLE}}, con domicilio en {{DOMICILIO}}, usa tu correo, tu nombre visible, los datos de tus sesiones y tus playlists
> sincronizadas solo para darte tu cuenta, protegerla y sincronizar entre tus dispositivos. Tu música no se sube. Puedes limitar el uso
> o borrar tus datos escribiendo a {{CORREO_PRIVACIDAD}}. Aviso completo: {{URL_APP}}/privacidad.

**No implementado:** el formulario de registro (`src/ui/dialogs.tsx`) aún no muestra este texto ni la casilla de los términos (S-17 de
`PLAN_SEGURIDAD.md`). Requisito antes de abrir cuentas.

---

## 4. Términos y condiciones

Desde el 2026-11-16 viven en `TERMINOS.md` (fuente de `/terminos`), con su fundamento por cláusula. Este archivo ya no los contiene.

---

## 5. Política de cookies y almacenamiento local (borrador)

**No hace falta banner de cookies.** La app no usa cookies, ni propias ni de terceros, ni ninguna tecnología de rastreo. Lo que guarda
en el navegador es lo que la persona pide al usarla (su biblioteca, sus ajustes, su sesión) y no se usa para nada más. Un banner
aquí sería ruido y daría a entender un rastreo que no existe.

Basta con esta página (`/almacenamiento`; hoy solo accesible por su dirección, sin enlace):

> **Cookies y almacenamiento local**
>
> {{NOMBRE_APP}} no usa cookies ni herramientas de rastreo.
>
> Para recordar tu música y tus ajustes sin pedirte una cuenta, guarda en el almacenamiento de tu navegador:
>
> | Qué | Para qué | Cómo borrarlo |
> |---|---|---|
> | Tu biblioteca: datos de cada canción (título, artista, portada, letra, ruta dentro de la carpeta que elegiste) y el permiso para leer esa carpeta | Que no tengas que volver a añadir tu música cada vez | Ajustes → Biblioteca → quitar la carpeta |
> | Lo que cambies en «Editar información» (título, artista, álbum y demás datos, y la carátula que elijas, reducida y sin sus metadatos). Tus archivos no se modifican | Que la app muestre tus cambios | «Restablecer» en «Editar información», o Ajustes → Privacidad y datos → Borrar datos de este dispositivo |
> | Copias de tus archivos, solo en navegadores que no permiten recordar carpetas (Firefox, Safari) | Que tu música siga disponible al volver | Ídem |
> | Playlists, cola, posición de reproducción y ajustes de sonido y fondo | Que la app esté como la dejaste | Ajustes → Privacidad y datos → Borrar datos de este dispositivo |
> | Tu nombre y tu foto de perfil, si los pones (la foto se guarda reducida y sin sus metadatos) | Mostrarlos en la app | Ajustes → Perfil, o Ajustes → Privacidad y datos → Borrar datos de este dispositivo |
> <!-- cuentas -->
> | Tu sesión, si iniciaste sesión | No pedirte la contraseña cada vez | Cerrar sesión |
>
> Nada de esto me llega, salvo tus playlists si tienes cuenta (ver el aviso de privacidad).
> <!-- /cuentas -->
> <!-- sin cuentas -->
>
> Nada de esto me llega.
> <!-- /sin cuentas -->

**Si algún día se añade analítica:** elegir una que no use cookies ni identificadores persistentes (ver `AJUSTES_PRIVACIDAD.md` §4) y,
aun así, ofrecerla como opción activada por la persona. Entonces esta página y el aviso se actualizan antes de publicarla.

---

## 6. Si hay usuarios en la Unión Europea

> **Decisión 2026-11-12 (L8):** no se dirige a la UE por ahora, así que esta sección queda como referencia y no se aplica al aviso. Se reabre si cambia.

El RGPD (Reglamento (UE) 2016/679, [eur-lex.europa.eu/eli/reg/2016/679/oj](https://eur-lex.europa.eu/eli/reg/2016/679/oj); no lo
releí en esta sesión) aplica a un responsable fuera de la UE cuando **ofrece** bienes o servicios a personas en la UE (art. 3.2).
Una web en español accesible desde España no basta por sí sola; anunciarse allí, aceptar euros o redactar para ese público sí
inclinaría la balanza. **[Abogado]** si es tu caso.

Si aplica, el borrador necesita:

| Ajuste | Por qué |
|---|---|
| Base jurídica por finalidad: ejecución de contrato (art. 6.1.b) para la cuenta y la sincronización; interés legítimo para seguridad | El RGPD no tiene "consentimiento tácito"; exige nombrar la base |
| Plazos de conservación concretos, derecho a reclamar ante una autoridad de control, derecho de **portabilidad** (art. 20) | Contenido mínimo del art. 13, más amplio que el art. 15 de la ley mexicana |
| Garantía de las transferencias a EE. UU.: cláusulas contractuales tipo | El DPA de Supabase (versión del 1-8-2026) incorpora las cláusulas tipo al aceptar sus términos ([supabase.com/legal/dpa](https://supabase.com/legal/dpa)) |
| **Vercel en plan Pro** | El DPA de Vercel se aplica a clientes de los planes Pro y Enterprise ([vercel.com/legal/dpa](https://vercel.com/legal/dpa), actualizado el 17-3-2026). En Hobby no hay DPA |
| Representante en la UE (art. 27) | Obligatorio salvo tratamiento ocasional y de bajo riesgo. **[Abogado]** si encaja en la excepción |
| Edad mínima de 16 años (los Estados pueden bajarla hasta 13; art. 8) | Para servicios de la sociedad de la información basados en consentimiento |
| Banner de cookies | **Sigue sin hacer falta**: la Directiva ePrivacy exime el almacenamiento estrictamente necesario para el servicio que la persona pide |

Y en la app: un botón "Eliminar cuenta" y una exportación de los datos de la cuenta (portabilidad). Ambos están especificados en
`AJUSTES_PRIVACIDAD.md`.

---

## 7. Decisiones

| # | Decisión | Estado |
|---|---|---|
| L1 | Responsable: persona física, nombre completo (`{{RESPONSABLE}}`) | **Resuelta** 2026-11-12; reconfirmada 2026-11-16 |
| L2 | Domicilio (`{{DOMICILIO}}`) | **Resuelta 2026-11-16: domicilio particular**, tras ver las opciones (oficina virtual, despacho, persona moral) en `INVESTIGACION_LEGAL.md` §5. Se puede cambiar sin tocar el texto: solo el valor en `privado/` |
| L3 | Correo (`{{CORREO_PRIVACIDAD}}`) | **Resuelta 2026-11-16:** alias en el dominio propio, ya funcional (valor en `privado/`). Sirve también para términos y avisos de derechos de autor |
| L4 | Plazo de borrado tras eliminar la cuenta | **Propuesta:** los del art. 31 (20 + 15 días hábiles), porque eliminar la cuenta es una cancelación. Pendiente si se quiere uno más corto |
| L5 | Edad mínima | **Propuesta:** 18 años o autorización de madre, padre o tutor (solo con cuentas). Pendiente de confirmar |
| L6 | Licencia del código | **Resuelta** 2026-11-12: PolyForm Noncommercial 1.0.0. Su relación con los términos, en `TERMINOS.md` cláusula 5 |
| L7 | Tribunales | **Resuelta 2026-11-16:** leyes de México sin fijar ciudad (`TERMINOS.md` cláusula 17) |
| L8 | Unión Europea | **Resuelta** 2026-11-12: no se dirige a la UE; §6 no aplica |
| L9 | «Eliminar cuenta» y «Datos de tu cuenta» en la app antes de abrir registros | **Resuelta** 2026-11-12. «Datos de tu cuenta» existe; «Eliminar cuenta», no |

## 8. Lo omitido y los riesgos

- **Antes de abrir cuentas** (bloqueante): aviso simplificado y casilla de términos en el registro, con registro de la versión aceptada;
  «Eliminar cuenta» en la app; aplicar la migración que deja vacío el nombre visible en vez de copiar el correo (o mantener la frase del
  aviso que lo dice); separar el proyecto de Supabase si la otra app que lo comparte tiene otro responsable (`SUPABASE.md`); SMTP propio
  para que los correos no salgan del remitente genérico (D9). Lista priorizada en `REVISION_ABOGADO.md`.
- **No verificado:** vigencia de los Lineamientos de 2013 y si hay Reglamento nuevo; retención de IP de Vercel y plan del proyecto; qué
  datos ve el responsable en Stripe.
- **No cubierto:** la app nativa (Google Play pide su formulario de seguridad de datos y borrado de cuenta dentro de la app y por web).
