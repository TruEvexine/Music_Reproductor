import { useLayoutEffect, useRef } from "react";
import type { PointerEvent, ReactNode, RefObject } from "react";
import { DISMISS_PX, LONG_PRESS_MS } from "../core/gestures";
import { tutorials } from "../state/tutorials";
import { buzz } from "./toast";
import { useEncounter } from "./Tutorial";

// Gestos con Pointer Events. Todos tienen alternativa sin gesto: botón de cerrar/Escape para arrastrar hacia abajo,
// y menú contextual (clic derecho, tecla de menú) → hoja de acciones para deslizar y pulsar largo.

const SLOP = 10; // px antes de decidir el eje (deslizar o desplazar, cerrar o pasar de portada)

/**
 * Arrastrar hacia abajo para cerrar una hoja: sigue al dedo y, al soltar, cierra si pasó 96 px o fue rápido.
 * Se pone en el asa o la cabecera (que deben tener `touch-action: none`). `touchOnly`: el ratón no arrastra.
 * Eje bloqueado: un gesto que empieza en horizontal no es suyo (lo toma el carrusel de portadas), y el puntero solo se captura al decidirlo.
 */
export function useDragDismiss(target: RefObject<HTMLElement | null>, onDismiss: () => void, { enabled = true, touchOnly = false } = {}) {
  const drag = useRef<{ startX: number; startY: number; startTime: number; dy: number; locked: boolean } | null>(null);
  const end = (event: PointerEvent<HTMLElement>) => {
    const gesture = drag.current;
    drag.current = null;
    const element = target.current;
    if (!gesture || !element) return;
    const speed = gesture.dy / Math.max(event.timeStamp - gesture.startTime, 1); // px/ms
    element.style.transition = "transform var(--fast) var(--ease)";
    if (gesture.dy > DISMISS_PX || (gesture.dy > 24 && speed > 0.5)) {
      element.style.transform = "translateY(100%)";
      window.setTimeout(onDismiss, 120);
    } else element.style.transform = "";
  };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || (touchOnly && event.pointerType === "mouse") || (event.target as HTMLElement).closest("button, input, a, .range")) return; // un deslizador es suyo
      drag.current = { startX: event.clientX, startY: event.clientY, startTime: event.timeStamp, dy: 0, locked: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const gesture = drag.current;
      if (!gesture || !target.current) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (!gesture.locked) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dx) > Math.abs(dy)) return void (drag.current = null);
        gesture.locked = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        target.current.style.transition = "none";
      }
      gesture.dy = Math.max(0, dy - SLOP); // sin salto al decidir el eje
      target.current.style.transform = `translateY(${gesture.dy}px)`;
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

const THRESHOLD = 88; // px que arman la acción (vibra al cruzarlo); a esa altura ya se lee el icono y la etiqueta
const LIMIT = 132;

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
  useEncounter("swipe");
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
    if (g.mode !== "idle") {
      swallowNextClick();
      tutorials.done("swipe"); // ya sabe deslizar o pulsar largo
    }
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
        }, LONG_PRESS_MS);
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

const COMMIT = 0.33; // fracción del recorrido que completa el cambio de portada
const FLICK = 0.45; // px/ms: un gesto rápido lo completa aunque sea corto

/**
 * Carrusel de portadas: deslizar a la izquierda = `onNext`, a la derecha = `onPrevious` (sin vecina hacia ese lado: resiste y vuelve).
 * La portada sigue al dedo y la vecina (`[data-side="next|prev"]` dentro de `track`) asoma; al soltar, pasado un tercio del recorrido
 * o con un gesto rápido se completa y, si no, vuelve. Eje bloqueado: un gesto que empieza en vertical es del cierre de la hoja.
 * `onProgress(p)`: -1…1 mientras se arrastra (negativo, hacia la siguiente). Solo dedo o lápiz; los botones de transporte son la alternativa.
 * `resetKey` (la entrada actual de la cola): al cambiar, el carril vuelve a 0 en el mismo cuadro en que la vecina pasa a ser la actual.
 */
