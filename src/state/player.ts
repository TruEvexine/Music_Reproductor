import { create } from "zustand";
import {
  clearQueue,
  cycleRepeat,
  emptyQueue,
  enqueue,
  moveInQueue,
  nextInQueue,
  playNow,
  previousInQueue,
  removeFromQueue,
  replaceQueue,
  restoreQueue,
  toggleShuffle,
} from "../core/queue";
import type { QueueState } from "../core/queue";
import { PlayerEngine } from "../engine/PlayerEngine";
import { storage } from "../platform";
import { library, trackUrl, useLibrary } from "./library";

// Fuente única de verdad de la reproducción. La UI solo lee este store y llama a `player.*`.
interface PlayerState {
  queue: QueueState;
  isPlaying: boolean;
  position: number;
  duration: number;
  /** Aviso para el usuario (pista que no se pudo reproducir). */
  message: string | null;
}

export const usePlayer = create<PlayerState>(() => ({
  queue: emptyQueue,
  isPlaying: false,
  position: 0,
  duration: 0,
  message: null,
}));

const MAX_FAILURES = 3;
let failuresInRow = 0;

const engine = new PlayerEngine({
  onPlaying: (isPlaying) => usePlayer.setState({ isPlaying }),
  onTime: (position) => {
    if (position > 1) failuresInRow = 0;
    usePlayer.setState({ position });
  },
  onDuration: (duration) => usePlayer.setState({ duration }),
  onEnded: () => advance(true),
  onError: () => fail(),
});

function titleOf(id: string): string {
  return useLibrary.getState().tracks.find((track) => track.id === id)?.title ?? "la pista";
}

/** Aplica una cola nueva; si la pista actual cambió (o `restart`), la carga en el motor. */
function apply(queue: QueueState, options: { autoplay: boolean; restart?: boolean; startAt?: number }) {
  const previous = usePlayer.getState().queue.current;
  usePlayer.setState({ queue });
  if (queue.current === previous && !options.restart) return;
  if (queue.current === null) {
    engine.stop();
    usePlayer.setState({ isPlaying: false, position: 0, duration: 0 });
    return;
  }
  const url = trackUrl(queue.current);
  if (!url) {
    fail();
    return;
  }
  const known = useLibrary.getState().tracks.find((track) => track.id === queue.current)?.duration ?? 0;
  usePlayer.setState({ position: options.startAt ?? 0, duration: known });
  engine.load(url, options.startAt);
  if (options.autoplay) void engine.play().catch(() => fail());
}

function advance(auto: boolean) {
  const state = usePlayer.getState();
  const next = nextInQueue(state.queue, auto);
  if (next.current === null) {
    // Fin de la cola: se queda en la última pista, parada al principio.
    engine.pause();
    engine.seek(0);
    usePlayer.setState({ isPlaying: false, position: 0 });
    return;
  }
  apply(next, { autoplay: true, restart: true });
}

/** Error de decodificación: marca la pista, avisa y salta; tras 3 seguidas, se detiene. */
function fail() {
  const { queue } = usePlayer.getState();
  if (queue.current === null) return;
  library.markUnplayable(queue.current);
  failuresInRow += 1;
  const message = `No se pudo reproducir «${titleOf(queue.current)}».`;
  const next = nextInQueue({ ...queue, repeat: queue.repeat === "track" ? "off" : queue.repeat }, true);
  if (failuresInRow >= MAX_FAILURES || next.current === null || next.current === queue.current) {
    failuresInRow = 0;
    engine.pause();
    usePlayer.setState({ isPlaying: false, message });
    return;
  }
  usePlayer.setState({ message });
  apply({ ...next, repeat: queue.repeat }, { autoplay: true, restart: true });
}

const q = () => usePlayer.getState().queue;

export const player = {
  /** Tocar una canción: la cola pasa a ser su contexto (lista visible), empezando por ella. */
  playContext(ids: string[], startId: string) {
    apply(replaceQueue(q(), ids, startId), { autoplay: true, restart: true });
  },
  playNow(id: string) {
    apply(playNow(q(), id), { autoplay: true, restart: true });
  },
  enqueue(id: string) {
    apply(enqueue(q(), id), { autoplay: false });
  },
  remove(id: string) {
    apply(removeFromQueue(q(), id), { autoplay: usePlayer.getState().isPlaying });
  },
  move(from: number, to: number) {
    usePlayer.setState({ queue: moveInQueue(q(), from, to) });
  },
  clear() {
    apply(clearQueue(q()), { autoplay: false });
  },
  toggle() {
    if (q().current === null) return;
    if (engine.paused) void engine.play().catch(() => fail());
    else engine.pause();
  },
  next() {
    advance(false);
  },
  /** Pasados 3 s reinicia la pista; antes, va a la anterior. */
  previous() {
    const previous = previousInQueue(q());
    if (engine.position > 3 || previous.current === q().current) {
      engine.seek(0);
      usePlayer.setState({ position: 0 });
      return;
    }
    apply(previous, { autoplay: true });
  },
  seek(position: number) {
    engine.seek(position);
    usePlayer.setState({ position });
  },
  toggleShuffle() {
    usePlayer.setState({ queue: toggleShuffle(q()) });
  },
  cycleRepeat() {
    usePlayer.setState({ queue: cycleRepeat(q()) });
  },
  dismissMessage() {
    usePlayer.setState({ message: null });
  },
};

// --- Persistencia de sesión (IndexedDB): cola, modos y posición. ---

interface SavedSession {
  queue: QueueState;
  position: number;
}

let saved: SavedSession | undefined;
let lastSave = 0;

function save() {
  const { queue, position } = usePlayer.getState();
  lastSave = Date.now();
  void storage.set("session", { queue, position } satisfies SavedSession);
}

/** Restaura la sesión con las pistas disponibles. Se reintenta cuando llegan pistas nuevas. */
function restore() {
  if (!saved) return;
  if (q().current !== null) {
    saved = undefined; // el usuario ya está escuchando otra cosa: la sesión guardada caduca
    return;
  }
  const available = new Set(useLibrary.getState().tracks.map((track) => track.id));
  const queue = restoreQueue(saved.queue, available);
  if (queue.current === null) {
    usePlayer.setState({ queue });
    return;
  }
  apply(queue, { autoplay: false, restart: true, startAt: queue.current === saved.queue.current ? saved.position : 0 });
  saved = undefined;
}

export async function initSession() {
  saved = await storage.get<SavedSession>("session");
  restore();
  useLibrary.subscribe((state, previous) => {
    if (state.tracks.length !== previous.tracks.length) restore();
  });
  usePlayer.subscribe((state, previous) => {
    if (saved) return; // todavía esperando a que aparezcan las pistas guardadas: no pisar la sesión
    if (state.queue !== previous.queue || Date.now() - lastSave > 5000) save();
  });
  window.addEventListener("pagehide", () => {
    if (!saved) save();
  });
}
