import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./Icon";
import type { Playlist } from "../features/playlists/playlistService";
import { getPlaylistTrackIdentifier } from "../features/playlists/playlistService";
import type { Track } from "../features/library/model/Track";

export function PlaylistNameDialog({
  initialName = "",
  isSaving,
  onClose,
  onSubmit,
  title,
}: {
  initialName?: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  title: string;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Escribe un nombre para la playlist.");
      return;
    }

    setError(null);
    try {
      await onSubmit(normalizedName);
      onClose();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la playlist.",
      );
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="playlist-dialog-title"
        aria-modal="true"
        className="account-dialog playlist-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Cerrar"
          className="icon-button dialog-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <p className="eyebrow">BIBLIOTECA</p>
        <h2 id="playlist-dialog-title">{title}</h2>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>
            Nombre de la playlist
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setName(event.currentTarget.value)}
              required
              value={name}
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </section>
    </div>
  );
}

export function AddTracksDialog({
  isSaving,
  onAdd,
  onClose,
  playlist,
  tracks,
}: {
  isSaving: boolean;
  onAdd: (track: Track) => Promise<void>;
  onClose: () => void;
  playlist: Playlist;
  tracks: Track[];
}) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const query = search.trim().toLocaleLowerCase();
  const matchingTracks = tracks.filter((track) =>
    [track.title, track.artist, track.album].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  );

  async function addTrack(track: Track) {
    setError(null);
    try {
      await onAdd(track);
    } catch (addError: unknown) {
      setError(
        addError instanceof Error ? addError.message : "No se pudo agregar.",
      );
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="add-tracks-title"
        aria-modal="true"
        className="account-dialog add-tracks-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Cerrar"
          className="icon-button dialog-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <p className="eyebrow">PLAYLIST</p>
        <h2 id="add-tracks-title">Añadir canciones</h2>
        <p className="dialog-description">{playlist.name}</p>
        <label className="search-box add-track-search">
          <svg
            aria-hidden="true"
            fill="none"
            height="17"
            viewBox="0 0 24 24"
            width="17"
          >
            <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" />
            <path d="m16 16 5 5" stroke="currentColor" />
          </svg>
          <input
            aria-label="Buscar canciones para añadir"
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Buscar en tu biblioteca"
            value={search}
          />
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="add-track-list">
          {matchingTracks.map((track) => {
            const identifier = getPlaylistTrackIdentifier(track);
            const alreadyAdded = playlist.trackIdentifiers.includes(identifier);
            const waiting = track.metadataStatus === "loading";

            return (
              <div className="add-track-row" key={track.id}>
                <span className="track-copy">
                  <span className="track-title">{track.title}</span>
                  <span className="track-artist">
                    {track.artist} · {track.album}
                  </span>
                </span>
                <button
                  aria-label={
                    alreadyAdded
                      ? `${track.title} ya está en la playlist`
                      : `Añadir ${track.title}`
                  }
                  className="icon-button add-track-button"
                  disabled={alreadyAdded || waiting || isSaving}
                  onClick={() => void addTrack(track)}
                  title={
                    alreadyAdded
                      ? "Ya está en la playlist"
                      : waiting
                        ? "Leyendo metadatos"
                        : "Añadir a la playlist"
                  }
                  type="button"
                >
                  <Icon name={alreadyAdded ? "clear" : "add"} size={17} />
                </button>
              </div>
            );
          })}
          {matchingTracks.length === 0 && (
            <p className="queue-empty">No hay canciones que coincidan.</p>
          )}
        </div>
      </section>
    </div>
  );
}
