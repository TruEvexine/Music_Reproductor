// Cola de reproducción como datos puros. Sin pistas repetidas: la pista actual se identifica por id.

export type RepeatMode = "off" | "queue" | "track";

export interface QueueState {
  /** Orden real de reproducción (barajado si `shuffle`). Es lo que muestra la UI. */
  order: string[];
  /** Orden sin barajar, para poder volver a él al apagar el shuffle. */
  original: string[];
  current: string | null;
  repeat: RepeatMode;
  shuffle: boolean;
}

export type Rng = () => number;

export const emptyQueue: QueueState = {
  order: [],
  original: [],
  current: null,
  repeat: "off",
  shuffle: false,
};

function shuffled(ids: string[], rng: Rng): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Baraja dejando `first` al principio: así nada se repite hasta agotar la cola. */
function shuffledFrom(ids: string[], first: string | null, rng: Rng): string[] {
  if (first === null || !ids.includes(first)) return shuffled(ids, rng);
  return [first, ...shuffled(ids.filter((id) => id !== first), rng)];
}

export function currentIndex(state: QueueState): number {
  return state.current === null ? -1 : state.order.indexOf(state.current);
}

/** Sustituye la cola por un contexto (álbum, lista filtrada…) empezando en `startId`. */
export function replaceQueue(state: QueueState, ids: string[], startId: string, rng: Rng = Math.random): QueueState {
  const original = [...new Set(ids)];
  if (!original.includes(startId)) return state;
  return {
    ...state,
    original,
    order: state.shuffle ? shuffledFrom(original, startId, rng) : original,
    current: startId,
  };
}

/** Añade al final sin reproducir. Si la cola estaba vacía, la pista queda seleccionada. */
export function enqueue(state: QueueState, id: string): QueueState {
  if (state.order.includes(id)) return state;
  return {
    ...state,
    order: [...state.order, id],
    original: [...state.original, id],
    current: state.current ?? id,
  };
}

/** Reproduce `id` ya: si no estaba en la cola se inserta justo después de la actual. */
export function playNow(state: QueueState, id: string): QueueState {
  if (state.order.includes(id)) return { ...state, current: id };
  const insert = (list: string[]) => {
    const at = state.current === null ? -1 : list.indexOf(state.current);
    const next = [...list];
    next.splice(at < 0 ? list.length : at + 1, 0, id);
    return next;
  };
  return { ...state, order: insert(state.order), original: insert(state.original), current: id };
}

/** Deja `id` justo después de la actual sin reproducirla; si ya estaba en la cola, la mueve. Sin pista actual, solo la añade. */
export function playNext(state: QueueState, id: string): QueueState {
  const current = state.current;
  if (current === null) return enqueue(state, id);
  if (id === current) return state;
  const place = (list: string[]) => {
    const rest = list.filter((item) => item !== id);
    const at = rest.indexOf(current);
    rest.splice(at < 0 ? rest.length : at + 1, 0, id);
    return rest;
  };
  return { ...state, order: place(state.order), original: place(state.original) };
}

/** Quita una pista. Si era la actual, pasa a la siguiente (o a la anterior si era la última). */
export function removeFromQueue(state: QueueState, id: string): QueueState {
  const index = state.order.indexOf(id);
  if (index < 0) return state;
  const order = state.order.filter((item) => item !== id);
  const current = state.current === id ? (order[index] ?? order[index - 1] ?? null) : state.current;
  return { ...state, order, original: state.original.filter((item) => item !== id), current };
}

/** Reordena por posición. La pista actual sigue siendo la misma porque se identifica por id. */
export function moveInQueue(state: QueueState, from: number, to: number): QueueState {
  if (from === to || from < 0 || to < 0 || from >= state.order.length || to >= state.order.length) return state;
  const order = [...state.order];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return { ...state, order, original: state.shuffle ? state.original : order };
}

export function clearQueue(state: QueueState): QueueState {
  return { ...state, order: [], original: [], current: null };
}

/**
 * Siguiente pista. `auto` = la pista terminó sola (respeta "repetir pista");
 * si el usuario pulsa "siguiente", avanza siempre.
 * Devuelve `current: null` cuando la cola se agotó y no hay repetición.
 */
export function nextInQueue(state: QueueState, auto: boolean, rng: Rng = Math.random): QueueState {
  if (state.current === null || state.order.length === 0) return state;
  if (auto && state.repeat === "track") return state;
  const next = state.order[currentIndex(state) + 1];
  if (next !== undefined) return { ...state, current: next };
  if (state.repeat !== "queue") return { ...state, current: null };
  if (!state.shuffle || state.order.length < 2) return { ...state, current: state.order[0] };
  // Nueva vuelta barajada, evitando que empiece por la que acaba de sonar.
  let order = shuffled(state.order, rng);
  if (order[0] === state.current) order = [...order.slice(1), order[0]];
  return { ...state, order, current: order[0] };
}

/** Pista anterior; al principio de la cola solo da la vuelta con "repetir cola". */
export function previousInQueue(state: QueueState): QueueState {
  const index = currentIndex(state);
  if (index < 0) return state;
  if (index > 0) return { ...state, current: state.order[index - 1] };
  return state.repeat === "queue" ? { ...state, current: state.order[state.order.length - 1] } : state;
}

export function toggleShuffle(state: QueueState, rng: Rng = Math.random): QueueState {
  return state.shuffle
    ? { ...state, shuffle: false, order: state.original }
    : { ...state, shuffle: true, order: shuffledFrom(state.original, state.current, rng) };
}

export function cycleRepeat(state: QueueState): QueueState {
  const repeat: RepeatMode = state.repeat === "off" ? "queue" : state.repeat === "queue" ? "track" : "off";
  return { ...state, repeat };
}

/** Restaura una cola guardada conservando solo las pistas que siguen existiendo. */
export function restoreQueue(saved: QueueState, available: ReadonlySet<string>): QueueState {
  const order = saved.order.filter((id) => available.has(id));
  const original = saved.original.filter((id) => available.has(id));
  const current = saved.current !== null && available.has(saved.current) ? saved.current : (order[0] ?? null);
  return { ...saved, order, original, current };
}
