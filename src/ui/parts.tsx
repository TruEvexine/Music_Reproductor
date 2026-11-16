import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { barsOf, BARS, hueOf } from "../core/coverArt";
import { coverBucket } from "../core/resample";
import { useCover } from "../state/covers";
import type { CoverSize } from "../state/covers";
import { useDragDismiss } from "./gestures";
import { useExit } from "./motion";

/** Tamaño y trazo únicos para todos los iconos (Lucide). */
export const icon = { size: 22, strokeWidth: 1.75, "aria-hidden": true } as const;
export const iconSmall = { ...icon, size: 18 } as const;

export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: { label: string; children: ReactNode } & ComponentPropsWithRef<"button">) {
  return (
    <button aria-label={label} className={`icon-button ${className}`} title={label} type="button" {...rest}>
      {children}
    </button>
  );
}

/** Píxeles reales de pantalla que ocupa el elemento (ancho × densidad, redondeados con `coverBucket`); 0 si no se pide medir. Se reevalúa al cambiar el tamaño, el zoom o de pantalla. */
function useDevicePixels(enabled: boolean) {
  const [px, setPx] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    let timer = 0;
    const observer = new ResizeObserver(([entry]) => {
      // El máximo de ambas medidas: con la densidad emulada de las pruebas la de dispositivo llega en píxeles CSS, y con zoom la otra se queda corta.
      const device = Math.max(entry.devicePixelContentBoxSize?.[0]?.inlineSize ?? 0, entry.contentRect.width * devicePixelRatio);
      clearTimeout(timer);
      timer = window.setTimeout(() => setPx(coverBucket(device)), 150); // al arrastrar el borde de la ventana solo cuenta el tamaño en el que se detiene
    });
    try {
      observer.observe(element, { box: "device-pixel-content-box" });
    } catch {
      observer.observe(element); // Safari no mide en píxeles de dispositivo: se multiplica por la densidad
    }
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [enabled]);
  return [px, ref] as const;
}

/**
 * Portada. Sin carátula (o mientras carga) se pinta la funda generada (core/coverArt.ts): estática, del tono y el motivo de su semilla, y se sustituye por la carátula en cuanto hay una.
 * `sharp`: portada grande que se sirve al tamaño real de pantalla (reproductor grande, cabecera de álbum).
 * `label` describe la portada para lectores de pantalla; sin él es decorativa (el título está al lado).
 */
export function Cover({ hash, size = "small", seed, className = "", sharp = false, label }: { hash?: string; size?: CoverSize; seed: string; className?: string; sharp?: boolean; label?: string }) {
  const [px, ref] = useDevicePixels(sharp);
  const src = useCover(hash, size, px);
  const bars = useMemo(() => barsOf(seed), [seed]);
  const generated = !hash && Boolean(label);
  return (
    <span
      aria-label={generated ? `Portada generada para ${label}` : undefined}
      className={`cover ${className}`}
      data-sleeve=""
      ref={ref}
      role={generated ? "img" : undefined}
      style={{ "--h": hueOf(seed) } as CSSProperties}
    >
      {!src && <Sleeve bars={bars} />}
      {src && <img alt={label ? `Portada de ${label}` : ""} decoding="async" loading="lazy" src={src} />}
    </span>
  );
}

// Nueve barras de 4,6 u con márgenes de 18 u a cada lado (en un lienzo de 100): el motivo se lee igual a 48 px que a pantalla completa.
const BAR = 4.6;
const PITCH = (64 - BAR) / (BARS - 1); // reparte las barras en el ancho útil de 64 u
const Sleeve = ({ bars }: { bars: number[] }) => (
  <svg aria-hidden="true" className="art" fill="currentColor" viewBox="0 0 100 100">
    {bars.map((bar, i) => (
      <rect height={bar * 64} key={i} rx={BAR / 2} width={BAR} x={18 + i * PITCH} y={50 - bar * 32} />
    ))}
  </svg>
);

/** Diálogo modal nativo: atrapa el foco, cierra con Escape y con clic fuera. En móvil es una hoja inferior. */
export function Dialog({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useDragDismiss(ref, onClose, { touchOnly: true }); // hoja inferior: arrastrar la cabecera la cierra (el arrastre ya animó la salida)
  const { closing, request } = useExit(onClose);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      aria-label={title}
      className={`dialog ${className}`}
      data-closing={closing}
      onCancel={(event) => {
        event.preventDefault(); // Escape: primero la salida, luego el cierre
        request();
      }}
      onClick={(event) => event.target === ref.current && request()}
      onClose={onClose}
      ref={ref}
    >
      <div className="dialog-body">
        <header className="dialog-header" {...drag}>
          <h2>{title}</h2>
          <IconButton label="Cerrar" onClick={request}>
            <X {...icon} />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
