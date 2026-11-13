# Borradores legales: aviso de privacidad, términos y almacenamiento local

> **Esto es un borrador para que lo revise un abogado.** No es asesoría legal ni está listo para publicarse. Lo escribí a partir del
> código de la rama `desarrollo` (12 de noviembre de 2026) y del texto vigente de la ley. Todo lo marcado **[Decides tú]** necesita
> una decisión tuya antes de la revisión; lo marcado **[Abogado]** es una duda jurídica que no puedo resolver con el texto de la ley.

Los textos para publicar están en las secciones 3, 4 y 5. Las secciones 1 y 2 son la base que el abogado necesita para revisarlos.

---

## 1. Inventario: qué datos existen y dónde viven

Todo lo demás parte de esta tabla. Se comprobó leyendo el código (`src/platform/web/db.ts`, `src/platform/web/index.ts`,
`src/platform/web/library.ts`, `src/state/*.ts`, `src/sync/*.ts`), la CSP de `vercel.json`, las migraciones de `supabase/migrations/`
y, con una consulta de solo lectura al esquema `auth` del proyecto de Supabase, las columnas que guarda el servicio de autenticación.

### 1.1 En el dispositivo (no sale de él)

| Dónde | Qué guarda | Cuándo | Cómo se borra hoy |
|---|---|---|---|
| IndexedDB `reproductor`, almacén `kv` | `audio` (ecualizador, volumen, velocidad, fundidos, ReplayGain), `background` (fondo, HDR, reducir movimiento), `session` (cola de reproducción y posición), `position` (pista y segundo actuales) | Al cambiar un ajuste o al reproducir | Ajustes → Datos locales → Borrar datos locales |
| IndexedDB, almacén `tracks` | Por pista: título, artista, álbum, artista del álbum, año, género, número de pista, duración, formato y calidad, ReplayGain, letras, nombre de archivo, ruta relativa dentro de la carpeta elegida, tamaño, fecha de modificación, huella `track:v2` (SHA-256 de partes del archivo), fecha en que se añadió y **fecha de la última reproducción** (`playedAt`, un solo valor por pista, no un historial) | Al añadir música o reproducir | Quitar la carpeta, o borrar datos locales |
| IndexedDB, almacén `roots` | Nombre de cada carpeta elegida y su permiso de acceso (`FileSystemDirectoryHandle`) | Al elegir una carpeta | Ídem |
| IndexedDB, almacén `covers` | Portadas extraídas de los archivos y sus miniaturas (96 y 600 px) | Al leer metadatos | Ídem |
| IndexedDB, almacén `playlists` | Nombre de cada playlist, identidades de sus pistas, dueño (id de usuario o ninguno) | Al crear o editar playlists | Borrar datos locales (si hay sesión, las de la cuenta vuelven a bajar) |
| IndexedDB, almacén `outbox` | Cambios de playlists pendientes de subir, con el id de usuario | Si hay sesión y el cambio aún no llega a Supabase | Se vacía al sincronizar o al borrar datos locales |
| OPFS (almacenamiento privado del navegador), carpeta `biblioteca/` | **Copia de los archivos de audio**, solo cuando el navegador no permite recordar la carpeta original (Firefox, Safari) | Al añadir música en esos navegadores | Quitar la carpeta, o borrar datos locales |
| `localStorage`, clave `sb-<proyecto>-auth-token` | Sesión de Supabase: token de acceso, token de renovación y datos de la cuenta, incluido el correo | Al iniciar sesión (comportamiento por defecto de `supabase-js` con `persistSession: true`; el código no define otro almacenamiento) | Cerrar sesión. **Borrar datos locales no la quita** (ver `AJUSTES_PRIVACIDAD.md`) |
| Memoria | Archivos añadidos sueltos cuando no se pueden guardar | Durante la sesión | Al recargar |
| Sistema operativo (Media Session) | Título, artista, álbum y portada de la pista actual, para la pantalla de bloqueo y los controles del sistema | Al reproducir | Lo gestiona el sistema operativo; no pasa por ningún servidor |

### 1.2 Fuera del dispositivo

