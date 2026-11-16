# Revisión con una persona abogada: qué llevar y qué preguntar

> Preparado el 16-11-2026. Nada de esto es asesoría jurídica: es la lista de dudas que una persona abogada debe resolver antes de abrir
> cuentas o cobrar. Documentos que conviene llevar impresos o en PDF: `TERMINOS.md`, `LEGAL_BORRADORES.md` (§1 inventario y §3 aviso),
> `INVESTIGACION_LEGAL.md` y `COPY_LEGAL.md`. Para la consulta basta con el texto publicado de los borradores: no hace falta enseñar código.

## 1. Lista priorizada

**P0 — antes de publicar los textos (incluso sin cuentas)**

1. Que el aviso sin cuentas basta, o si hace falta aviso siquiera (Satin no recaba nada; Vercel recibe la IP). `INVESTIGACION_LEGAL.md` §2.7.
2. Que los términos sin cuentas no contienen ninguna cláusula nula frente a la LFPC (arts. 1, 85 y 90), en especial las cláusulas 11, 12, 16 y 17.
3. Domicilio: se decidió publicar el particular. Confirmar que cumple y, por si se cambia de idea, si una oficina virtual valdría como
   domicilio convencional (CCF art. 34). `INVESTIGACION_LEGAL.md` §5.
4. Licencia PolyForm Noncommercial frente a los términos del servicio (cláusula 5) y qué cuenta como «no comercial».

**P1 — antes de abrir cuentas**

5. Procedimiento de avisos de derechos de autor y política de reincidentes (cláusula 6): ¿cumple el art. 114 Octies LFDA para el texto
   sincronizado? ¿Hay formularios obligatorios por reglamento?
6. Forma de aceptación con cuentas (casilla, guardar versión y fecha) y de aviso de cambios (15 días naturales propuestos).
7. Edad mínima propuesta (18 años o autorización) y qué hacer si se detecta una cuenta de menor.
8. Plazos de borrado tras eliminar la cuenta: ¿basta con los del art. 31 LFPDPPP? ¿Hay que bloquear algo (art. 10)?
9. Relación con Supabase y Vercel como encargados: ¿basta aceptar sus términos y DPA? ¿Qué pasa si Vercel está en plan Hobby (sin DPA)?
10. Proyecto de Supabase compartido con otra app: ¿problema si la otra app tiene otro responsable?

**P2 — antes de cobrar o publicar el café**

11. Aportaciones voluntarias: ¿relación de consumo? ¿obligaciones fiscales y comprobantes (CFDI)? (`MONETIZACION.md`, M3).
12. Datos que se ven en Stripe (nombre, correo, importe): ¿datos patrimoniales con consentimiento expreso (LFPDPPP art. 7)?
13. Futuras funciones de pago: domicilio físico al consumidor (LFPC art. 76 Bis, fr. III), cobros recurrentes (fr. VIII y IX), registro del
    contrato de adhesión (arts. 86 a 88).

**P3 — cuando cambie el producto**

14. Cualquier función que lea letras o portadas de servicios externos, enlace a fuentes de música, recomiende, comparta playlists o suba
    audio (`INVESTIGACION_LEGAL.md` §3, tabla de puntos débiles).
15. Registro de la marca ante el IMPI y, si se quiere prueba de autoría, del programa ante INDAUTOR.

## 2. Preguntas concretas para la consulta

1. Sin cuentas, la app no recibe ningún dato; Vercel registra la IP de cada visita para servir la web. ¿Estoy obligado a tener aviso de
   privacidad? Si sí, ¿el texto «Al visitar la web» es suficiente?
2. La ley pide «identidad y domicilio del responsable». Soy persona física. ¿Puedo poner un domicilio convencional para oír y recibir
   notificaciones (oficina virtual) en lugar de mi casa? ¿Siguen vigentes los Lineamientos del Aviso de Privacidad de 2013 con la ley de 2025?
   ¿Se publicó un Reglamento nuevo?
3. ¿Un servicio gratuito como este crea una relación de consumo bajo la LFPC (art. 2, fr. II no menciona contraprestación)?
4. Cláusula 12: ¿es válida tal como está («solo daños directos; no respondo de lo que cause el navegador, el borrado de datos o terceros;
   nunca excluyo dolo ni culpa grave»)? ¿Puedo añadir un tope monetario sin caer en el art. 90, fr. II?
5. Cláusula 16: sin cuentas no puedo avisar a nadie de un cambio. ¿Basta con publicar la versión nueva con fecha? Con cuentas, ¿15 días
   naturales de aviso por correo es razonable?
6. Cláusula 17: «leyes de México, tribunales competentes conforme a ellas, sin perjuicio de Profeco». ¿Es mejor así que fijar tribunales?
7. ¿La app, al guardar en el navegador una copia de los archivos (Firefox/Safari) y miniaturas de portadas, hace reproducciones que
   necesitan una excepción de la LFDA? El art. 148, fr. IV habla de un solo ejemplar para uso personal. ¿La responsabilidad es del usuario?
8. Con cuentas guardo títulos, artistas y nombres de playlists. ¿Eso me hace «proveedor de servicios en línea» (art. 114 Septies, fr. II, b)?
   ¿El procedimiento de la cláusula 6 cumple el art. 114 Octies? ¿Debo concretar cuántos avisos hacen a alguien reincidente?
9. ¿Hay resoluciones de la Suprema Corte sobre los arts. 114 Bis a 114 Octies (reforma de 2020) que cambien algo?
10. La licencia del código es PolyForm Noncommercial. ¿Es coherente con que los términos rijan el uso de la web? ¿Qué es «comercial» en el
    caso de una empresa que la use internamente?
11. Edad mínima: ¿18 años o autorización de madre, padre o tutor es una fórmula válida sin verificar edades?
12. Eliminar una cuenta: ¿la trato como cancelación ARCO con los plazos del art. 31 (20 + 15 días hábiles)? ¿Debo conservar algo bloqueado?
13. Supabase (DPA aceptado con sus términos) y Vercel (DPA solo en plan Pro): ¿qué instrumento necesito con cada uno como encargados?
14. El café: aportación voluntaria sin contraprestación vía Stripe Payment Links. ¿Qué obligaciones fiscales y de consumo tengo? ¿Debo
    emitir comprobante? ¿Qué digo sobre reembolsos?
15. Los títulos de una playlist pueden revelar creencias. ¿Eso los vuelve datos sensibles aunque no los interprete?
16. ¿Conviene registrar el nombre como marca antes de publicar, y el código ante INDAUTOR?

## 3. Lo que ya está decidido (para no reabrirlo en la consulta salvo que haya un motivo legal)

- Responsable: persona física con nombre completo; correo en el dominio propio; domicilio particular (16-11-2026).
- Leyes de México sin fijar ciudad.
- Sin UE por ahora (L8).
- Primer lanzamiento sin cuentas; nada se cobra.
