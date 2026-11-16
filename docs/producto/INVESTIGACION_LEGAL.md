# Investigación legal: cómo proteger a Satin sin cláusulas que se caigan

> **No es asesoría jurídica.** Es la investigación de una persona que no es abogada, hecha para preparar la revisión con una que sí lo sea
> (`REVISION_ABOGADO.md`). Fecha de consulta de todas las fuentes: **16-11-2026**, salvo que se diga otra. Las leyes se leyeron en el texto
> vigente que publica la Cámara de Diputados (PDF descargado y convertido a texto en local); las páginas de empresas, en su sitio oficial.
> Cada dato lleva su marca: **[Firme]** leído en la fuente citada; **[Opinión]** lectura propia, discutible; **[No confirmado]** no se pudo
> leer o verificar.

**Idea rectora.** «Blindaje» no es inmunidad. Ninguna cláusula vale contra el dolo (Código Civil Federal, art. 2106: la renuncia a esa
responsabilidad «es nula») ni contra normas de orden público como la Ley Federal de Protección al Consumidor (art. 1: sus disposiciones
«son irrenunciables»), y en un contrato de adhesión las cláusulas abusivas «se tendrán por no puestas» (LFPC, art. 90). Un texto que
resiste es el que **describe con exactitud lo que la app hace**, reparte responsabilidades donde de verdad están y limita lo que la ley
deja limitar. Un texto duro que promete de más o excluye lo inexcluible se cae entero en la parte que importa.

---

## 1. Cómo se protegen productos comparables

Se leyeron las páginas legales oficiales. Las ideas se resumen con palabras propias; **no se copió texto**.

| Producto | Tipo | Contenido que el usuario reproduce o sube | Derechos de autor y avisos | Garantías | Límite de responsabilidad | Ley y jurisdicción | Edad mínima | Fuente |
|---|---|---|---|---|---|---|---|---|
| **VLC** (VideoLAN) | Reproductor local, software libre | No hay términos de uso; declina responsabilidad por usos ilegales del programa | Sin procedimiento de avisos. Separa la licencia del código (GPL/LGPL) de las **marcas**, que solo autoriza en redistribuciones libres; explica su postura sobre patentes y DRM con decisiones francesas | No hay cláusula propia (la da la GPL) | Sin tope | Ley francesa; prevalece la versión francesa | No aparece | videolan.org/legal.html |
| **Poweramp** | Reproductor local (Android, de pago) | Solo política de privacidad: el usuario responde de los datos de terceros que comparta | No aparece | No aparece | No aparece | Titular en Dubái; sin cláusula de jurisdicción | No aparece | powerampapp.com; su política en iubenda |
| **Musicolet** | Reproductor local (Android, gratis) | Nada: su argumento es técnico, la app **no tiene permiso de Internet** | No aparece | No aparece | No aparece | No aparece | No aparece | krosbits.in/musicolet |
| **Symfonium** | Cliente de servidores propios | Solo privacidad; describe la analítica anónima y la verificación de licencia | No aparece | No aparece | No aparece | No aparece | No aparece | symfonium.app; docs.symfonium.app (privacidad) |
| **foobar2000** | Reproductor local (freeware) | Nada sobre contenido; insiste en «sin telemetría» | Solo reglas sobre instaladores modificados. **[No confirmado]** El EULA no está enlazado en las páginas leídas | — | — | — | — | foobar2000.org (inicio, soporte, FAQ) |
| **Jellyfin** | Servidor autoalojado | El proyecto no opera servidores: responde quien ejecuta el suyo | Política de comunidad: el acceso de pago a servidores ajenos es piratería; puede denunciar al hosting y negar soporte | No aparece | No aparece | No aparece | No aparece | jellyfin.org; docs de normas de servidores |
| **Navidrome** | Servidor autoalojado | Solo organiza música existente; **no tiene subida de archivos por diseño** | No aparece | No aparece (GPL v3) | No aparece | No aparece | No aparece | navidrome.org; FAQ |
| **Bandcamp** | Servicio que aloja contenido de usuario | El artista garantiza tener los derechos y concede una licencia no exclusiva para alojar y emitir; el fan recibe licencia personal | Procedimiento completo: aviso con declaración formal, contra-aviso, plazo para que el titular demande, **política de reincidentes** | «Tal cual» (según resumen) | Tope de 100 USD (según resumen) | California y arbitraje (según resumen) | 18 años | bandcamp.com/terms_of_use; /copyright |
| **Plex / Plexamp** | Servidor y cliente | **[No confirmado]** La página de términos devolvió 403 | — | — | — | — | — | plex.tv (no leída) |
| **SoundCloud** | Servicio que aloja contenido | **[No confirmado]** Los términos no cargaron | — | — | — | — | — | soundcloud.com/terms-of-use (no leída) |