| Quién | Dónde | Qué recibe | Cuándo |
|---|---|---|---|
| **Supabase** (autenticación y base de datos) | Proyecto en `us-east-1`, **Estados Unidos** | Correo, contraseña cifrada (hash), nombre visible (`display_name`), fechas de alta, confirmación y último acceso; por sesión, **dirección IP y navegador** (`auth.sessions.ip`, `user_agent`); registro de auditoría con IP (`auth.audit_log_entries.ip_address`); tablas de la app: `profiles` (nombre visible; `avatar_url` existe pero la app no la usa), `playlists` (nombre), `playlist_tracks` (identidad de cada pista y posición) | Solo si la persona crea una cuenta |
| Supabase (correo) | Ídem | Correo de confirmación de registro, enviado con el servidor de correo integrado de Supabase (no hay SMTP propio todavía, ver D9 en `DECISIONES_PENDIENTES.md`) | Al registrarse |
| **Vercel** (alojamiento) | Red global | La petición HTTP de cada archivo de la web: IP, navegador, ruta. Es inherente a servir una página. No hay funciones de servidor ni analítica de Vercel activas. **No verifiqué si Vercel conserva esas IP ni cuánto tiempo** | Cada visita |

**Detalle importante sobre las playlists sincronizadas:** la identidad `track:v1` es `título|artista|álbum|duración` en texto
(`src/core/track.ts`). Es decir, la nube no recibe audio, pero **sí recibe los títulos y artistas** de las canciones de cada playlist.
Eso debe decirse en el aviso: revela gustos musicales.

### 1.3 Lo que no existe (comprobado)

- **Cookies:** la app no crea ninguna. `supabase-js` guarda la sesión en `localStorage`, no en cookies.
- **Analítica, publicidad, rastreo, píxeles, reporte de errores a terceros:** no hay. La CSP (`connect-src 'self'` + el dominio de
  Supabase) impediría cualquier otra conexión aunque alguien añadiera el script.
- **Fuentes, scripts o imágenes de terceros:** la tipografía va empaquetada (`@fontsource`) y todo se sirve desde el propio dominio.
- **Audio en servidores:** los archivos se leen en el dispositivo y nunca se suben (`AGENTS.md` §5, `docs/COPY_LANDING.md`).
- **Recuperación de contraseña, cambio de correo, borrado de cuenta y edición de perfil desde la app:** no están implementados.
  Hoy el borrado de cuenta solo puede hacerse a mano desde el panel de Supabase.
- **Datos sensibles** en el sentido del artículo 2, fracción VI, de la ley: no se piden. **[Abogado]** Los títulos de canciones
  de una playlist podrían revelar creencias religiosas o políticas (música religiosa, himnos de partido). Conviene que el abogado
  diga si eso basta para tratarlos como sensibles; mi lectura es que no, porque la app no los interpreta ni los clasifica.

---

## 2. Ley aplicable en México

**Ley vigente:** Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), **nueva ley publicada en el
DOF el 20 de marzo de 2025**, en vigor al día siguiente (transitorio Primero). Abrogó la ley de 2010 (transitorio Segundo, fracción I).
Última reforma: DOF 14 de noviembre de 2025, que solo modificó el artículo 4 (ley supletoria: Código Nacional de Procedimientos Civiles
y Familiares). Fuente: texto vigente de la Cámara de Diputados,
[diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), leído el 12-11-2026.

**Autoridad:** la **Secretaría Anticorrupción y Buen Gobierno** (art. 2, fr. XV; arts. 38 y 39). Sustituye al INAI. Contra sus
resoluciones procede el juicio de amparo (art. 51).

Lo que importa para esta app:

| Tema | Qué dice la ley | Consecuencia aquí |
|---|---|---|
| ¿Aplica? | Sí. La excepción del art. 1, fr. II es solo para uso personal sin divulgación ni uso comercial; esta app guarda datos de terceros (las cuentas) | Hace falta aviso de privacidad |
| Consentimiento | Tácito por regla general (art. 7); no hace falta cuando los datos se requieren para cumplir la relación jurídica con el titular (art. 9, fr. IV). Expreso para datos financieros o patrimoniales (art. 7) | La cuenta y la sincronización entran en el art. 9, fr. IV. Si algún día cobras directamente, los datos de pago requieren consentimiento expreso (o los gestiona la pasarela) |
| Revocación | Se puede revocar en cualquier momento; el aviso debe decir cómo (art. 7) | Incluir el medio en el aviso |
| Contenido del aviso | Identidad y domicilio; datos tratados; finalidades; opciones para limitar uso; medios ARCO; cómo se avisarán cambios (art. 15, fr. I a VI) | Sección 3 |
| Aviso simplificado | Si los datos se obtienen por medios electrónicos, se da en modalidad simplificada (fr. I a IV del art. 15) con enlace al integral (art. 16, fr. II) | Va en el formulario de registro (sección 3.2) |
| Seguridad | Medidas administrativas, técnicas y físicas (art. 18). Las vulneraciones que afecten de forma significativa al titular se le informan de inmediato (art. 19) | Tener un procedimiento de aviso por correo |
| Derechos ARCO | Acceso, rectificación, cancelación, oposición (arts. 21 a 26). Respuesta en **20 días hábiles** y ejecución en los **15 siguientes** (art. 31; "días" son hábiles, art. 2, fr. VIII). Gratuitos salvo costos de envío o copia (art. 34) | Un correo de contacto y, mejor, botones en la app |
| Persona encargada vs. transferencia | Quien trata datos por cuenta del responsable es "persona encargada" (art. 2, fr. XII). Transferencia es la comunicación a alguien distinto del titular, el responsable o el encargado (art. 2, fr. XX). Las transferencias requieren cláusula en el aviso (art. 35) salvo los supuestos del art. 36 | Supabase y Vercel actúan como encargados: **no son transferencias**. Hoy no hay transferencias |
| Sanciones | Multas de 100 a 320,000 UMA según la infracción (art. 59) | — |

