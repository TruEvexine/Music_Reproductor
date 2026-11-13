# Luces reactivas: de dónde sale cada efecto

Qué hace el fondo **Ritmo** del reproductor con la música, paso a paso. Código: `src/core/rhythm.ts` (análisis y luz, puro y con
tests), `src/ui/Backdrop.tsx` (bucle de dibujo) y `src/ui/backdropRenderer.ts` (shader).

## 1. El recorrido en una imagen

```mermaid
flowchart LR
  A["Audio que suena<br/>(tras volumen, EQ y limitador)"] --> B["AnalyserNode<br/>FFT 2048 · suavizado 0,4<br/>−100 a −10 dB → bytes 0–255"]
  B --> G["Graves<br/>20–150 Hz"]
  B --> M["Medios / voz<br/>250–4000 Hz"]
  B --> T["Agudos<br/>4–16 kHz"]
  subgraph N["Normalización adaptativa por banda (memoria ≈ 4 s)"]
    G --> GN["nivel = energía frente a su<br/>media y su variación"]
    G --> GF["flujo espectral<br/>(subidas entre cuadros)"]
    M --> MN["nivel"]
    T --> TF["flujo espectral"]
  end
  GF -->|"flujo > media + k·σ"| BEAT["Golpe"]
  TF -->|"flujo > media + k·σ"| PACE["Ataques de agudos<br/>por segundo"]
  subgraph L["Luz (createLight) con topes de seguridad"]
    BEAT -->|"≥ 340 ms desde el anterior"| FLASH["Destello<br/>pulso de 100 ms"]
    GN --> SWELL["Brillo e hinchazón<br/>sube ≤ 2,5/s · baja ≤ 0,65/s"]
    FLASH --> SWELL
    MN --> SIZE["Tamaño de las manchas"]
    PACE --> RATE["Velocidad 0,5–2,5×<br/>(cambia en 2–4 s)"]
  end
  SWELL --> S["Shader: brillo y radio"]
  SIZE --> S
  RATE --> S2["Shader: deriva de las manchas"]
  P["Paleta de la portada"] --> S3["Shader: color"]
```

El color **no** sale del audio: viene de la portada (o del acento o del tono elegido). La música cambia el brillo, el tamaño y la
velocidad de las manchas, nunca su tono.

## 2. Las tres bandas

El analizador entrega 1024 valores (cada uno, ~22 Hz de ancho) en escala logarítmica: un byte por cada 0,35 dB entre −100 dB
(silencio) y −10 dB. Se agrupan en tres bandas que no se solapan:

| Banda | Frecuencias | Qué suele haber | Efecto que mueve |
|---|---|---|---|
| Graves | 20–150 Hz | Bombo, 808, bajo | Brillo e hinchazón; sus ataques, los destellos |
| Medios / voz | 250–4000 Hz | Voz, guitarras, teclados, caja | Tamaño de las manchas (un ajuste suave) |
| Agudos | 4–16 kHz | Hi-hats, platos, sibilantes | Velocidad de la deriva |

150–250 Hz queda fuera a propósito: ahí se mezclan el bajo y el cuerpo de la voz, y contaminaría las dos bandas.

## 3. Cómo se normaliza la señal

Cada canción viene masterizada a un volumen y con una compresión distintos, y además pasa por tu volumen y tu ecualizador antes de
llegar al analizador. Por eso nada se compara con un valor fijo: **cada banda se compara con su propio pasado reciente**.

- **Energía de la banda:** media de sus bytes, de 0 a 1.
- **Media y variación móviles:** medias exponenciales con una constante de 4 s (`NORM_MS`). Al empezar se usa la media acumulada,
  así que se adapta en el primer segundo.
- **Nivel normalizado:** `0,5 + (energía − media) / (spread · σ)`, recortado entre 0 y 1. La media cae en 0,5; `spread/2`
  desviaciones por encima o por debajo llegan a 1 o a 0.
- **Suelo de variación:** σ nunca baja de 0,01 (≈ 0,9 dB). Un tono constante o un ruido de fondo no se amplifican hasta parecer
  música: quedan en 0,5, quietos.
- **Silencio:** por debajo de 0,03 (≈ −97 dB) la banda da 0 y no hay ataques. Las medias se **congelan**, de modo que una pausa no las
  arrastra a cero y al reanudar la luz sigue calibrada.

## 4. Ataques: el flujo espectral

Un ataque (bombo, caja, hi-hat) es una **subida brusca** de energía. Cada cuadro se suman, en la banda, solo las subidas de cada
valor respecto al cuadro anterior (las bajadas no cuentan) y se divide por el número de valores: es el *flujo espectral*. Como la
escala está en dB, un golpe sube lo mismo suene fuerte o bajo.

Hay ataque cuando se cumplen todas:

| Condición | Valor | Por qué |
|---|---|---|
| Flujo por encima de su media móvil más `k` desviaciones típicas | `k` según la sensibilidad (§6) | Umbral relativo: se adapta a lo "ocupada" que esté la canción |
| Desviación típica del flujo de al menos 0,002 | `MIN_FLUX_DEVIATION` | Sin esto, un fondo muy quieto convertiría cualquier roce en golpe |
| Flujo de al menos 0,003 (≈ 0,3 dB de subida media) | `MIN_FLUX` | Suelo absoluto para el ruido |
| Al menos 30 cuadros (½ s) desde que la banda empezó a sonar | — | Calentamiento de las medias |
| Separación desde el ataque anterior | 200 ms en graves y medios, 90 ms en agudos | 200 ms admite hasta 300 BPM |

