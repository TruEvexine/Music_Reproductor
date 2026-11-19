// Gestos táctiles como datos puros: las constantes que usa src/ui/gestures.tsx y los textos de la ayuda salen de aquí,
// así que cambiar un umbral o una etiqueta cambia también lo que dice Ayuda → Gestos.

/** Etiquetas de las acciones de deslizar una fila (las que se ven al arrastrar). */
export const SWIPE_LABELS = { next: "Siguiente", enqueue: "A la cola", remove: "Quitar" } as const;
/** Mantener pulsada una fila este tiempo abre sus acciones. */
export const LONG_PRESS_MS = 500;
/** Arrastrar una hoja hacia abajo más que esto la cierra (más corto, solo si el gesto es rápido). */
export const DISMISS_PX = 96;

export interface GestureHelp {
  id: "swipe-row" | "long-press" | "swipe-cover" | "drag-open" | "drag-close" | "fine-seek";
  title: string;
  how: string;
  /** Qué hacer sin el gesto: todo gesto tiene alternativa por botón o teclado. */
  alternative: string;
}

export const GESTURES: readonly GestureHelp[] = [
  {
    id: "swipe-row",
    title: "Deslizar una fila",
    how: `Desliza una canción a la derecha para que suene a continuación («${SWIPE_LABELS.next}») o a la izquierda para añadirla a la cola («${SWIPE_LABELS.enqueue}»; en la cola, «${SWIPE_LABELS.remove}»). El aviso que aparece permite deshacerlo.`,
    alternative: "El botón de añadir a la cola de cada fila, o su menú de acciones.",
  },
  {
    id: "long-press",
    title: "Pulsación larga",
    how: `Mantén pulsada una canción ${(LONG_PRESS_MS / 1000).toLocaleString("es")} s para abrir sus acciones.`,
    alternative: "Clic derecho o la tecla de menú sobre la fila; en la cola, el botón «⋯».",
  },
  {
    id: "swipe-cover",
    title: "Deslizar la portada",
    how: "En el reproductor grande, desliza la portada a la izquierda para pasar a la siguiente canción y a la derecha para volver a la anterior.",
    alternative: "Los botones anterior y siguiente, o las flechas ← y → del teclado.",
  },
  {
    id: "drag-open",
    title: "Arrastrar para abrir",
    how: "En el teléfono, arrastra hacia arriba el mini reproductor: el reproductor grande sigue a tu dedo. Si a mitad cambias de idea, vuelve hacia abajo y suelta.",
    alternative: "Toca el mini reproductor.",
  },
  {
    id: "drag-close",
    title: "Arrastrar para cerrar",
    how: "Arrastra hacia abajo la cabecera de una hoja, del reproductor grande o de la cola para cerrarlos.",
    alternative: "El botón de cerrar, la tecla Escape o el gesto atrás del sistema.",
  },
  {
    id: "fine-seek",
    title: "Ajuste fino de la barra",
    how: "Mientras arrastras la barra de progreso, aleja el dedo de ella hacia arriba o hacia abajo: cuanto más lejos, más despacio avanza (½, ¼ y ⅒) y más preciso es el salto. Junto al tiempo ves la velocidad.",
    alternative: "Con teclado, las flechas ← y → sobre la barra la mueven de segundo en segundo.",
  },
];
