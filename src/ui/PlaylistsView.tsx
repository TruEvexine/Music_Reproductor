import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { formatTime } from "../core/format";
import { trackV1Id } from "../core/track";
import type { Track } from "../core/track";
import { useLibrary } from "../state/library";
import { player } from "../state/player";
import { playlists, usePlaylists, visiblePlaylists } from "../state/playlists";
import type { AuthController } from "../sync/useAuthController";
import { AddTracksDialog, ConfirmDialog, PlaylistNameDialog } from "./dialogs";
import { Cover, icon, IconButton, iconSmall } from "./parts";

function syncText(signedIn: boolean, configured: boolean, pending: number, syncing: boolean, offline: boolean) {
  if (!signedIn) return configured ? "Guardadas en este dispositivo. Inicia sesión para tenerlas en todos." : "Guardadas en este dispositivo.";
  if (syncing) return "Sincronizando…";
  if (pending > 0) return offline ? "Sin conexión: los cambios se enviarán al volver la red." : "Cambios pendientes de enviar.";
  return "Sincronizadas con tu cuenta.";
}

export function PlaylistsView({ auth, onAccount }: { auth: AuthController; onAccount: () => void }) {
  const userId = auth.session?.user.id ?? null;
  const all = usePlaylists((state) => state.all);
  const { pending, syncing, offline } = usePlaylists();
  const list = useMemo(() => visiblePlaylists(all, userId), [all, userId]);
  const tracks = useLibrary((state) => state.tracks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [naming, setNaming] = useState<"create" | "rename" | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = list.find((playlist) => playlist.id === selectedId) ?? list[0];

  // Las playlists guardan track:v1 (compatibles con las de siempre); también se reconoce track:v2.
  const byIdentity = useMemo(() => {
    const map = new Map<string, Track>();
    for (const track of tracks) {
      map.set(trackV1Id(track), track);
      if (track.v2) map.set(track.v2, track);
    }
    return map;
  }, [tracks]);
  const entries = selected?.trackIdentifiers.map((identifier) => ({ identifier, track: byIdentity.get(identifier) })) ?? [];
  const playable = entries.flatMap(({ track }) => (track ? [track.id] : []));
  const missing = entries.length - playable.length;

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>Playlists</h1>
          <p className="subtitle">{syncText(Boolean(userId), auth.isConfigured, pending, syncing, offline)}</p>
        </div>
        <div className="header-actions">
          {!userId && auth.isConfigured && (
            <button className="button" onClick={onAccount} type="button">
              Iniciar sesión
            </button>
          )}
          <button className="button primary" onClick={() => setNaming("create")} type="button">
            <Plus {...iconSmall} />
            Nueva playlist
          </button>
        </div>
      </header>
      {list.length === 0 ? (
        <p className="subtitle">Crea tu primera playlist con «Nueva playlist». Funciona sin cuenta y sin conexión.</p>
      ) : (
        <div className="playlists">
          <ul aria-label="Tus playlists" className="playlist-list">
            {list.map((playlist) => (
              <li key={playlist.id}>
                <button
                  aria-current={playlist.id === selected?.id ? "true" : undefined}
                  className="playlist-item"
                  onClick={() => setSelectedId(playlist.id)}
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
          {selected && (
            <div className="playlist-detail">
              <header className="playlist-header">
                <div className="row-copy">
                  <h2>{selected.name}</h2>
                  <p className="subtitle">
                    {entries.length} {entries.length === 1 ? "canción" : "canciones"}
                    {missing > 0 && ` · ${missing} no ${missing === 1 ? "está" : "están"} en este dispositivo`}
                  </p>
                </div>
                <IconButton className="play-button" disabled={playable.length === 0} label={`Reproducir ${selected.name}`} onClick={() => player.playContext(playable, playable[0])}>
                  <Play {...icon} fill="currentColor" />
                </IconButton>
                <IconButton disabled={tracks.length === 0} label="Añadir canciones" onClick={() => setAdding(true)}>
                  <Plus {...icon} />
                </IconButton>
                <IconButton label="Cambiar nombre" onClick={() => setNaming("rename")}>
                  <Pencil {...iconSmall} />
                </IconButton>
                <IconButton label="Eliminar playlist" onClick={() => setDeleting(true)}>
                  <Trash2 {...iconSmall} />
                </IconButton>
              </header>
              {entries.length === 0 ? (
                <p className="subtitle">Esta playlist está vacía. Añade canciones desde tu música.</p>
              ) : (
                <ol className="track-list">
                  {entries.map(({ identifier, track }, index) => (
                    <li className="track-row" key={identifier}>
                      <button className="row-main" disabled={!track} onClick={() => track && player.playContext(playable, track.id)} type="button">
                        <Cover className="row-cover" hash={track?.coverHash} seed={track?.album ?? identifier} />
                        <span className="row-copy">
                          <span className="title">{track?.title ?? "No está en este dispositivo"}</span>
                          <span className="subtitle">{track ? `${track.artist} · ${track.album}` : "Añade el archivo para escucharla"}</span>
                        </span>
                        <span className="row-time time">{formatTime(track?.duration)}</span>
                      </button>
                      <IconButton disabled={index === 0} label="Subir" onClick={() => void playlists.move(selected.id, identifier, -1)}>
                        <ArrowUp {...iconSmall} />
                      </IconButton>
                      <IconButton disabled={index === entries.length - 1} label="Bajar" onClick={() => void playlists.move(selected.id, identifier, 1)}>
                        <ArrowDown {...iconSmall} />
                      </IconButton>
                      <IconButton label="Quitar de la playlist" onClick={() => void playlists.removeTrack(selected.id, identifier)}>
                        <X {...iconSmall} />
                      </IconButton>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
      {naming && (
        <PlaylistNameDialog
          initialName={naming === "rename" ? (selected?.name ?? "") : ""}
          isSaving={false}
          onClose={() => setNaming(null)}
          onSubmit={async (name) => {
            if (naming === "create") setSelectedId(await playlists.create(name));
            else if (selected) await playlists.rename(selected.id, name);
          }}
          title={naming === "create" ? "Nueva playlist" : "Cambiar nombre"}
        />
      )}
      {deleting && selected && (
        <ConfirmDialog
          confirmLabel="Eliminar"
          message={`Se eliminará «${selected.name}»${selected.ownerId ? " de este dispositivo y de tu cuenta" : ""}. Tu música no se toca.`}
          onClose={() => setDeleting(false)}
          onConfirm={() => void playlists.remove(selected.id)}
          title="¿Eliminar la playlist?"
        />
      )}
      {adding && selected && (
        <AddTracksDialog
          isSaving={false}
          onAdd={(track) => playlists.add(selected.id, trackV1Id(track))}
          onClose={() => setAdding(false)}
          playlist={selected}
          tracks={tracks.filter((track) => track.metadataStatus !== "loading")}
        />
      )}
    </section>
  );
}