**[Abogado]** La ley remite a un Reglamento en varios puntos (arts. 17, 40, 41, 49, 54, 57). No verifiqué si ya se publicó un
Reglamento nuevo para la ley de 2025 ni qué exige sobre la relación con encargados (la ley de 2010 pedía formalizarla por contrato).
Pregunta concreta: ¿basta aceptar los términos y el DPA de Supabase y Vercel?

---

## 3. Aviso de privacidad (borrador)

### 3.1 Aviso de privacidad integral

> **Aviso de privacidad de [Nombre de la app]**
> Última actualización: [fecha]
>
> **Quién es responsable.** {{RESPONSABLE}}, con domicilio en {{DOMICILIO}}, es responsable de los datos personales
> que se tratan en [Nombre de la app] ("la app"). Contacto para cualquier asunto de privacidad: {{CORREO_PRIVACIDAD}}.
>
> **Lo que no recabamos.** Tu música no sale de tu dispositivo: la app lee los archivos en tu navegador y no los sube a ningún
> servidor. Tampoco usamos cookies, analítica, publicidad ni herramientas de rastreo.
>
> **Si usas la app sin cuenta,** no tratamos ningún dato personal tuyo. Tu biblioteca, playlists, cola y ajustes se guardan solo en
> el almacenamiento de tu navegador y puedes borrarlos desde Ajustes → Datos locales.
>
> **Si creas una cuenta,** tratamos:
> - Correo electrónico y contraseña (la contraseña se guarda cifrada; nadie puede leerla).
> - El nombre visible que elijas.
> - Fechas de registro, confirmación y último acceso; dirección IP y tipo de navegador de cada sesión iniciada.
> - Tus playlists sincronizadas: su nombre y, por cada canción, el título, artista, álbum y duración tal como aparecen en tus
>   archivos. No recibimos los archivos de audio.
>
> No tratamos datos personales sensibles.
>
> **Para qué.** Usamos estos datos solo para: (a) crear y mantener tu cuenta; (b) sincronizar tus playlists entre tus dispositivos;
> (c) proteger tu cuenta (detectar accesos indebidos y limitar intentos); (d) enviarte correos necesarios del servicio, como la
> confirmación de registro o un aviso de seguridad. Estas finalidades son necesarias para darte el servicio que pides. No hay
> finalidades secundarias: no usamos tus datos para publicidad, perfiles comerciales ni los vendemos.
> **[Decides tú]** Si algún día añades analítica o correos de novedades, se agregan aquí como finalidades secundarias con su propia
> casilla, desactivada por defecto.
>
> **Con quién.** Nos apoyamos en dos proveedores que tratan datos por nuestra cuenta y bajo nuestras instrucciones:
> - Supabase, Inc. (autenticación y base de datos), con servidores en Estados Unidos.
> - Vercel, Inc. (alojamiento de la web), que recibe la dirección IP de cada visita para entregar la página.
>
> No transferimos tus datos a terceros. Solo los entregaríamos si una autoridad competente lo ordena conforme a la ley.
>
> **Cuánto tiempo.** Mientras tengas cuenta. Si la eliminas, borramos tus datos en un máximo de [30] días, salvo lo que debamos
> conservar por obligación legal. **[Decides tú]** el plazo; **[Abogado]** si hay obligación de conservar algo.
>
> **Tus derechos (ARCO).** Puedes pedir acceso, rectificación, cancelación u oposición, o revocar tu consentimiento, escribiendo a
> {{CORREO_PRIVACIDAD}} desde el correo de tu cuenta, con tu nombre, lo que pides y, si es rectificación, el dato correcto.
> Respondemos en un máximo de 20 días hábiles y, si procede, lo aplicamos en los 15 días hábiles siguientes. Es gratuito.
> Desde la app también puedes: cerrar sesión, borrar tus playlists y borrar todos los datos de tu dispositivo.
> **[Decides tú]** Cuando exista "Eliminar cuenta" en la app, mencionarlo aquí.
>
> **Si no estás conforme** con nuestra respuesta, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno.
>
> **Cambios a este aviso.** Publicaremos cualquier cambio en [URL]/privacidad con su fecha. Si el cambio afecta a lo que hacemos con
> tus datos, te avisaremos por correo antes de aplicarlo.

