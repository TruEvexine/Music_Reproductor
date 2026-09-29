# Plan Maestro — Reproductor de Música

## 1. Objetivo

Crear un reproductor de música moderno, responsive y orientado a escritorio/móvil, inspirado visualmente en **Qobuz** pero con una experiencia de reproducción más cercana a **Poweramp en móvil**: controles claros, información musical visible, cola de reproducción accesible y una interfaz dinámica que priorice la escucha.

El reproductor deberá:

- Detectar canciones incluidas dentro del proyecto.
- Detectar canciones añadidas posteriormente desde la carpeta `music`.
- Leer automáticamente sus metadatos.
- Mostrar portada, título, artista/autor, álbum y duración cuando estén disponibles.
- Reproducir, pausar y cambiar canciones.
- Manejar anterior/siguiente.
- Manejar loop/repetición.
- Mantener una cola de reproducción.
- Permitir visualizar y gestionar la fila.
- Mostrar qué canción sigue y cuál queda al final de la fila.
- Actualizar dinámicamente el tiempo reproducido y restante.
- Avanzar automáticamente cuando una canción termine.
- Adaptarse de forma nativa a distintos tamaños y orientaciones de pantalla.
- Contar con un backend básico de autenticación.
- Utilizar una base de datos conectada directamente a Supabase.
- Separar claramente la lógica de reproducción local de los datos persistentes de usuario.

> **Importante:** `design.md` será proporcionado posteriormente. No inventar ni fijar detalles visuales definitivos que deban venir de ese documento. Este plan establece la arquitectura y comportamiento; `design.md` definirá la dirección visual concreta.

---

# 2. Alcance funcional

## 2.1 Biblioteca musical local

La aplicación tendrá una carpeta principal:

```text
music/
```

Debe ser capaz de descubrir archivos de audio colocados:

```text
/music
/music/artist
/music/artist/album
```

La estructura de carpetas no deberá ser obligatoria para que una canción funcione.

El sistema deberá poder encontrar archivos de audio independientemente de su ubicación dentro de `music`, siempre que el formato sea compatible.

### Formatos

La implementación deberá definir una lista de formatos soportados por el motor de audio.

Como mínimo considerar:

- MP3
- FLAC
- WAV
- M4A/AAC
- OGG/Opus

Si algún formato no puede reproducirse directamente mediante la tecnología seleccionada, deberá quedar documentado en la implementación.

---

# 3. Lectura de metadatos

Al descubrir una canción, el sistema deberá intentar extraer:

- Título
- Artista
- Álbum
- Artista del álbum, si existe
- Número de pista
- Año
- Género
- Duración
- Portada embebida
- Formato
- Bitrate, si está disponible
- Sample rate, si está disponible

## 3.1 Fallbacks

Los metadatos pueden estar incompletos.

El reproductor deberá utilizar valores alternativos:

```text
Título:
    TITLE
    si falta → nombre del archivo

Artista:
    ARTIST
    si falta → "Artista desconocido"

Álbum:
    ALBUM
    si falta → "Álbum desconocido"

Portada:
    portada embebida
    si falta → portada genérica del sistema
```

Nunca deberá romperse la interfaz porque una canción no tenga metadata.

---

# 4. Escaneo de la carpeta music

El sistema tendrá un proceso de descubrimiento musical.

## Flujo inicial

```text
Inicio de aplicación
        ↓
Verificar carpeta music
        ↓
Crearla si no existe
        ↓
Escanear archivos compatibles
        ↓
Extraer metadata
        ↓
Construir biblioteca local
        ↓
Mostrar canciones disponibles
```

## Archivos nuevos

El sistema deberá permitir agregar canciones posteriormente.

Como mínimo deberá existir una acción para:

```text
Escanear biblioteca
```

Opcionalmente podrá implementarse detección automática de cambios de carpeta.

## Evitar duplicados

La misma canción no deberá aparecer repetida únicamente porque se realizó otro escaneo.

Se deberá utilizar un identificador estable basado, según la arquitectura elegida, en:

- ruta absoluta/relativa,
- tamaño,
- fecha de modificación,
- hash o identificador equivalente.

---

# 5. Modelo de canción

Crear una entidad/modelo similar a:

```text
Track
├── id
├── filePath
├── title
├── artist
├── album
├── albumArtist
├── trackNumber
├── year
├── genre
├── duration
├── coverArt
├── format
├── bitrate
├── sampleRate
└── metadataStatus
```

