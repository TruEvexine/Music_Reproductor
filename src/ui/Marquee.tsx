import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PanelHidden, useReducedMotion } from "./motion";

const SPEED = 30; // px por segundo, constante
const HOLD = 1500; // ms quieto en cada extremo
const FADE = 16; // px de la máscara del borde derecho (player.css: .marquee[data-moving])

/**
 * Texto de una línea: si cabe, se queda quieto; si desborda, va y vuelve a velocidad constante con pausas en los extremos.
 * Con movimiento reducido (del sistema o de Ajustes) o sin desborde queda el recorte con «…» de siempre.
 */
export function Marquee({ children }: { children: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0); // píxeles que sobresale; 0 = cabe

  useLayoutEffect(() => {
    // El texto es un <span> en línea (ResizeObserver no lo observa): se mide su rectángulo y se observa la caja.
    const measure = () => setShift(Math.max(0, Math.ceil(text.current!.getBoundingClientRect().width - box.current!.clientWidth)));
    const observer = new ResizeObserver(measure);
    observer.observe(box.current!);
    measure();
    return () => observer.disconnect();
  }, [children]);

  const reduced = useReducedMotion();
  const hidden = useContext(PanelHidden); // en un panel cerrado no se ve: sin bucle
  const animate = shift > 0 && !reduced && !hidden;
  useEffect(() => {
    if (!animate) return;
    const distance = shift + FADE; // el final del texto se detiene fuera de la máscara
    const travel = (distance / SPEED) * 1000;
    const total = travel * 2 + HOLD * 2;
    const end = `translateX(-${distance}px)`;
    const run = text.current!.animate(
      [
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: HOLD / total },
        { transform: end, offset: (HOLD + travel) / total },
        { transform: end, offset: (HOLD * 2 + travel) / total },
        { transform: "translateX(0)", offset: 1 },
      ],
      { duration: total, iterations: Infinity },
    );
    return () => run.cancel();
  }, [animate, shift]);

  return (
    <span className="marquee" data-moving={animate || undefined} ref={box} style={{ "--fade": `${FADE}px` } as CSSProperties}>
      <span ref={text}>{children}</span>
    </span>
  );
}