### 3.2 Aviso simplificado (bajo el botón de registro)

> {{RESPONSABLE}} usa tu correo, tu nombre visible y tus playlists sincronizadas solo para darte tu cuenta y sincronizar
> entre dispositivos. Tu música no se sube. Puedes limitar el uso o borrar tus datos escribiendo a {{CORREO_PRIVACIDAD}}. Aviso completo:
> [URL]/privacidad.

---

## 4. Términos y condiciones (borrador)

> **Términos de uso de [Nombre de la app]**
> Última actualización: [fecha]
>
> **1. Qué es.** [Nombre de la app] es un reproductor de música que funciona en tu navegador con archivos que ya tienes. La app no
> vende, presta ni distribuye música. La cuenta es opcional y solo sirve para sincronizar playlists.
>
> **2. Tu música es tu responsabilidad.** Solo debes reproducir archivos que tengas derecho a usar. La app no sube tus archivos ni
> verifica su origen.
>
> **3. Tu cuenta.** Debes dar un correo válido y cuidar tu contraseña. Puedes dejar de usar la cuenta y pedir su eliminación en
> cualquier momento. Podemos suspender una cuenta que se use para atacar el servicio o a otras personas (por ejemplo, intentos
> automatizados de acceso o abuso de la sincronización).
> **[Decides tú]** edad mínima. Sugerencia: 13 años con autorización de padre, madre o tutor hasta los 18. **[Abogado]** validez de
> esa fórmula en México.
>
> **4. Licencia de uso.** Te damos permiso personal, gratuito y no exclusivo para usar la app. No puedes usarla para ofrecer un
> servicio a terceros ni intentar saltarte sus límites técnicos.
> El código fuente se publica bajo la **PolyForm Noncommercial License 1.0.0** (archivo `LICENSE` del repositorio): se puede leer,
> usar y modificar sin fines comerciales; usarlo para vender o lucrar requiere permiso del titular. **[Abogado]** si esta cláusula y
> la licencia son coherentes entre sí y qué cuenta como «no comercial» (por ejemplo, un uso interno en una empresa).
>
> **5. Disponibilidad.** La app se ofrece tal como está, sin garantía de que funcione en todos los navegadores o dispositivos ni de
> que esté siempre disponible. Lo que guardas en tu navegador depende de él: si borras sus datos o el navegador libera espacio,
> puede perderse. Usa la copia de seguridad (Ajustes → Datos locales) para conservar tus playlists y ajustes.
>
> **6. Límite de responsabilidad.** En la medida en que la ley lo permita, no respondemos por pérdida de datos guardados en tu
> dispositivo ni por fallos del navegador o del sistema operativo. **[Abogado]** alcance frente a la Ley Federal de Protección al
> Consumidor, sobre todo si hay funciones de pago.
>
> **7. Apoyo voluntario.** Si eliges apoyar el proyecto con una aportación, es voluntaria y no te da derecho a funciones, soporte
> prioritario ni reembolsos, salvo error en el cobro. **[Decides tú]** política de reembolso; **[Abogado]** tratamiento fiscal y de
> consumo de las aportaciones (ver `MONETIZACION.md`).
>
> **8. Cambios.** Publicaremos los cambios con su fecha en [URL]/terminos. Si son relevantes, avisaremos por correo a quien tenga
> cuenta con al menos [15] días de anticipación.
>
> **9. Ley y jurisdicción.** Estos términos se rigen por las leyes de México. **[Decides tú]** tribunales competentes (por ejemplo,
> los de [ciudad]). **[Abogado]** si esa cláusula es válida frente a consumidores.
>
> **10. Contacto.** {{CORREO_PRIVACIDAD}}.