`metadataStatus` permitirá distinguir entre metadata completa, parcial o ausente.

La información de reproducción temporal no deberá mezclarse innecesariamente con la metadata permanente.

---

# 6. Motor de reproducción

Crear una capa dedicada exclusivamente a la reproducción.

Ejemplo conceptual:

```text
AudioPlayer
├── load(track)
├── play()
├── pause()
├── resume()
├── stop()
├── seek(position)
├── next()
├── previous()
├── setVolume()
├── getCurrentPosition()
├── getDuration()
└── getPlaybackState()
```

La interfaz gráfica no deberá controlar directamente el motor de audio en múltiples lugares.

Toda la reproducción deberá pasar por una única capa de servicio.

---

# 7. Controles mínimos

La interfaz deberá incluir:

## Reproducir / Pausar

Comportamiento:

```text
Si está detenido:
    reproducir

Si está reproduciendo:
    pausar

Si está pausado:
    continuar
```

## Anterior

Debe:

- Volver a la canción anterior de la cola.
- Si la canción actual lleva poco tiempo reproduciéndose, puede reiniciar la canción actual antes de retroceder, si este comportamiento se considera apropiado para el diseño final.

El comportamiento exacto deberá documentarse en la implementación.

## Siguiente

Debe:

```text
Si existe siguiente canción:
    reproducir siguiente

Si no existe:
    aplicar comportamiento de loop/fin de cola
```

## Loop

Implementar al menos:

```text
OFF
REPEAT QUEUE
REPEAT TRACK
```

Visualmente el estado seleccionado deberá ser evidente.

---

# 8. Cola / Playlist

La cola es una de las funciones principales.

Debe distinguirse entre:

### Canción actual

La canción que está reproduciéndose.

### Siguiente en la fila

La canción inmediatamente posterior.

### Último en la fila

La canción que se encuentra al final de la cola.

Ejemplo:

```text
▶ Canción actual
  ├── Siguiente
  ├── Canción 3
  ├── Canción 4
  └── Última canción
```

## Operaciones mínimas

La cola deberá permitir:

- Ver canciones.
- Reproducir una canción específica.
- Eliminar una canción.
- Reordenar canciones.
- Agregar canciones.
- Limpiar la cola.
- Mostrar canción actual.
- Mostrar claramente el orden de reproducción.

Opcionalmente:

- Arrastrar para reordenar.
- "Reproducir después".
- "Agregar al final".
- "Reproducir ahora".

---

# 9. Comportamiento de reproducción al terminar una canción

Cuando el audio llegue a su duración final:

```text
Evento END_OF_TRACK
        ↓
Consultar modo de repetición
        ↓
REPEAT TRACK
    → repetir actual

REPEAT QUEUE
    → siguiente
    → si termina la cola, volver al inicio

OFF
    → siguiente de la cola
    → si no existe, detener reproducción
```

Este comportamiento deberá estar centralizado en el controlador de reproducción.

No depender de que la interfaz gráfica detecte por su cuenta que terminó la canción.

---

# 10. Tiempo de reproducción

La interfaz deberá mostrar dinámicamente:

```text
00:42 / 04:17
```

o una variante equivalente definida por `design.md`.

Debe existir una barra de progreso interactiva.

El usuario deberá poder:

- Ver tiempo transcurrido.
- Ver duración total.
- Ver tiempo restante.
- Hacer seek arrastrando la barra.
- Hacer seek mediante interacción táctil en móvil.

El valor deberá actualizarse de forma fluida sin generar actualizaciones excesivas de UI.

---

# 11. Pantalla de reproducción

La pantalla principal de reproducción deberá mostrar como mínimo:

- Portada.
- Título.
- Artista.
- Álbum.
- Duración.
- Tiempo transcurrido.
- Tiempo restante.
- Barra de progreso.
- Anterior.
- Play/Pause.
- Siguiente.
- Loop.
- Acceso a la cola.

La composición exacta, tamaños, tipografía, iconografía, espaciado y tratamiento de la portada deberán definirse posteriormente en `design.md`.

---

# 12. Lista de canciones

La biblioteca/cola deberá mostrar visualmente:

```text
[PORTADA]  Título de canción
           Artista · Álbum
           04:21
```

