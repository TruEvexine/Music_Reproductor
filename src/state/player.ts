import { create } from "zustand";
import { eqChainOf, FADE_PAUSE_SECONDS, replayGainFor, sanitizeAudioSettings, SLEEP_FADE_SECONDS, sleepShouldFade } from "../core/audio";
import type { AudioSettings, SleepTimer } from "../core/audio";
import {
  clearQueue,
  cycleRepeat,
  emptyQueue,
  enqueue,
  moveInQueue,
  nextInQueue,
  playNext,
  playNow,
  previousInQueue,
  removeFromQueue,
  replaceQueue,
  restoreQueue,
  toggleShuffle,
} from "../core/queue";
import type { QueueState } from "../core/queue";
import { PlayerEngine } from "../engine/PlayerEngine";
import { audioSession, storage } from "../platform";
import { holdCover } from "./covers";
import { ensureTrackUrl, library, trackUrl, useLibrary } from "./library";

// Fuente única de verdad de la reproducción. La UI solo lee este store y llama a `player.*`.
interface PlayerState {
  queue: QueueState;
  isPlaying: boolean;
  position: number;
  duration: number;
  audio: AudioSettings;
  sleep: SleepTimer;
  /** Aviso para el usuario (pista que no se pudo reproducir). */
  message: string | null;
}

export const usePlayer = create<PlayerState>(() => ({
  queue: emptyQueue,
  isPlaying: false,
  position: 0,
  duration: 0,
  audio: sanitizeAudioSettings(undefined),
  sleep: null,
  message: null,
}));

const MAX_FAILURES = 3;
const PRELOAD_SECONDS = 15;
let failuresInRow = 0;
let fading = false; // crossfade o fundido de apagado en curso para la pista actual
let loadedId: string | null = null; // pista cargada en el motor (una sesión restaurada aún no lee su archivo)
let loadToken = 0; // la lectura del archivo es asíncrona: solo cuenta la última petición

const engine = new PlayerEngine({
  onPlaying: (isPlaying) => usePlayer.setState({ isPlaying }),
  onStarted: republishSession,
  onTime: (position) => {
    if (position > 1) failuresInRow = 0;
    usePlayer.setState({ position });
    nearEnd(position);
  },
  onDuration: (duration) => usePlayer.setState({ duration }),
  onEnded: () => {
    const { sleep } = usePlayer.getState();
    if (sleep && "endOfTrack" in sleep) {
      usePlayer.setState({ sleep: null, isPlaying: false });
      return;
    }
    advance(true);
  },
  onError: () => fail(),
});

const q = () => usePlayer.getState().queue;
const trackOf = (id: string | null) => useLibrary.getState().tracks.find((track) => track.id === id);
const pauseFade = () => (usePlayer.getState().audio.fadePause ? FADE_PAUSE_SECONDS : 0);
const gainOf = (id: string | null) => replayGainFor(trackOf(id), usePlayer.getState().audio.replayGain);

/** Cerca del final: precarga la siguiente, arranca el crossfade o el fundido del temporizador. */
function nearEnd(position: number) {
  const { duration, audio, sleep, queue, isPlaying } = usePlayer.getState();
  if (!isPlaying || fading) return;
  if (sleepShouldFade(sleep, Date.now())) {
    fading = true;
    engine.pause(SLEEP_FADE_SECONDS);
    setTimeout(() => {
      fading = false;
      usePlayer.setState({ sleep: null });
    }, SLEEP_FADE_SECONDS * 1000);
    return;
  }
  if (duration <= 0) return;
  const remaining = duration - position;
  if (remaining > PRELOAD_SECONDS) return;
  const next = nextInQueue(queue, true);
  if (!next.current || next.current === queue.current) return;
  const url = trackUrl(next.current);
  if (!url) {
    void ensureTrackUrl(next.current); // el próximo tic (≈250 ms) ya la encuentra
    return;
  }
  const endOfTrackSleep = sleep !== null && "endOfTrack" in sleep;
  if (audio.crossfade > 0 && !endOfTrackSleep && remaining <= audio.crossfade && duration > audio.crossfade * 2) {
    if (engine.crossfadeTo(url, Math.max(remaining / audio.speed, 0.5), gainOf(next.current))) {
      fading = true;
      setTimeout(() => (fading = false), 1000);
      loadedId = next.current;
      library.markPlayed(next.current);
      usePlayer.setState({ queue: next, position: 0, duration: trackOf(next.current)?.duration ?? 0 });
      return;
    }
  }
  engine.preload(url);
}

