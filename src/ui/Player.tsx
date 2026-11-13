import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  ChevronDown,
  Ellipsis,
  ListMusic,
  ListStart,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { coverSeed } from "../core/coverArt";
import { formatTime, isHiRes, qualityLabel } from "../core/format";
import { lineAt } from "../core/lyrics";
import type { Lyrics } from "../core/lyrics";
import { currentIndex, previousInQueue } from "../core/queue";
import type { QueueEntry } from "../core/queue";
import type { Track } from "../core/track";
import { usePaletteOf } from "../state/covers";
import { useLibrary } from "../state/library";
import { player, usePlayer } from "../state/player";
import { Cover, Dialog, icon, IconButton, iconSmall } from "./parts";
import { closePanel, openPanel } from "./router";
import { ActionSheet } from "./ActionSheet";
import { backdropPreview } from "./Backdrop";
import { SwipeRow, useCoverSwipe, useDragDismiss } from "./gestures";
import { useMedia } from "./useMedia";
import { Marquee } from "./Marquee";
import { MenuButton } from "./PlayerMenu";
import { queueAction } from "./toast";
import { Range } from "./Range";
import { motionReduced } from "./motion";
import { VirtualList } from "./VirtualList";

export function useCurrentTrack(): Track | undefined {
  const current = usePlayer((state) => state.queue.current);
  return useLibrary((state) => state.tracks.find((track) => track.id === current?.id));
}

function VolumeControl() {
  const volume = usePlayer((state) => state.audio.volume);
  const muted = usePlayer((state) => state.audio.muted);
  return (
    <div className="volume">
      <IconButton label={muted ? "Activar sonido" : "Silenciar"} onClick={player.toggleMute}>
        {muted || volume === 0 ? <VolumeX {...icon} /> : <Volume2 {...icon} />}
      </IconButton>
      <Range format={(value) => `${Math.round(value * 100)} %`} label="Volumen" max={1} min={0} onChange={player.setVolume} step={0.01} value={muted ? 0 : volume} />
    </div>
  );
}

export const repeatLabel = { off: "Repetición desactivada", queue: "Repitiendo la cola", track: "Repitiendo la canción" };

function Transport({ large = false }: { large?: boolean }) {
  const isPlaying = usePlayer((state) => state.isPlaying);
  const repeat = usePlayer((state) => state.queue.repeat);
  const shuffle = usePlayer((state) => state.queue.shuffle);
  const empty = usePlayer((state) => state.queue.current === null);
  const size = large ? { ...icon, size: 28 } : icon;
  return (
    <div className={`transport${large ? " transport-large" : ""}`}>
      <IconButton
        aria-pressed={shuffle}
        className={shuffle ? "is-on" : ""}
        label={shuffle ? "Aleatorio activado" : "Aleatorio desactivado"}
        onClick={player.toggleShuffle}
      >
        <Shuffle {...iconSmall} />
      </IconButton>
      <IconButton disabled={empty} label="Canción anterior" onClick={player.previous}>
        <SkipBack {...size} fill="currentColor" />
      </IconButton>
      <IconButton className="play-button" disabled={empty} label={isPlaying ? "Pausar" : "Reproducir"} onClick={player.toggle}>
        {isPlaying ? <Pause {...size} fill="currentColor" /> : <Play {...size} fill="currentColor" />}
      </IconButton>
      <IconButton disabled={empty} label="Siguiente canción" onClick={player.next}>
        <SkipForward {...size} fill="currentColor" />
      </IconButton>
      <IconButton
        aria-pressed={repeat !== "off"}
        className={repeat !== "off" ? "is-on" : ""}
        label={repeatLabel[repeat]}
        onClick={player.cycleRepeat}
      >
        {repeat === "track" ? <Repeat1 {...iconSmall} /> : <Repeat {...iconSmall} />}
      </IconButton>
    </div>
  );
}

function Seek() {
  const position = usePlayer((state) => state.position);
  const duration = usePlayer((state) => state.duration);
  const empty = usePlayer((state) => state.queue.current === null);
  return (
    <div className="seek">
      <Range
        disabled={empty || duration === 0}
        format={formatTime}
        label="Posición de reproducción"
        max={duration || 0}
        min={0}
        onChange={player.seek}
        step={1}
        value={Math.min(position, duration || 0)}
        valueText={`${formatTime(position)} de ${formatTime(duration)}`}
      />
      <span className="time">{formatTime(empty ? undefined : position)}</span>
      <span className="time">{duration > 0 ? `-${formatTime(duration - position)}` : "--:--"}</span>
    </div>
  );
}

