import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { formatTime } from "../core/format";
import { trackV1Id } from "../core/track";
import { useLibrary } from "../state/library";
import { player } from "../state/player";
import type { AuthController } from "../sync/useAuthController";
import { usePlaylistController } from "../sync/usePlaylistController";
import { AddTracksDialog, ConfirmDialog, PlaylistNameDialog } from "./dialogs";
import { Cover, icon, IconButton, iconSmall } from "./parts";

export function PlaylistsView({ auth, onAccount }: { auth: AuthController; onAccount: () => void }) {
  const playlists = usePlaylistController(auth.session?.user.id);
  const tracks = useLibrary((state) => state.tracks);
  const [naming, setNaming] = useState<"create" | "rename" | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = playlists.selectedPlaylist;

  if (!auth.session) {
    return (
      <section className="view empty">
        <h1>Playlists</h1>
        <p>
          {auth.isConfigured
            ? "Inicia sesión para crear playlists y tenerlas en todos tus dispositivos. Tu música local sigue funcionando sin cuenta."
            : "Las playlists sincronizadas no están disponibles en esta instalación."}
        </p>
        {auth.isConfigured && (
          <button className="button primary" onClick={onAccount} type="button">
            Iniciar sesión
          </button>
        )}
      </section>
    );
  }

  const byIdentity = new Map(tracks.map((track) => [trackV1Id(track), track]));
  const entries = selected?.trackIdentifiers.map((identifier) => ({ identifier, track: byIdentity.get(identifier) })) ?? [];
  const playable = entries.flatMap(({ track }) => (track ? [track.id] : []));
  const missing = entries.length - playable.length;
  const safely = (work: Promise<void>) => void work.catch(() => undefined); // el controlador ya publica el error

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>Playlists</h1>
          <p className="subtitle">{playlists.isLoading ? "Cargando…" : `${playlists.playlists.length} en tu cuenta`}</p>
        </div>
        <button className="button" onClick={() => setNaming("create")} type="button">
          <Plus {...iconSmall} />
          Nueva playlist
        </button>
      </header>
      {playlists.error && (
        <p className="error" role="alert">
          No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.
        </p>
      )}
      <div className="playlists">
        <ul aria-label="Tus playlists" className="playlist-list">
          {playlists.playlists.map((playlist) => (
            <li key={playlist.id}>
              <button
                aria-current={playlist.id === selected?.id ? "true" : undefined}
                className="playlist-item"
                onClick={() => playlists.selectPlaylist(playlist.id)}
                type="button"
              >
                <span className="title">{playlist.name}</span>
                <span className="subtitle">
                  {playlist.trackIdentifiers.length} {playlist.trackIdentifiers.length === 1 ? "canción" : "canciones"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <div className="playlist-detail">
            <header className="playlist-header">
              <div className="row-copy">
                <h2>{selected.name}</h2>
                <p className="subtitle">
                  {entries.length} {entries.length === 1 ? "canción" : "canciones"}
                  {missing > 0 && ` · ${missing} no ${missing === 1 ? "está" : "están"} en este dispositivo`}
                </p>
              </div>
              <IconButton
                className="play-button"
                disabled={playable.length === 0}
                label={`Reproducir ${selected.name}`}
                onClick={() => player.playContext(playable, playable[0])}
              >
                <Play {...icon} fill="currentColor" />
              </IconButton>
              <IconButton disabled={tracks.length === 0} label="Añadir canciones" onClick={() => setAdding(true)}>
                <Plus {...icon} />
              </IconButton>
              <IconButton disabled={playlists.isSaving} label="Cambiar nombre" onClick={() => setNaming("rename")}>
                <Pencil {...iconSmall} />
              </IconButton>
              <IconButton
                disabled={playlists.isSaving}
                label="Eliminar playlist"
                onClick={() => setDeleting(true)}
              >
                <Trash2 {...iconSmall} />
              </IconButton>
            </header>
            {entries.length === 0 ? (
              <p className="subtitle">Esta playlist está vacía. Añade canciones desde tu música.</p>
            ) : (
              <ol className="track-list">
                {entries.map(({ identifier, track }, index) => (
                  <li className="track-row" key={identifier}>
                    <button
                      className="row-main"
                      disabled={!track}
                      onClick={() => track && player.playContext(playable, track.id)}
                      type="button"
                    >
                      <Cover className="row-cover" seed={track?.album ?? identifier} src={track?.coverUrl} />
                      <span className="row-copy">
                        <span className="title">{track?.title ?? "No está en este dispositivo"}</span>
                        <span className="subtitle">{track ? `${track.artist} · ${track.album}` : "Añade el archivo para escucharla"}</span>
                      </span>
                      <span className="row-time time">{formatTime(track?.duration)}</span>
                    </button>
                    <IconButton
                      disabled={index === 0 || playlists.isSaving}
                      label="Subir"
                      onClick={() => safely(playlists.moveTrack(selected.id, identifier, -1))}
                    >
                      <ArrowUp {...iconSmall} />
                    </IconButton>
                    <IconButton
                      disabled={index === entries.length - 1 || playlists.isSaving}
                      label="Bajar"
                      onClick={() => safely(playlists.moveTrack(selected.id, identifier, 1))}
                    >
                      <ArrowDown {...iconSmall} />
                    </IconButton>
                    <IconButton
                      disabled={playlists.isSaving}
                      label="Quitar de la playlist"
                      onClick={() => safely(playlists.removeTrack(selected.id, identifier))}
                    >
                      <X {...iconSmall} />
                    </IconButton>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          !playlists.isLoading && <p className="subtitle">Crea tu primera playlist con «Nueva playlist».</p>
        )}
      </div>
      {naming && (
        <PlaylistNameDialog
          initialName={naming === "rename" ? (selected?.name ?? "") : ""}
          isSaving={playlists.isSaving}
          onClose={() => setNaming(null)}
          onSubmit={(name) =>
            naming === "create" ? playlists.createPlaylist(name) : playlists.renamePlaylist(selected?.id ?? "", name)
          }
          title={naming === "create" ? "Nueva playlist" : "Cambiar nombre"}
        />
      )}
      {deleting && selected && (
        <ConfirmDialog
          confirmLabel="Eliminar"
          message={`Se eliminará «${selected.name}» de tu cuenta. Tu música local no se toca.`}
          onClose={() => setDeleting(false)}
          onConfirm={() => safely(playlists.deletePlaylist(selected.id))}
          title="¿Eliminar la playlist?"
        />
      )}
      {adding && selected && (
        <AddTracksDialog
          isSaving={playlists.isSaving}
          onAdd={(track) => playlists.addTrack(selected.id, track)}
          onClose={() => setAdding(false)}
          playlist={selected}
          tracks={tracks}
        />
      )}
    </section>
  );
}