/** Aplica una cola nueva; si la pista actual cambió (o `restart`), la carga en el motor. */
function apply(queue: QueueState, options: { autoplay: boolean; restart?: boolean; startAt?: number }) {
  const previous = usePlayer.getState().queue.current;
  if (queue.current === previous && !options.restart) {
    usePlayer.setState({ queue });
    return;
  }
  fading = false;
  if (queue.current === null) {
    engine.stop();
    usePlayer.setState({ queue, isPlaying: false, position: 0, duration: 0 });
    return;
  }
  const id = queue.current;
  const track = trackOf(id);
  // Cola y posición en el mismo cambio: si no, la sesión se guardaría con la posición de la pista anterior.
  usePlayer.setState({ queue, position: options.startAt ?? 0, duration: track?.duration ?? 0 });
  if (track?.unsupported) {
    fail(`Este navegador no puede reproducir archivos ${track.fileName.split(".").pop()?.toUpperCase() ?? "de este tipo"}.`);
    return;
  }
  // Restaurar la sesión no lee el archivo: así no se pide permiso a la carpeta sin que el usuario toque nada.
  if (!options.autoplay && !trackUrl(id)) {
    loadedId = null;
    return;
  }
  const token = ++loadToken;
  void ensureTrackUrl(id).then((url) => {
    if (token !== loadToken || q().current !== id) return;
    if (!url) {
      const folder = library.accessFor(id);
      if (folder && folder.access !== "granted" && folder.access !== "missing") {
        engine.stop();
        loadedId = null;
        usePlayer.setState({ isPlaying: false, message: `Hace falta permiso para leer «${folder.name}». Toca «Reconectar» en tu biblioteca.` });
      } else fail(`«${track?.title ?? "La pista"}» ya no está en tu dispositivo.`);
      return;
    }
    loadedId = id;
    engine.load(url, options.startAt, gainOf(id));
    if (options.autoplay) {
      library.markPlayed(id);
      void engine.play().catch(() => fail());
    }
  });
}

