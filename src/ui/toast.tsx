import { create } from "zustand";
import { player, usePlayer } from "../state/player";

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
  useToast.setState({ current: { id: ++serial, message, undo } });
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
  return (
    <div className="toaster" role="status">
      {current && (
        <p className="toast" key={current.id}>
          <span>{current.message}</span>
          {current.undo && (
            <button
              className="link"
              onClick={() => {
                current.undo?.();
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