/** Barra persistente: mini reproductor en móvil, barra completa en escritorio. */
export function PlayerBar({ queueOpen }: { queueOpen: boolean }) {
  const track = useCurrentTrack();
  const isPlaying = usePlayer((state) => state.isPlaying);
  const progress = usePlayer((state) => (state.duration > 0 ? (state.position / state.duration) * 100 : 0));
  if (!track) return null;
  return (
    <footer aria-label="Reproductor" className="player-bar">
      <span aria-hidden="true" className="bar-progress" style={{ "--progress": `${progress}%` } as CSSProperties} />
      <button aria-label={`Abrir reproductor: ${track.title}`} className="bar-track" onClick={() => openPanel("player")} type="button">
        <Cover className="bar-cover" seed={coverSeed(track.title, track.artist)} hash={track.coverHash} />
        <span className="bar-copy">
          <span className="title">
            <Marquee>{track.title}</Marquee>
          </span>
          <span className="subtitle">
            <Marquee>{track.artist}</Marquee>
          </span>
        </span>
      </button>
      <div className="bar-center">
        <Transport />
        <Seek />
      </div>
      <div className="bar-mini">
        <IconButton label={isPlaying ? "Pausar" : "Reproducir"} onClick={player.toggle}>
          {isPlaying ? <Pause {...icon} fill="currentColor" /> : <Play {...icon} fill="currentColor" />}
        </IconButton>
        <IconButton label="Siguiente canción" onClick={player.next}>
          <SkipForward {...icon} fill="currentColor" />
        </IconButton>
        <MenuButton />
      </div>
      <div className="bar-end">
        <span className="quality">{qualityLabel(track)}</span>
        <VolumeControl />
        <MenuButton />
        <IconButton
          aria-expanded={queueOpen}
          className={queueOpen ? "is-on" : ""}
          label="Cola de reproducción"
          onClick={() => (queueOpen ? closePanel() : openPanel("queue"))}
        >
          <ListMusic {...icon} />
        </IconButton>
      </div>
    </footer>
  );
}

/** Reproductor expandido a pantalla completa: portada protagonista y controles en la mitad inferior. */
/** Letra: sincronizada (sigue la posición real del audio) o texto sin marcas de tiempo. */
function LyricsDialog({ lyrics, title, onClose }: { lyrics: Lyrics; title: string; onClose: () => void }) {
  const position = usePlayer((state) => state.position);
  const current = lyrics.synced ? lineAt(lyrics.synced, position) : -1;
  const active = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const reduce = motionReduced();
    active.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [current]);
  return (
    <Dialog onClose={onClose} title={`Letra de ${title}`}>
      <div className="lyrics">
        {lyrics.synced
          ? lyrics.synced.map((line, index) => (
              <p aria-current={index === current ? "true" : undefined} className="lyric-line" key={`${line.time}-${index}`} ref={index === current ? active : undefined}>
                {line.text || "…"}
              </p>
            ))
          : <p className="lyrics-plain">{lyrics.plain}</p>}
      </div>
    </Dialog>
  );
}

/** Las entradas vecinas de la actual tal como las tomarían «siguiente» y «anterior» (sin la vuelta barajada, que aún no existe). */
function useNeighbors() {
  const queue = usePlayer((state) => state.queue);
  const tracks = useLibrary((state) => state.tracks);
  const at = currentIndex(queue);
  const next = at < 0 ? undefined : (queue.order[at + 1] ?? (queue.repeat === "queue" && !queue.shuffle ? queue.order[0] : undefined));
  const previous = previousInQueue(queue).current ?? undefined;
  const find = (entry?: QueueEntry) => (entry && entry.key !== queue.current?.key ? tracks.find((track) => track.id === entry.id) : undefined);
  return { key: queue.current?.key, nextKey: next?.key, previousKey: previous?.key, next: find(next), previous: find(previous) };
}