## 5. Qué dispara cada efecto

### Destellos
Un **golpe** (ataque en los graves) dispara un destello si han pasado al menos **340 ms** desde el anterior. El destello es un
pulso que se mantiene 100 ms, con ataque de 70 ms y caída de 300 ms.

### Brillo e hinchazón (`swell`)
- Objetivo: `0,6 · graves + 0,45 · pulso`, con los graves ya normalizados y seguidos con ataque de 90 ms y caída de 450 ms.
- El valor real persigue al objetivo con dos topes: **sube como mucho 2,5 por segundo y baja como mucho 0,65 por segundo**.
- En el shader: cada mancha se ilumina por `0,9 + 0,35 · swell` y su radio crece `0,2 · swell`.

### Tamaño
Los medios normalizados (ataque 120 ms, caída 500 ms) añaden hasta `0,04` al radio. Es el efecto más discreto: da cuerpo cuando
entra la voz sin competir con los graves.

### Velocidad
- Se cuentan los **ataques de agudos por segundo** (media de ~3 s). 6 por segundo o más es el máximo.
- Esa densidad pasa por una envolvente lenta (sube en ~2 s, baja en ~4 s) y da un multiplicador de **0,5× a 2,5×**: 1,5 ataques por
  segundo es ×1, sin agudos es ×0,5. Se multiplica por la «Velocidad» que elijas.
- La fase de la deriva se integra cuadro a cuadro, así que la velocidad cambia sin saltos.

### Color
No reacciona al audio. Cambia al cambiar de pista (transición de ~250 ms) o al deslizar el carrusel de portadas.

## 6. Topes de seguridad y sensibilidad

Estos topes no dependen de la canción ni de la sensibilidad:

| Tope | Valor | Garantía |
|---|---|---|
| Separación entre destellos | 340 ms | ≤ 2,9 golpes de luz por segundo (WCAG 2.3.1 pide ≤ 3) |
| Subida del brillo | 2,5 /s (`SWELL_SLEW`) | En 100 ms el brillo cambia como mucho un 7 % (límite: 10 %) |
| Bajada del brillo | 0,65 /s (`SWELL_FALL`) | Un cambio que cuenta como destello (5 % de brillo, el doble de exigente que WCAG) tarda ≥ 72 ms en subir y ≥ 277 ms en bajar: ≥ 349 ms por ciclo, así que **ni los graves ni los golpes pueden pasar de 2,9 destellos por segundo**, por construcción |
| Movimiento reducido | — | Sin lienzo ni bucle: el mismo degradado en CSS, quieto (el del sistema se respeta siempre; también el de Ajustes) |
| Modo Portada | — | Sin análisis: velocidad fija y brillo quieto |

**Sensibilidad** (Ajustes → Apariencia y luces, o menú ≡ → Fondo, solo en Ritmo). Las tres se adaptan a cada canción; cambian el
umbral de los ataques y cuánto recorre el nivel:

| Sensibilidad | `k` (umbral de ataque) | `spread` (desviaciones de 0 a 1) |
|---|---|---|
| Baja | 2,0 | 6 |
| Auto (por defecto) | 1,6 | 4 |
| Alta | 1,3 | 2,5 |

## 7. Por qué había canciones que apenas se movían (diagnóstico)

Medido con el audio real de *Highest in the Room* (Travis Scott) y *The Spins* (Mac Miller), del minuto 0:40 al 1:40, por el mismo
camino que el navegador (simulación del analizador en `src/core/rhythm.sim.ts`):

| Valor de la versión anterior | Highest in the Room | The Spins |
|---|---|---|
| Graves (p5 / p50 / p95) | 0,71 / 0,94 / 1,00 | 0,90 / 0,97 / 1,00 |
| Flujo del bombo (p95 / p99) | 0,035 / 0,089 | 0,045 / 0,077 |

Tres causas:

1. **Saturación.** El analizador usaba su rango de serie, hasta −30 dB. Los graves de un máster actual pasan de ahí y se quedaban
   pegados a 255. En *The Spins* (bajo continuo, máster comprimido) la banda iba de 0,90 a 1,00 y, multiplicada por 1,15, era
   **siempre 1**: brillo plano. *Highest in the Room* tiene silencios entre los 808 (p5 0,71), y por eso sí se movía algo.
2. **Umbral de golpe absoluto.** Un golpe exigía un flujo de 0,25, calibrado con bombos sintéticos (≈ 0,8). En música real el flujo
   casi nunca pasa de 0,09: **casi no había destellos** (0,10/s y 0,00/s en las canciones completas).
3. **Ganancias fijas** (×1,15 graves, ×1,8 medios, ×3 agudos). Con un máster fuerte todo se recortaba a 1 y la velocidad, ligada al
   volumen, se quedaba en el tope.

Arreglo: rango del analizador −100 a −10 dB (`ANALYSER_DB`, lo fija el motor), normalización por banda (§3), ataques con umbral
relativo (§4) y velocidad por densidad de agudos (§5).
