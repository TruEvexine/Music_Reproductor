import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SPEED = 30; // px por segundo, constante
const HOLD = 1500; // ms quieto en cada extremo

/**
 * Texto de una línea: si cabe, se queda quieto; si desborda, va y vuelve a velocidad constante con pausas en los extremos.
 * Con prefers-reduced-motion (o sin desborde) queda el recorte con «…» de siempre.
 * shortcut: lee reduced-motion al medir, no al cambiar el ajuste en caliente; basta recargar.
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

  const animate = shift > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (!animate) return;
    const travel = (shift / SPEED) * 1000;
    const total = travel * 2 + HOLD * 2;
    const end = `translateX(-${shift}px)`;
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
    <span className="marquee" data-moving={animate || undefined} ref={box}>
      <span ref={text}>{children}</span>
    </span>
  );
}
