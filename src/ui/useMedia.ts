import { useSyncExternalStore } from "react";

/** ¿Se cumple este media query? Se actualiza al rotar o redimensionar. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
  );
}
