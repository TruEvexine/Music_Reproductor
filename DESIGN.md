# DESIGN.md — Sistema Visual del Reproductor

## 1. Dirección visual

El reproductor debe combinar dos referencias principales:

- **Qobuz** como referencia de estructura, elegancia, jerarquía musical, biblioteca y tratamiento editorial.
- **Poweramp Mobile** como referencia de reproductor moderno, controles directos, información de reproducción y enfoque en la experiencia de escucha.

El resultado debe sentirse como un producto propio y moderno. **No se debe copiar literalmente la interfaz de Qobuz ni de Poweramp.**

Las tres imágenes proporcionadas por el usuario son las referencias visuales principales para este documento.

---

# 2. Principio visual principal: la canción controla el ambiente

La característica visual más importante del reproductor será que **el ambiente del reproductor cambia dinámicamente según la portada de la canción que está reproduciéndose**.

La portada no será únicamente una imagen decorativa.

Su contenido deberá influir en:

- Color de fondo.
- Gradientes.
- Tonos de superficies.
- Acentos.
- Iluminación visual.
- Algunas transiciones entre canciones.

## Objetivo

Cada canción debe producir una atmósfera visual ligeramente diferente sin perder la identidad general de la aplicación.

Ejemplo conceptual:

```text
Portada con predominancia azul
        ↓
Fondo oscuro con dominante azul

Portada con predominancia roja
        ↓
Fondo oscuro con dominante roja

Portada amarilla/naranja
        ↓
Fondo oscuro con dominante ámbar/naranja

Portada verde
        ↓
Fondo oscuro con dominante verde
```

El fondo **no debe convertirse literalmente en el color dominante de la portada**. Debe utilizarse una versión adaptada, oscurecida y/o desaturada para conservar contraste y legibilidad.

---

# 3. Extracción dinámica de color

Crear un sistema de extracción de color de portada.

## Flujo

```text
Portada de canción
       ↓
Analizador de imagen
       ↓
Colores predominantes
       ↓
Color dominante / paleta
       ↓
Normalización
       ↓
Paleta visual de UI
       ↓
Aplicar transición
```

Como mínimo obtener:

```text
primaryColor
secondaryColor
backgroundColor
accentColor
```

## Reglas

El sistema deberá:

- Evitar colores demasiado brillantes como fondo completo.
- Mantener suficiente contraste.
- Oscurecer la paleta para el fondo.
- Mantener el texto legible.
- Permitir que el color dominante sea perceptible sin resultar invasivo.
- Evitar cambios excesivamente bruscos cuando las portadas son muy diferentes.

## Transición

Al cambiar de canción:

```text
Paleta anterior
       ↓
transición suave
       ↓
Paleta nueva
```

La transición deberá ser breve y elegante.

No hacer que toda la interfaz parpadee.

---

# 4. Fondo del reproductor

El fondo deberá ser predominantemente oscuro.

No utilizar un negro plano como única opción.

Preferentemente:

```text
base oscura
+
gradiente derivado de portada
+
variaciones sutiles de luminosidad
```

Ejemplo conceptual:

```text
┌──────────────────────────────────────────────┐
│                                              │
│     Fondo oscuro                             │
│        ╲                                     │
│         ╲ tono derivado de portada          │
│          ╲                                  │
│                                              │
└──────────────────────────────────────────────┘
```

El fondo puede utilizar:

- Gradiente radial.
- Gradiente lineal.
- Glow muy sutil.
- Overlay oscuro.

No utilizar un efecto excesivamente saturado.

---

# 5. Identidad base

Aunque el color cambie por canción, la aplicación debe conservar una identidad estable.

Elementos que deben permanecer consistentes:

- Tipografía.
- Tamaños de controles.
- Iconografía.
- Espaciado.
- Estructura.
- Bordes.
- Jerarquía.
- Comportamiento responsive.

La portada cambia el **ambiente**, no la arquitectura.

---

# 6. Estética general