Lo de Bandcamp marcado «según resumen» salió del resumen del lector web, no del texto literal: **[No confirmado]** hasta releerlo.

**Lo que enseña la tabla** **[Opinión]**:

1. Los reproductores locales **casi no tienen términos**. Se apoyan en un hecho técnico verificable: no alojan ni transmiten obras
   (Musicolet ni siquiera tiene permiso de Internet; Navidrome no deja subir archivos). Ese es el argumento más fuerte de Satin y por eso
   `COPY_LEGAL.md` lo ata al código.
2. Quien sí aloja algo (Bandcamp) tiene un **procedimiento de avisos completo y una política de reincidentes**. Satin aloja texto en un
   caso: los nombres de playlists y los títulos y artistas sincronizados con cuenta. Para ese caso necesita un procedimiento, aunque sea mínimo.
3. VLC separa **licencia del código** y **marca**. Satin tiene el mismo problema (código PolyForm Noncommercial; nombre aún sin registrar).
4. Las cláusulas de EE. UU. (arbitraje, tope de 100 USD, «as is» absoluto) **no se trasladan a México** sin más: frente a un consumidor,
   el art. 90 de la LFPC las vuelve nulas en lo que liberen de responsabilidad civil o sometan a tribunales extranjeros (§2.3).

---

## 2. Marco mexicano para una herramienta que no aloja ni distribuye obras

### 2.1 Ley Federal del Derecho de Autor (LFDA)

Texto vigente, última reforma **DOF 14-05-2026** (portada del PDF), [diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf).

| Tema | Qué dice | Para Satin |
|---|---|---|
| Protección sin registro | Art. 5o: la protección nace cuando la obra se fija en un soporte. Art. 162: las obras quedan protegidas «aun cuando no sean registrados» **[Firme]** | El código de Satin está protegido desde que existe. Registrarlo en INDAUTOR da prueba y publicidad, no el derecho |
| Programas de computación | Art. 101 (definición) y 102: se protegen como obras literarias, en código fuente y objeto **[Firme]** | Base de la cláusula de propiedad intelectual |
| **Intermediarios (reforma DOF 01-07-2020)** | Capítulo V del Título IV, arts. 114 Bis a 114 Octies **[Firme: existen]**. Art. 114 Septies define dos figuras: *proveedor de acceso* (transmite o enruta sin modificar) y *proveedor de servicios en línea*, que hace almacenamiento temporal automático, **almacenamiento a petición de un usuario** o **direccionamiento o vinculación** con buscadores, hipervínculos y directorios | **Sin cuentas** Satin no almacena nada del usuario ni enlaza a obras: no encaja en ninguna figura **[Opinión]**. **Con cuentas** guarda a petición del usuario los nombres de playlists y los títulos y artistas: encaja en el almacenamiento a petición, aunque solo para ese texto **[Opinión]** |
| Exención de responsabilidad | Art. 114 Octies: no responde por daños si no controla, inicia ni dirige la infracción y, para servicios en línea: (a) retira o inhabilita de forma «expedita y eficaz» tras un aviso del titular o una resolución, y toma medidas razonables para que no se vuelva a subir; (b) avisa a la persona cuyo material retira; (c) tiene una **política pública de terminación de cuentas de infractores reincidentes**; (d) no interfiere con medidas técnicas estándar; (e) no recibe un beneficio económico atribuible a la infracción si puede controlarla **[Firme]** | Los términos deben incluir el procedimiento de aviso y la política de reincidentes **solo para lo que se sincroniza**. Coste casi nulo y es lo que la ley pide para la exención |
| Contenido mínimo del aviso | Art. 114 Octies, fr. III: nombre del titular o representante y medio de contacto; identificar el contenido; manifestar el derecho o interés; ubicación electrónica. Remite a formularios «conforme lo señale el reglamento» **[Firme]**. **[No confirmado]** si el Reglamento de la LFDA ya regula esos formularios | Los términos piden exactamente esos cuatro datos |
| Contra-aviso | El usuario puede pedir que se restaure probando titularidad o un uso permitido; el proveedor informa a quien avisó y restaura salvo que este inicie un procedimiento en **15 días hábiles** **[Firme]** | Va en los términos |
| Sin vigilancia general | Art. 114 Octies, fr. IV: no hay obligación de monitorear **[Firme]** | Se puede decir que no revisamos el contenido |
| Sanciones a avisos falsos | Art. 232 Quinquies: multa a quien haga una declaración falsa en un aviso o contra-aviso, y al proveedor que no retire de forma expedita **[Firme]** | Se menciona para disuadir avisos abusivos; obliga a cumplir el plazo |
| Medidas tecnológicas de protección (DRM) | Art. 114 Bis, fr. I (definición; no obliga a fabricantes de productos no destinados a ilícitos); art. 232 Bis: multa a quien ofrezca dispositivos o servicios **promocionados, usados preponderantemente o diseñados** para eludirlas; art. 232 Ter: multa a quien las eluda **[Firme]** | Satin no descifra DRM: reproduce solo lo que el navegador decodifica y no usa EME (`COPY_LEGAL.md`). Nunca anunciarlo como forma de saltarse protecciones |
| Información sobre gestión de derechos | Art. 114 Bis, fr. II; art. 232 Quáter: multa a quien la suprima o altere sin autorización **[Firme]** | Satin **lee** las etiquetas y **no escribe** en los archivos del usuario (permiso de solo lectura). Bajo riesgo **[Opinión]** |
| Copia para uso personal | Art. 148, fr. IV: reproducción «por una sola vez, y en un sólo ejemplar», para uso personal y privado y sin lucro **[Firme]** | **Punto débil:** en Firefox y Safari la app guarda una copia del audio en el almacenamiento privado del navegador, y siempre guarda miniaturas de las portadas. La LFDA no tiene una excepción expresa para copias técnicas o de caché **[No confirmado: no la encontré]**. Lo hace el usuario, en su dispositivo, con sus archivos; pregunta para la abogada |
| Infracciones en materia de comercio | Art. 231: requieren «fines de lucro directo o indirecto»; fr. V: dispositivos para desactivar la protección de un programa. Las sanciona el **IMPI** (art. 232) **[Firme]** | Si algún día hay cobros, el «lucro indirecto» deja de ser teórico. Razón de más para no facilitar nada ilícito |