export function useCoverSwipe(
  track: RefObject<HTMLElement | null>,
  { onNext, onPrevious, onProgress, resetKey }: { onNext?: () => void; onPrevious?: () => void; onProgress: (progress: number) => void; resetKey: string | undefined },
) {
  const gesture = useRef<{ x: number; y: number; dx: number; mode: "idle" | "drag"; distance: { next: number; prev: number }; samples: { t: number; x: number }[] } | null>(null);
  const settling = useRef(false);
  const set = (dx: number, transition = "none") => {
    if (!track.current) return;
    track.current.style.transition = transition;
    track.current.style.setProperty("--dx", `${dx}px`);
  };
  useLayoutEffect(() => {
    settling.current = false;
    set(0);
    track.current?.removeAttribute("data-dragging");
    onProgress(0);
    // onProgress cambia en cada render; solo importa el cambio de pista
  }, [resetKey]);

  const finish = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.mode !== "drag") return;
    const run = g.dx < 0 ? onNext : onPrevious;
    const distance = g.dx < 0 ? g.distance.next : g.distance.prev;
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((sample) => last.t - sample.t <= 100) ?? g.samples[0];
    const speed = (last.x - first.x) / Math.max(last.t - first.t, 1); // px/ms en los últimos 100 ms
    const flick = Math.abs(speed) > FLICK && Math.sign(speed) === Math.sign(g.dx) && Math.abs(g.dx) > 24;
    if (!run || event.type === "pointercancel" || (Math.abs(g.dx) < distance * COMMIT && !flick)) {
      set(0, "transform var(--base) var(--ease)");
      track.current?.removeAttribute("data-dragging");
      onProgress(0);
      return;
    }
    // Se completa: la vecina llega al centro y entonces cambia la pista (el efecto de `resetKey` deja el carril en 0 sin salto).
    settling.current = true;
    onProgress(g.dx < 0 ? -1 : 1);
    set(Math.sign(g.dx) * distance, "transform var(--base) var(--ease-move)");
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      tutorials.done("player-touch"); // ya sabe deslizar la portada
      run();
    };
    track.current?.addEventListener("transitionend", commit, { once: true });
    window.setTimeout(commit, 320); // movimiento reducido (transición de 0,01 ms) o una transición que no llegó a empezar
  };

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" || !event.isPrimary || settling.current) return;
      gesture.current = { x: event.clientX, y: event.clientY, dx: 0, mode: "idle", distance: { next: 0, prev: 0 }, samples: [{ t: event.timeStamp, x: event.clientX }] };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const g = gesture.current;
      const element = track.current;
      if (!g || !element) return;
      const dx = event.clientX - g.x;
      if (g.mode === "idle") {
        const dy = event.clientY - g.y;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) return void (gesture.current = null); // vertical: de la hoja
        g.mode = "drag";
        event.currentTarget.setPointerCapture(event.pointerId);
        element.setAttribute("data-dragging", "");
        // Recorrido hasta que la vecina ocupa el sitio de la actual, medido una vez por gesto (cambia con el tamaño de pantalla).
        const left = element.getBoundingClientRect().left;
        const edge = (side: string) => element.querySelector(`[data-side="${side}"]`)?.getBoundingClientRect().left;
        g.distance = { next: (edge("next") ?? left) - left, prev: left - (edge("prev") ?? left) };
      }
      g.samples.push({ t: event.timeStamp, x: event.clientX });
      if (g.samples.length > 8) g.samples.shift();
      const toward = dx < 0 ? onNext : onPrevious;
      const distance = dx < 0 ? g.distance.next : g.distance.prev;
      g.dx = toward ? dx : 0;
      set(toward ? dx : dx * 0.2); // sin vecina: resistencia, y vuelve al soltar
      onProgress(toward && distance > 0 ? Math.max(-1, Math.min(1, dx / distance)) : 0);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
