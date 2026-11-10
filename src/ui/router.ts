import { useMemo, useSyncExternalStore } from "react";
import { isNative } from "../platform";

// Router mínimo. Web: rutas reales (/app/...). App nativa: hash (#/app/...), porque se sirve desde archivos.
// Los paneles (reproductor, cola) van en ?panel= para que el botón/gesto "atrás" del sistema los cierre.

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

export function navigate(to: string, replace = false) {
  const url = isNative ? `#${to}` : to;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): { path: string; panel: Panel | null } {
  const current = useSyncExternalStore(subscribe, raw);
  return useMemo(() => {
    const url = new URL(current, "http://local");
    const panel = url.searchParams.get("panel");
    return {
      path: url.pathname.replace(/\/+$/, "") || "/",
      panel: panel === "player" || panel === "queue" ? panel : null,
    };
  }, [current]);
}

export function openPanel(panel: Panel) {
  const url = new URL(raw(), "http://local");
  const replace = url.searchParams.has("panel"); // de reproductor a cola no apila historial
  url.searchParams.set("panel", panel);
  navigate(url.pathname + url.search, replace);
}

/** Cierra el panel abierto volviendo atrás, igual que haría el botón del sistema. */
export function closePanel() {
  if (new URL(raw(), "http://local").searchParams.has("panel")) history.back();
}
