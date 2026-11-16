# Términos de uso (borrador)

> **Borrador para revisión de una persona abogada; no es asesoría jurídica.** Escrito el 16-11-2026 a partir de `INVESTIGACION_LEGAL.md`
> (fundamentos y fuentes) y del código de la rama `desarrollo`; cada afirmación sobre lo que hace la app tiene su fila en `COPY_LEGAL.md`.
>
> **Cómo se publica.** La sección «Texto» es la fuente de `/terminos` (`src/ui/LegalPage.tsx`, vía `virtual:docs`). Las notas
> **[Decides tú]** y **[Abogado]** llegan hasta el final de su párrafo y no se publican. `<!-- cuentas -->…<!-- /cuentas -->` solo sale con
> `VITE_CUENTAS=1` y `<!-- sin cuentas -->…<!-- /sin cuentas -->` solo sin ellas. Los `{{MARCADORES}}` se completan al compilar con las
> variables `LEGAL_*` (nunca en el repositorio; valores en `docs/producto/privado/`) y `npm run build` falla si queda alguno.
> La página no se enlaza en la navegación pública: solo desde Ajustes → Acerca de.

## Texto

> **Términos de uso de {{NOMBRE_APP}}**
> Última actualización: {{FECHA_ACTUALIZACION}}
>
> Estos términos son el acuerdo entre tú y yo, {{RESPONSABLE}}, la persona que desarrolla y mantiene {{NOMBRE_APP}} desde México. Léelos
> junto con el aviso de privacidad ({{URL_APP}}/privacidad). Si algo no queda claro, escríbeme a {{CORREO_PRIVACIDAD}}.
>
> **1. Qué es {{NOMBRE_APP}} y qué no es.** Es un reproductor de música que funciona en tu navegador con archivos de audio que ya tienes.
> Lee tus archivos en tu dispositivo y no los sube a ningún servidor.
>
> No es una tienda ni un servicio de streaming: no vende, presta, aloja ni distribuye música, no busca canciones en Internet y no enlaza a
> sitios donde conseguirlas. Tampoco incluye letras ni portadas de terceros: las que ves salen de tus archivos o de las imágenes que
> tienes en tus carpetas.
>
> <!-- cuentas -->
> La cuenta es opcional y solo sirve para sincronizar tus playlists entre tus dispositivos.
> <!-- /cuentas -->
> <!-- sin cuentas -->
> Esta versión no tiene cuentas: lo que haces en la app no me llega.
> <!-- /sin cuentas -->
>
> **2. Cómo aceptas estos términos.** Al usar la app los aceptas. Están siempre disponibles en Ajustes → Acerca de.
> <!-- cuentas -->
> Para crear una cuenta te pediré que los aceptes de forma expresa, y guardaré qué versión aceptaste y cuándo.
> <!-- /cuentas -->
>
> **[Decides tú]** Con cuentas, la casilla de aceptación y el registro de la versión aceptada **no existen todavía**: son requisito antes de
> abrir registros (`COPY_LEGAL.md`, `REVISION_ABOGADO.md`).
>
> **3. Tus archivos son tu responsabilidad.** Al abrir un archivo en la app declaras que tienes derecho a reproducirlo: porque es tuyo, lo
> compraste, tiene una licencia que lo permite o la ley te lo permite. Eres la única persona responsable de los archivos que abres, de su
> origen y de lo que hagas con ellos. No veo ni reviso tus archivos.
>
> Para funcionar, la app guarda en tu dispositivo, a petición tuya, copias técnicas: miniaturas de las portadas y, en los navegadores que
> no permiten recordar una carpeta (como Firefox o Safari), una copia de los archivos en el almacenamiento privado del navegador. Esas
> copias no salen de tu dispositivo, solo sirven para que los reproduzcas ahí y se borran al quitar la carpeta.
>
> **4. Lo que no puedes hacer.** No uses la app para:
> - reproducir, copiar o compartir obras sin tener derecho, ni para ayudar a otras personas a hacerlo;
> - eludir medidas tecnológicas de protección (DRM) ni quitar o alterar la información sobre derechos de una obra, ni modificarla o
>   anunciarla como herramienta para eso;
> - atacar el servicio, sobrecargarlo, automatizar accesos o intentar saltarte sus límites técnicos;
> <!-- cuentas -->
> - crear cuentas de forma automatizada o con datos de otra persona, ni usar los nombres de tus playlists para acosar, suplantar o
>   publicar datos de otras personas;
> <!-- /cuentas -->
> - nada que sea contrario a la ley.
>
> **5. Propiedad intelectual y licencias.** El código, el diseño, los textos y el nombre de {{NOMBRE_APP}} son míos o los uso con licencia.
> Usar la app no te da más derecho sobre ellos que el de usarla conforme a estos términos.
> - **El código fuente** es público bajo la licencia **PolyForm Noncommercial 1.0.0**: puedes leerlo, usarlo y modificarlo sin fines
>   comerciales en los términos de esa licencia; un uso comercial necesita mi permiso. Esa licencia rige el código; estos términos rigen el
>   uso de la app publicada en {{URL_APP}}.
> - **El nombre y el logotipo** de {{NOMBRE_APP}} no se licencian con el código: no los uses para identificar otro producto ni una versión
>   modificada.
> - **Software y tipografía de terceros:** la app incluye bibliotecas de código abierto y la tipografía Instrument Sans (SIL Open Font
>   License 1.1), cada una con su licencia. La lista y los textos completos están en {{URL_APP}}/licencias-terceros.txt.
>
> **6. Derechos de autor: cómo avisarme.** No alojo obras: tus archivos de audio nunca llegan a mis servidores.
> <!-- cuentas -->
> Lo único que guardo de tus playlists sincronizadas es texto (el nombre de la playlist y, por canción, el título, el artista, el álbum y
> la duración) y una huella de cada archivo que no permite reconstruirlo.
> <!-- /cuentas -->
> Si eres titular de derechos, o actúas en su nombre, y crees que algo de {{NOMBRE_APP}} los infringe, escríbeme a {{CORREO_PRIVACIDAD}} con:
> - tu nombre (o el del titular al que representas) y un medio de contacto para responderte;
> - qué contenido es y dónde está, con la dirección o una descripción que permita encontrarlo;
> - qué derecho o interés tienes sobre la obra;
> - la confirmación de que la información es verdadera. Una declaración falsa en un aviso puede ser sancionada por la ley.
>
> <!-- cuentas -->
> Si el aviso está completo, retiraré o desactivaré ese contenido sin demora y avisaré a la persona que lo sincronizó. Ella puede
> responder con un contra-aviso que acredite su derecho o un uso permitido; en ese caso se lo enviaré a quien avisó y restableceré el
> contenido, salvo que en un plazo de 15 días hábiles esa persona me informe que inició un procedimiento judicial, administrativo, penal o
> un mecanismo alterno de solución. No reviso de forma general lo que sincronizas. Cerraré la cuenta de quien acumule avisos fundados de
> forma reiterada.
> <!-- /cuentas -->
>
> **[Decides tú]** Concretar «de forma reiterada» (por ejemplo, tres avisos fundados en doce meses). La ley pide que la política sea pública,
> no un número concreto (LFDA art. 114 Octies, fr. II, inciso c).
>
> <!-- cuentas -->
> **7. Lo que creas en tu cuenta.** Los nombres de tus playlists y los datos de tus canciones siguen siendo tuyos. Me das permiso para
> guardarlos, copiarlos entre tus dispositivos y mostrártelos, solo para darte la sincronización y mientras tengas la cuenta. No los hago
> públicos ni los uso para nada más. Eres responsable de que no infrinjan derechos de otras personas ni la ley.
>
> **8. Tu cuenta.** Para crear una cuenta debes tener 18 años o más, o contar con la autorización de tu madre, padre o tutor, que asume
> la responsabilidad de ese uso. Da un correo que sea tuyo y cuida el acceso a él y a tu contraseña.
>
> Puedes dejar de usar tu cuenta cuando quieras y pedirme que la elimine escribiendo a {{CORREO_PRIVACIDAD}} desde el correo de la cuenta;
> los plazos están en el aviso de privacidad. Antes puedes descargar lo que guarda en Ajustes → Privacidad y datos → Datos de tu cuenta.
> Eliminar la cuenta no borra lo que está en tu dispositivo: eso lo borras tú desde la misma sección.
>
> Puedo suspender o cerrar una cuenta que incumpla la cláusula 4, que reciba avisos fundados de forma reiterada (cláusula 6) o cuando lo
> ordene una autoridad. Te avisaré por correo y te diré el motivo, salvo que hacerlo facilite el abuso o la ley lo impida. Si no estás de
> acuerdo, puedes escribirme para revisarlo.
>
> Si un día dejo de ofrecer la sincronización, te avisaré por correo con al menos 30 días naturales de anticipación para que descargues
> tus datos.
>
> **[Decides tú]** Los 30 días naturales son una propuesta; la ley no fija un plazo para esto.
> <!-- /cuentas -->
> <!-- sin cuentas -->
> **7. Lo que creas en la app.** Tus playlists, el nombre y la foto de perfil, y todo lo que guardas se queda en tu dispositivo y no me llega.
>
> **8. Cuentas.** Esta versión no tiene cuentas. Si las añado, actualizaré estos términos antes de abrirlas.
> <!-- /sin cuentas -->
>
> **9. Tus datos en el dispositivo y las copias de seguridad.** Tu biblioteca, tus playlists y tus ajustes se guardan en el almacenamiento
> de tu navegador. El navegador puede borrarlos: si borras los datos del sitio, si usas una ventana privada, si le falta espacio o, en
> algunos navegadores, si pasas un tiempo sin abrir la app. La app pide al navegador que conserve la copia de tus archivos, pero la
> decisión es del navegador.
> <!-- cuentas -->
> Salvo tus playlists sincronizadas, no guardo copia de nada de esto, así que no puedo recuperarlo.
> <!-- /cuentas -->
> <!-- sin cuentas -->
> No guardo copia de nada de esto, así que no puedo recuperarlo.
> <!-- /sin cuentas -->
> Guarda tus archivos originales y exporta de vez en cuando la copia de seguridad (Ajustes → Privacidad y datos), que incluye tus playlists
> y tus ajustes.
>
> **10. Disponibilidad y cambios en la app.** {{NOMBRE_APP}} es gratuita y la mantiene una sola persona. Puede tener fallos o interrupciones,
> y puedo cambiar, añadir o retirar funciones. No todos los navegadores ni dispositivos reproducen todos los formatos.
>
> **11. La app se ofrece tal como está.** Te la ofrezco tal como está y según esté disponible. No te doy más garantías que las que la ley
> exige y no se pueden excluir; por ejemplo, no garantizo que funcione sin interrupciones, que reproduzca todos tus archivos ni que lea
> bien todas sus etiquetas.
>
> **12. Límite de responsabilidad.** Respondo de los daños que cause por dolo o culpa grave y de todo lo que la ley no permite limitar;
> nada de esta cláusula lo excluye. Fuera de eso, y en la medida en que la ley lo permita, solo respondo de los daños que sean
> consecuencia inmediata y directa de un incumplimiento mío, y no de los causados por tu navegador, tu sistema operativo o tu conexión,
> por el borrado de datos que hagan tú o el navegador, por los archivos que abres o por servicios de terceros, como la página de pago del
> café.
>
> **[Abogado]** ¿Se puede añadir un tope de responsabilidad (por ejemplo, lo pagado en los últimos 12 meses) sin que se considere una
> liberación de responsabilidad civil nula (LFPC art. 90, fr. II)? Hoy no se incluye ninguno a propósito.
>
> **13. Nada de esto limita tus derechos como consumidor.** Si alguna parte de estos términos contradice la Ley Federal de Protección al
> Consumidor u otra norma que no se puede renunciar, prevalece la ley. Puedes presentar una queja ante la Procuraduría Federal del
> Consumidor (Profeco) en cualquier momento.
>
> **14. Apoyo voluntario («Comprar un café»).** Si la app muestra el botón «Comprar un café», aportar es voluntario y no es una compra: no te
> da funciones, soporte, prioridad ni ningún otro derecho, y la app funciona igual lo aportes o no. El pago se hace en la página de un
> procesador de pagos, fuera de la app, con sus propios términos y su aviso de privacidad. Los comprobantes y los reembolsos son los que
> indique esa página al momento de aportar. Si se te cobra por error o dos veces, escríbeme y lo corrijo.
>
> **[Abogado]** Tratamiento fiscal de las aportaciones y si cuentan como relación de consumo (`MONETIZACION.md`, M3). **[Decides tú]**
> Revisar esta cláusula contra la página real de Stripe cuando exista (recibos activados, política de reembolso visible).
>
> **15. Si algún día hay funciones de pago.** Hoy todo es gratis. Si en el futuro ofrezco funciones opcionales que cuesten mantener un
> servidor, sus precios y condiciones se publicarán antes, solo se cobrarán si las aceptas de forma expresa y se cancelan cuando quieras.
> Lo que hoy funciona en tu dispositivo sin cuenta seguirá siendo gratis.
>
> **[Decides tú]** La última frase es un compromiso (coherente con `MONETIZACION.md` §1 y la landing): confirmar que se quiere asumir.
>
> **16. Cambios a estos términos.** Publicaré cada versión nueva en {{URL_APP}}/terminos con su fecha.
> <!-- cuentas -->
> Si un cambio afecta tus derechos u obligaciones, te avisaré por correo al menos 15 días naturales antes de que entre en vigor. Si no
> estás de acuerdo, puedes dejar de usar la app y eliminar tu cuenta antes de esa fecha, sin costo.
> <!-- /cuentas -->
> <!-- sin cuentas -->
> Como no tengo forma de contactarte, la fecha de arriba indica la versión vigente; si no estás de acuerdo con un cambio, puedes dejar de
> usar la app.
> <!-- /sin cuentas -->
> Ningún cambio se aplica a hechos anteriores a su publicación.
>
> **17. Ley aplicable.** Estos términos se rigen por las leyes de México. Cualquier controversia la resolverán los tribunales competentes
> conforme a esas leyes, sin perjuicio de que acudas a Profeco. Si quieres, escríbeme primero para intentar resolverlo; no es un requisito.
> Si alguna parte de estos términos no fuera válida, el resto sigue vigente.
>
> **18. Contacto.** {{CORREO_PRIVACIDAD}}.