export function NowPlaying({ backdrop, closing, queueOpen }: { backdrop: ReactNode; closing?: true; queueOpen: boolean }) {
  const track = useCurrentTrack();
  const neighbors = useNeighbors();
  const nextPalette = usePaletteOf(neighbors.next?.coverHash);
  const previousPalette = usePaletteOf(neighbors.previous?.coverHash);
  const carousel = useRef<HTMLDivElement>(null);
  const swipe = useCoverSwipe(carousel, {
    onNext: neighbors.next && player.next,
    onPrevious: neighbors.previous && neighbors.previousKey ? () => player.playEntry(neighbors.previousKey!) : undefined,
    onProgress: (progress) => {
      backdropPreview.palette = progress < 0 ? nextPalette : progress > 0 ? previousPalette : null;
      backdropPreview.amount = Math.abs(progress);
    },
    resetKey: neighbors.key,
  });
  const [lyrics, setLyrics] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const drag = useDragDismiss(sheet, closePanel, { touchOnly: true }); // arrastrar hacia abajo cierra; el botón ⌄ y Escape siguen
  const wide = useMedia("(min-width: 1000px)");
  const isPlaying = usePlayer((state) => state.isPlaying);
  if (!track) return null;
  return (
    <section
      aria-label="Reproduciendo ahora"
      className="now-playing"
      data-closing={closing}
      // La cola no es modal: en ancho es un cajón al lado y el reproductor sigue usable. En estrecho lo tapa entero: inert para
      // que Tab y el lector de pantalla no entren en lo oculto. `wide` se recalcula al rotar o redimensionar con la cola abierta.
      inert={closing || (queueOpen && !wide)}
      {...drag}
      onPointerDown={(event) => !(event.target as HTMLElement).closest("dialog") && drag.onPointerDown(event)} // la letra tiene su propio scroll
      ref={sheet}
    >
      {backdrop}
      <span aria-hidden="true" className="now-grabber" />
      <header className="now-header">
        <IconButton label="Cerrar reproductor" onClick={closePanel}>
          <ChevronDown {...icon} />
        </IconButton>
        <div className="now-actions">
          {track.lyrics && (
            <IconButton label="Letra" onClick={() => setLyrics(true)}>
              <MicVocal {...icon} />
            </IconButton>
          )}
          <IconButton
            aria-expanded={queueOpen}
            className={queueOpen ? "is-on" : ""}
            label="Cola de reproducción"
            onClick={() => (queueOpen ? closePanel() : openPanel("queue"))}
          >
            <ListMusic {...icon} />
          </IconButton>
          <MenuButton />
        </div>
      </header>
      {/* Carrusel (solo dedo; los botones de transporte son la alternativa). Cada portada lleva la clave de su pista: la vecina que llega
          al centro es el mismo nodo, sin parpadeo de imagen. Las vecinas esperan fuera del recorte hasta que el gesto las trae. */}
      <div className="now-art" {...swipe}>
        <div className="now-track" ref={carousel}>
          {/* Claves de entrada de la cola (una pista puede repetirse); con dos entradas y «repetir cola», la misma es anterior y siguiente. */}
          {([
            ["prev", neighbors.previous, neighbors.previousKey === neighbors.nextKey ? `prev:${neighbors.previousKey}` : neighbors.previousKey],
            ["current", track, neighbors.key],
            ["next", neighbors.next, neighbors.nextKey],
          ] as const).map(([side, item, key]) => {
            if (!item) return null;
            const current = side === "current";
            return (
              <span aria-hidden={current ? undefined : true} className="now-slot" data-side={current ? undefined : side} key={key}>
                <Cover
                  className="now-cover"
                  hash={item.coverHash}
                  label={current ? `«${item.title}», de ${item.artist}` : undefined}
                  playing={current && isPlaying}
                  seed={coverSeed(item.title, item.artist)}
                  sharp={current}
                  size="large"
                />
              </span>
            );
          })}
        </div>
      </div>
      <div className="now-controls">
        <div className="now-copy">
          <h2 className="now-title">
            <Marquee>{track.title}</Marquee>
          </h2>
          <p className="now-artist">
            <Marquee>{`${track.artist} · ${track.album}`}</Marquee>
          </p>
          <span className="quality">
            {qualityLabel(track)}
            {isHiRes(track) && <span className="hires"> Hi-Res</span>}
          </span>
        </div>
        <Seek />
        <Transport large />
      </div>
      {lyrics && track.lyrics && <LyricsDialog lyrics={track.lyrics} onClose={() => setLyrics(false)} title={track.title} />}
    </section>
  );
}

type RowState = "played" | "current" | "next" | "later";

