import { useLayoutEffect, useRef } from "react";
import type { PointerEvent, ReactNode, RefObject } from "react";
import { DISMISS_PX, LONG_PRESS_MS } from "../core/gestures";
import { tutorials } from "../state/tutorials";
import { motionReduced, tokenMs } from "./motion";
import { morphActive, morphDrag, morphStart, morphTo } from "./playerMorph";
import { closePanel, openPanel, playerOpen } from "./router";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
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
      window.setTimeout(onDismiss, motionReduced() ? 0 : tokenMs("--fast")); // lo que dura la transición de arriba (0,01 ms con movimiento reducido)
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

const VERTICAL = 1.4; // el gesto vertical solo es suyo si |dy| > 1,4·|dx| (≈ 35° de la vertical): lo diagonal no abre ni cierra
const FLICK_Y = 0.45; // px/ms: un gesto rápido decide la dirección aunque sea corto (el mismo umbral que el carrusel)

/**
 * Arrastrar entre la barra y el reproductor grande (playerMorph): `open` en la barra (hacia arriba), `close` en la hoja (hacia abajo).
 * La posición del dedo es el avance; al soltar deciden la velocidad (> 0,45 px/ms) y, si no, la distancia (DISMISS_PX desde donde
 * empezó). Un toque durante la animación la agarra donde va. Solo dedo o lápiz y solo en estrecho (en escritorio no hay arrastre).
 * Con movimiento reducido no sigue al dedo: decide al soltar y abre con un fundido o cierra al instante. Al llegar, la URL se pone al día.
 */
export function useMorphDrag(direction: "open" | "close") {
  const gesture = useRef<{ x: number; y: number; lockY: number; from: number; travel: number; mode: "idle" | "drag"; samples: { t: number; y: number }[]; grabbed: boolean } | null>(null);
  const sheet = () => document.querySelector<HTMLElement>(".now-playing");
  // La URL se pone al día al soltar, tras el primer cuadro de la animación: no al llegar (caía dentro de un cuadro, con la pintura: 60–69 ms
  // con la CPU 4×) ni en el mismo toque (el render de React retrasaba la entrega de la animación al compositor). Si vuelve a donde estaba, nada.
  const go = (target: 0 | 1, velocity?: number) => {
    const el = sheet();
    if (!el) return;
    morphTo(el, target, { velocity });
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (target === 1 && !playerOpen()) openPanel("player");
        else if (target === 0 && playerOpen()) closePanel();
      }),
    );
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "idle") return void (g.grabbed && go(g.from > 0.5 ? 1 : 0)); // agarrada y soltada sin mover: termina hacia el lado más cerca
    swallowNextClick(); // el arrastre empezó quizá sobre un botón (la barra entera lo es)
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((sample) => last.t - sample.t <= 100) ?? g.samples[0];
    const vy = (last.y - first.y) / Math.max(last.t - first.t, 1); // px/ms, positivo hacia abajo
    const moved = (g.lockY - event.clientY) / g.travel; // en p, positivo hacia arriba (abrir)
    const at = clamp01(g.from + moved);
    let target: 0 | 1;
    if (event.type === "pointercancel") target = g.from > 0.5 ? 1 : 0;
    else if (Math.abs(vy) > FLICK_Y) target = vy < 0 ? 1 : 0;
    else if (g.from === 0 || g.from === 1) target = Math.abs(moved) * g.travel >= DISMISS_PX ? ((1 - g.from) as 0 | 1) : g.from;
    else target = at > 0.5 ? 1 : 0;
    go(target, motionReduced() ? undefined : -vy / g.travel);
  };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      const el = sheet();
      if (!el || event.pointerType === "mouse" || !event.isPrimary || matchMedia("(min-width: 1000px)").matches) return;
      if ((event.target as HTMLElement).closest("input, a, .range, dialog, textarea, select")) return; // un deslizador es suyo
      const grabbed = morphActive() && !motionReduced();
      const start = grabbed ? morphStart(el) : null; // a mitad de camino: se congela donde va y el dedo la lleva desde ahí
      gesture.current = { x: event.clientX, y: event.clientY, lockY: event.clientY, from: start?.at ?? (direction === "open" ? 0 : 1), travel: start?.travel ?? 1, mode: "idle", samples: [], grabbed };
      if (grabbed) event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const g = gesture.current;
      if (!g) return;
      if (g.mode === "idle") {
        const dx = event.clientX - g.x;
        const dy = event.clientY - g.y;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const wrongWay = !g.grabbed && (direction === "open" ? dy > 0 : dy < 0);
        if (Math.abs(dy) <= Math.abs(dx) * VERTICAL || wrongWay) {
          if (g.grabbed) go(g.from > 0.5 ? 1 : 0);
          return void (gesture.current = null);
        }
        g.mode = "drag";
        g.lockY = event.clientY; // sin salto al decidir el eje
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!g.grabbed && !motionReduced()) {
          const start = morphStart(sheet()!);
          if (!start) return void (gesture.current = null);
          g.from = start.at;
          g.travel = start.travel;
        }
      }
      g.samples.push({ t: event.timeStamp, y: event.clientY });
      if (g.samples.length > 8) g.samples.shift();
      if (!motionReduced()) morphDrag(g.from + (g.lockY - event.clientY) / g.travel);
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
 * `reducedPreview: false` (mini reproductor): con movimiento reducido no sigue al dedo; decide al soltar, con el mismo umbral, y cambia sin animar.
 * Lo usan el reproductor grande (portada) y el mini (portada y título).
 */