Características deseadas:

- Premium.
- Oscura.
- Moderna.
- Limpia.
- Musical.
- Editorial.
- Minimalista sin ser vacía.
- Información abundante pero jerarquizada.

Evitar:

- UI genérica de reproductor.
- Exceso de tarjetas flotantes.
- Neumorphism.
- Glassmorphism exagerado.
- Gradientes artificiales demasiado fuertes.
- Colores arbitrarios que no provengan de la canción.
- Interfaces excesivamente similares a Spotify.

---

# 7. Navegación principal

En escritorio, utilizar una navegación lateral inspirada en la estructura observada en las referencias.

Conceptualmente:

```text
┌───────────────┬───────────────────────────────────┐
│ Logo          │                                   │
│               │        CONTENIDO                  │
│ Biblioteca    │                                   │
│ Playlists     │                                   │
│ Pistas        │                                   │
│ Álbumes       │                                   │
│ Artistas      │                                   │
│ Sellos        │                                   │
│               │                                   │
└───────────────┴───────────────────────────────────┘
```

La navegación deberá ser compacta y no consumir espacio innecesario.

En móvil deberá convertirse en una navegación apropiada para pantalla pequeña.

---

# 8. Header

El header deberá contener, dependiendo del contexto:

- Logo.
- Navegación.
- Buscador.
- Acciones de usuario.
- Acciones contextuales.

La referencia visual muestra un header compacto y oscuro.

Debe evitarse un header excesivamente alto.

---

# 9. Biblioteca

La biblioteca será principalmente visual.

La referencia principal es la primera y tercera imagen.

## Grid

Las canciones/álbumes podrán mostrarse como:

```text
┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │          │  │          │
│ PORTADA  │  │ PORTADA  │  │ PORTADA  │
│          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
Título        Título        Título
Artista       Artista       Artista
```

El número de columnas deberá adaptarse automáticamente al ancho disponible.

No fijar un número rígido de columnas.

---

# 10. Tarjetas musicales

Las tarjetas deberán priorizar:

1. Portada.
2. Título.
3. Artista.
4. Álbum o metadata secundaria.

Opcional:

- Indicador Hi-Res.
- Formato.
- Calidad.
- Estado de reproducción.

## Acción de reproducción

Las referencias muestran un botón circular de play superpuesto a la portada.

Mantener este concepto:

```text
┌───────────────┐
│               │
│    PORTADA    │
│               │
│  ●            │
└───────────────┘
```

El botón deberá aparecer:

- En hover en escritorio, o
- Cuando sea necesario para hacerlo evidente.

En touch deberá ser fácilmente accesible.

---

# 11. Información musical

La información deberá respetar jerarquía.

Ejemplo:

```text
Superhero (Heroes & Villains)
Pista · Metro Boomin · HEROES & VILLAINS
```

El título tendrá mayor peso visual.

El artista y álbum serán secundarios.

No permitir que textos largos destruyan el layout.

Usar:

- truncamiento,
- ellipsis,
- tooltip,
- segunda línea cuando exista espacio.

---

# 12. Player inferior

La referencia de Qobuz utiliza un reproductor persistente en la parte inferior.

Mantener este concepto.

El mini-player deberá permanecer visible mientras el usuario navega por la biblioteca, salvo en contextos móviles donde se adapte.

Conceptualmente:

```text
┌──────────────────────────────────────────────────────────────┐
│ portada │ canción │ tiempo │ controles │ volumen │ calidad  │
└──────────────────────────────────────────────────────────────┘
```

Debe mostrar como mínimo:

- Portada.
- Título.
- Artista.
- Tiempo actual.
- Duración.
- Play/Pause.
- Previous.
- Next.
- Loop/Repeat.
- Acceso a la cola.

---

# 13. Player expandido

La segunda imagen es la referencia principal para el reproductor expandido.

Debe existir una vista de reproducción más grande.

Conceptualmente:

