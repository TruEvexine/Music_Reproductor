import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { artBackground, artOf, COVER_STYLE, hueOf, initialOf } from "../core/coverArt";
import { coverBucket } from "../core/resample";
import { useCover } from "../state/covers";
import type { CoverSize } from "../state/covers";
import { useDragDismiss } from "./gestures";
import { useExit, useReducedMotion } from "./motion";

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

const pageVisible = () => document.visibilityState === "visible";
const watchVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};

/**
 * Portada. Sin carátula (o mientras carga) se pinta arte generativo estable por pista (core/coverArt.ts): en listas, un `background` estático barato.
 * `sharp`: portada grande que se sirve al tamaño real de pantalla (reproductor grande, cabecera de álbum) y cuyo arte, además, se mueve despacio
 * mientras `playing`, solo con la pestaña visible y nunca con movimiento reducido (entonces la capa que se mueve ni existe).
 * `label` describe la portada para lectores de pantalla; sin él es decorativa (el título está al lado).
 */
export function Cover({
  hash,
  size = "small",
  seed,
  className = "",
  sharp = false,
  playing = false,
  label,
  title,
  artist,
}: {
  hash?: string;
  size?: CoverSize;
  seed: string;
  className?: string;
  sharp?: boolean;
  playing?: boolean;
  label?: string;
  title?: string;
  artist?: string;
}) {
  const [px, ref] = useDevicePixels(sharp);
  const src = useCover(hash, size, px);
  const reduced = useReducedMotion();
  const visible = useSyncExternalStore(watchVisibility, pageVisible);
  const flat = COVER_STYLE !== "campos";
  const art = useMemo(() => (flat ? "" : artBackground(artOf(seed), sharp)), [seed, sharp, flat]);
  const moving = !flat && sharp && !reduced && !src;
  const generated = !hash && Boolean(label);
  return (
    <span
      aria-label={generated ? `Portada generada para ${label}` : undefined}
      className={`cover ${className}`}
      data-art={moving ? "drift" : undefined}
      data-cover={flat ? COVER_STYLE : undefined}
      data-live={(moving && playing && visible) || undefined}
      ref={ref}
      role={generated ? "img" : undefined}
      style={flat ? ({ "--h": hueOf(seed) } as CSSProperties) : moving ? undefined : { background: art }}
    >
      {flat && !src && <FlatArt artist={artist} seed={seed} title={title} />}
      {moving && <span aria-hidden="true" className="art-drift" style={{ background: art }} />}
      {src && <img alt={label ? `Portada de ${label}` : ""} decoding="async" loading="lazy" src={src} />}
    </span>
  );
}

/** Contenido de la portada plana (el tono lo pone el CSS). Es decorativo: el título ya está al lado o en `aria-label`. */
function FlatArt({ seed, title, artist }: { seed: string; title?: string; artist?: string }) {
  const name = title ?? seed.split("\u0000")[0];
  return (
    <span aria-hidden="true" className="art">
      {COVER_STYLE === "inicial" && <span className="art-initial">{initialOf(name)}</span>}
      {COVER_STYLE === "nota" && (
        <svg className="art-note" fill="currentColor" viewBox="0 0 100 100">
          <ellipse cx="30" cy="72" rx="14" ry="10" transform="rotate(-20 30 72)" />
          <ellipse cx="73" cy="62" rx="14" ry="10" transform="rotate(-20 73 62)" />
          <path d="M38 24 87 14v15L38 39zM38 24h6v48h-6zM81 14h6v48h-6z" />
        </svg>
      )}
      {COVER_STYLE === "tarjeta" && (
        <>
          <span className="art-title">{name}</span>
          {artist && <span className="art-artist">{artist}</span>}
        </>
      )}
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