export function useCoverSwipe(
  track: RefObject<HTMLElement | null>,
  {
    onNext,
    onPrevious,
    onProgress,
    resetKey,
    reducedPreview = true,
  }: { onNext?: () => void; onPrevious?: () => void; onProgress?: (progress: number) => void; resetKey: string | undefined; reducedPreview?: boolean },
) {
  const gesture = useRef<{ x: number; y: number; dx: number; mode: "idle" | "drag"; distance: { next: number; prev: number }; samples: { t: number; x: number }[] } | null>(null);
  const settling = useRef(false);
  const preview = () => reducedPreview || !motionReduced();
  const set = (dx: number, transition = "none") => {
    if (!track.current || !preview()) return;
    track.current.style.transition = transition;
    track.current.style.setProperty("--dx", `${dx}px`);
  };
  useLayoutEffect(() => {
    settling.current = false;
    set(0);
    track.current?.removeAttribute("data-dragging");
    onProgress?.(0);
    // onProgress cambia en cada render; solo importa el cambio de pista
  }, [resetKey]);

  const finish = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.mode !== "drag") return;
    swallowNextClick(); // el mini es un botón (abre el reproductor): soltar tras deslizar no debe abrirlo
    const run = g.dx < 0 ? onNext : onPrevious;
    const distance = g.dx < 0 ? g.distance.next : g.distance.prev;
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((sample) => last.t - sample.t <= 100) ?? g.samples[0];
    const speed = (last.x - first.x) / Math.max(last.t - first.t, 1); // px/ms en los últimos 100 ms
    const flick = Math.abs(speed) > FLICK && Math.sign(speed) === Math.sign(g.dx) && Math.abs(g.dx) > 24;
    if (!run || event.type === "pointercancel" || (Math.abs(g.dx) < distance * COMMIT && !flick)) {
      set(0, "transform var(--base) var(--ease)");
      track.current?.removeAttribute("data-dragging");
      onProgress?.(0);
      return;
    }
    // Se completa: la vecina llega al centro y entonces cambia la pista (el efecto de `resetKey` deja el carril en 0 sin salto).
    settling.current = true;
    onProgress?.(g.dx < 0 ? -1 : 1);
    set(Math.sign(g.dx) * distance, "transform var(--base) var(--ease-move)");
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      tutorials.done("player-touch"); // ya sabe deslizar la portada
      run();
    };
    if (!preview()) return void commit(); // sin vista previa: cambia al soltar
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
      onProgress?.(toward && distance > 0 ? Math.max(-1, Math.min(1, dx / distance)) : 0);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