```text
┌──────────────────────────────────────────────────────────────┐
│                        PLAYER                                │
│                                                              │
│      ┌─────────────────┐        ┌────────────────────────┐  │
│      │                 │        │ Cola                   │  │
│      │     PORTADA     │        │                        │  │
│      │                 │        │ Canción 1              │  │
│      │                 │        │ Canción 2              │  │
│      └─────────────────┘        │ Canción 3              │  │
│                                 └────────────────────────┘  │
│      Título                                                   │
│      Artista                                                  │
│      ────────────────●────────────                            │
│      00:24                         03:02                     │
│                                                              │
│           shuffle   prev   play   next   repeat              │
└──────────────────────────────────────────────────────────────┘
```

La distribución exacta puede cambiar según viewport.

---

# 14. Cola

La cola debe estar disponible desde el reproductor.

Cada elemento deberá mostrar:

- Miniatura.
- Título.
- Artista.
- Estado actual.
- Acción secundaria.

La canción actual deberá distinguirse claramente.

Ejemplo:

```text
[cover]  Canción actual
         Artista

[cover]  Siguiente canción
         Artista

[cover]  Canción siguiente
         Artista
```

La cola debe poder abrirse sin abandonar completamente el contexto del reproductor.

---

# 15. Lectura automática

Cuando se implemente la función de reproducción automática:

```text
Lectura automática
Se reproducirán pistas similares cuando termine la cola.
```

Debe utilizarse una superficie visual coherente con la referencia proporcionada.

No es obligatorio implementar recomendación inteligente en el MVP; el diseño debe dejar espacio para la funcionalidad futura.

---

# 16. Controles

Los controles principales deben ser fáciles de localizar.

Orden recomendado:

```text
Shuffle
Previous
Play/Pause
Next
Repeat
```

El botón Play/Pause deberá tener mayor peso visual.

Estados:

```text
normal
hover
pressed
active
disabled
```

Los estados activos deberán ser visibles.

---

# 17. Progreso

La barra de progreso deberá ser fina y elegante.

Mostrar:

```text
00:24                       03:02
──────────────●──────────────
```

Debe permitir seek.

El progreso deberá actualizarse en tiempo real.

---

# 18. Volumen

El control de volumen debe aparecer principalmente en desktop.

En móvil puede integrarse en una zona secundaria o depender del control del dispositivo, pero la aplicación deberá conservar una forma de modificar el volumen cuando la plataforma lo permita.

---

# 19. Calidad de audio

La interfaz puede mostrar información técnica cuando esté disponible:

```text
Hi-Res
24-Bit
96 kHz
Estéreo
```

Esta información debe ser secundaria.

No debe competir visualmente con:

- título,
- artista,
- controles.

---

# 20. Responsive

## Desktop

Prioridad:

- Biblioteca visible.
- Sidebar.
- Player persistente.
- Grid amplio.
- Información técnica.

## Tablet

Reducir:

- Sidebar.
- Columnas.
- Metadata secundaria.

## Mobile

Prioridad:

1. Portada.
2. Título/artista.
3. Progreso.
4. Controles.
5. Cola.

La navegación deberá transformarse a un patrón apropiado para móvil.

---

# 21. Mobile player

En móvil la experiencia deberá sentirse más cercana a un reproductor dedicado.

La portada tendrá mayor protagonismo.

Ejemplo:

```text
┌──────────────────────┐
│                      │
│       PORTADA        │
│                      │
│                      │
├──────────────────────┤
│ Título               │
│ Artista              │
│                      │
│ 00:24        03:02   │
│ ───────●──────────   │
│                      │
│  ↶    ◀   ▶   ▶   ↷  │
│                      │
│      Cola / Queue    │
└──────────────────────┘
```

Los controles deben tener áreas táctiles grandes.

---

# 22. Tipografía

La tipografía debe ser:

- Sans-serif.
- Moderna.
- Legible.
- Con buena diferenciación de pesos.

