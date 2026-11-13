import { useRef } from "react";
import type { PointerEvent, ReactNode, RefObject } from "react";
import { buzz } from "./toast";

// Gestos con Pointer Events. Todos tienen alternativa sin gesto: botón de cerrar/Escape para arrastrar hacia abajo,
// y menú contextual (clic derecho, tecla de menú) → hoja de acciones para deslizar y pulsar largo.

/**
 * Arrastrar hacia abajo para cerrar una hoja: sigue al dedo y, al soltar, cierra si pasó 96 px o fue rápido.
 * Se pone en el asa o la cabecera (que deben tener `touch-action: none`). `touchOnly`: el ratón no arrastra.
 */
export function useDragDismiss(target: RefObject<HTMLElement | null>, onDismiss: () => void, { enabled = true, touchOnly = false } = {}) {
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null);
  const end = (event: PointerEvent<HTMLElement>) => {
    const gesture = drag.current;
    drag.current = null;
    const element = target.current;
    if (!gesture || !element) return;
    const speed = gesture.dy / Math.max(event.timeStamp - gesture.startTime, 1); // px/ms
    element.style.transition = "transform var(--fast) var(--ease)";
    if (gesture.dy > 96 || (gesture.dy > 24 && speed > 0.5)) {
      element.style.transform = "translateY(100%)";
      window.setTimeout(onDismiss, 120);
    } else element.style.transform = "";
  };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || (touchOnly && event.pointerType === "mouse") || (event.target as HTMLElement).closest("button, input, a")) return;
      drag.current = { startY: event.clientY, startTime: event.timeStamp, dy: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
      if (target.current) target.current.style.transition = "none";
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!drag.current || !target.current) return;
      drag.current.dy = Math.max(0, event.clientY - drag.current.startY);
      target.current.style.transform = `translateY(${drag.current.dy}px)`;
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  run: () => void;
}

const SLOP = 10; // px antes de decidir si es deslizar o desplazar la lista
const THRESHOLD = 88; // px que arman la acción (vibra al cruzarlo); a esa altura ya se lee el icono y la etiqueta
const LIMIT = 132;
const PRESS_MS = 500;

/**
 * Descarta el clic que el navegador genera al soltar tras un gesto, caiga donde caiga. Tras una pulsación larga cae en el fondo
 * de la hoja recién abierta (capa superior, fuera de la fila) y la cerraba. Un toque nuevo o 400 ms sin clic lo desactivan.
 */
function swallowNextClick() {
  const stop = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    off();
  };
  const off = () => {
    window.removeEventListener("click", stop, true);
    window.removeEventListener("pointerdown", off, true);
    window.clearTimeout(timer);
  };
  window.addEventListener("click", stop, true);
  window.addEventListener("pointerdown", off, true);
  const timer = window.setTimeout(off, 400);
}

/**
 * Fila deslizable: derecha = `right`, izquierda = `left`; pulsación larga (o menú contextual) = `onMenu`.
 * `touch-action: pan-y` deja el scroll vertical al navegador; solo el dedo (táctil/lápiz) desliza, el ratón usa botones.
 */
export function SwipeRow({
  className,
  current,
  left,
  right,
  onMenu,
  children,
}: {
  className: string;
  current?: boolean;
  left?: SwipeAction;
  right?: SwipeAction;
  onMenu: () => void;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; mode: "idle" | "swipe" | "press"; dx: number; armed: boolean; timer: number } | null>(null);

  const reset = () => {
    row.current?.style.setProperty("--dx", "0px");
    row.current?.removeAttribute("data-dragging");
    row.current?.removeAttribute("data-armed");
  };
  const finish = (run: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    window.clearTimeout(g.timer);
    if (g.mode === "swipe" && run && g.armed) (g.dx > 0 ? right : left)?.run();
    if (g.mode !== "idle") swallowNextClick();
    reset();
  };

  return (
    <div
      aria-current={current ? "true" : undefined}
      className={`swipe ${className}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu();
      }}
      onPointerCancel={() => finish(false)}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" || !event.isPrimary) return;
        const g = { x: event.clientX, y: event.clientY, mode: "idle" as const, dx: 0, armed: false, timer: 0 };
        g.timer = window.setTimeout(() => {
          if (gesture.current?.mode !== "idle") return;
          gesture.current.mode = "press";
          buzz(15);
          onMenu();
        }, PRESS_MS);
        gesture.current = g;
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g || g.mode === "press") return;
        const dx = event.clientX - g.x;
        const dy = event.clientY - g.y;
        if (g.mode === "idle") {
          if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return void finish(false); // scroll vertical: del navegador
          if (Math.abs(dx) < SLOP) return;
          if (!(dx > 0 ? right : left)) return void finish(false);
          g.mode = "swipe";
          window.clearTimeout(g.timer);
          event.currentTarget.setPointerCapture(event.pointerId);
          row.current?.setAttribute("data-dragging", "");
        }
        // Sin acción hacia ese lado, la fila no se mueve; pasado el umbral, resistencia.
        const allowed = dx > 0 ? right : left;
        const abs = allowed ? Math.abs(dx) : 0;
        const eased = abs <= THRESHOLD ? abs : Math.min(THRESHOLD + (abs - THRESHOLD) * 0.5, LIMIT);
        g.dx = Math.sign(dx) * eased;
        row.current?.style.setProperty("--dx", `${g.dx}px`);
        const armed = eased >= THRESHOLD;
        if (armed !== g.armed) {
          g.armed = armed;
          if (armed) buzz(8);
          if (armed) row.current?.setAttribute("data-armed", "");
          else row.current?.removeAttribute("data-armed");
        }
      }}
      onPointerUp={() => finish(true)}
      ref={row}
    >
      {right && (
        <span aria-hidden="true" className="swipe-hint" data-side="right">
          {right.icon}
          {right.label}
        </span>
      )}
      {left && (
        <span aria-hidden="true" className="swipe-hint" data-side="left">
          {left.icon}
          {left.label}
        </span>
      )}
      {children}
    </div>
  );
}