La información mínima visible será:

- Portada.
- Título.
- Autor/artista.
- Duración.

Cuando el espacio lo permita:

- Álbum.
- Año.
- Formato.
- Calidad de audio.

En pantallas pequeñas deberá ocultarse información secundaria antes de sacrificar legibilidad.

---

# 13. Responsive Layout nativo

El diseño deberá ser realmente responsive, no una interfaz de escritorio simplemente escalada.

Se deberán contemplar como mínimo:

```text
Desktop
Tablet
Mobile
```

Y, cuando corresponda:

```text
Portrait
Landscape
```

## Principios

Los componentes deberán reorganizarse según el espacio disponible.

### Desktop

Puede utilizar:

```text
┌──────────────┬─────────────────────┐
│ Biblioteca   │ Reproductor         │
│              │                     │
│ Canciones    │ Portada             │
│              │ Información         │
│              │ Controles           │
└──────────────┴─────────────────────┘
```

### Mobile

La composición deberá transformarse en una estructura vertical y táctil:

```text
┌──────────────────┐
│      Portada     │
│                  │
│ Título           │
│ Artista          │
│                  │
│ ──────────────   │
│ 00:42     04:17  │
│                  │
│  ◀   ▶/Ⅱ   ▶    │
│                  │
│      Cola        │
└──────────────────┘
```

No asumir que la misma distribución desktop funcionará en móvil.

---

# 14. Interacción táctil

En tamaños móviles:

- Botones con áreas táctiles adecuadas.
- Gestos opcionales para navegación.
- Slider de progreso fácil de utilizar.
- Scroll suave en biblioteca y cola.
- Evitar controles demasiado pequeños.

La interfaz deberá funcionar correctamente con mouse y touch.

---

# 15. Backend y autenticación

El proyecto tendrá un backend básico orientado principalmente a:

- Registro.
- Inicio de sesión.
- Cierre de sesión.
- Persistencia de sesión.
- Usuario actual.
- Protección básica de datos asociados al usuario.

No convertir el backend inicial en una arquitectura innecesariamente compleja.

La reproducción local deberá poder funcionar independientemente de que exista una conexión constante con el backend, salvo las funciones explícitamente dependientes de cuenta.

---

# 16. Supabase

La persistencia remota utilizará **Supabase**.

La configuración deberá quedar separada del código sensible.

Nunca colocar:

- claves privadas,
- service role key,
- secretos,
- credenciales administrativas

directamente en el repositorio.

El cliente deberá utilizar únicamente las credenciales apropiadas para frontend/cliente.

---

# 17. Base de datos inicial

Como mínimo considerar una estructura equivalente a:

```text
profiles
├── id
├── username/display_name
├── avatar_url
└── created_at
```

Y, dependiendo de las funciones implementadas:

```text
playlists
├── id
├── user_id
├── name
└── created_at

playlist_tracks
├── id
├── playlist_id
├── track_identifier
├── position
└── created_at
```

La metadata de archivos locales no debe asumirse automáticamente como un archivo físico disponible en Supabase.

Debe diferenciarse entre:

```text
Archivo musical local
```

y

```text
Registro remoto asociado al usuario
```

---

# 18. Documento SUPABASE.md

La integración de Supabase deberá explicarse también en un documento independiente:

```text
SUPABASE.md
```

Ese documento deberá contener:

- Crear proyecto Supabase.
- Configuración de Authentication.
- Variables de entorno.
- URL del proyecto.
- Anon/Public key.
- Estructura SQL.
- Tablas.
- Relaciones.
- Row Level Security.
- Policies.
- Flujo de registro.
- Flujo de login.
- Flujo de logout.
- Persistencia de sesión.
- Configuración del cliente.
- Qué datos deben permanecer locales.
- Qué datos pueden sincronizarse.
- Qué secretos nunca deben exponerse.

Si la IA encargada del desarrollo puede conectarse directamente a Supabase mediante una herramienta autorizada, deberá utilizar dicha conexión para comprobar la estructura real antes de modificarla.

Si no puede acceder a Supabase:

1. No inventar credenciales.
2. No asumir que las tablas existen.
3. Generar el SQL necesario.
4. Documentar exactamente qué debe ejecutar/configurar el usuario.
5. Pedir únicamente los datos que realmente sean necesarios.

---

# 19. Arquitectura propuesta

