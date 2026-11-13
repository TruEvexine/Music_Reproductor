# Product

<!-- impeccable:product-schema 1 -->

> Registro de producto para las skills de diseño (impeccable). Resume lo ya decidido en `docs/producto/` y `PLAN.md`; si algo
> choca, mandan esos documentos. Escrito el 2026-11-13.

## Platform

web

PWA primero; después Android y luego iPhone con la misma base de código (Capacitor, `docs/ARQUITECTURA_APP.md`). El lenguaje visual
es uno solo y se adapta con `data-platform`, no con forks nativos.

## Users

Personas que **tienen su propia biblioteca de música en archivos** (MP3, M4A, WAV y sobre todo FLAC) y quieren la comodidad de un
servicio de streaming sin subir su música a nadie. El público es amplio (cualquiera con música descargada), pero **el nicho que define
el producto es quien cuida la calidad de sonido**: FLAC y alta resolución, ReplayGain, ecualizador, datos técnicos a la vista.

México y español primero; la versión en inglés queda para después (`ROADMAP.md`, Fase 3). Uso principal en el teléfono, también en la
computadora.

## Product Purpose

Un reproductor **local-first**: lee los archivos en el dispositivo, funciona completo sin cuenta y sin red, y se ve y se maneja como
una app premium. Éxito: que escuchar tu propia música sea tan cómodo como un streaming, sin entregar tu biblioteca.

## Positioning

Reproduce como Poweramp y se presenta como Qobuz (`DESIGN.md` §1), sin copiar a ninguno. Lo que un streaming no puede decir con
verdad: **tu música no se sube** — la CSP solo permite conectar con el propio dominio y con el servidor de cuentas — y la calidad es la
de tus archivos, sin recompresión.

## Operating Context

- Importar una carpeta o archivos; la biblioteca se guarda en IndexedDB y se escanea por diferencias. Miles de pistas (pruebas con
  5 000).
- Reproductor expandido con la portada a todo el ancho y su color inundando el fondo; controles en la mitad inferior.
- Cuenta opcional: solo sincroniza playlists (Supabase). Sin cuenta lo tienes todo.

## Capabilities and Constraints

- Audio: FLAC, ReplayGain, ecualizador, crossfade, volumen, shuffle, repetición off/cola/pista, letras, temporizador.
- Biblioteca persistente, playlists locales primero, copia de seguridad en archivo, Ajustes, fondos (Portada, Ritmo, Estático,
  AMOLED) y HDR simulado.
- Gratis todo lo que corre en el dispositivo; apoyo voluntario; premium futuro solo para lo que cuesta servidor (`MONETIZACION.md`).
  Sin anuncios.
- Técnicas: React 19 + Vite + TS; CSP cerrada (fuentes y recursos autoalojados, sin CDN); animar solo `transform`/`opacity`.
- **Sin decidir:** dominio y redes (`docs/marca/MARCA_DEFINITIVA.md` §6). Los textos de la app dicen «Music Reproductor» hasta
  registrar «Satin».

## Brand Commitments

- Nombre: **Satin** (2026-11-13; pendiente de IMPI). Debe evocar **calidad de sonido, elegancia y modernidad**. Logo «Trama al
  bies», oro arena `#e6c686` sobre negro cálido, logotipo en Instrument Serif; sin verde. Todo en `docs/marca/MARCA_DEFINITIVA.md`.
- Voz: cercana, de tú, directa; cada frase comprobable contra el código. «Nosotros» firma como «una persona en México», sin nombre real.
- La interfaz no tiene color de marca fijo: el acento sale de la portada que suena. El logo sí tendrá color fijo (`MARCA.md` §3).
- Evitar en el logo: ondas de audio, auriculares, notas musicales y degradados (clichés de la categoría, `MARCA.md` §3).

## Evidence on Hand

- Capturas reales de la app en `docs/capturas/` (matriz de `scripts/capturas.mjs`).
- Textos: `docs/COPY_LANDING.md`, `docs/producto/FAQ.md`, legales en borrador.
- Logo y sistema: `docs/marca/logo/`. **No hay** testimonios, usuarios, cifras de uso ni prensa. No inventarlos. Nunca se versiona ni se muestra audio con derechos.

## Product Principles

1. La música del usuario es suya y es local; la nube es opcional.
2. Respuesta inmediata: nada bloquea la reproducción; nada de esperas artificiales.
3. Pulgar primero en móvil.
4. Lo que decimos es verdad: no se anuncia lo que no existe.
5. Sin sobreingeniería: cada fase entrega algo usable.

## Accessibility & Inclusion

Uso completo con teclado, áreas táctiles ≥ 44 px, zoom de texto al 200 %, contraste ≥ 4.5:1 en texto, nada depende solo del color ni
del hover; respeta `prefers-reduced-motion`, `prefers-color-scheme` y `prefers-contrast`.
