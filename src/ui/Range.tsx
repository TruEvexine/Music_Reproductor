import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { buzz } from "./toast";

// Deslizador único de la app: progreso, volumen, velocidad, fundido, ecualizador y fondo. Debajo hay un <input type="range"> nativo:
// teclado, foco, aria y lectores de pantalla son los del navegador. El puntero lo lleva esta capa: al pulsar, la barra se engrosa y aparece
// el tirador; alejar el dedo de la barra en perpendicular baja la velocidad del ajuste (ajuste fino) y muestra el valor.

/** Velocidad del ajuste según la distancia (px) del puntero a la barra: cerca 1; después ½, ¼ y ⅒. */
export function fineRate(distance: number): number {
  return distance < 40 ? 1 : distance < 96 ? 0.5 : distance < 160 ? 0.25 : 0.1;
}
const RATE_LABEL: Record<number, string> = { 0.5: "½", 0.25: "¼", 0.1: "⅒" };

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;

interface Gesture {
  raw: number;
  last: number;
  start: number;
  sent: number;
  rate: number;
  rect: DOMRect;
  /** Táctil: no se toca el valor hasta saber que no es un desplazamiento de la página (que cancelaría el gesto). */
  pending: boolean;
}

export function Range({
  label,
  value,
  min,
  max,
  step,
  format,
  valueText,
  onChange,
  origin = min,
  disabled = false,
  vertical = false,
  className = "",
}: {
  /** Nombre accesible; sin él, el del <label> que lo envuelve. */
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  /** Texto para lectores de pantalla si no basta con `format` (p. ej. «1:02 de 3:40»). */
  valueText?: string;
  onChange: (value: number) => void;
  /** Valor desde el que se pinta el relleno (el centro en los controles con signo); se marca en la barra. */
  origin?: number;
  disabled?: boolean;
  vertical?: boolean;
  className?: string;
}) {
  const [drag, setDrag] = useState<{ value: number; rate: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = drag?.value ?? value;
  const span = max - min || 1;
  const at = (v: number) => `${((Math.min(Math.max(v, min), max) - min) / span) * 100}%`;
  const length = (rect: DOMRect) => (vertical ? rect.height : rect.width);
  const along = (rect: DOMRect, event: PointerEvent) => (vertical ? rect.bottom - event.clientY : event.clientX - rect.left);

  const apply = (g: Gesture, raw: number) => {
    g.raw = Math.min(Math.max(raw, min), max);
    const snapped = Number(Math.min(max, min + Math.round((g.raw - min) / step) * step).toFixed(decimals(step)));
    setDrag({ value: snapped, rate: g.rate });
    if (snapped !== g.sent) {
      g.sent = snapped;
      onChange(snapped);
    }
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (event.type === "pointercancel") {
      if (!g.pending && g.sent !== g.start) onChange(g.start); // la página se desplazó: el valor vuelve
    } else if (g.pending) apply(g, g.raw); // toque sin arrastre: salta ahí
    setDrag(null);
  };

  return (
    <span
      className={`range ${className}`}
      data-active={drag ? "" : undefined}
      data-disabled={disabled || undefined}
      data-vertical={vertical || undefined}
      onPointerCancel={end}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0 || !event.isPrimary) return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        input.current?.focus({ preventScroll: true }); // las flechas siguen donde se tocó
        const position = along(rect, event);
        const g: Gesture = { raw: min + (Math.min(Math.max(position, 0), length(rect)) / length(rect)) * span, last: position, start: value, sent: value, rate: 1, rect, pending: event.pointerType !== "mouse" };
        gesture.current = g;
        if (g.pending) setDrag({ value, rate: 1 });
        else apply(g, g.raw);
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g) return;
        const position = along(g.rect, event);
        const cross = vertical ? Math.abs(event.clientX - (g.rect.left + g.rect.width / 2)) : Math.abs(event.clientY - (g.rect.top + g.rect.height / 2));
        const rate = fineRate(cross);
        if (rate !== g.rate) {
          g.rate = rate;
          buzz(6);
        }
        if (g.pending) {
          g.pending = false;
          apply(g, g.raw);
        }
        apply(g, g.raw + ((position - g.last) / length(g.rect)) * span * rate);
        g.last = position;
      }}
      onPointerUp={end}
      style={{ "--from": at(Math.min(shown, origin)), "--to": at(Math.max(shown, origin)), "--at": at(shown), "--origin": at(origin) } as CSSProperties}
    >
      <span aria-hidden="true" className="range-rail">
        <span className="range-glow" />
        <span className="range-fill" />
        {origin > min && <span className="range-origin" />}
      </span>
      <span aria-hidden="true" className="range-thumb" />
      {drag && drag.rate < 1 && (
        <span aria-hidden="true" className="range-value">
          {format(drag.value)} · fino {RATE_LABEL[drag.rate]}
        </span>
      )}
      <input
        aria-label={label}
        aria-orientation={vertical ? "vertical" : undefined}
        aria-valuetext={valueText ?? format(shown)}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        ref={input}
        step={step}
        type="range"
        value={shown}
      />
    </span>
  );
}
