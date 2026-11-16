import type { ReactNode } from "react";
import type { Track } from "../core/track";
import { Dialog } from "./parts";

export interface SheetAction {
  label: string;
  icon: ReactNode;
  run: () => void;
}

/** Hoja de acciones de una pista (pulsación larga, clic derecho o tecla de menú sobre su fila). */
export function ActionSheet({ track, actions, onClose }: { track: Track; actions: SheetAction[]; onClose: () => void }) {
  return (
    <Dialog onClose={onClose} title={track.title}>
      <p className="subtitle">
        {track.artist} · {track.album}
      </p>
      <ul className="sheet-actions">
        {actions.map((action) => (
          <li key={action.label}>
            <button
              className="sheet-action"
              onClick={() => {
                onClose();
                action.run();
              }}
              type="button"
            >
              {action.icon}
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
