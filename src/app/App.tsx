import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AuthDialog } from "./AuthDialog";
import { Icon } from "./Icon";
import { AddTracksDialog, PlaylistNameDialog } from "./PlaylistDialogs";
import { useAuthController } from "../features/auth/useAuthController";
import { usePlaybackController } from "../features/player/usePlaybackController";
import { useCoverPalette } from "../features/player/useCoverPalette";
import { getPlaylistTrackIdentifier } from "../features/playlists/playlistService";
import { usePlaylistController } from "../features/playlists/usePlaylistController";
import type { Playlist } from "../features/playlists/playlistService";
import type { Track } from "../features/library/model/Track";

function formatTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return "--:--";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatLabel(fileName: string): string {
  return fileName.split(".").pop()?.toUpperCase() ?? "AUDIO";
}

function formatBitrate(bitrate?: number): string | null {
  return bitrate ? `${Math.round(bitrate / 1000)} kbps` : null;
}

function Cover({
  src,
  title,
  className,
}: {
  src?: string;
  title: string;
  className: string;
}) {
  return (
    <span className={`cover-frame ${className}`}>
      {src ? (
        <img alt={`Portada de ${title}`} loading="lazy" src={src} />
      ) : (
        <span aria-hidden="true" className="cover-fallback">
          ♪
        </span>
      )}
    </span>
  );
}

type PlaylistDialogMode = "create" | "rename";

