import { useEffect } from "react";
import { player, usePlayer } from "../state/player";
import { closePanel, openPanel } from "./router";

/** ¿El foco está en algo donde las teclas escriben o ya tienen significado propio? */
function owns(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.closest("dialog[open]") !== null;
}

/**
 * Atajos de escritorio (con diálogos o campos de texto enfocados no actúan):
 * Espacio play/pausa · ←/→ ∓5 s · Mayús+←/→ anterior/siguiente · ↑/↓ volumen · M silencio · S aleatorio · R repetición · Q cola.
 * Los deslizadores de rango conservan sus propias flechas: si uno tiene el foco, ←/→/↑/↓ no se interceptan.
 */
export function useShortcuts(queueOpen: boolean) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || owns(event.target)) return;
      const onRange = event.target instanceof HTMLInputElement && event.target.type === "range";
      const audio = usePlayer.getState().audio;
      const handled = (action: () => void) => {
        event.preventDefault();
        action();
      };
      switch (event.key) {
        case " ":
          if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return; // Espacio activa el botón enfocado
          return handled(player.toggle);
        case "ArrowLeft":
          if (!onRange) handled(() => (event.shiftKey ? player.previous() : player.seekBy(-5)));
          return;
        case "ArrowRight":
          if (!onRange) handled(() => (event.shiftKey ? player.next() : player.seekBy(5)));
          return;
        case "ArrowUp":
          if (!onRange) handled(() => player.setVolume(Math.min(1, audio.volume + 0.05)));
          return;
        case "ArrowDown":
          if (!onRange) handled(() => player.setVolume(Math.max(0, audio.volume - 0.05)));
          return;
        case "m":
        case "M":
          return handled(player.toggleMute);
        case "s":
        case "S":
          return handled(player.toggleShuffle);
        case "r":
        case "R":
          return handled(player.cycleRepeat);
        case "q":
        case "Q":
          return handled(() => (queueOpen ? closePanel() : openPanel("queue")));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueOpen]);
}