Separar el proyecto aproximadamente en:

```text
UI
│
├── Library View
├── Player View
├── Queue View
├── Login View
└── Settings View
        │
        ▼
Application / Controllers
        │
        ├── PlaybackController
        ├── QueueController
        ├── LibraryController
        ├── AuthController
        └── SettingsController
        │
        ▼
Services
        │
        ├── AudioService
        ├── MetadataService
        ├── LibraryScanner
        ├── QueueService
        ├── SupabaseService
        └── CoverArtService
        │
        ▼
Data
        │
        ├── Local filesystem
        └── Supabase
```

La estructura real deberá adaptarse al framework elegido, pero deberá conservar esta separación conceptual.

---

# 20. Estado global del reproductor

El reproductor deberá tener un estado central.

Ejemplo:

```text
PlayerState
├── currentTrack
├── isPlaying
├── currentPosition
├── duration
├── volume
├── repeatMode
├── queue
└── currentQueueIndex
```

La UI deberá observar este estado en lugar de mantener copias independientes.

Esto evitará inconsistencias como:

```text
La UI dice "pausa"
pero el motor sigue reproduciendo.
```

---

# 21. Máquina de estados

Estados mínimos:

```text
IDLE
LOADING
PLAYING
PAUSED
STOPPED
ERROR
```

Transiciones importantes:

```text
IDLE → LOADING → PLAYING
PLAYING → PAUSED
PAUSED → PLAYING
PLAYING → LOADING
PLAYING → STOPPED
LOADING → ERROR
```

La implementación deberá manejar correctamente errores de archivo, formato incompatible y archivos eliminados.

---

# 22. Manejo de errores

El reproductor no deberá cerrarse por:

- Canción corrupta.
- Metadata inválida.
- Portada inválida.
- Archivo eliminado.
- Formato incompatible.
- Error de lectura.
- Error de conexión con Supabase.

En caso de error de una canción durante una reproducción automática:

```text
Error
 ↓
Registrar error
 ↓
Notificar al usuario
 ↓
Intentar siguiente canción
```

cuando dicha estrategia sea segura.

---

# 23. Portadas

Las portadas deberán poder provenir de:

1. Metadata embebida.
2. Archivo de portada asociado, si se implementa.
3. Imagen genérica.

La portada no deberá bloquear la reproducción durante demasiado tiempo.

Cuando sea necesario, cargar imágenes de forma asíncrona y utilizar caché.

---

# 24. Rendimiento

Consideraciones mínimas:

- No cargar todos los archivos de audio completos en memoria.
- Leer metadata de forma eficiente.
- Utilizar caché para portadas.
- Evitar reconstruir toda la biblioteca ante cada interacción.
- Actualizar el progreso de reproducción sin sobrecargar la UI.
- Mantener reproducción fluida mientras se hace scroll.
- Evitar bloqueos durante el escaneo de `music`.

Si existen cientos o miles de canciones, la biblioteca deberá seguir siendo usable.

---

# 25. Persistencia local

Considerar persistir:

- Última canción.
- Posición aproximada.
- Volumen.
- Modo de loop.
- Cola, si resulta útil.
- Preferencias de interfaz.

No asumir que todo debe ir a Supabase.

La reproducción local y las preferencias básicas deberán priorizar una experiencia rápida.

---

# 26. Seguridad

Reglas mínimas:

- No almacenar contraseñas manualmente.
- Delegar autenticación de credenciales a Supabase Auth.
- No usar service role keys en el cliente.
- Validar sesión.
- Aplicar Row Level Security en datos privados.
- No confiar exclusivamente en validaciones visuales del frontend.
- No guardar secretos dentro del repositorio.

---

# 27. UX de reproducción

La experiencia deberá comunicar siempre:

```text
¿Qué canción estoy escuchando?
¿Dónde estoy dentro de ella?
¿Qué canción sigue?
¿Está reproduciendo o pausada?
¿Qué modo de repetición está activo?
```

La información importante deberá permanecer accesible sin navegar por múltiples pantallas.

---

# 28. Diseño visual

## Referencias

La dirección general combinará:

**Qobuz**
- Elegancia.
- Jerarquía editorial.
- Presentación musical premium.
- Uso importante de portadas.
- Sensación de catálogo musical.