function advance(auto: boolean) {
  const next = nextInQueue(q(), auto);
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
function fail(reason?: string) {
  const queue = q();
  if (queue.current === null) return;
  library.markUnplayable(queue.current);
  failuresInRow += 1;
  const message = reason ?? `No se pudo reproducir «${trackOf(queue.current)?.title ?? "la pista"}».`;
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

function setAudio(change: Partial<AudioSettings>) {
  const audio = sanitizeAudioSettings({ ...usePlayer.getState().audio, ...change });
  usePlayer.setState({ audio });
  engine.setVolume(audio.muted ? 0 : audio.volume);
  engine.setEq(eqChainOf(audio));
  engine.setBalance(audio.balance);
  engine.setSpeed(audio.speed);
  engine.setTrackGain(gainOf(q().current));
  void storage.set("audio", audio);
}

if (import.meta.env.DEV) (window as unknown as { __engine: PlayerEngine }).__engine = engine; // solo desarrollo: las pruebas de navegador leen el grafo real

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
  /** "Reproducir a continuación": detrás de la actual, sin cortar lo que suena. */
  playNext(id: string) {
    apply(playNext(q(), id), { autoplay: false });
  },
  /** Deshacer de las acciones de cola: vuelve a una cola guardada antes, sin tocar lo que suena si la actual no cambió. */
  restoreQueue(queue: QueueState) {
    apply(queue, { autoplay: usePlayer.getState().isPlaying });
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
    if (engine.paused || loadedId !== q().current) player.play();
    else player.pause();
  },
  play() {
    const { current } = q();
    if (current === null) return;
    // Sesión restaurada: el archivo se lee ahora, con el gesto del usuario (permiso de la carpeta si hace falta).
    if (loadedId !== current) apply(q(), { autoplay: true, restart: true, startAt: usePlayer.getState().position });
    else if (engine.paused) void engine.play(pauseFade()).catch(() => fail());
  },
  pause() {
    engine.pause(pauseFade());
  },
  next() {
    advance(false);
  },
  /** Pasados 3 s reinicia la pista; antes, va a la anterior. */
  previous() {
    const previous = previousInQueue(q());
    if (engine.position > 3 || previous.current === q().current) {
      player.seek(0);
      return;
    }
    apply(previous, { autoplay: true });
  },
  seek(position: number) {
    const { duration } = usePlayer.getState();
    const target = Math.max(0, duration > 0 ? Math.min(position, duration) : position);
    engine.seek(target);
    usePlayer.setState({ position: target });
  },
  seekBy(seconds: number) {
    player.seek(engine.position + seconds);
  },
  toggleShuffle() {
    usePlayer.setState({ queue: toggleShuffle(q()) });
  },
  cycleRepeat() {
    usePlayer.setState({ queue: cycleRepeat(q()) });
  },
  setVolume(volume: number) {
    setAudio({ volume, muted: false });
  },
  toggleMute() {
    setAudio({ muted: !usePlayer.getState().audio.muted });
  },
  setAudio,
  /** `minutes` = apagar pasado ese tiempo; "track" = al terminar la pista; null = cancelar. */
  setSleep(when: number | "track" | null) {
    usePlayer.setState({
      sleep: when === null ? null : when === "track" ? { endOfTrack: true } : { endsAt: Date.now() + when * 60_000 },
    });
  },
  dismissMessage() {
    usePlayer.setState({ message: null });
  },
  /** Analizador del grafo de audio (fondo "Ritmo"). Existe tras la primera reproducción. */
  analyser: () => engine.analyser,
};

// --- Sistema: pantalla de bloqueo, notificación y auriculares. ---

audioSession.setHandlers({
  play: player.play,
  pause: player.pause,
  next: player.next,
  previous: player.previous,
  seekTo: player.seek,
  seekBy: player.seekBy,
});

/** `immediate`: ficha sin portada ya, y la portada cuando esté lista. Sin él, solo se reaplica la ficha completa. */
function publishTrack(immediate: boolean) {
  const track = trackOf(q().current);
  const info = track && { title: track.title, artist: track.artist, album: track.album };
  if (immediate) audioSession.setTrack(info ?? null);
  void holdCover(track?.coverHash).then((artworkUrl) => {
    if (info && q().current === track.id) audioSession.setTrack({ ...info, artworkUrl });
  });
}

/** Android a veces ignora la ficha fijada antes de que haya reproducción real: se reaplica al empezar a sonar. */
function republishSession() {
  publishTrack(false);
  const { isPlaying, position, duration, audio } = usePlayer.getState();
  audioSession.setState({ playing: isPlaying, position, duration, rate: audio.speed });
}

function syncSession(state: PlayerState, previous: PlayerState) {
  const track = trackOf(state.queue.current);
  if (state.queue.current !== previous.queue.current || !lastSessionTitle || lastSessionTitle !== track?.title) {
    lastSessionTitle = track?.title;
    publishTrack(true);
  }
  // La posición se publica al cambiar de estado o de duración, no en cada tic: el sistema la extrapola solo.
  const speed = state.audio.speed;
  if (state.isPlaying !== previous.isPlaying || state.duration !== previous.duration || speed !== previous.audio.speed || Math.abs(state.position - previous.position) > 2) {
    audioSession.setState({ playing: state.isPlaying, position: state.position, duration: state.duration, rate: speed });
  }
}
let lastSessionTitle: string | undefined;

// --- Persistencia (IndexedDB): cola, modos, posición y ajustes de audio. ---

interface SavedSession {
  queue: QueueState;
  position: number;
}

let saved: SavedSession | undefined;
let lastPositionSave = 0;
const POSITION_EVERY_MS = 2000;

// La cola (hasta miles de ids) se guarda solo cuando cambia; la posición va en su propia clave, pequeña y frecuente.
// No se confía en pagehide: al recargar, la escritura asíncrona de IndexedDB puede no llegar a completarse.
function saveQueue() {
  const { queue, position } = usePlayer.getState();
  void storage.set("session", { queue, position } satisfies SavedSession);
  savePosition();
}

function savePosition() {
  const { queue, position } = usePlayer.getState();
  lastPositionSave = Date.now();
  void storage.set("position", { id: queue.current, position });
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
  const [audio, session, last] = await Promise.all([
    storage.get<AudioSettings>("audio"),
    storage.get<SavedSession>("session"),
    storage.get<{ id: string | null; position: number }>("position"),
    library.init(),
  ]);
  setAudio(sanitizeAudioSettings(audio));
  saved = session && last?.id === session.queue.current ? { ...session, position: last.position } : session;
  restore();
  useLibrary.subscribe((state, previous) => {
    if (state.tracks.length !== previous.tracks.length) restore();
    // Los metadatos llegan después de empezar a sonar: se actualiza la ficha del sistema y el ReplayGain.
    const current = q().current;
    if (current && state.tracks !== previous.tracks) {
      engine.setTrackGain(gainOf(current));
      syncSession(usePlayer.getState(), usePlayer.getState());
    }
  });
  usePlayer.subscribe((state, previous) => {
    syncSession(state, previous);
    if (saved) return; // todavía esperando a que aparezcan las pistas guardadas: no pisar la sesión
    if (state.queue !== previous.queue) saveQueue();
    else if (state.position !== previous.position && Date.now() - lastPositionSave > POSITION_EVERY_MS) savePosition();
  });
  const leave = () => !saved && savePosition();
  window.addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && leave());
}
