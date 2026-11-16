import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** Primer antepasado que hace scroll vertical (el contenido principal o el panel de la cola). */
function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * Lista de filas de alto fijo: solo existen en el DOM las visibles (más un margen), así 5 000 pistas
 * cuestan lo mismo que 20. El scroll es el del contenedor de siempre, no uno nuevo dentro de la vista.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  label,
  className,
  ordered = false,
  getKey,
  children,
}: {
  items: T[];
  rowHeight: number;
  label: string;
  className: string;
  ordered?: boolean;
  getKey: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
}) {
  const ref = useRef<HTMLUListElement & HTMLOListElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);

  // La distancia entre el principio del scroll y la lista cambia con lo que haya encima (avisos, cabecera).
  useLayoutEffect(() => {
    const parent = scrollParent(ref.current);
    setScroller(parent);
    if (!parent || !ref.current) return;
    const measure = () => {
      if (!ref.current) return;
      setMargin(ref.current.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const child of parent.children) observer.observe(child);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: () => rowHeight,
    overscan: 8,
    scrollMargin: margin,
    getItemKey: (index) => getKey(items[index]),
  });
  const List = ordered ? "ol" : "ul";
  return (
    <List aria-label={label} className={`virtual-list ${className}`} ref={ref} style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => (
        <li
          aria-posinset={row.index + 1}
          aria-setsize={items.length}
          className="virtual-row"
          key={row.key}
          style={{ height: rowHeight, transform: `translateY(${row.start - margin}px)` }}
        >
          {children(items[row.index], row.index)}
        </li>
      ))}
    </List>
  );
}