export default function App() {
  const player = usePlaybackController();
  const auth = useAuthController();
  const playlists = usePlaylistController(auth.session?.user.id);
  const [search, setSearch] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeView, setActiveView] = useState<"library" | "playlists">(
    "library",
  );
  const [playlistDialogMode, setPlaylistDialogMode] =
    useState<PlaylistDialogMode | null>(null);
  const [addTracksOpen, setAddTracksOpen] = useState(false);
  const coverPalette = useCoverPalette(player.currentTrack?.coverUrl);
  const progress =
    player.duration > 0
      ? (player.currentPosition / player.duration) * 100
      : 0;

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return player.tracks;
    return player.tracks.filter((track) =>
      [
        track.title,
        track.artist,
        track.album,
        track.albumArtist,
        track.genre,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [player.tracks, search]);

  const queuedTracks = player.queue
    .map((id) => player.tracks.find((track) => track.id === id))
    .filter((track) => track !== undefined);

  const selectedPlaylist = playlists.selectedPlaylist;
  const playlistEntries =
    selectedPlaylist?.trackIdentifiers.map((identifier, index) => ({
      identifier,
      index,
      track: player.tracks.find(
        (track) => getPlaylistTrackIdentifier(track) === identifier,
      ),
    })) ?? [];
  const availablePlaylistTrackIds = playlistEntries.flatMap(({ track }) =>
    track ? [track.id] : [],
  );

  function openPlaylistDialog(mode: PlaylistDialogMode) {
    if (!auth.session) {
      setAccountOpen(true);
      return;
    }
    setPlaylistDialogMode(mode);
  }

  async function submitPlaylistName(name: string) {
    if (playlistDialogMode === "create") {
      await playlists.createPlaylist(name);
      return;
    }
    if (selectedPlaylist) {
      await playlists.renamePlaylist(selectedPlaylist.id, name);
    }
  }

  function playPlaylist(playlist: Playlist) {
    const trackIds = playlist.trackIdentifiers.flatMap((identifier) => {
      const track = player.tracks.find(
        (item) => getPlaylistTrackIdentifier(item) === identifier,
      );
      return track ? [track.id] : [];
    });
    player.playTrackList(trackIds);
  }

  async function addLibraryTrack(track: Track) {
    if (!selectedPlaylist) return;
    await playlists.addTrack(selectedPlaylist.id, track);
  }

  return (
    <div className="app-shell" style={coverPalette}>
      <aside aria-label="Navegación principal" className="sidebar">
        <a aria-label="Music Player, inicio" className="brand" href="#library">
          <span aria-hidden="true" className="brand-mark">
            M
          </span>
          <span className="brand-name">MUSIC PLAYER</span>
        </a>
        <nav className="sidebar-nav">
          <span className="nav-label">TU MÚSICA</span>
          <button
            aria-current={activeView === "library" ? "page" : undefined}
            className={`nav-link nav-button${
              activeView === "library" ? " nav-link-active" : ""
            }`}
            onClick={() => setActiveView("library")}
            type="button"
          >
            <Icon name="library" size={17} />
            Biblioteca
          </button>
          <button
            aria-current={activeView === "playlists" ? "page" : undefined}
            className={`nav-link nav-button${
              activeView === "playlists" ? " nav-link-active" : ""
            }`}
            onClick={() => setActiveView("playlists")}
            type="button"
          >
            <Icon name="queue" size={17} />
            Playlists
            <span className="nav-count">{playlists.playlists.length}</span>
          </button>
          <button
            aria-expanded={queueOpen}
            className="nav-link nav-button"
            onClick={() => setQueueOpen((open) => !open)}
            type="button"
          >
            <Icon name="queue" size={17} />
            Cola de reproducción
            <span className="nav-count">{player.queue.length}</span>
          </button>
        </nav>
        <div className="sidebar-note">
          Una biblioteca para escuchar sin distracciones.
        </div>
      </aside>

      <main className="main-content" id="library">
        {activeView === "library" ? (
          <>
            <header className="page-header">
          <div>
            <p className="eyebrow">BIBLIOTECA LOCAL</p>
            <h1>Tu colección</h1>
            <p className="page-subtitle">
              {player.tracks.length} pistas · MP3, WAV, FLAC y M4A
            </p>
          </div>
          <div className="header-actions">
            <span
              className={`backend-indicator${auth.isConfigured ? " backend-ready" : ""}`}
              title={
                auth.isConfigured
                  ? "Credenciales públicas de Supabase configuradas"
                  : "Configura las variables públicas de Supabase en .env"
              }
            >
              <span aria-hidden="true" className="status-dot" />
              {auth.isConfigured
                ? "Supabase configurado"
                : "Cuenta desconectada"}
            </span>
            <button
              aria-label={
                auth.session ? "Abrir cuenta" : "Iniciar sesión o crear cuenta"
              }
              className="icon-button account-button"
              onClick={() => setAccountOpen(true)}
              title={auth.session?.user.email ?? "Cuenta"}
              type="button"
            >
              <Icon name="user" size={18} />
            </button>
          </div>
            </header>

            <section className="library-toolbar">
          <label className="search-box">
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
              aria-label="Buscar en la biblioteca"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Buscar canciones, artistas o álbumes"
              type="search"
              value={search}
            />
          </label>
          <label className="import-button">
            <Icon name="add" size={17} />
            Agregar música
            <input
              accept=".mp3,.wav,.flac,.m4a,audio/mpeg,audio/wav,audio/flac,audio/mp4"
              aria-label="Agregar archivos de música"
              multiple
              onChange={player.addFiles}
              type="file"
            />
          </label>
              {auth.session && selectedPlaylist && (
                <button
                  className="secondary-button library-add-playlist"
                  onClick={() => setAddTracksOpen(true)}
                  type="button"
                >
                  <Icon name="add" size={16} />
                  Añadir a {selectedPlaylist.name}
                </button>
              )}
            </section>

            {player.error && (
              <p className="error-message app-error" role="alert">
                {player.error}
              </p>
            )}

            {filteredTracks.length > 0 ? (
              <section aria-label="Canciones" className="track-list">
            <div aria-hidden="true" className="track-list-heading">
              <span>CANCIÓN</span>
              <span>ÁLBUM</span>
              <span>FORMATO</span>
              <span className="heading-duration">DURACIÓN</span>
              <span className="action-heading">ACCIONES</span>
            </div>
            {filteredTracks.map((track) => {
              const isCurrent = track.id === player.currentTrack?.id;
              const bitrate = formatBitrate(track.bitrate);

              return (
                <article
                  className={`track-row${isCurrent ? " track-row-current" : ""}`}
                  key={track.id}
                >
                  <button
                    aria-label={`Reproducir ${track.title} de ${track.artist}`}
                    className="track-select"
                    onClick={() => player.playTrack(track.id)}
                    type="button"
                  >
                    <Cover
                      className="track-cover"
                      src={track.coverUrl}
                      title={track.title}
                    />
                    <span className="track-copy">
                      <span className="track-title">
                        {track.title}
                        {isCurrent && player.isPlaying && (
                          <span aria-label="Reproduciendo" className="playing-bars">
                            <i />
                            <i />
                            <i />
                          </span>
                        )}
                      </span>
                      <span className="track-artist">
                        {track.artist}
                        {track.year ? ` · ${track.year}` : ""}
                      </span>
                    </span>
                  </button>
                  <span className="track-album">
                    <span>{track.album}</span>
                    {track.albumArtist &&
                      track.albumArtist !== track.artist && (
                        <small>{track.albumArtist}</small>
                      )}
                    {track.metadataStatus === "error" && (
                      <small className="metadata-warning">
                        Metadatos no disponibles
                      </small>
                    )}
                  </span>
                  <span className="format-cell">
                    <span className="format-tag">
                      {formatLabel(track.fileName)}
                    </span>
                    {bitrate && <small>{bitrate}</small>}
                  </span>
                  <span className="track-duration">
                    {formatTime(track.duration)}
                  </span>
                  <button
                    aria-label={`Reproducir ${track.title}`}
                    className="row-play-button"
                    onClick={() => player.playTrack(track.id)}
                    type="button"
                  >
                    <Icon name="play" size={17} />
                  </button>
                  <button
                    aria-label={
                      player.queue.includes(track.id)
                        ? `${track.title} ya está en la cola`
                        : `Agregar ${track.title} a la cola`
                    }
                    className={`row-queue-button${
                      player.queue.includes(track.id)
                        ? " row-queue-button-added"
                        : ""
                    }`}
                    disabled={player.queue.includes(track.id)}
                    onClick={() => player.addToQueue(track.id)}
                    title={
                      player.queue.includes(track.id)
                        ? "Ya está en la cola"
                        : "Agregar a la cola"
                    }
                    type="button"
                  >
                    <Icon
                      name={player.queue.includes(track.id) ? "check" : "add"}
                      size={17}
                    />
                  </button>
                </article>
              );
            })}
              </section>
            ) : (
              <section className="empty-state">
            <div aria-hidden="true" className="empty-art">
              ♪
            </div>
            <h2>{search ? "No hay coincidencias" : "Tu música empieza aquí"}</h2>
            <p>
              {search
                ? "Prueba con otro título, artista o álbum."
                : "Las canciones demo incluidas aparecen aquí. También puedes importar MP3, WAV, FLAC o M4A desde tu dispositivo."}
            </p>
              </section>
            )}
          </>
        ) : (
          <section aria-label="Tus playlists" className="playlists-page">
            <header className="page-header playlist-page-header">
              <div>
                <p className="eyebrow">TU MÚSICA</p>
                <h1>Playlists</h1>
                <p className="page-subtitle">
                  Tus listas, disponibles al iniciar sesión.
                </p>
              </div>
              <button
                className="import-button"
                onClick={() => openPlaylistDialog("create")}
                type="button"
              >
                <Icon name="add" size={17} />
                Nueva playlist
              </button>
            </header>

            {playlists.error && (
              <p className="error-message app-error" role="alert">
                {playlists.error}
              </p>
            )}
            {playlists.notice && (
              <p className="playlist-notice" role="status">
                {playlists.notice}
              </p>
            )}

            {!auth.session ? (
              <section className="empty-state playlist-empty">
                <div aria-hidden="true" className="empty-art">
                  <Icon name="user" size={27} />
                </div>
                <h2>Inicia sesión para guardar playlists</h2>
                <p>
                  Tus playlists privadas se sincronizan con Supabase. La
                  biblioteca local seguirá disponible sin iniciar sesión.
                </p>
                <button
                  className="primary-button playlist-login-button"
                  onClick={() => setAccountOpen(true)}
                  type="button"
                >
                  Conectar cuenta
                </button>
              </section>
            ) : playlists.isLoading ? (
              <p className="playlist-loading" role="status">
                Cargando tus playlists…
              </p>
            ) : (
              <div className="playlist-layout">
                <aside aria-label="Lista de playlists" className="playlist-list">
                  <div className="playlist-list-heading">
                    <span>TUS LISTAS</span>
                    <span>{playlists.playlists.length}</span>
                  </div>
                  {playlists.playlists.map((playlist) => (
                    <button
                      aria-current={
                        playlist.id === playlists.selectedPlaylistId
                          ? "true"
                          : undefined
                      }
                      className={`playlist-list-item${
                        playlist.id === playlists.selectedPlaylistId
                          ? " playlist-list-item-active"
                          : ""
                      }`}
                      key={playlist.id}
                      onClick={() => playlists.selectPlaylist(playlist.id)}
                      type="button"
                    >
                      <span className="playlist-list-icon">
                        <Icon name="queue" size={17} />
                      </span>
                      <span className="playlist-list-copy">
                        <strong>{playlist.name}</strong>
                        <small>
                          {playlist.trackIdentifiers.length} pistas
                        </small>
                      </span>
                    </button>
                  ))}
                  {playlists.playlists.length === 0 && (
                    <p className="playlist-list-empty">
                      Crea tu primera playlist para empezar.
                    </p>
                  )}
                </aside>

                <div className="playlist-detail">
                  {selectedPlaylist ? (
                    <>
                      <header className="playlist-detail-header">
                        <div className="playlist-art">
                          <Icon name="queue" size={32} />
                        </div>
                        <div className="playlist-detail-title">
                          <p className="eyebrow">PLAYLIST PRIVADA</p>
                          <h2>{selectedPlaylist.name}</h2>
                          <p>
                            {selectedPlaylist.trackIdentifiers.length} pistas
                            {playlistEntries.some(({ track }) => !track) &&
                              ` · ${playlistEntries.filter(({ track }) => !track).length} no disponibles en esta biblioteca`}
                          </p>
                        </div>
                        <div className="playlist-detail-actions">
                          <button
                            aria-label={`Reproducir ${selectedPlaylist.name}`}
                            className="icon-button control-primary playlist-play"
                            disabled={availablePlaylistTrackIds.length === 0}
                            onClick={() => playPlaylist(selectedPlaylist)}
                            title="Reproducir playlist"
                            type="button"
                          >
                            <Icon name="play" size={19} />
                          </button>
                          <button
                            aria-label="Añadir canciones"
                            className="icon-button"
                            disabled={player.tracks.length === 0}
                            onClick={() => setAddTracksOpen(true)}
                            title="Añadir canciones"
                            type="button"
                          >
                            <Icon name="add" size={18} />
                          </button>
                          <button
                            aria-label="Renombrar playlist"
                            className="icon-button"
                            disabled={playlists.isSaving}
                            onClick={() => openPlaylistDialog("rename")}
                            title="Renombrar playlist"
                            type="button"
                          >
                            <span aria-hidden="true">✎</span>
                          </button>
                          <button
                            aria-label="Eliminar playlist"
                            className="icon-button playlist-delete"
                            disabled={playlists.isSaving}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Eliminar la playlist "${selectedPlaylist.name}"?`,
                                )
                              ) {
                                void playlists
                                  .deletePlaylist(selectedPlaylist.id)
                                  .catch(() => undefined);
                              }
                            }}
                            title="Eliminar playlist"
                            type="button"
                          >
                            <Icon name="clear" size={17} />
                          </button>
                        </div>
                      </header>

                      <div className="playlist-track-list">
                        {playlistEntries.map(({ identifier, index, track }) => (
                          <article
                            className="playlist-track-row"
                            key={`${selectedPlaylist.id}:${identifier}`}
                          >
                            {track ? (
                              <button
                                className="queue-track"
                                onClick={() => player.playTrack(track.id)}
                                type="button"
                              >
                                <Cover
                                  className="queue-cover"
                                  src={track.coverUrl}
                                  title={track.title}
                                />
                                <span className="track-copy">
                                  <span className="track-title">
                                    {track.title}
                                  </span>
                                  <span className="track-artist">
                                    {track.artist} · {track.album}
                                  </span>
                                </span>
                              </button>
                            ) : (
                              <span className="missing-playlist-track">
                                <span className="missing-track-icon">♪</span>
                                <span>
                                  <strong>Canción no disponible</strong>
                                  <small>
                                    No se encontró en la biblioteca local
                                  </small>
                                </span>
                              </span>
                            )}
                            <span className="track-duration">
                              {formatTime(track?.duration)}
                            </span>
                            <div className="queue-actions">
                              <button
                                aria-label="Mover canción arriba"
                                className="icon-button small-icon-button"
                                disabled={index === 0 || playlists.isSaving}
                                onClick={() =>
                                  void playlists
                                    .moveTrack(
                                      selectedPlaylist.id,
                                      identifier,
                                      -1,
                                    )
                                    .catch(() => undefined)
                                }
                                type="button"
                              >
                                ↑
                              </button>
                              <button
                                aria-label="Mover canción abajo"
                                className="icon-button small-icon-button"
                                disabled={
                                  index ===
                                    selectedPlaylist.trackIdentifiers.length -
                                      1 || playlists.isSaving
                                }
                                onClick={() =>
                                  void playlists
                                    .moveTrack(
                                      selectedPlaylist.id,
                                      identifier,
                                      1,
                                    )
                                    .catch(() => undefined)
                                }
                                type="button"
                              >
                                ↓
                              </button>
                              <button
                                aria-label="Quitar canción de la playlist"
                                className="icon-button small-icon-button queue-remove"
                                disabled={playlists.isSaving}
                                onClick={() =>
                                  void playlists
                                    .removeTrack(
                                      selectedPlaylist.id,
                                      identifier,
                                    )
                                    .catch(() => undefined)
                                }
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                          </article>
                        ))}
                        {selectedPlaylist.trackIdentifiers.length === 0 && (
                          <div className="playlist-empty-tracks">
                            <p>Esta playlist aún no tiene canciones.</p>
                            <button
                              className="secondary-button"
                              onClick={() => setAddTracksOpen(true)}
                              type="button"
                            >
                              <Icon name="add" size={16} />
                              Añadir desde biblioteca
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="playlist-empty-tracks playlist-pick-empty">
                      <p>Selecciona una playlist o crea una nueva.</p>
                      <button
                        className="secondary-button"
                        onClick={() => openPlaylistDialog("create")}
                        type="button"
                      >
                        <Icon name="add" size={16} />
                        Crear playlist
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {queueOpen && (
        <>
          <button
            aria-label="Cerrar cola"
            className="drawer-scrim"
            onClick={() => setQueueOpen(false)}
            type="button"
          />
          <aside aria-label="Cola de reproducción" className="queue-drawer">
            <header className="drawer-header">
              <div className="drawer-title">
                <p className="eyebrow">REPRODUCCIÓN</p>
                <h2>Cola</h2>
              </div>
              <div className="drawer-tools">
                <button
                  aria-label="Vaciar cola"
                  className="icon-button"
                  disabled={queuedTracks.length === 0}
                  onClick={player.clearQueue}
                  title="Vaciar cola"
                  type="button"
                >
                  <Icon name="clear" size={18} />
                </button>
                <button
                  aria-label="Cerrar cola"
                  className="icon-button"
                  onClick={() => setQueueOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>
            <p className="queue-summary">
              {queuedTracks.length}{" "}
              {queuedTracks.length === 1 ? "pista en fila" : "pistas en fila"}
            </p>
            <div className="queue-list">
              {queuedTracks.map((track, index) => {
                const isCurrent = track.id === player.currentTrack?.id;
                const nextTrack = index === player.currentQueueIndex + 1;
                const isLast = index === queuedTracks.length - 1;

                return (
                  <article
                    className={`queue-row${isCurrent ? " queue-row-current" : ""}`}
                    key={track.id}
                  >
                    <button
                      aria-label={`Reproducir ${track.title}`}
                      className="queue-track"
                      onClick={() => player.playTrack(track.id)}
                      type="button"
                    >
                      <Cover
                        className="queue-cover"
                        src={track.coverUrl}
                        title={track.title}
                      />
                      <span className="track-copy">
                        <span className="track-title">{track.title}</span>
                        <span className="track-artist">
                          {isCurrent
                            ? player.isPlaying
                              ? "Sonando ahora"
                              : "Seleccionada"
                            : nextTrack
                              ? "A continuación"
                              : isLast
                                ? "Última en fila"
                                : track.artist}
                        </span>
                      </span>
                    </button>
                    <div className="queue-actions">
                      <button
                        aria-label={`Mover ${track.title} hacia arriba`}
                        className="icon-button small-icon-button"
                        disabled={index === 0}
                        onClick={() => player.moveQueueTrack(track.id, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Mover ${track.title} hacia abajo`}
                        className="icon-button small-icon-button"
                        disabled={isLast}
                        onClick={() => player.moveQueueTrack(track.id, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        aria-label={`Quitar ${track.title} de la cola`}
                        className="icon-button small-icon-button queue-remove"
                        onClick={() => player.removeFromQueue(track.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  </article>
                );
              })}
              {queuedTracks.length === 0 && (
                <p className="queue-empty">
                  La cola está vacía. Reproduce una canción de la biblioteca
                  para agregarla.
                </p>
              )}
            </div>
          </aside>
        </>
      )}

      <footer aria-label="Reproductor" className="player-bar">
        <div className="now-playing">
          <Cover
            className="mini-cover"
            src={player.currentTrack?.coverUrl}
            title={player.currentTrack?.title ?? "Sin canción"}
          />
          <div className="now-playing-copy">
            <span className="now-playing-title">
              {player.currentTrack?.title ?? "Selecciona una canción"}
            </span>
            <span className="now-playing-artist">
              {player.currentTrack?.artist ?? "Reproductor local"}
              {player.currentTrack?.album
                ? ` · ${player.currentTrack.album}`
                : ""}
            </span>
          </div>
        </div>

        <div className="playback-controls">
          <div className="control-buttons">
            <button
              aria-label={`Repetición: ${
                player.repeatMode === "off"
                  ? "desactivada"
                  : player.repeatMode === "queue"
                    ? "cola"
                    : "canción"
              }`}
              aria-pressed={player.repeatMode !== "off"}
              className={`icon-button control-button repeat-button${
                player.repeatMode !== "off" ? " control-active" : ""
              }`}
              onClick={player.cycleRepeatMode}
              title={`Repetición: ${player.repeatMode}`}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="17"
                viewBox="0 0 24 24"
                width="17"
              >
                <path
                  d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
                {player.repeatMode === "track" && (
                  <text
                    fill="currentColor"
                    fontSize="8"
                    fontWeight="700"
                    textAnchor="middle"
                    x="12"
                    y="15"
                  >
                    1
                  </text>
                )}
              </svg>
            </button>
            <button
              aria-label="Canción anterior"
              className="icon-button control-button"
              disabled={!player.currentTrack}
              onClick={player.playPrevious}
              type="button"
            >
              <Icon name="previous" size={20} />
            </button>
            <button
              aria-label={player.isPlaying ? "Pausar" : "Reproducir"}
              className="icon-button control-button control-primary"
              disabled={!player.currentTrack}
              onClick={player.togglePlayback}
              type="button"
            >
              <Icon name={player.isPlaying ? "pause" : "play"} size={19} />
            </button>
            <button
              aria-label="Siguiente canción"
              className="icon-button control-button"
              disabled={!player.currentTrack}
              onClick={player.playNext}
              type="button"
            >
              <Icon name="next" size={20} />
            </button>
            <button
              aria-expanded={queueOpen}
              aria-label="Abrir cola de reproducción"
              className={`icon-button control-button queue-button${
                queueOpen ? " control-active" : ""
              }`}
              onClick={() => setQueueOpen((open) => !open)}
              type="button"
            >
              <Icon name="queue" size={18} />
              <span aria-hidden="true" className="queue-count">
                {player.queue.length}
              </span>
            </button>
          </div>
          <div className="progress-row">
            <span className="time-current">
              {player.currentPosition > 0
                ? formatTime(player.currentPosition)
                : "0:00"}
            </span>
            <input
              aria-label="Posición de reproducción"
              className="progress-slider"
              disabled={!player.currentTrack || player.duration === 0}
              max={player.duration || 0}
              min={0}
              onChange={(event) => player.seek(Number(event.currentTarget.value))}
              step={0.1}
              style={{ "--progress": `${progress}%` } as CSSProperties}
              type="range"
              value={Math.min(player.currentPosition, player.duration || 0)}
            />
            <span className="time-duration">
              {formatTime(player.duration > 0 ? player.duration : undefined)}
            </span>
          </div>
        </div>

        <div className="player-format">
          {player.currentTrack
            ? formatLabel(player.currentTrack.fileName)
            : "LOCAL"}
          {player.currentTrack?.sampleRate && (
            <small>
              {Math.round(player.currentTrack.sampleRate / 1000)} kHz
            </small>
          )}
        </div>

        <audio
          ref={player.audioRef}
          preload="metadata"
          onEnded={player.handleEnded}
          onError={() => {
            player.setIsPlaying(false);
            player.setError(
              "El navegador no pudo decodificar el archivo de audio seleccionado.",
            );
          }}
          onLoadedMetadata={(event) => {
            const mediaDuration = event.currentTarget.duration;
            player.setDuration(
              Number.isFinite(mediaDuration)
                ? mediaDuration
                : (player.currentTrack?.duration ?? 0),
            );
          }}
          onPause={() => player.setIsPlaying(false)}
          onPlay={() => player.setIsPlaying(true)}
          onTimeUpdate={(event) =>
            player.setCurrentPosition(event.currentTarget.currentTime)
          }
        />
      </footer>

      {accountOpen && (
        <AuthDialog auth={auth} onClose={() => setAccountOpen(false)} />
      )}
      {playlistDialogMode && (
        <PlaylistNameDialog
          initialName={
            playlistDialogMode === "rename"
              ? (selectedPlaylist?.name ?? "")
              : ""
          }
          isSaving={playlists.isSaving}
          onClose={() => setPlaylistDialogMode(null)}
          onSubmit={submitPlaylistName}
          title={
            playlistDialogMode === "create"
              ? "Crear playlist"
              : "Renombrar playlist"
          }
        />
      )}
      {addTracksOpen && selectedPlaylist && (
        <AddTracksDialog
          isSaving={playlists.isSaving}
          onAdd={addLibraryTrack}
          onClose={() => setAddTracksOpen(false)}
          playlist={selectedPlaylist}
          tracks={player.tracks}
        />
      )}
    </div>
  );
}