**Poweramp Mobile**
- Enfoque directo en reproducción.
- Controles accesibles.
- Información técnica/reproductiva.
- Interfaz orientada a uso frecuente.
- Adaptación móvil.

El resultado **no debe ser una copia literal** de ninguna de las dos aplicaciones.

Debe tomar principios de ambas y desarrollar una identidad propia.

Los detalles definitivos deberán venir de:

```text
design.md
```

que será proporcionado posteriormente.

---

# 29. Design.md

Cuando se proporcione `design.md`, utilizarlo como fuente principal para:

- Paleta.
- Tipografía.
- Iconografía.
- Bordes.
- Sombras.
- Espaciado.
- Cards.
- Player.
- Navegación.
- Responsive breakpoints visuales.
- Tratamiento de portadas.
- Estados hover/pressed/active.
- Estados de reproducción.
- Animaciones.

No reemplazar las especificaciones de `design.md` por decisiones genéricas si existe una indicación concreta allí.

---

# 30. Animaciones

Las animaciones deberán ser funcionales y discretas.

Ejemplos:

- Cambio de canción.
- Aparición de portada.
- Expansión del reproductor.
- Apertura de cola.
- Cambio de estado play/pause.
- Progreso de reproducción.
- Reordenamiento de cola.

Evitar animaciones que interfieran con controles de reproducción.

---

# 31. Accesibilidad

Considerar:

- Contraste suficiente.
- Estados activos claramente visibles.
- Texto legible.
- Áreas táctiles apropiadas.
- Navegación mediante teclado cuando la plataforma lo permita.
- Tooltips para controles cuyo significado pueda ser ambiguo.
- No depender únicamente del color para comunicar estados.

---

# 32. Flujo de usuario principal

```text
Abrir aplicación
      ↓
Cargar sesión
      ↓
Inicializar reproductor
      ↓
Escanear music/
      ↓
Construir biblioteca
      ↓
Usuario selecciona canción
      ↓
Agregar a cola
      ↓
Reproducir
      ↓
Mostrar portada + metadata
      ↓
Actualizar progreso
      ↓
Canción termina
      ↓
Resolver siguiente elemento
      ↓
Reproducir siguiente
```

---

# 33. Flujo de login

```text
Abrir aplicación
      ↓
¿Existe sesión?
 ┌────┴────┐
Sí         No
↓           ↓
App       Login
            ↓
       Autenticación
            ↓
        Sesión válida
            ↓
           App
```

La aplicación deberá decidir qué funciones son públicas y cuáles requieren autenticación.

La reproducción de archivos locales debería mantenerse separada de la autenticación siempre que sea razonable.

---

# 34. Criterios de aceptación

El MVP será considerado funcional cuando:

### Biblioteca

- [ ] Detecta archivos dentro de `music`.
- [ ] Lee metadata.
- [ ] Detecta portadas embebidas.
- [ ] Usa fallbacks cuando falta metadata.
- [ ] No duplica canciones al volver a escanear.

### Reproducción

- [ ] Play funciona.
- [ ] Pause funciona.
- [ ] Resume funciona.
- [ ] Previous funciona.
- [ ] Next funciona.
- [ ] Seek funciona.
- [ ] Loop funciona.
- [ ] Avanza automáticamente al terminar.
- [ ] El tiempo se actualiza dinámicamente.

### Cola

- [ ] Se puede visualizar.
- [ ] Se puede agregar.
- [ ] Se puede eliminar.
- [ ] Se puede reordenar.
- [ ] Se identifica la canción actual.
- [ ] Se identifica correctamente la siguiente.
- [ ] Se identifica el último elemento.
- [ ] La reproducción respeta el orden.

### UI

- [ ] Muestra portada.
- [ ] Muestra título.
- [ ] Muestra artista.
- [ ] Muestra duración.
- [ ] Es responsive.
- [ ] Funciona en desktop.
- [ ] Funciona en mobile.
- [ ] Funciona en portrait/landscape cuando aplique.

### Backend

- [ ] Registro.
- [ ] Login.
- [ ] Logout.
- [ ] Persistencia de sesión.
- [ ] Conexión con Supabase.
- [ ] Policies básicas.
- [ ] No existen secretos expuestos.

---

# 35. Orden recomendado de implementación

## Fase 1 — Base del proyecto

- Crear estructura.
- Configurar dependencias.
- Configurar entorno.
- Crear `music/`.
- Preparar arquitectura.

