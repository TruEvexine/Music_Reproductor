# Diseño: panel de estadísticas de escucha

Estado: **propuesta para aprobar antes de implementar**. Disponible **solo con cuenta**. Es la función más delicada
(datos del usuario + base compartida), por eso se diseña primero y se implementa en dos pasos.

## Qué se mide

Canciones y artistas más escuchados · minutos por artista, álbum y género · géneros · hábitos (hora del día, día de la
semana, racha de días, sesiones) · evolución en el tiempo (semana/mes/año) · porcentaje completado vs. saltado · calidad
(FLAC/hi-res vs. comprimido) · biblioteca (tamaño, canciones nunca reproducidas).

## Qué es una "reproducción" (regla de conteo)

Cuenta si se escuchó ≥ 30 s **y** ≥ 50 % de la pista, o ≥ 4 min (lo habitual en scrobblers). Se guarda también el tiempo
realmente escuchado (`listened_ms`) para sumar minutos aunque no cuente como reproducción. Saltos y repeticiones se registran.

## Captura (local primero)

- Evento por pista en IndexedDB (`play_events`, versión de esquema nueva, migración aditiva) y cola `outbox` ya existente
  para sincronizar.
- Campos: `track_key`, `title`, `artist`, `album`, `genre`, `year`, `duration_ms`, `listened_ms`, `completed`,
  `started_at` (UTC), `source` (biblioteca/playlist/cola), `format`.
- **Desnormalizado:** las pistas locales no existen en el servidor, por lo que cada evento lleva sus metadatos.
- Géneros: normalizar (minúsculas, alias, separar "Rock; Pop") antes de agregar.
- **Decisión pendiente (D19):** ¿capturar siempre en local y subir solo con cuenta (recomendado: al crear cuenta aparece el
  historial ya acumulado), o capturar solo con sesión iniciada?

## Servidor (Supabase compartido → prefijo `mp_`)

- `mp_play_events` (en bruto, retención ~13 meses) y `mp_play_daily` (resumen diario por usuario/artista/género/pista).
- RLS por `auth.uid()`, restricciones de longitud, sin `EXECUTE` público en funciones, insert por lote con límite (p. ej.
  500 eventos) mediante función `security definer` con `search_path` fijo; borrado en cascada al eliminar la cuenta.
- Migración solo como archivo en `supabase/migrations/`, aditiva e idempotente. Revisar advisors antes y después.
- La base es compartida y de plan gratuito: estimar volumen (≈ 50–200 eventos/día/usuario) y limitar con resumen diario.

## Privacidad

Exportar (JSON/CSV), borrar todo el historial, desactivar la captura, y texto claro de qué se guarda. Nada de esto sale del
dispositivo para quien no tenga cuenta. Cumple el principio actual: la música nunca se sube.

## Panel (UI)

- Ruta `/app/estadisticas`, **carga diferida** (chunk propio) para no pesar en el arranque.
- Sin cuenta: pantalla de invitación con vista previa difuminada y botón "Entrar".
- Filtros de periodo (7 d / 30 d / 12 m / todo). Tarjetas: minutos totales, canciones, artistas, racha.
- Gráficas: barras horizontales (top canciones/artistas), anillo o barras (géneros), mapa de calor hora×día (hábitos), línea
  de minutos por semana. SVG ligero con módulos de d3 (`d3-scale`, `d3-shape`), sin librería de gráficos pesada.
- Cada gráfica con tabla accesible alternativa y colores aptos para daltonismo; toman el acento de la portada actual.
- Skeletons con la forma de cada tarjeta; estado vacío ("aún no hay datos") y estado "sin conexión".

## Entrega en dos pasos

1. **Captura + sincronización + migración + pruebas** (sin UI visible). Se puede desplegar antes porque empieza a acumular datos.
2. **Panel** con gráficas, filtros, exportar/borrar.

## Pruebas

Reglas de conteo con casos límite (saltos, pausas, seeks, repetición, cambio de pista durante crossfade); idempotencia del
envío (clave única por evento); RLS probada con dos usuarios; rendimiento de agregación con 100 000 eventos sintéticos.