---

## 5. Política de cookies y almacenamiento local (borrador)

**No hace falta banner de cookies.** La app no usa cookies, ni propias ni de terceros, ni ninguna tecnología de rastreo. Lo que guarda
en el navegador es lo que la persona pide al usarla (su biblioteca, sus ajustes, su sesión) y no se usa para nada más. Un banner
aquí sería ruido y daría a entender un rastreo que no existe.

Basta con esta página, enlazada desde el pie de la landing y desde Ajustes:

> **Cookies y almacenamiento local**
>
> [Nombre de la app] no usa cookies ni herramientas de rastreo.
>
> Para funcionar sin conexión y sin cuenta, guarda en el almacenamiento de tu navegador:
>
> | Qué | Para qué | Cómo borrarlo |
> |---|---|---|
> | Tu biblioteca: datos de cada canción (título, artista, portada, ruta dentro de la carpeta que elegiste) y el permiso para leer esa carpeta | Que no tengas que volver a añadir tu música cada vez | Ajustes → Biblioteca → quitar la carpeta |
> | Copias de tus archivos, solo en navegadores que no permiten recordar carpetas (Firefox, Safari) | Que tu música siga disponible al volver | Ídem |
> | Playlists, cola, posición de reproducción y ajustes de sonido y fondo | Que la app esté como la dejaste | Ajustes → Datos locales → Borrar datos locales |
> | Tu sesión, si iniciaste sesión | No pedirte la contraseña cada vez | Cerrar sesión |
>
> Nada de esto se envía a nosotros, salvo tus playlists si tienes cuenta (ver el aviso de privacidad).

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

## 7. Decisiones tuyas

| # | Decisión | Por qué importa |
|---|---|---|
| L1 | **Resuelta 2026-11-12:** persona física. Responsable: `{{RESPONSABLE}}` | Va en la primera línea del aviso |
| L2 | **Resuelta 2026-11-12:** se publica el domicilio particular, `{{DOMICILIO}}`. **[Pendiente: confirmar con el abogado que basta]** | Art. 15, fr. I |
| L3 | **Resuelta en parte 2026-11-12:** `{{CORREO_PRIVACIDAD}}` es un correo temporal de Gmail. **[Pendiente: correo en el dominio propio, cuando exista]** | Medio ARCO |
| L4 | Plazo de borrado tras eliminar la cuenta | Aviso, sección "Cuánto tiempo" |
| L5 | Edad mínima | Términos, cláusula 3 |
| L6 | **Resuelta 2026-11-12:** PolyForm Noncommercial 1.0.0, repositorio público; archivo `LICENSE` añadido con `{{RESPONSABLE}}` como titular. **[Pendiente: completar el titular al publicar; revisión del abogado]** | Términos, cláusula 4 |
| L7 | Tribunales competentes | Términos, cláusula 9 |
| L8 | **Resuelta 2026-11-12:** no se dirige a la UE por ahora; la sección 6 **no aplica hasta que eso cambie** (se reabre si se anuncia allí, se aceptan euros o se traduce para ese público). Versión en inglés: después, cuando haya nombre en inglés | Sección 6 |
| L9 | **Resuelta 2026-11-12:** sí, «Eliminar cuenta» y «Datos de tu cuenta» se implementan **antes de abrir registros** | Aviso, sección «Tus derechos» |

## 8. Lo omitido y los riesgos

- **No verifiqué** si ya existe un Reglamento de la ley de 2025, ni la política de retención de IP de Vercel en sitios estáticos.
- **No cubrí** la app nativa: Google Play pide su propio formulario de seguridad de datos y borrado de cuenta dentro de la app y por
  enlace web (`PLAN.md`, Fase 11). Cuando exista, el inventario cambia (Keystore, permisos de almacenamiento).
- **Riesgo actual:** el proyecto de Supabase es compartido con otra app (`SUPABASE.md`). Para el aviso, ambas apps tienen el mismo
  encargado y la misma región; si la otra app tiene otro responsable, hay que separar proyectos antes de publicar el aviso.
- **Riesgo actual:** no hay forma de eliminar la cuenta desde la app. Un aviso que promete borrar en 30 días obliga a hacerlo a mano.
- **Riesgo actual:** el correo de confirmación sale del remitente genérico de Supabase; parece suplantación y no lleva el nombre del
  responsable. Se resuelve con SMTP propio (D9).
