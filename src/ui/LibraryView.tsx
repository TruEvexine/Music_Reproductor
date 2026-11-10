import { useMemo, useRef, useState } from "react";
import { FilePlus, ListPlus, Search, TriangleAlert } from "lucide-react";
import { formatTime, matchesSearch, qualityLabel } from "../core/format";
import type { Track } from "../core/track";
import { library, useLibrary } from "../state/library";
import { player, usePlayer } from "../state/player";
import { Cover, icon, IconButton, iconSmall } from "./parts";

const ACCEPT = ".mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,audio/*";

export function TrackRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const isCurrent = usePlayer((state) => state.queue.current === track.id);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const queued = usePlayer((state) => state.queue.order.includes(track.id));
  return (
    <li aria-current={isCurrent ? "true" : undefined} className="track-row">
      <button aria-label={`Reproducir ${track.title}, de ${track.artist}`} className="row-main" onClick={onPlay} type="button">
        <Cover className="row-cover" seed={track.album} src={track.coverUrl} />
        <span className="row-copy">
          <span className="title">
            {track.unplayable && <TriangleAlert {...iconSmall} aria-label="No se pudo reproducir" className="warn" />}
            {track.title}
          </span>
          <span className="subtitle">
            {isCurrent ? (isPlaying ? "Sonando · " : "En pausa · ") : ""}
            {track.artist}
          </span>
        </span>
        <span className="row-album subtitle">{track.album}</span>
        <span className="row-quality quality">{track.metadataStatus === "loading" ? "" : qualityLabel(track)}</span>
        <span className="row-time time">{formatTime(track.duration)}</span>
      </button>
      {/* Ya en la cola: no hay nada que ofrecer; el hueco mantiene la alineación. */}
      {queued ? (
        <span aria-hidden="true" className="row-spacer" />
      ) : (
        <IconButton label={`Añadir ${track.title} a la cola`} onClick={() => player.enqueue(track.id)}>
          <ListPlus {...iconSmall} />
        </IconButton>
      )}
    </li>
  );
}

export function LibraryView() {
  const tracks = useLibrary((state) => state.tracks);
  const notice = useLibrary((state) => state.notice);
  const message = usePlayer((state) => state.message);
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => tracks.filter((track) => matchesSearch(track, search)), [tracks, search]);
  const ids = useMemo(() => visible.map((track) => track.id), [visible]);

  const picker = (
    <input
      accept={ACCEPT}
      aria-label="Elegir archivos de música"
      className="visually-hidden"
      multiple
      onChange={(event) => {
        library.addFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = "";
      }}
      ref={input}
      tabIndex={-1}
      type="file"
    />
  );

  if (tracks.length === 0) {
    return (
      <section className="view empty">
        {picker}
        <h1>Tu música, en tu dispositivo</h1>
        <p>
          Añade tus archivos y empieza a escuchar. Nada se sube a ningún servidor: la música se queda donde está.
        </p>
        <button className="button primary" onClick={() => input.current?.click()} type="button">
          <FilePlus {...icon} />
          Añadir música
        </button>
        <p className="hint">MP3, FLAC, WAV, M4A, OGG y Opus</p>
      </section>
    );
  }

  return (
    <section className="view">
      {picker}
      <header className="view-header">
        <div>
          <h1>Canciones</h1>
          <p className="subtitle">
            {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
          </p>
        </div>
        <button className="button" onClick={() => input.current?.click()} type="button">
          <FilePlus {...iconSmall} />
          Añadir música
        </button>
      </header>
      <label className="search">
        <Search {...iconSmall} />
        <input
          aria-label="Buscar en tu música"
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Buscar canciones, artistas o álbumes"
          type="search"
          value={search}
        />
      </label>
      {(notice || message) && (
        <div className="notices" role="status">
          {message && (
            <p className="notice">
              {message}
              <button className="link" onClick={player.dismissMessage} type="button">
                Entendido
              </button>
            </p>
          )}
          {notice && (
            <p className="notice">
              {notice}
              <button className="link" onClick={library.dismissNotice} type="button">
                Entendido
              </button>
            </p>
          )}
        </div>
      )}
      {visible.length > 0 ? (
        <ul aria-label="Canciones" className="track-list">
          {visible.map((track) => (
            <TrackRow key={track.id} onPlay={() => player.playContext(ids, track.id)} track={track} />
          ))}
        </ul>
      ) : (
        <p className="no-results">Nada coincide con «{search}». Prueba con otro título, artista o álbum.</p>
      )}
    </section>
  );
}
