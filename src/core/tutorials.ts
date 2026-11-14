// Avisos de primera vez como datos puros: qué se dice, en qué dispositivo y cuál toca mostrar ahora. Uno a la vez, solo los que la persona
// ya encontró, ninguno si omitió todos. El estado vive en src/state/tutorials.ts y los pinta src/ui/Tutorial.tsx.
import { SWIPE_LABELS } from "./gestures";

export type TutorialId = "swipe" | "player-touch" | "player-pointer" | "shortcuts";
export type TutorialDevice = "touch" | "pointer";
/** Dónde se pinta: «dock» es una franja en el flujo sobre el reproductor (no tapa nada); «player» va dentro del reproductor grande. */
export type TutorialSlot = "dock" | "player";

export interface Tutorial {
  id: TutorialId;
  device: TutorialDevice;
  slot: TutorialSlot;
  text: string;
}

/** El orden es la prioridad cuando varios se han encontrado a la vez. */
export const TUTORIALS: readonly Tutorial[] = [
  { id: "swipe", device: "touch", slot: "dock", text: `Desliza una canción a la derecha («${SWIPE_LABELS.next}») o a la izquierda («${SWIPE_LABELS.enqueue}»). Si la mantienes pulsada, verás más acciones.` },
  { id: "player-touch", device: "touch", slot: "player", text: "Desliza la portada para cambiar de canción y arrastra hacia abajo para cerrar el reproductor." },
  { id: "player-pointer", device: "pointer", slot: "player", text: "Cambia de canción con las flechas ← y →, y cierra el reproductor con Esc." },
  { id: "shortcuts", device: "pointer", slot: "dock", text: "Pulsa ? para ver todos los atajos de teclado. Espacio pausa y ← → cambian de canción." },
];

export interface TutorialState {
  seen: TutorialId[];
  /** «Omitir todos»: no aparece ninguno más hasta «Ver tutoriales otra vez». */
  off: boolean;
}

export const initialTutorials: TutorialState = { seen: [], off: false };

const known = new Set<string>(TUTORIALS.map((tutorial) => tutorial.id));

/** Acepta lo guardado por cualquier versión (o corrupto): ids desconocidos fuera, y un `off` que no sea booleano no cuenta. */
export function sanitizeTutorials(saved: unknown): TutorialState {
  const data = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};
  const seen = Array.isArray(data.seen) ? data.seen.filter((id): id is TutorialId => typeof id === "string" && known.has(id)) : [];
  return { seen: [...new Set(seen)], off: data.off === true };
}

/**
 * El aviso que toca ahora en la superficie visible (`slot`: la franja sobre el reproductor o el reproductor grande, que nunca se ven a la
 * vez) y el dispositivo, o null. Son los encontrados y no vistos, por prioridad: nunca hay más de uno en pantalla.
 */
export function nextTutorial(state: TutorialState, encountered: readonly TutorialId[], device: TutorialDevice, slot: TutorialSlot): Tutorial | null {
  if (state.off) return null;
  return TUTORIALS.find((tutorial) => tutorial.device === device && tutorial.slot === slot && encountered.includes(tutorial.id) && !state.seen.includes(tutorial.id)) ?? null;
}

export const markSeen = (state: TutorialState, id: TutorialId): TutorialState => (state.seen.includes(id) ? state : { ...state, seen: [...state.seen, id] });
export const skipAll = (state: TutorialState): TutorialState => ({ ...state, off: true });
