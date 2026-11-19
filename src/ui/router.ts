import { useMemo, useSyncExternalStore } from "react";
import { isNative } from "../platform";

// Router mínimo. Web: rutas reales (/app/...). App nativa: hash (#/app/...), porque se sirve desde archivos.
// Los paneles van en la URL para que el botón/gesto "atrás" del sistema los cierre: ?panel=player (reproductor grande) y
// ?panel=queue (cola sola). Con el reproductor abierto, la cola es una capa encima: ?panel=player&queue=1 (atrás la cierra primero).

export type Panel = "player" | "queue";

function raw(): string {
  if (isNative) return location.hash.slice(1) || "/app";
  return location.pathname + location.search;
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

export function navigate(to: string, replace = false, state: unknown = null) {
  const url = isNative ? `#${to}` : to;
  if (replace) history.replaceState(state, "", url);
  else history.pushState(state, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): { path: string; panel: Panel | null; queue: boolean } {
  const current = useSyncExternalStore(subscribe, raw);
  return useMemo(() => {
    const url = new URL(current, "http://local");
    const param = url.searchParams.get("panel");
    const panel = param === "player" || param === "queue" ? param : null;
    return {
      path: url.pathname.replace(/\/+$/, "") || "/",
      panel,
      queue: panel === "queue" || (panel === "player" && url.searchParams.get("queue") === "1"),
    };
  }, [current]);
}

export function openPanel(panel: Panel) {
  const url = new URL(raw(), "http://local");
  if (panel === "queue" && url.searchParams.get("panel") === "player") {
    // Capa sobre el reproductor: entrada de historial propia para que "atrás" cierre solo la cola.
    if (url.searchParams.get("queue") !== "1") {
      url.searchParams.set("queue", "1");
      navigate(url.pathname + url.search);
    }
    return;
  }
  const replace = url.searchParams.has("panel");
  url.searchParams.delete("queue");
  url.searchParams.set("panel", panel);
  navigate(url.pathname + url.search, replace);
}

/** ¿La URL tiene el reproductor grande abierto? (fuera de React: los gestos deciden si abrir o cerrar al terminar) */
export const playerOpen = () => new URL(raw(), "http://local").searchParams.get("panel") === "player";

/** Cierra el panel abierto volviendo atrás, igual que haría el botón del sistema. */
export function closePanel() {
  if (new URL(raw(), "http://local").searchParams.has("panel")) history.back();
}
