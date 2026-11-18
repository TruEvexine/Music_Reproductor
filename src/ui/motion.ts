import { createContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { cssMs } from "../core/format";
import { useBackground } from "../state/background";

// Entradas y salidas de paneles, hojas y diálogos. Los valores salen de tokens.css (`--exit`), el CSS anima `[data-closing]`
// y aquí solo se espera a que termine para desmontar. Con movimiento reducido no se espera nada.

const reducedQuery = "(prefers-reduced-motion: reduce)";

/** Movimiento reducido: lo pide el sistema o el interruptor de Ajustes (state/background.ts lo refleja en <html data-motion>). */
export const motionReduced = () => window.matchMedia(reducedQuery).matches || document.documentElement.dataset.motion === "reduce";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(reducedQuery);
      media.addEventListener("change", listener);
      const stop = useBackground.subscribe((state, before) => state.reduceMotion !== before.reduceMotion && listener());
      return () => {
        media.removeEventListener("change", listener);
        stop();
      };
    },
    motionReduced,
  );
}

/**
 * Un token de duración de tokens.css (`--fast`, `--exit`…) en ms: el único sitio de JS que lee las duraciones. Se lee una vez: son constantes
 * de :root, y getComputedStyle en mitad de un toque fuerza el recálculo de estilo de toda la página (≈ 20 ms con la CPU 4× al abrir el reproductor).
 */
const tokens = new Map<string, number>();
export function tokenMs(name: string): number {
  const cached = tokens.get(name);
  if (cached !== undefined) return cached;
  const ms = cssMs(getComputedStyle(document.documentElement).getPropertyValue(name));
  if (ms > 0) tokens.set(name, ms); // 0: la hoja de estilos aún no estaba; se vuelve a leer
  return ms;
}

/** Duración de toda salida (`--exit`) en ms; 0 con movimiento reducido. */
function exitMs(): number {
  if (motionReduced()) return 0;
  return tokenMs("--exit");
}

/** Cierre con salida: `request()` marca `closing` y llama a `onClose` cuando termina la animación de salida. */
export function useExit(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const request = () => {
    if (timer.current) return;
    const ms = exitMs();
    if (!ms) return onClose();
    setClosing(true);
    timer.current = window.setTimeout(onClose, ms);
  };
  return { closing: closing || undefined, request };
}

/**
 * Mantiene montado un panel mientras sale. `animated` en falso (sin animación de salida) lo desmonta al instante.
 * Espera `--exit` + 100 ms: el compositor arranca la transición uno o más cuadros después del cambio de estilo (38 ms con la CPU 4× más lenta),
 * así que un temporizador de `--exit` justo cortaba el final y Chromium marcaba la animación cancelada como no compuesta (compositeFailed).
 */
export function usePresence(open: boolean, animated = true) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return;
    const ms = animated ? exitMs() : 0;
    if (!ms) return setMounted(false);
    const timer = window.setTimeout(() => setMounted(false), ms + 100);
    return () => clearTimeout(timer);
  }, [open, mounted, animated]);
  return { mounted: open || mounted, closing: !open || undefined };
}

/**
 * Como usePresence, pero el panel no se desmonta: desde que se abre por primera vez (o lo pide `preload`) queda montado, y cerrado es
 * `closed` (oculto, inert). Así abrir es solo la transición, sin el montaje de React en el toque (66–81 ms con la CPU 4× más lenta).
 */
export function useKeptPanel(open: boolean, preload: boolean, animated = true) {
  const presence = usePresence(open, animated);
  const [kept, setKept] = useState(false);
  if (!kept && (presence.mounted || preload)) setKept(true);
  return { render: kept || presence.mounted, closing: presence.mounted ? presence.closing : undefined, closed: presence.mounted ? undefined : (true as const) };
}

/** Dentro de un panel cerrado que sigue montado: lo que se mueve solo (Marquee) se para y lo que cambia a cada rato (la posición) no re-renderiza. */
export const PanelHidden = createContext(false);

/**
 * Panel conservado (useKeptPanel): al abrir, el foco entra en `first`; al cerrar vuelve a quien lo tenía, si se quedó dentro o se perdió.
 * Ya oculto, cierra los diálogos que dejó abiertos (un modal oculto bloquearía la página) y borra el `transform` que deja el arrastre.
 */
export function usePanelFocus(panel: RefObject<HTMLElement | null>, first: RefObject<HTMLElement | null>, open: boolean, closed: boolean) {
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      first.current?.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    if (back.current?.isConnected && (!active || active === document.body || panel.current?.contains(active))) back.current.focus({ preventScroll: true });
    back.current = null;
  }, [open]);
  useLayoutEffect(() => {
    const node = panel.current;
    if (!closed || !node) return;
    for (const dialog of node.querySelectorAll("dialog[open]")) (dialog as HTMLDialogElement).close();
    node.style.transform = node.style.transition = "";
  }, [closed]);
}