function QueueRow({ entryKey, track, index, first, last, state, repeated }: { entryKey: string; track: Track; index: number; first: boolean; last: boolean; state: RowState; repeated: boolean }) {
  const [sheet, setSheet] = useState(false);
  const id = track.id;
  const isCurrent = state === "current";
  const isNext = state === "next";
  const status = isCurrent
    ? repeated
      ? { text: "Sonando · se repite", icon: <Repeat1 {...iconSmall} size={14} /> }
      : { text: "Sonando", icon: <AudioLines {...iconSmall} size={14} /> }
    : isNext
      ? { text: "A continuación", icon: <ListStart {...iconSmall} size={14} /> }
      : null;
  const playNext = { label: "Reproducir a continuación", icon: <ListStart {...iconSmall} />, run: () => queueAction("Sonará a continuación", () => player.playNext(id, entryKey)) };
  const remove = { label: "Quitar de la cola", icon: <Trash2 {...iconSmall} />, run: () => queueAction("Quitada de la cola", () => player.remove(entryKey)) };
  return (
    <>
    <SwipeRow
      className="queue-row"
      current={isCurrent}
      left={isCurrent ? undefined : { ...remove, label: "Quitar" }}
      onMenu={() => setSheet(true)}
      right={isCurrent || isNext ? undefined : { ...playNext, label: "Siguiente" }}
    >
      <button className="row-main" data-state={state} onClick={() => player.playEntry(entryKey)} type="button">
        <span className="row-coverbox">
          <Cover className="row-cover" hash={track.coverHash} seed={coverSeed(track.title, track.artist)} />
        </span>
        <span className="row-copy">
          <span className="title">
            <Marquee>{track.title}</Marquee>
          </span>
          <span className="subtitle row-sub">
            {status && <span className="row-status">{status.icon}</span>}
            <Marquee>{status ? `${status.text} · ${track.artist}` : `${track.artist} · ${formatTime(track.duration)}`}</Marquee>
          </span>
        </span>
      </button>
      <span className="row-tools">
        <IconButton disabled={first} label={`Subir ${track.title}`} onClick={() => player.move(index, index - 1)}>
          <ArrowUp {...iconSmall} />
        </IconButton>
        <IconButton disabled={last} label={`Bajar ${track.title}`} onClick={() => player.move(index, index + 1)}>
          <ArrowDown {...iconSmall} />
        </IconButton>
        <IconButton label={`Quitar ${track.title} de la cola`} onClick={() => player.remove(entryKey)}>
          <X {...iconSmall} />
        </IconButton>
      </span>
      <IconButton className="row-more" label={`Acciones de ${track.title}`} onClick={() => setSheet(true)}>
        <Ellipsis {...iconSmall} />
      </IconButton>
    </SwipeRow>
    {/* Fuera de la fila: los toques dentro de la hoja no deben contar como gestos de la fila. */}
    {sheet && (
      <ActionSheet
        actions={[
          { label: "Reproducir ahora", icon: <Play {...iconSmall} fill="currentColor" />, run: () => player.playEntry(entryKey) },
          ...(isCurrent || isNext ? [] : [playNext]),
          ...(first ? [] : [{ label: "Subir", icon: <ArrowUp {...iconSmall} />, run: () => player.move(index, index - 1) }]),
          ...(last ? [] : [{ label: "Bajar", icon: <ArrowDown {...iconSmall} />, run: () => player.move(index, index + 1) }]),
          ...(isCurrent ? [] : [remove]),
        ]}
        onClose={() => setSheet(false)}
        track={track}
      />
    )}
    </>
  );
}

export function QueuePanel({ closing }: { closing?: true }) {
  const order = usePlayer((state) => state.queue.order);
  const current = usePlayer((state) => state.queue.current);
  const tracks = useLibrary((state) => state.tracks);
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const repeat = usePlayer((state) => state.queue.repeat);
  const currentAt = current === null ? -1 : order.findIndex((item) => item.key === current.key);
  const panel = useRef<HTMLElement>(null);
  const drag = useDragDismiss(panel, closePanel, { touchOnly: true }); // móvil: arrastrar la cabecera hacia abajo la cierra
  // Panel no modal: un clic en una zona vacía de fuera lo cierra; los controles de fuera funcionan sin cerrarlo.
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!panel.current?.contains(target) && !target.closest("button, input, select, textarea, a, label, dialog, .range")) closePanel();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <aside aria-label="Cola de reproducción" className="queue-panel" data-closing={closing} inert={closing} ref={panel}>
      <span aria-hidden="true" className="now-grabber" />
      <header className="queue-header" {...drag}>
        <h2>Cola</h2>
        <span className="subtitle">
          {order.length} {order.length === 1 ? "canción" : "canciones"}
        </span>
        <IconButton disabled={order.length === 0} label="Vaciar cola" onClick={player.clear}>
          <Trash2 {...iconSmall} />
        </IconButton>
        <IconButton label="Cerrar cola" onClick={closePanel}>
          <X {...icon} />
        </IconButton>
      </header>
      {order.length === 0 ? (
        <p className="queue-empty">La cola está vacía. Toca una canción para empezar.</p>
      ) : (
        <div className="queue-list">
          <VirtualList className="queue-rows" getKey={(item) => item.key} items={order} label="Canciones en cola" ordered rowHeight={64}>
            {(item, index) => {
              const track = byId.get(item.id);
              if (!track) return null;
              const state = index === currentAt ? "current" : index === currentAt + 1 ? "next" : index < currentAt ? "played" : "later";
              return <QueueRow entryKey={item.key} first={index === 0} last={index === order.length - 1} index={index} repeated={repeat === "track"} state={state} track={track} />;
            }}
          </VirtualList>
        </div>
      )}
    </aside>
  );
}
