import { useEffect } from "react";
import { shortcutFor } from "../core/shortcuts";
import type { FocusTarget } from "../core/shortcuts";
import { useBackground } from "../state/background";
import { player, usePlayer } from "../state/player";
import { repeatLabel } from "./Player";
import { openShortcutHelp } from "./ShortcutsHelp";
import { toast } from "./toast";
import { closePanel, openPanel } from "./router";

function focusOf(target: EventTarget | null): FocusTarget {
  if (!(target instanceof HTMLElement)) return { tag: "BODY" };
  return { tag: target.tagName, type: target instanceof HTMLInputElement ? target.type : undefined, role: target.getAttribute("role"), editable: target.isContentEditable };
}

/**
 * Atajos de escritorio (mapa y reglas de foco en core/shortcuts.ts): Espacio play/pausa · ←/→ anterior/siguiente · Mayús+←/→ ∓5 s ·
 * ↑/↓ volumen · M silencio · X aleatorio · P repetición · Q cola · ? ayuda. Se apagan en Ajustes → Accesibilidad; con un diálogo abierto no actúan.
 */
export function useShortcuts(queueOpen: boolean) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !useBackground.getState().shortcuts) return;
      if (event.target instanceof Element && event.target.closest("dialog[open]")) return;
      const action = shortcutFor(event, focusOf(event.target));
      if (!action) return;
      event.preventDefault();
      const audio = usePlayer.getState().audio;
      switch (action) {
        case "toggle":
          return player.toggle();
        case "previous":
          return player.previous();
        case "next":
          return player.next();
        case "seekBack":
          return player.seekBy(-5);
        case "seekForward":
          return player.seekBy(5);
        case "volumeUp":
          return player.setVolume(Math.min(1, audio.volume + 0.05));
        case "volumeDown":
          return player.setVolume(Math.max(0, audio.volume - 0.05));
        case "mute":
          return player.toggleMute();
        case "shuffle":
          player.toggleShuffle();
          return toast(usePlayer.getState().queue.shuffle ? "Aleatorio activado" : "Aleatorio desactivado");
        case "repeat":
          player.cycleRepeat();
          return toast(repeatLabel[usePlayer.getState().queue.repeat]);
        case "queue":
          return queueOpen ? closePanel() : openPanel("queue");
        case "help":
          return openShortcutHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueOpen]);
}
