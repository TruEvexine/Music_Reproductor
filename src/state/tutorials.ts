import { create } from "zustand";
import { initialTutorials, markSeen, sanitizeTutorials, skipAll } from "../core/tutorials";
import type { TutorialId, TutorialState } from "../core/tutorials";
import { storage } from "../platform";

// Avisos de primera vez. Lo visto y lo omitido se guarda en IndexedDB (clave "tutorials"); lo «encontrado» solo vive en esta sesión.
interface TutorialsStore extends TutorialState {
  /** Hasta cargar lo guardado no se muestra ninguno (si no, un aviso ya visto parpadearía al abrir). */
  ready: boolean;
  /** Cosas que la persona ya tiene delante en esta sesión: lo único que puede disparar un aviso. */
  encountered: TutorialId[];
  /** Sube con «Ver tutoriales otra vez»: los efectos que registran encuentros se repiten. */
  resets: number;
}

export const useTutorials = create<TutorialsStore>(() => ({ ...initialTutorials, ready: false, encountered: [], resets: 0 }));

function save() {
  const { seen, off } = useTutorials.getState();
  void storage.set("tutorials", { seen, off } satisfies TutorialState);
}

export const tutorials = {
  encounter(id: TutorialId) {
    if (!useTutorials.getState().encountered.includes(id)) useTutorials.setState((state) => ({ encountered: [...state.encountered, id] }));
  },
  /** La persona ya lo vio o lo hizo: no vuelve a salir. */
  done(id: TutorialId) {
    const next = markSeen(useTutorials.getState(), id);
    if (next === useTutorials.getState()) return;
    useTutorials.setState({ seen: next.seen });
    save();
  },
  skipAll() {
    useTutorials.setState({ off: skipAll(useTutorials.getState()).off });
    save();
  },
  /** Ajustes → «Ver tutoriales otra vez». */
  reset() {
    useTutorials.setState((state) => ({ ...initialTutorials, encountered: [], resets: state.resets + 1 }));
    save();
  },
};

export async function initTutorials() {
  useTutorials.setState({ ...sanitizeTutorials(await storage.get("tutorials")), ready: true });
}