---

## Por qué cada cláusula está escrita así

| Cláusula | Fundamento (detalle y fuentes en `INVESTIGACION_LEGAL.md`) |
|---|---|
| 1, 3 | El argumento de «solo herramienta» se sostiene en hechos verificables (`COPY_LEGAL.md`). La declaración del usuario no exime a nadie de su propio dolo (CCF art. 2106), pero deja claro quién decide qué se reproduce. Las copias técnicas se dicen en voz alta porque el art. 148 fr. IV LFDA habla de un solo ejemplar |
| 2 | Aceptación tácita sin cuentas (CCF art. 1803, fr. II); expresa con cuentas (fr. I; LFPC art. 76 Bis 1, fr. III) y prueba de la versión aceptada (CCF art. 1834 bis) |
| 4 | Usos ilícitos que la ley sanciona (LFDA arts. 231, 232 Bis a 232 Quáter; CPF arts. 424 a 427 Quinquies). La cláusula no protege si la conducta existe; sirve para que la app no se presente como herramienta para eso |
| 5 | Licencia del código (archivo `LICENSE`) separada de los términos del servicio y del nombre, como hace VideoLAN. Avisos de terceros generados por `scripts/licencias.mjs` (la OFL de Instrument Sans exige acompañar la licencia) |
| 6 | Procedimiento del art. 114 Octies LFDA: los cuatro datos mínimos del aviso (fr. III), retiro expedito, aviso al usuario, contra-aviso con 15 días hábiles, sin vigilancia general (fr. IV), política pública de reincidentes (fr. II, c). Mención a las declaraciones falsas: art. 232 Quinquies |
| 7, 8 | Licencia limitada y revocable sobre texto del usuario, solo para sincronizar. Edad: CCF arts. 646, 450 y 2228. Suspensión motivada y con aviso para no dejarlo al arbitrio de una parte (CCF art. 1797; LFPC art. 90, fr. I) |
| 9 | Hecho técnico: el navegador decide la persistencia (`navigator.storage.persist` solo se pide al copiar archivos, `platform/web/library.ts:191`) |
| 10, 11 | «Tal cual» sin excluir las garantías legales (LFPC art. 1) |
| 12 | Sin dolo ni culpa grave excluidos (CCF art. 2106); daños directos (art. 2110); caso fortuito y hechos de terceros (art. 2111). Sin tope monetario, a propósito, por el art. 90, fr. II LFPC |
| 13 | LFPC art. 1 (irrenunciable) y art. 90, fr. VI |
| 14 | El café es una liberalidad sin contraprestación; reembolsos y comprobantes dependen de la página de pago, que aún no existe. Pagos en exceso: LFPC art. 91 |
| 15 | Cobros futuros: LFPC art. 76 Bis, fr. V, VIII y IX |
| 16 | Cambios con aviso previo y salida sin costo para que no sean una modificación unilateral nula (LFPC art. 90, fr. I). Los 15 días naturales son una decisión, no un plazo legal |
| 17 | Sin fijar ciudad: reglas generales de competencia (CNPCF art. 89, fr. IV), sin tribunales extranjeros (LFPC art. 90, fr. VI) y sin requisito previo para demandar (fr. V). Decisión del 16-11-2026 |
| 18 | Correo de contacto en el dominio propio (valor en `privado/`) |
