import { useRef } from "react";
import { create } from "zustand";
import { player, usePlayer } from "../state/player";
import { usePresence } from "./motion";

// Aviso breve con "Deshacer" para las acciones de cola (gestos y hoja de acciones). Un solo aviso a la vez.
interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

const useToast = create<{ current: Toast | null }>(() => ({ current: null }));
let timer: ReturnType<typeof setTimeout> | undefined;
let serial = 0;

function dismiss() {
  clearTimeout(timer);
  useToast.setState({ current: null });
}

export function toast(message: string, undo?: () => void) {
  clearTimeout(timer);
  // Un aviso sin «Deshacer» que ya está a la vista se reescribe en su sitio: pulsar X o P varias veces no repite la entrada.
  const current = useToast.getState().current;
  useToast.setState({ current: { id: current && !current.undo && !undo ? current.id : ++serial, message, undo } });
  timer = setTimeout(dismiss, undo ? 6000 : 3500);
}

/** Vibración corta al cruzar el umbral de un gesto. Solo donde existe (Android); iOS Safari no la tiene. */
export const buzz = (ms = 10) => void navigator.vibrate?.(ms);

/** Ejecuta un cambio de cola y ofrece deshacerlo volviendo a la cola de antes. */
export function queueAction(message: string, run: () => void) {
  const before = usePlayer.getState().queue;
  run();
  toast(message, () => player.restoreQueue(before));
}

export function Toaster() {
  const current = useToast((state) => state.current);
  // Al descartarse, el aviso sigue pintándose mientras sale (--exit).
  const last = useRef(current);
  if (current) last.current = current;
  const { mounted, closing } = usePresence(current !== null);
  const shown = current ?? last.current;
  return (
    <div className="toaster" role="status">
      {mounted && shown && (
        <p className="toast" data-closing={closing} inert={closing} key={shown.id}>
          <span>{shown.message}</span>
          {shown.undo && (
            <button
              className="link"
              onClick={() => {
                shown.undo?.();
                dismiss();
              }}
              type="button"
            >
              Deshacer
            </button>
          )}
        </p>
      )}
    </div>
  );
}
