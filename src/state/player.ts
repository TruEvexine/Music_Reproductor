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
import { library, trackUrl, useLibrary } from "./library";

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

const engine = new PlayerEngine({
  onPlaying: (isPlaying) => usePlayer.setState({ isPlaying }),
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
  const url = next.current && next.current !== queue.current ? trackUrl(next.current) : undefined;
  if (!url) return;
  const endOfTrackSleep = sleep !== null && "endOfTrack" in sleep;
  if (audio.crossfade > 0 && !endOfTrackSleep && remaining <= audio.crossfade && duration > audio.crossfade * 2) {
    if (engine.crossfadeTo(url, Math.max(remaining / audio.speed, 0.5), gainOf(next.current))) {
      fading = true;
      setTimeout(() => (fading = false), 1000);
      usePlayer.setState({ queue: next, position: 0, duration: trackOf(next.current)?.duration ?? 0 });
      return;
    }
  }
  engine.preload(url);
}

/** Aplica una cola nueva; si la pista actual cambió (o `restart`), la carga en el motor. */
function apply(queue: QueueState, options: { autoplay: boolean; restart?: boolean; startAt?: number }) {
  const previous = usePlayer.getState().queue.current;
  usePlayer.setState({ queue });
  if (queue.current === previous && !options.restart) return;
  fading = false;
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
  usePlayer.setState({ position: options.startAt ?? 0, duration: trackOf(queue.current)?.duration ?? 0 });
  engine.load(url, options.startAt, gainOf(queue.current));
  if (options.autoplay) void engine.play().catch(() => fail());
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
function fail() {
  const queue = q();
  if (queue.current === null) return;
  library.markUnplayable(queue.current);
  failuresInRow += 1;
  const message = `No se pudo reproducir «${trackOf(queue.current)?.title ?? "la pista"}».`;
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
    if (engine.paused) player.play();
    else player.pause();
  },
  play() {
    if (q().current !== null && engine.paused) void engine.play(pauseFade()).catch(() => fail());
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

function syncSession(state: PlayerState, previous: PlayerState) {
  const track = trackOf(state.queue.current);
  if (state.queue.current !== previous.queue.current || !lastSessionTitle || lastSessionTitle !== track?.title) {
    lastSessionTitle = track?.title;
    audioSession.setTrack(track ? { title: track.title, artist: track.artist, album: track.album, artworkUrl: track.coverUrl } : null);
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
  setAudio(sanitizeAudioSettings(await storage.get<AudioSettings>("audio")));
  saved = await storage.get<SavedSession>("session");
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
    if (state.queue !== previous.queue || Date.now() - lastSave > 5000) save();
  });
  window.addEventListener("pagehide", () => {
    if (!saved) save();
  });
}