**[No confirmado]** Si la Suprema Corte ha resuelto impugnaciones contra la reforma de 2020 (se habló de acciones de inconstitucionalidad).
No lo verifiqué; puede cambiar el alcance del art. 114 Octies.

### 2.2 Código Penal Federal

Texto vigente, última reforma **DOF 13-03-2026**, [diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf](https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf),
Título Vigésimo Sexto, arts. 424 a 429 **[Firme]**:

- Art. 424, fr. III: uso **doloso, con fin de lucro** y sin autorización de obras protegidas.
- Art. 424 bis: reproducir o distribuir copias **con fin de especulación comercial**, y aportar insumos **a sabiendas**; fabricar **con fin de lucro** dispositivos para desactivar la protección de un programa.
- Arts. 427 Bis a 427 Quinquies (DOF 01-07-2020): eludir medidas tecnológicas, comercializar dispositivos o **servicios destinados principalmente a eludirlas**, y suprimir información sobre gestión de derechos; todos exigen **a sabiendas y/o fines de lucro**.
- Art. 429: se persiguen **de oficio**, salvo los arts. 424 fr. II, 424 Bis fr. III y 427.

**Para Satin** **[Opinión]**: ningún tipo alcanza, por su texto, a quien ofrece una herramienta que no aloja, no distribuye, no elude
protecciones y no se promociona para piratear. Lo que lo cambiaría: anunciar o diseñar funciones para conseguir música ajena, descifrar DRM,
o lucrar con contenido de terceros. Los términos prohíben esos usos y la app no los hace; la cláusula no protege si la conducta existe.

### 2.3 Ley Federal de Protección al Consumidor (LFPC)

Texto vigente, última reforma **DOF 12-12-2025**, [diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf).

