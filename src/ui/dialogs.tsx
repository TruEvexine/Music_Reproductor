import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { matchesSearch } from "../core/format";
import { trackV1Id } from "../core/track";
import type { Track } from "../core/track";
import type { Playlist } from "../sync/playlistService";
import type { AuthController } from "../sync/useAuthController";
import { Dialog, IconButton, iconSmall } from "./parts";

export function AuthDialog({ auth, onClose }: { auth: AuthController; onClose: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    void (registering ? auth.signUp(email.trim(), password, name.trim()) : auth.signIn(email.trim(), password));
  }

  if (!auth.isConfigured) {
    return (
      <Dialog onClose={onClose} title="Cuenta">
        <p>Las cuentas no están disponibles en esta instalación. Tu música local funciona igual sin ellas.</p>
      </Dialog>
    );
  }

  if (auth.session) {
    return (
      <Dialog onClose={onClose} title="Tu cuenta">
        <p className="account-email">{auth.session.user.email}</p>
        <p className="subtitle" role="status">
          {auth.databaseState === "error" ? auth.databaseError : "Tus playlists se sincronizan con esta cuenta."}
        </p>
        {auth.authError && (
          <p className="error" role="alert">
            {auth.authError}
          </p>
        )}
        <button className="button" onClick={() => void auth.signOut()} type="button">
          Cerrar sesión
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} title={registering ? "Crear cuenta" : "Iniciar sesión"}>
      <p className="subtitle">La cuenta solo sirve para sincronizar tus playlists. Tu música local no la necesita.</p>
      <form className="form" onSubmit={submit}>
        {registering && (
          <label>
            Nombre
            <input autoComplete="name" maxLength={60} onChange={(event) => setName(event.currentTarget.value)} required value={name} />
          </label>
        )}
        <label>
          Correo electrónico
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Contraseña
          <input
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 10 : 1}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
          {registering && <span className="hint">Mínimo 10 caracteres.</span>}
        </label>
        {auth.authError && (
          <p className="error" role="alert">
            {auth.authError}
          </p>
        )}
        {auth.authNotice && <p role="status">{auth.authNotice}</p>}
        <button className="button primary" disabled={auth.isSubmitting} type="submit">
          {auth.isSubmitting ? "Un momento…" : registering ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </form>
      <button
        className="link"
        onClick={() => {
          setRegistering(!registering);
          auth.clearAuthMessages();
        }}
        type="button"
      >
        {registering ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
      </button>
    </Dialog>
  );
}

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

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSubmit(name.trim());
      onClose();
    } catch {
      setError("No se pudo guardar la playlist. Inténtalo de nuevo.");
    }
  }

  return (
    <Dialog onClose={onClose} title={title}>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <label>
          Nombre de la playlist
          <input autoFocus maxLength={120} onChange={(event) => setName(event.currentTarget.value)} required value={name} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={isSaving || !name.trim()} type="submit">
          {isSaving ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </Dialog>
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
  const matching = tracks.filter((track) => matchesSearch(track, search));

  return (
    <Dialog onClose={onClose} title={`Añadir a ${playlist.name}`}>
      <label className="search">
        <input
          aria-label="Buscar canciones para añadir"
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Buscar en tu música"
          type="search"
          value={search}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul className="add-list">
        {matching.map((track) => {
          const added = playlist.trackIdentifiers.includes(trackV1Id(track));
          return (
            <li className="add-row" key={track.id}>
              <span className="row-copy">
                <span className="title">{track.title}</span>
                <span className="subtitle">
                  {track.artist} · {track.album}
                </span>
              </span>
              <IconButton
                disabled={added || isSaving || track.metadataStatus === "loading"}
                label={added ? `${track.title} ya está en la playlist` : `Añadir ${track.title}`}
                onClick={() => void onAdd(track).catch(() => setError("No se pudo añadir la canción."))}
              >
                {added ? <Check {...iconSmall} /> : <Plus {...iconSmall} />}
              </IconButton>
            </li>
          );
        })}
      </ul>
      {matching.length === 0 && <p className="subtitle">Ninguna canción coincide.</p>}
    </Dialog>
  );
}
