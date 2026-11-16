import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { matchesSearch } from "../core/format";
import { trackV1Id } from "../core/track";
import type { Track } from "../core/track";
import type { LocalPlaylist } from "../core/outbox";
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

  if (auth.linkProblem && !auth.session) {
    const otherBrowser = auth.linkProblem === "other-browser";
    return (
      <Dialog onClose={onClose} title="El enlace no funcionó">
        <p>{otherBrowser ? "Abre el enlace en el mismo navegador donde lo pediste." : "El enlace caducó o ya se usó."}</p>
        <p className="subtitle">
          {otherBrowser
            ? "Si era el de confirmar tu correo, puede que ya esté confirmado: prueba a iniciar sesión con tu contraseña. Si no, pide uno nuevo aquí y ábrelo en este navegador."
            : "Pide uno nuevo aquí y ábrelo en este navegador."}
        </p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void auth.resendLink(email.trim());
          }}
        >
          <label>
            Correo electrónico
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.currentTarget.value)} required type="email" value={email} />
          </label>
          {auth.authError && (
            <p className="error" role="alert">
              {auth.authError}
            </p>
          )}
          {auth.authNotice && <p role="status">{auth.authNotice}</p>}
          <button className="button primary" disabled={auth.isSubmitting} type="submit">
            {auth.isSubmitting ? "Un momento…" : "Pedir un enlace nuevo"}
          </button>
        </form>
        <button
          className="link"
          onClick={() => {
            auth.clearLinkProblem();
            auth.clearAuthMessages();
          }}
          type="button"
        >
          Iniciar sesión con mi contraseña
        </button>
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
            Nombre visible (opcional)
            <input autoComplete="name" maxLength={60} onChange={(event) => setName(event.currentTarget.value)} value={name} />
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

/** Confirmación propia (sustituye a window.confirm). La acción destructiva no recibe el foco inicial: es "Cancelar". */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Opciones propias del diálogo (por ejemplo una casilla), entre el mensaje y los botones. */
  children?: ReactNode;
}) {
  return (
    <Dialog onClose={onClose} title={title}>
      <p>{message}</p>
      {children}
      <div className="dialog-actions">
        <button autoFocus className="button" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="button danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
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

const SHOWN = 100;

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
  playlist: LocalPlaylist;
  tracks: Track[];
}) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const all = tracks.filter((track) => matchesSearch(track, search));
  // Con miles de pistas no se pintan todas: se pide afinar la búsqueda.
  const matching = all.slice(0, SHOWN);
  const inPlaylist = new Set(playlist.trackIdentifiers);

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
          const added = inPlaylist.has(trackV1Id(track)) || (track.v2 !== undefined && inPlaylist.has(track.v2));
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
      {all.length > SHOWN && <p className="subtitle">Se muestran {SHOWN} de {all.length}. Escribe para afinar la búsqueda.</p>}
    </Dialog>
  );
}

/** Tras iniciar sesión, si hay playlists creadas sin cuenta: nunca se suben sin preguntar. Cerrar el diálogo equivale a «Decidir luego». */
export function AdoptDialog({ count, onChoose }: { count: number; onChoose: (choice: "upload" | "keep" | "later") => void }) {
  const one = count === 1;
  return (
    <Dialog onClose={() => onChoose("later")} title={one ? "¿Subir tu playlist a la cuenta?" : "¿Subir tus playlists a la cuenta?"}>
      <p>{one ? "Tienes 1 playlist creada sin cuenta en este dispositivo." : `Tienes ${count} playlists creadas sin cuenta en este dispositivo.`}</p>
      <p className="subtitle">
        Si {one ? "la subes" : "las subes"}, tu cuenta guardará el nombre de cada playlist y, por cada canción, su título, artista, álbum y duración tal como
        vienen en tus archivos. Los archivos de música no se suben. Si no, {one ? "se queda" : "se quedan"} solo en este dispositivo.
      </p>
      <div className="dialog-actions">
        <button className="button" onClick={() => onChoose("later")} type="button">
          Decidir luego
        </button>
        <button className="button" onClick={() => onChoose("keep")} type="button">
          No subir
        </button>
        <button className="button primary" onClick={() => onChoose("upload")} type="button">
          Subir
        </button>
      </div>
    </Dialog>
  );
}