| Tema | Qué dice **[Firme]** | Para los términos |
|---|---|---|
| Orden público | Art. 1: disposiciones «irrenunciables»; nada en contrario vale | Ninguna cláusula puede quitar derechos de la LFPC ni la competencia de Profeco |
| ¿Hay consumidor si es gratis? | Art. 2, fr. II: proveedor es quien «habitual o periódicamente ofrece… o concede el uso o disfrute de bienes, productos y servicios»; la definición **no menciona contraprestación** | **[Opinión]** Satin gratis podría ser relación de consumo. Redactar como si lo fuera es lo prudente. **[No confirmado]** criterio de Profeco o de tribunales para servicios gratuitos |
| Comercio electrónico | Art. 76 Bis: confidencialidad, seguridad, **domicilio físico y medios de contacto antes de la transacción** (fr. III), información de términos y costos (fr. V); la reforma de 2025 añadió las fr. VIII (cobros recurrentes: consentimiento expreso y aviso **5 días naturales** antes de renovar) y IX (cancelación inmediata). Art. 76 Bis 1: mecanismos para aceptar, probar la transacción y reclamar | Hoy no hay transacción con Satin (el café se paga en Stripe, §4). **Si un día se cobra**, el domicilio físico vuelve a ser obligatorio y cualquier suscripción debe cumplir las fr. VIII y IX |
| Contrato de adhesión | Art. 85: en español, legible, sin prestaciones desproporcionadas ni cláusulas abusivas. Art. 86: el registro previo en Profeco solo es obligatorio cuando lo exija una **norma oficial mexicana**. Art. 88: registro voluntario | Los términos son un contrato de adhesión. **[No confirmado]** que ninguna NOM obligue a registrar este tipo de servicio; no encontré una |
| **Cláusulas que no valen** | Art. 90: modificar unilateralmente el contrato o sustraerse de las obligaciones (I); **liberar al proveedor de su responsabilidad civil** salvo incumplimiento del consumidor (II); trasladarla a otro (III); prescripción menor a la legal (IV); formalidades para demandar (V); **renunciar a la protección de la ley o someterse a tribunales extranjeros** (VI) | Diseño de los términos: cambios **con aviso previo** y derecho a dejar de usar; limitación de responsabilidad **«en lo que la ley permita»**, sin excluir dolo, culpa grave ni daños a la persona; sin tribunales extranjeros; sin requisitos para reclamar |

**[No confirmado]** Páginas de Profeco sobre comercio electrónico y el Registro Público de Contratos de Adhesión: la portada de gob.mx/profeco
no las enlaza y no adiviné direcciones.

### 2.4 Código Civil Federal, Código de Comercio y Código Nacional de Procedimientos Civiles y Familiares

| Norma | Qué dice **[Firme]** | Para qué sirve |
|---|---|---|
| CCF art. 6o | No se puede eximir de la ley; solo se renuncian derechos privados que no afecten el interés público | Límite de toda exclusión |
| CCF art. 1797 | La validez y el cumplimiento del contrato no pueden dejarse al arbitrio de una parte | Otra razón para que los cambios sean con aviso y salida libre |
| CCF art. 1803 | Consentimiento **expreso** (también por medios electrónicos) o **tácito** (hechos que lo presupongan) | Base de la aceptación de los términos (§7) |
| CCF art. 1834 bis | Los medios electrónicos cumplen la forma escrita si la información es atribuible y consultable después | Guardar qué versión se aceptó y cuándo |
| CCF art. 2106 | La responsabilidad por dolo es exigible siempre; su renuncia es nula | El límite de responsabilidad nunca cubre dolo |
| CCF arts. 2110 y 2111 | Los daños deben ser consecuencia inmediata y directa; nadie responde del caso fortuito salvo que lo cause o lo acepte | Base para no responder de daños indirectos ni de fallos ajenos (navegador, sistema) |
| CCF art. 1910 | Responsabilidad por hecho ilícito | No se excluye por contrato frente a terceros |
| CCF arts. 646 y 450 | La mayoría de edad empieza a los 18; los menores tienen incapacidad legal | Edad mínima (§2.6) |
| CCF arts. 29 y 34 | Domicilio de la persona física: donde reside habitualmente. **Se puede designar un domicilio convencional** para el cumplimiento de determinadas obligaciones | Opciones de domicilio (§5) |
| CCom art. 89 bis | No se niegan efectos a la información por estar en un mensaje de datos | Prueba de la aceptación electrónica |
| CCom art. 1093 | Sumisión expresa (mercantil): solo a tribunales del domicilio de una de las partes, del lugar de cumplimiento o de la ubicación de la cosa | Elegir una ciudad cualquiera no vale en lo mercantil |
| CNPCF arts. 85, 86 y 89 fr. IV | Competencia por sumisión expresa o tácita; sin sumisión, en acciones personales, la del **domicilio de la parte demandada** | Base de la opción «sin fijar ciudad» (§6) |

Fuentes: [CCF](https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf) (última reforma DOF 14-11-2025), [CCom](https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf)
(DOF 14-11-2025), [CNPCF](https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPCF.pdf) (DOF 15-01-2026).

### 2.5 Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP, 2025)

Nueva ley (DOF 20-03-2025), última reforma **DOF 14-11-2025** (solo el art. 4), [diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).
Autoridad: **Secretaría Anticorrupción y Buen Gobierno** (art. 2, fr. XV). **[Firme]** salvo donde se indique.