Jerarquía:

```text
Título de página
↓
Título musical
↓
Artista / álbum
↓
Metadata
↓
Metadata técnica
```

No utilizar demasiadas familias tipográficas.

---

# 23. Iconografía

Usar una única familia de iconos coherente.

Iconos necesarios:

- Search.
- Home/Library.
- Playlist.
- Track.
- Album.
- Artist.
- Label.
- Play.
- Pause.
- Previous.
- Next.
- Shuffle.
- Repeat.
- Volume.
- Queue.
- Favorite.
- Settings.
- User.
- More.

Evitar mezclar estilos de iconos incompatibles.

---

# 24. Botones

Los botones deben tener:

- Área táctil suficiente.
- Estados visibles.
- Icono claro.
- Tooltip cuando corresponda.

Los botones circulares funcionan especialmente bien para:

- Play.
- Pause.
- Previous.
- Next.

---

# 25. Menús contextuales

La tercera imagen muestra un menú de usuario contextual.

Los menús deberán:

- Mantener el tema oscuro.
- Tener separación clara entre grupos.
- Utilizar iconos discretos.
- Mostrar acciones destructivas de forma diferenciada.
- No ocupar más espacio del necesario.

---

# 26. Animaciones visuales

La interfaz deberá utilizar movimiento de forma funcional.

### Cambio de canción

```text
Canción A
   ↓
Portada nueva
   ↓
Extracción de color
   ↓
Transición de fondo
```

### Cambio de player

El mini-player puede expandirse hacia el player completo mediante una transición suave.

### Cola

La cola puede entrar/salir con una transición corta.

Evitar animaciones largas.

---

# 27. Accesibilidad visual

Siempre mantener:

- Contraste suficiente.
- Texto legible sobre fondos dinámicos.
- No usar exclusivamente color para indicar estado.
- Iconos reconocibles.
- Focus states.
- Áreas táctiles adecuadas.

El algoritmo de colores deberá tener una capa de corrección de contraste.

---

# 28. Reglas de color dinámico

La portada puede generar una paleta, pero la interfaz debe tener límites.

### Permitido

```text
Oscurecer
Desaturar
Mezclar
Aumentar contraste
Reducir luminosidad
```

### No permitido

```text
Texto ilegible
Fondo completamente saturado
Controles sin contraste
Cambiar colores estructurales arbitrariamente
```

La identidad de marca permanece estable.

---

# 29. Estados de reproducción

Debe ser posible distinguir:

```text
No reproducida
Reproduciendo
Pausada
Error
```

La canción actual puede utilizar:

- icono de reproducción,
- acento dinámico,
- cambio sutil de fondo,
- highlight.

No utilizar animaciones agresivas.

---

# 30. Reglas de responsive

Nunca:

- Fijar tamaños que rompan el layout.
- Depender únicamente de coordenadas absolutas.
- Hacer que la UI desktop simplemente se reduzca.
- Permitir que controles queden fuera de pantalla.

Sí:

- Usar layouts fluidos.
- Usar grids adaptativos.
- Reorganizar componentes.
- Reducir metadata secundaria.
- Cambiar navegación según viewport.

---

# 31. Prioridades visuales

En cualquier viewport:

### Prioridad 1
Canción actual.

### Prioridad 2
Controles de reproducción.

### Prioridad 3
Portada.

### Prioridad 4
Cola/biblioteca.

### Prioridad 5
Metadata secundaria.

### Prioridad 6
Metadata técnica.

Si el espacio es insuficiente, ocultar/reducir elementos en ese orden inverso.

---

# 32. Regla final de diseño

El reproductor debe sentirse como:

> **Una biblioteca musical premium que se transforma visualmente alrededor de la canción que estás escuchando.**

Qobuz aporta la estructura editorial y de biblioteca.

Poweramp aporta la sensación de reproductor dedicado.

El color dinámico de la portada conecta ambos conceptos y se convierte en una característica propia del producto.
