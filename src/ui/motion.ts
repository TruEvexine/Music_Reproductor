import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

/** Un token de duración de tokens.css (`--fast`, `--exit`…) en ms: el único sitio de JS que lee las duraciones. */
export const tokenMs = (name: string) => cssMs(getComputedStyle(document.documentElement).getPropertyValue(name));

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

/** Mantiene montado un panel mientras sale. `animated` en falso (sin animación de salida) lo desmonta al instante. */
export function usePresence(open: boolean, animated = true) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return;
    const ms = animated ? exitMs() : 0;
    if (!ms) return setMounted(false);
    const timer = window.setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, mounted, animated]);
  return { mounted: open || mounted, closing: !open || undefined };
}
