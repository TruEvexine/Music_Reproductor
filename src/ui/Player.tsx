import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ListMusic,
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
import { formatTime, qualityLabel } from "../core/format";
import type { Track } from "../core/track";
import { useLibrary } from "../state/library";
import { player, usePlayer } from "../state/player";
import { Cover, icon, IconButton, iconSmall } from "./parts";
import { closePanel, openPanel } from "./router";
import { MenuButton } from "./PlayerMenu";

export function useCurrentTrack(): Track | undefined {
  const current = usePlayer((state) => state.queue.current);
  return useLibrary((state) => state.tracks.find((track) => track.id === current));
}

function VolumeControl() {
  const volume = usePlayer((state) => state.audio.volume);
  const muted = usePlayer((state) => state.audio.muted);
  return (
    <div className="volume">
      <IconButton label={muted ? "Activar sonido" : "Silenciar"} onClick={player.toggleMute}>
        {muted || volume === 0 ? <VolumeX {...icon} /> : <Volume2 {...icon} />}
      </IconButton>
      <input
        aria-label="Volumen"
        aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} %`}
        max={1}
        min={0}
        onChange={(event) => player.setVolume(Number(event.currentTarget.value))}
        step={0.01}
        style={{ "--progress": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
        type="range"
        value={muted ? 0 : volume}
      />
    </div>
  );
}

const repeatLabel = { off: "Repetición desactivada", queue: "Repitiendo la cola", track: "Repitiendo la canción" };

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
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  return (
    <div className="seek">
      <input
        aria-label="Posición de reproducción"
        aria-valuetext={`${formatTime(position)} de ${formatTime(duration)}`}
        disabled={empty || duration === 0}
        max={duration || 0}
        min={0}
        onChange={(event) => player.seek(Number(event.currentTarget.value))}
        step={1}
        style={{ "--progress": `${progress}%` } as CSSProperties}
        type="range"
        value={Math.min(position, duration || 0)}
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
        <Cover className="bar-cover" seed={track.album} src={track.coverUrl} />
        <span className="bar-copy">
          <span className="title">{track.title}</span>
          <span className="subtitle">{track.artist}</span>
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
export function NowPlaying() {
  const track = useCurrentTrack();
  if (!track) return null;
  return (
    <section aria-label="Reproduciendo ahora" className="now-playing">
      <header className="now-header">
        <IconButton label="Cerrar reproductor" onClick={closePanel}>
          <ChevronDown {...icon} />
        </IconButton>
        <div className="now-actions">
          <IconButton label="Cola de reproducción" onClick={() => openPanel("queue")}>
            <ListMusic {...icon} />
          </IconButton>
          <MenuButton />
        </div>
      </header>
      <div className="now-art">
        <Cover className="now-cover" seed={track.album} src={track.coverUrl} />
      </div>
      <div className="now-controls">
        <div className="now-copy">
          <h2 className="now-title">{track.title}</h2>
          <p className="now-artist">
            {track.artist} · {track.album}
          </p>
          <span className="quality">{qualityLabel(track)}</span>
        </div>
        <Seek />
        <Transport large />
      </div>
    </section>
  );
}

export function QueuePanel() {
  const order = usePlayer((state) => state.queue.order);
  const current = usePlayer((state) => state.queue.current);
  const tracks = useLibrary((state) => state.tracks);
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const currentAt = current === null ? -1 : order.indexOf(current);
  return (
    <aside aria-label="Cola de reproducción" className="queue-panel">
      <header className="queue-header">
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
        <ol className="queue-list">
          {order.map((id, index) => {
            const track = byId.get(id);
            if (!track) return null;
            return (
              <li aria-current={id === current ? "true" : undefined} className="queue-row" key={id}>
                <button className="row-main" onClick={() => player.playNow(id)} type="button">
                  <Cover className="row-cover" seed={track.album} src={track.coverUrl} />
                  <span className="row-copy">
                    <span className="title">{track.title}</span>
                    <span className="subtitle">
                      {id === current ? "Sonando" : index === currentAt + 1 ? "A continuación" : track.artist}
                    </span>
                  </span>
                </button>
                <IconButton disabled={index === 0} label={`Subir ${track.title}`} onClick={() => player.move(index, index - 1)}>
                  <ArrowUp {...iconSmall} />
                </IconButton>
                <IconButton
                  disabled={index === order.length - 1}
                  label={`Bajar ${track.title}`}
                  onClick={() => player.move(index, index + 1)}
                >
                  <ArrowDown {...iconSmall} />
                </IconButton>
                <IconButton label={`Quitar ${track.title} de la cola`} onClick={() => player.remove(id)}>
                  <X {...iconSmall} />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
