// Cola de reproducción como datos puros. Cada entrada tiene su propia clave: una misma pista puede estar varias veces
// y la actual se identifica por su clave, así reordenar o quitar otra copia nunca la pierde.

export type RepeatMode = "off" | "queue" | "track";

/** Una aparición de una pista en la cola: `key` es única por entrada, `id` es el de la pista. */
export interface QueueEntry {
  key: string;
  id: string;
}

export interface QueueState {
  /** Orden real de reproducción (barajado si `shuffle`). Es lo que muestra la UI. */
  order: QueueEntry[];
  /** Orden sin barajar, para poder volver a él al apagar el shuffle. */
  original: QueueEntry[];
  current: QueueEntry | null;
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

// Prefijo aleatorio por ejecución: las claves de una cola restaurada de otra sesión no chocan con las nuevas.
const run = Math.random().toString(36).slice(2, 8);
let serial = 0;
const entry = (id: string): QueueEntry => ({ key: `${++serial}.${run}`, id });
const indexOf = (list: QueueEntry[], key: string | undefined) => list.findIndex((item) => item.key === key);

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Baraja dejando `first` al principio: así nada se repite hasta agotar la cola. */
function shuffledFrom(list: QueueEntry[], first: QueueEntry | null, rng: Rng): QueueEntry[] {
  if (first === null || indexOf(list, first.key) < 0) return shuffled(list, rng);
  return [first, ...shuffled(list.filter((item) => item.key !== first.key), rng)];
}

export function currentIndex(state: QueueState): number {
  return state.current === null ? -1 : indexOf(state.order, state.current.key);
}

// Posiciones de cada entrada, calculadas una vez por cola: una lista de 5 000 filas consulta esto en cada cambio del reproductor.
const positions = new WeakMap<QueueEntry[], { byKey: Map<string, number>; lastById: Map<string, number> }>();

/** ¿Ya sonó esta pista? Todas sus apariciones en la cola están antes de la actual. La que suena nunca cuenta como sonada. */
export function hasPlayed(state: QueueState, id: string): boolean {
  if (state.current === null) return false;
  let found = positions.get(state.order);
  if (!found) {
    const built = { byKey: new Map<string, number>(), lastById: new Map<string, number>() };
    state.order.forEach((item, at) => {
      built.byKey.set(item.key, at);
      built.lastById.set(item.id, at);
    });
    positions.set(state.order, (found = built));
  }
  const last = found.lastById.get(id);
  return last !== undefined && last < (found.byKey.get(state.current.key) ?? -1);
}

/** Sustituye la cola por un contexto (álbum, lista filtrada…) empezando en `startId`. */
export function replaceQueue(state: QueueState, ids: string[], startId: string, rng: Rng = Math.random): QueueState {
  const original = [...new Set(ids)].map(entry);
  const start = original.find((item) => item.id === startId);
  if (!start) return state;
  return {
    ...state,
    original,
    order: state.shuffle ? shuffledFrom(original, start, rng) : original,
    current: start,
  };
}

/** Añade al final sin reproducir, aunque ya esté en la cola. Si la cola estaba vacía, la pista queda seleccionada. */
export function enqueue(state: QueueState, id: string): QueueState {
  const added = entry(id);
  return {
    ...state,
    order: [...state.order, added],
    original: [...state.original, added],
    current: state.current ?? added,
  };
}

/** Reproduce ya la entrada `key` de la cola. */
export function playEntry(state: QueueState, key: string): QueueState {
  const found = state.order.find((item) => item.key === key);
  return found ? { ...state, current: found } : state;
}

/**
 * Deja la pista justo después de la actual sin reproducirla. Con `key` mueve esa entrada; sin ella mueve la primera
 * copia de `id` que no sea la actual o, si no hay, añade una. Sin pista actual, solo la añade.
 */
export function playNext(state: QueueState, id: string, key?: string): QueueState {
  const current = state.current;
  if (current === null) return enqueue(state, id);
  if (key === undefined ? id === current.id : key === current.key) return state;
  const moved = state.order.find((item) => (key === undefined ? item.id === id && item.key !== current.key : item.key === key)) ?? entry(id);
  const place = (list: QueueEntry[]) => {
    const rest = list.filter((item) => item.key !== moved.key);
    const at = indexOf(rest, current.key);
    rest.splice(at < 0 ? rest.length : at + 1, 0, moved);
    return rest;
  };
  return { ...state, order: place(state.order), original: place(state.original) };
}

/** Quita una entrada. Si era la actual, pasa a la siguiente (o a la anterior si era la última). */
export function removeFromQueue(state: QueueState, key: string): QueueState {
  const index = indexOf(state.order, key);
  if (index < 0) return state;
  const order = state.order.filter((item) => item.key !== key);
  const current = state.current?.key === key ? (order[index] ?? order[index - 1] ?? null) : state.current;
  return { ...state, order, original: state.original.filter((item) => item.key !== key), current };
}

/** Reordena por posición. La pista actual sigue siendo la misma porque se identifica por su clave. */
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
  if (order[0].key === state.current.key) order = [...order.slice(1), order[0]];
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

/** Sesiones guardadas antes de las entradas (listas de ids sin repetidos): se convierten al cargarlas. */
export function upgradeQueue(saved: QueueState): QueueState {
  if (typeof saved.order[0] !== "string" && typeof saved.current !== "string") return saved;
  const legacy = saved as unknown as { order: string[]; original: string[]; current: string | null };
  const byId = new Map(legacy.order.map((id) => [id, entry(id)]));
  const of = (id: string) => byId.get(id) ?? entry(id);
  return { ...saved, order: legacy.order.map(of), original: legacy.original.map(of), current: legacy.current === null ? null : of(legacy.current) };
}

/** Restaura una cola guardada conservando solo las pistas que siguen existiendo. */
export function restoreQueue(saved: QueueState, available: ReadonlySet<string>): QueueState {
  const order = saved.order.filter((item) => available.has(item.id));
  const original = saved.original.filter((item) => available.has(item.id));
  const current = order.find((item) => item.key === saved.current?.key) ?? order[0] ?? null;
  return { ...saved, order, original, current };
}