## Fase 2 — Audio

- Implementar `AudioService`.
- Cargar canciones.
- Play/pause.
- Previous/next.
- Seek.
- Detección de fin de canción.

## Fase 3 — Metadata

- Implementar metadata reader.
- Portadas.
- Fallbacks.
- Modelo `Track`.

## Fase 4 — Biblioteca

- Scanner.
- Lista.
- Actualización.
- Detección de archivos nuevos.
- Cache.

## Fase 5 — Cola

- QueueService.
- Agregar/eliminar.
- Reordenar.
- Repeat modes.
- Auto-next.

## Fase 6 — UI principal

- Player.
- Library.
- Queue.
- Controles.
- Tiempo.
- Portadas.

## Fase 7 — Responsive

- Desktop.
- Tablet.
- Mobile.
- Portrait.
- Landscape.
- Touch.

## Fase 8 — Backend

- Supabase.
- Auth.
- Sesión.
- Base de datos.
- RLS.

## Fase 9 — Diseño final

Aplicar `design.md`.

## Fase 10 — QA

Probar:

- MP3.
- FLAC.
- WAV.
- M4A/AAC.
- OGG/Opus.
- Sin metadata.
- Sin portada.
- Archivo corrupto.
- Archivo eliminado.
- Cola vacía.
- Una sola canción.
- Muchas canciones.
- Repeat Track.
- Repeat Queue.
- Loop Off.
- Login/logout.
- Cambio de orientación.
- Ventanas pequeñas.
- Pantallas táctiles.

---

# 36. Regla principal de implementación

No construir solamente una maqueta visual.

La aplicación deberá priorizar una separación clara entre:

```text
Interfaz
↓
Estado
↓
Lógica de reproducción
↓
Biblioteca
↓
Archivos locales
↓
Backend/Supabase
```

Cada parte deberá poder modificarse sin romper innecesariamente las demás.

El objetivo es obtener un reproductor funcional y ampliable, no únicamente una pantalla que parezca un reproductor.

---

# 37. Entregables

El proyecto deberá terminar con:

```text
/Proyecto
│
├── /src
├── /music
├── /resources
├── .env.example
├── README.md
├── PLAN.md
├── SUPABASE.md
└── design.md
```

`design.md` será añadido posteriormente por el usuario.

`SUPABASE.md` deberá contener toda la configuración necesaria para que otra persona pueda conectar el proyecto a una instancia de Supabase sin tener que deducir pasos faltantes.


# 38. Documentación adicional del proyecto

El proyecto deberá incluir también:

```text
DESIGN.md
AGENTS.md
SUPABASE.md
```

## DESIGN.md

Documento visual basado en las referencias proporcionadas por el usuario.

Debe especificar:

- Dirección visual Qobuz + Poweramp moderno.
- Biblioteca.
- Player inferior.
- Player expandido.
- Cola.
- Responsive.
- Estados de controles.
- Tipografía.
- Iconografía.
- Menús.
- Animaciones.
- Accesibilidad.
- Sistema de color dinámico basado en la portada.

### Requisito especial: fondo dinámico

El fondo del reproductor deberá cambiar de forma dinámica según los colores predominantes de la portada de la canción actual.

La implementación deberá:

1. Analizar la portada.
2. Obtener una paleta.
3. Generar colores adecuados para fondo/acento.
4. Corregir luminosidad/saturación para conservar contraste.
5. Transicionar suavemente desde la paleta anterior.
6. Mantener la identidad visual del producto.

No se debe utilizar simplemente el color dominante puro como fondo.

## AGENTS.md

Documento de instrucciones para agentes de IA que trabajen posteriormente sobre el proyecto.

Debe establecer:

- Orden de lectura de documentación.
- Arquitectura y separación de responsabilidades.
- Reglas de audio.
- Reglas de metadata.
- Reglas de cola.
- Reglas responsive.
- Reglas de diseño.
- Reglas del sistema de color dinámico.
- Reglas de Supabase.
- Seguridad.
- Pruebas obligatorias.
- Prohibición de inventar APIs, credenciales o capacidades.
- Prohibición de sobreingeniería.
- Proceso de inspección → implementación → pruebas → reporte.

`AGENTS.md` deberá tratarse como la guía operativa para cualquier agente que continúe el desarrollo.