| Tema | Artículo | Para el aviso |
|---|---|---|
| Ámbito | Art. 1: excluye solo el uso «exclusivamente personal» sin divulgación ni uso comercial | Satin con cuentas trata datos de terceros: aplica |
| Dato personal | Art. 2, fr. V: persona identificada o identificable, directa o indirectamente | La IP puede serlo (§2.7) |
| Encargado y transferencia | Art. 2, fr. XII (persona encargada) y XX: transferencia es la comunicación a alguien **distinto** del titular, el responsable o el encargado | Supabase y Vercel, si actúan como encargados, **no son transferencias** |
| Consentimiento | Art. 7: tácito por regla general; expreso para datos financieros o patrimoniales; revocable, y el aviso dice cómo. Art. 9, fr. IV: no hace falta si los datos se requieren por la relación jurídica | La cuenta y la sincronización encajan en el art. 9, fr. IV |
| Conservación | Art. 10: suprimir, previo bloqueo, cuando dejen de ser necesarios y acabe el plazo de conservación. Art. 2, fr. III: el bloqueo dura hasta la prescripción legal o contractual | **La ley no fija un número de días para borrar tras cerrar la cuenta**: lo fija el responsable. Ver §3 del aviso |
| Contenido del aviso | Art. 15, fr. I a VI: **identidad y domicilio**, datos (y sensibles), finalidades, opciones para limitar, medios ARCO, cómo se avisan los cambios | La ley no precisa qué domicilio (§5) |
| Aviso simplificado | Art. 16, fr. II: si los datos se obtienen por medios electrónicos, se da el simplificado (fr. I a IV del art. 15) con el sitio del integral | Va bajo «Crear cuenta» |
| Seguridad y vulneraciones | Arts. 18 y 19: medidas administrativas, técnicas y físicas; avisar **de forma inmediata** las vulneraciones que afecten de forma significativa | El aviso lo promete |
| Solicitud ARCO | Art. 28: nombre y domicilio **o cualquier otro medio** para notificaciones, identificación, descripción de los datos y del derecho | Un correo basta como medio |
| **Plazos ARCO** | Art. 31: responder en **20 días** y hacerlo efectivo en los **15 siguientes**; ampliables **una sola vez** por un periodo igual si se justifica. «Días» son hábiles (art. 2, fr. VIII) | Sustituye a los [30] y [15] del borrador anterior donde eran plazos ARCO |
| Gratuidad | Art. 34: gratis salvo costos de reproducción o envío | El aviso lo dice |
| Transferencias | Arts. 35 y 36 | Hoy no hay |
| Sanciones | Art. 59: hasta 320 000 UMA | — |
| Menores | **La ley no tiene reglas sobre menores** | Se suple con el CCF (§2.6) |
| Reglamento | La ley remite a un Reglamento (arts. 17, 49, 54, 57…). Transitorio Décimo Segundo: el Ejecutivo debía adecuar los reglamentos en 90 días naturales | **[No confirmado]** si se publicó un Reglamento nuevo. El texto en diputados.gob.mx/LeyesBiblio/regley/Reg_LFPDPPP.pdf parece ser el de 2011 |

