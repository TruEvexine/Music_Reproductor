import { useEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { X } from "lucide-react";
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

// Respaldo sin portada: un degradado estable derivado del texto (álbum), nunca un gris plano.
function hueOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
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

/** `sharp`: portada grande que se sirve al tamaño real de pantalla (reproductor grande, cabecera de álbum). En listas y rejillas no hace falta. */
export function Cover({ hash, size = "small", seed, className = "", sharp = false }: { hash?: string; size?: CoverSize; seed: string; className?: string; sharp?: boolean }) {
  const [px, ref] = useDevicePixels(sharp);
  const src = useCover(hash, size, px);
  const hue = hueOf(seed);
  return (
    <span
      className={`cover ${className}`}
      ref={ref}
      style={{ background: `linear-gradient(135deg, oklch(0.42 0.07 ${hue}), oklch(0.24 0.05 ${(hue + 50) % 360}))` }}
    >
      {src && <img alt="" decoding="async" loading="lazy" src={src} />}
    </span>
  );
}

/** Diálogo modal nativo: atrapa el foco, cierra con Escape y con clic fuera. En móvil es una hoja inferior. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useDragDismiss(ref, onClose, { touchOnly: true }); // hoja inferior: arrastrar la cabecera la cierra (el arrastre ya animó la salida)
  const { closing, request } = useExit(onClose);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      aria-label={title}
      className="dialog"
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
