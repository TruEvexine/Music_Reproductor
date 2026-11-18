import { useContext, useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
import { nextTutorial } from "../core/tutorials";
import type { TutorialId, TutorialSlot } from "../core/tutorials";
import { tutorials, useTutorials } from "../state/tutorials";
import { PanelHidden, usePresence } from "./motion";
import { iconSmall } from "./parts";
import { useMedia } from "./useMedia";

/** Registra que la persona ya tiene delante esa cosa (cuando `when`): es lo único que puede disparar su aviso. Se repite tras «Ver tutoriales otra vez». */
export function useEncounter(id: TutorialId, when = true) {
  const resets = useTutorials((state) => state.resets);
  useEffect(() => {
    if (when) tutorials.encounter(id);
  }, [id, when, resets]);
}

/**
 * Aviso de primera vez, sin bloquear: va en el flujo (no flota), así que no tapa nada. «dock» es la franja sobre el reproductor; «player»,
 * dentro del reproductor grande. Solo se pinta si es la superficie visible (`enabled`), y uno a la vez (core/tutorials.ts).
 */
export function TutorialHint({ slot, enabled = true }: { slot: TutorialSlot; enabled?: boolean }) {
  const state = useTutorials();
  const pointer = useMedia("(hover: hover) and (pointer: fine)");
  const hidden = useContext(PanelHidden); // dentro de un panel cerrado (que sigue montado) no es la superficie visible
  const tip = enabled && !hidden && state.ready ? nextTutorial(state, state.encountered, pointer ? "pointer" : "touch", slot) : null;
  // Al descartarse sigue pintándose mientras sale (--exit), como el aviso de «Deshacer».
  const last = useRef(tip);
  if (tip) last.current = tip;
  const { mounted, closing } = usePresence(tip !== null);
  const shown = tip ?? last.current;
  if (!mounted || !shown) return null;
  return (
    <aside aria-label="Consejo" className="tip" data-closing={closing} data-slot={slot} inert={closing} key={shown.id}>
      <Lightbulb {...iconSmall} className="tip-icon" />
      <p>{shown.text}</p>
      <span className="tip-actions">
        <button className="link" onClick={() => tutorials.done(shown.id)} type="button">
          Entendido
        </button>
        <button className="link" onClick={tutorials.skipAll} type="button">
          Omitir todos
        </button>
      </span>
    </aside>
  );
}
