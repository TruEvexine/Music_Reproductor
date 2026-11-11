import { useEffect, useRef } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { X } from "lucide-react";
import { useCover } from "../state/covers";
import type { CoverSize } from "../state/covers";
import { useDragDismiss } from "./gestures";

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

export function Cover({ hash, size = "small", seed, className = "" }: { hash?: string; size?: CoverSize; seed: string; className?: string }) {
  const src = useCover(hash, size);
  const hue = hueOf(seed);
  return (
    <span
      className={`cover ${className}`}
      style={{ background: `linear-gradient(135deg, oklch(0.42 0.07 ${hue}), oklch(0.24 0.05 ${(hue + 50) % 360}))` }}
    >
      {src && <img alt="" decoding="async" loading="lazy" src={src} />}
    </span>
  );
}

/** Diálogo modal nativo: atrapa el foco, cierra con Escape y con clic fuera. En móvil es una hoja inferior. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useDragDismiss(ref, onClose, { touchOnly: true }); // hoja inferior: arrastrar la cabecera la cierra
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      aria-label={title}
      className="dialog"
      onClick={(event) => event.target === ref.current && onClose()}
      onClose={onClose}
      ref={ref}
    >
      <div className="dialog-body">
        <header className="dialog-header" {...drag}>
          <h2>{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X {...icon} />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