**Lineamientos del Aviso de Privacidad** (2013, [dof.gob.mx/nota_detalle_popup.php?codigo=5284966](https://dof.gob.mx/nota_detalle_popup.php?codigo=5284966)).
Se expidieron con la ley de 2010, hoy abrogada (transitorio Segundo de la de 2025). **[No confirmado]** que sigan vigentes. Aun así son la
guía oficial más concreta: el domicilio debe ser **completo** (calle, número, colonia, ciudad, municipio o delegación, CP y entidad) y
**«deberá corresponder a aquél para oír y recibir notificaciones»** (numeral Vigésimo primero); el nombre de la persona física, completo; el
aviso, en lugar visible y de fácil consulta (Decimoprimero); la carga de la prueba de haberlo puesto a disposición es del responsable
(Decimoséptimo); **no hay obligación de nombrar a los encargados** en el aviso (Vigésimo sexto); informar sobre menores es solo una buena
práctica (Anexo, Cuarto).

**Supabase** **[Firme]**: actúa como encargado («processor») de los datos de los usuarios finales de sus clientes; su DPA (versión 1,
1-8-2026) forma parte de sus términos y aceptarlos equivale a firmar las cláusulas contractuales tipo; si el cliente elige región, los
datos se guardan y procesan principalmente en ella ([supabase.com/privacy](https://supabase.com/privacy), [supabase.com/legal/dpa](https://supabase.com/legal/dpa)).
Su lista de subencargados del 12-10-2026 (PDF enlazado desde [supabase.com/legal/subprocessors](https://supabase.com/legal/subprocessors))
incluye sobre todo empresas de **EE. UU.** (AWS, Google y Cloudflare para alojamiento; Postmark para correos; Sentry) y una de Hungría.

### 2.6 Edad mínima

No hay en México una edad específica para servicios en línea como la de EE. UU. o la UE **[No confirmado: no encontré norma]**. Lo que hay
es el CCF: los menores de 18 tienen incapacidad legal (arts. 646 y 450) y sus contratos son anulables (art. 2228, nulidad relativa).
**Propuesta [Opinión]:** sin cuentas no hace falta edad mínima (no se recaba nada). Con cuentas: 18 años, o menos con autorización de quien
ejerza la patria potestad o la tutela, que asume la responsabilidad. Es coherente con el CCF y no requiere verificar edades.

### 2.7 Sin cuentas: ¿hace falta aviso de privacidad?

- La app no recoge datos personales: todo vive en el navegador y no hay analítica (`COPY_LEGAL.md`). **[Firme, en el código]**
- **Vercel** recibe la **IP** y datos de configuración del navegador de cada visita para entregar la página; su aviso lo describe como
  «Website Information» y deriva ciudad y país de la IP **[Firme]** ([vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy),
  actualizado el 1-6-2026). Cuando trata datos por cuenta de un cliente, el cliente es el responsable. Su **DPA solo cubre los planes Pro y
  Enterprise** ([vercel.com/legal/dpa](https://vercel.com/legal/dpa), 17-3-2026) **[Firme]**. No da plazo de conservación («el mínimo
  necesario») **[Firme]**. Los registros de ejecución de funciones duran 1 hora en Hobby y 1 día en Pro según su documentación
  ([vercel.com/docs/observability/limits-and-pricing](https://vercel.com/docs/observability/limits-and-pricing), vía buscador) **[No confirmado
  en lectura directa]**; un sitio estático sin funciones puede no generarlos **[Opinión]**.
- **[No confirmado]** En qué plan está el proyecto (Hobby o Pro). En Hobby no hay DPA, así que Vercel no es encargado por contrato.
- **[Opinión]** Una IP es dato personal si permite identificar a alguien, aunque sea indirectamente (art. 2, fr. V). Satin no la ve ni la
  usa; si Vercel la trata por cuenta de Satin, el tratamiento es de Satin y hace falta aviso. Aunque se discuta, publicar un aviso breve
  cuesta nada y quita la duda. **Recomendación:** mantener el aviso sin cuentas, diciendo exactamente esto.

---

## 3. Qué hace la app de verdad (base del argumento «solo ofrecemos herramientas de reproducción»)

Verificado en el código de la rama `desarrollo` el 16-11-2026; cada fila, con su archivo, en `COPY_LEGAL.md`.

1. **Los archivos de audio nunca salen del dispositivo.** La carpeta se abre con permiso de **solo lectura**; los archivos se leen al reproducir;
   la CSP solo permite conexiones al propio dominio y, con cuentas, a Supabase. No hay código que suba audio.
2. **No hay streaming de terceros**, catálogos, búsquedas en Internet ni enlaces a fuentes de música. Ninguna URL externa en `src/`.
3. **Letras:** solo las de los archivos del usuario (etiquetas USLT/SYLT o un `.lrc` con el mismo nombre en su carpeta). Ninguna API de letras.
4. **Portadas:** las incrustadas en los archivos o una imagen (`cover.jpg`, `folder.png`…) en la carpeta del álbum; si no hay, un degradado.
   **Corrección al encargo:** la app **no** deja elegir una carátula a mano; lo que la persona elige es su **foto de perfil**, que se queda en el dispositivo.
5. **Playlists sincronizadas solo con cuenta**, y lo que sube es el **nombre** de cada playlist y, por pista, su identidad: `track:v1`
   (título, artista, álbum y duración en texto) o `track:v2` (una huella SHA-256 de partes del archivo). Ni audio ni portadas.
6. **El café está fuera de la app:** un enlace que abre en otra pestaña la página de pago de un tercero (Stripe Payment Links, decidido en
   `MONETIZACION.md`), solo si el build trae `VITE_CAFE_URL`; no desbloquea nada.
7. **No hay DRM ni elusión:** no usa Encrypted Media Extensions; reproduce lo que el navegador sabe decodificar.

**Dónde el argumento es más débil** **[Opinión]**, de más a menos:

| Punto | Por qué debilita | Qué hacer |
|---|---|---|
| Copias en el almacenamiento del navegador (audio en Firefox/Safari; miniaturas de portadas siempre) | Son reproducciones; el art. 148 fr. IV habla de un solo ejemplar | Decirlo en los términos (la copia la hace el usuario, en su dispositivo, para su uso). Pregunta para la abogada |
| Títulos y artistas sincronizados | Con cuentas, Satin almacena texto del usuario: es «almacenamiento a petición» (art. 114 Septies) | Procedimiento de aviso y política de reincidentes en los términos |
| Huella `track:v2` sincronizada | Identifica un archivo concreto; no es la obra, pero es un dato más del usuario | Mencionarla en el aviso |
| Imágenes y capturas de la landing | Las sirve Satin; son de dominio público o CC0 (`CREDITOS.md`) | Mantener la verificación de licencias del script |
| **Funciones futuras** que lo romperían: letras o portadas de servicios externos; enlaces a tiendas, YouTube o fuentes de descarga; recomendaciones o un catálogo; playlists públicas o compartidas; subir audio o transmitirlo entre dispositivos; conversión que quite DRM | Cada una convierte a Satin en «proveedor de servicios en línea» (almacenar o **vincular**, art. 114 Septies fr. II b y c), le da conocimiento y control sobre obras ajenas, o lo acerca a los arts. 232 Bis y 427 Ter | Antes de añadir cualquiera: revisar con la abogada y actualizar términos y `COPY_LEGAL.md` |

---

## 4. Café y cobros futuros

- **El café hoy no está publicado** (no hay `VITE_CAFE_URL` real; `MONETIZACION.md` pide resolver el régimen fiscal antes). **[Firme]**
- **Stripe Payment Links** **[Firme]** ([docs.stripe.com/payment-links](https://docs.stripe.com/payment-links), [/receipts](https://docs.stripe.com/receipts),
  [/refunds](https://docs.stripe.com/refunds)): los recibos por correo existen pero hay que activarlos; para mostrarlos Stripe pide datos públicos
  del negocio (nombre legal, **dirección**, correo de soporte, URL de privacidad); los reembolsos los decide y emite **el vendedor**, y las
  comisiones no se devuelven; la página de pago puede mostrar políticas de reembolso si se configuran. **[No confirmado]** si Stripe es
  «merchant of record» en Payment Links (solo lo dice de otro producto) y cualquier cosa sobre CFDI.
- **Lo que deben decir los términos:** que el café es voluntario, sin contraprestación ni funciones, que lo procesa un tercero con sus propios
  términos, y que reembolsos y comprobantes dependen de **lo que diga la página del café en ese momento**. Como esa página aún no existe,
  los términos no prometen recibo ni reembolso; solo la corrección de cobros erróneos o duplicados (art. 91 LFPC sobre pagos en exceso).
- **[No confirmado]** Si una aportación voluntaria es relación de consumo y su tratamiento fiscal (M3 en `MONETIZACION.md`).
- **Cobros futuros por costos de servidor:** cláusula de cambios con aviso previo; si hay suscripción, consentimiento expreso, aviso 5 días
  naturales antes de renovar y cancelación inmediata (art. 76 Bis, fr. VIII y IX), y domicilio físico antes de cobrar (fr. III).

---

## 5. Domicilio del responsable sin publicar la casa: opciones

La ley pide «identidad y domicilio» sin precisar cuál (art. 15, fr. I). El CCF define el domicilio de la persona física como donde reside
(art. 29) pero permite **designar un domicilio convencional** para obligaciones determinadas (art. 34). Los Lineamientos de 2013 piden un
domicilio completo **que corresponda al de oír y recibir notificaciones** (numeral Vigésimo primero) **[No confirmado: vigencia]**.

| Opción | Qué es | ¿Vale? **[Opinión]** | Riesgo |
|---|---|---|---|
| Domicilio particular | La casa | Sí, sin discusión | Privacidad: queda publicado para siempre (archivos, buscadores) |
| Domicilio convencional en una **oficina virtual** | Dirección física con recepción de correspondencia y notificaciones a nombre del responsable, por contrato | Probablemente sí: domicilio completo, designado (art. 34) y apto para notificaciones (Lineamientos) | Bajo si de verdad reciben y avisan; si una notificación se pierde, el problema es del responsable. Costo mensual |
| Despacho de quien asesore | El domicilio profesional, con autorización para recibir | Probablemente sí, mismo argumento | Bajo; depende del acuerdo con el despacho |
| Apartado postal | Caja de Correos | **No**: no es un domicilio completo (sin calle ni número) | Alto: incumplir el art. 15, fr. I |
| Solo correo electrónico | — | **No**: el art. 15 pide domicilio; el correo sirve como medio ARCO (art. 28) | Alto |
| Persona moral (por ejemplo, una S.A.S.) | El responsable pasa a ser la sociedad, con su domicilio | Sí | Costo y obligaciones fiscales; cambia el responsable en todos los textos |

Si algún día se cobra, el art. 76 Bis, fr. III de la LFPC pide además un **domicilio físico** al consumidor antes de la transacción, y Stripe
pide una dirección pública para los recibos: la misma decisión sirve para los tres.

**Decisión del 16-11-2026:** nombre completo como responsable; correo de privacidad en el dominio propio (en `privado/`); **domicilio
particular** (`{{DOMICILIO}}`, valor en `privado/`). Se mantiene la opción de oficina virtual documentada por si cambia de idea.

## 6. Ley aplicable y tribunales sin revelar la ciudad

| Opción | Efecto **[Opinión]** |
|---|---|
| **Leyes de México, sin fijar tribunales** (elegida 16-11-2026) | Rigen las reglas generales: en acciones personales, el juez del domicilio del demandado (CNPCF art. 89, fr. IV). No aparece ninguna ciudad. Profeco sigue siendo competente (LFPC art. 1). Es la que menos riesgo tiene de caerse |
| Tribunales del domicilio del usuario | Favorable al consumidor, resiste bien; obliga al responsable a litigar donde viva cada usuario |
| Una ciudad concreta | Revela la ubicación; en lo mercantil solo vale si es el domicilio de una parte o el lugar de cumplimiento (CCom art. 1093) y frente a un consumidor puede verse como abusiva |
| Tribunales extranjeros | Nulo frente a consumidores (LFPC art. 90, fr. VI) |

## 7. Cómo se aceptan los términos y los cambios

- **Sin cuentas:** no hay registro ni pago, y la persona no asume más obligación que no usar la app para fines ilícitos. Lo razonable es
  **ponerlos a disposición** (Ajustes → Acerca de, donde ya están) y decir que usar la app implica conocerlos. Es aceptación tácita
  (CCF art. 1803, fr. II); débil como prueba, pero proporcional a lo que hay en juego **[Opinión]**.
- **Con cuentas:** aceptación **expresa**: una casilla **sin marcar** bajo «Crear cuenta» con enlaces a términos y aviso, junto al aviso
  simplificado (LFPDPPP art. 16; LFPC art. 76 Bis 1, fr. III; CCF arts. 1803 fr. I y 1834 bis). Conviene **guardar la versión y la fecha**
  aceptadas para poder probarlo. **No implementado** (las cuentas están cerradas; requiere migración aditiva y cambio de UI).
- **Cambios:** publicar la versión nueva con su fecha; si el cambio es relevante y hay cuenta, avisar por correo con antelación; quien no
  esté de acuerdo puede dejar de usar la app o borrar la cuenta. **No encontré un plazo legal** para avisar cambios de términos: los
  **15 días naturales** que proponen los términos son una decisión, no un requisito **[Opinión]**. El único plazo legal parecido son los 5
  días naturales del art. 76 Bis, fr. VIII, para renovaciones de cobros recurrentes.

---

## 8. Resumen: firme, opinión y no confirmado

**Firme (leído en la fuente):** los artículos citados de LFDA, CPF, LFPC, CCF, CCom, CNPCF y LFPDPPP con sus fechas de reforma; plazos ARCO
de 20 + 15 días hábiles ampliables una vez (LFPDPPP art. 31); que la LFPDPPP no regula menores ni fija plazo de borrado; las cláusulas
nulas del art. 90 LFPC; el procedimiento de aviso, contra-aviso (15 días hábiles) y reincidentes del art. 114 Octies LFDA; las condiciones de
Vercel, Supabase y Stripe citadas; la licencia OFL 1.1 de Instrument Sans; todo lo de §3 en el código.

**Opinión (discutible):** que Satin sin cuentas no es proveedor de servicios en línea y con cuentas sí, solo para el texto sincronizado; que
un servicio gratuito puede ser relación de consumo; que la IP de Vercel exige aviso; que el domicilio convencional en oficina virtual
cumple; la edad mínima propuesta; la forma de aceptación; el plazo de 15 días naturales para avisar cambios.

**No confirmado:** vigencia de los Lineamientos de 2013 y si hay Reglamento nuevo de la LFPDPPP; Reglamento de la LFDA sobre formularios de
aviso; resoluciones de la SCJN sobre la reforma de 2020; excepción para copias técnicas o de caché; criterio de Profeco sobre servicios
gratuitos y aportaciones; que ninguna NOM obligue a registrar el contrato; plan de Vercel del proyecto y retención real de IP; ubicación
exacta de us-east-1 según Supabase (no leí su página de regiones; el proyecto se creó en «East US», `SUPABASE.md`);
Stripe como «merchant of record» y CFDI; los términos de Plex y SoundCloud; el EULA de foobar2000; los detalles de Bandcamp marcados «según resumen».
