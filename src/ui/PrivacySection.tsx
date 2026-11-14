import { useEffect, useState } from "react";
import { buildAccountExport } from "../core/backup";
import { formatBytes, maskEmail } from "../core/format";
import { storage } from "../platform";
import { library, useLibrary } from "../state/library";
import { usePlaylists } from "../state/playlists";
import { fetchAccountData, signOutForWipe } from "../sync/account";
import type { AuthController } from "../sync/useAuthController";
import { ConfirmDialog } from "./dialogs";
import { downloadJson } from "./download";
import { BackupSection } from "./LibrarySheet";
import { toast } from "./toast";

// Ajustes → Privacidad y datos (docs/producto/AJUSTES_PRIVACIDAD.md §2): qué se guarda con cifras reales, exportar y borrar.
// Quedan fuera, por decisión pendiente, «Eliminar cuenta» y la analítica.

interface Stored {
  covers: { count: number; bytes: number };
  copies: number;
  space?: { usage: number; quota: number };
}

/** Lo que cuesta recorrer los almacenes: se calcula al abrir la sección, no al arrancar la app. */
async function loadStored(): Promise<Stored> {
  const [records, copies, space] = await Promise.all([
    storage.list<{ small?: Blob; large?: Blob; master?: Blob }>("covers"),
    library.copiesSize(),
    library.space(),
  ]);
  const bytes = records.reduce((sum, record) => sum + (record.small?.size ?? 0) + (record.large?.size ?? 0) + (record.master?.size ?? 0), 0);
  return { covers: { count: records.length, bytes }, copies, space };
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("es")} ${n === 1 ? one : many}`;

function StoredList({ auth }: { auth: AuthController }) {
  const tracks = useLibrary((state) => state.tracks.length);
  const roots = useLibrary((state) => state.roots.length);
  const all = usePlaylists((state) => state.all);
  const pending = usePlaylists((state) => state.pending);
  const [stored, setStored] = useState<Stored>();
  useEffect(() => {
    void loadStored().then(setStored);
  }, [tracks, roots]);
  const email = auth.session?.user.email;
  const synced = all.filter((playlist) => playlist.ownerId !== null).length;
  const rows: [string, string][] = [
    ["Canciones en la biblioteca", tracks === 0 ? "Ninguna todavía" : `${count(tracks, "canción", "canciones")} de ${count(roots, "carpeta", "carpetas")}`],
    ["Portadas", stored ? (stored.covers.count === 0 ? "Ninguna" : `${count(stored.covers.count, "portada", "portadas")} · ${formatBytes(stored.covers.bytes)}`) : "Calculando…"],
    ["Copias de música", stored ? (stored.copies > 0 ? formatBytes(stored.copies) : "Ninguna: se lee de tus carpetas") : "Calculando…"],
    ["Playlists", `${count(all.length, "en este dispositivo", "en este dispositivo")} · ${count(synced, "sincronizada", "sincronizadas")}`],
    ...(pending > 0 ? [["Cambios pendientes de subir", String(pending)] as [string, string]] : []),
    ["Espacio total usado", stored ? (stored.space ? `${formatBytes(stored.space.usage)} de ${formatBytes(stored.space.quota)} disponibles` : "El navegador no lo informa") : "Calculando…"],
    ["Cuenta", auth.session ? `Conectado como ${email ? maskEmail(email) : "tu cuenta"}` : "Sin cuenta: nada sale de este dispositivo"],
  ];
  return (
    <section className="sheet-section">
      <h3>Qué se guarda</h3>
      <dl className="stored">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">
        Tus archivos de música nunca se suben. Si tienes cuenta, solo se sincronizan tus playlists: su nombre y el título, artista, álbum y duración de cada canción.
      </p>
    </section>
  );
}

function AccountExport({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    setStatus(null);
    try {
      const { profile, playlists } = await fetchAccountData(userId);
      const data = buildAccountExport(profile, playlists);
      downloadJson(`reproductor-cuenta-${data.exportedAt.slice(0, 10)}.json`, data);
      setStatus("Archivo descargado.");
    } catch {
      setStatus("No se pudieron leer los datos de tu cuenta. Inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sheet-section">
      <h3>Datos de tu cuenta</h3>
      <p className="subtitle">Tu perfil y todas las playlists de tu cuenta, tal como están guardadas, en un archivo JSON.</p>
      <div className="dialog-actions">
        <button className="button" disabled={busy} onClick={() => void run()} type="button">
          Descargar datos de la cuenta
        </button>
      </div>
      {status && (
        <p className="subtitle" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

function WipeDialog({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [closeSession, setCloseSession] = useState(signedIn);
  return (
    <ConfirmDialog
      confirmLabel="Borrar todo"
      message="Se borrarán de este navegador tu biblioteca, las copias de música, tus playlists y tus ajustes. Tus archivos originales no se tocan."
      onClose={onClose}
      onConfirm={() => void (closeSession ? signOutForWipe() : Promise.resolve()).catch(() => {}).then(() => library.wipeAll()).then(() => location.reload())}
      title="¿Borrar los datos de este dispositivo?"
    >
      {signedIn && (
        <>
          <label className="check-row">
            <input checked={closeSession} onChange={(event) => setCloseSession(event.currentTarget.checked)} type="checkbox" />
            Cerrar también la sesión
          </label>
          {!closeSession && <p className="hint">Si no cierras la sesión, las playlists de tu cuenta volverán a bajar a este dispositivo.</p>}
        </>
      )}
    </ConfirmDialog>
  );
}

export function PrivacySection({ auth }: { auth: AuthController }) {
  const [asking, setAsking] = useState<"recent" | "wipe" | null>(null);
  const userId = auth.session?.user.id;
  return (
    <section aria-labelledby="set-data" className="settings-section">
      <h2 id="set-data">Privacidad y datos</h2>
      <p className="subtitle">Lo que la app guarda en este dispositivo y en tu cuenta.</p>
      <StoredList auth={auth} />
      <BackupSection />
      {userId && <AccountExport userId={userId} />}
      <section className="sheet-section">
        <h3>Borrar</h3>
        <p className="subtitle">Para quitar una carpeta concreta, ve a Biblioteca. Aquí, de menor a mayor alcance:</p>
        <div className="dialog-actions">
          <button className="button" onClick={() => setAsking("recent")} type="button">
            Borrar el historial de Recientes
          </button>
        </div>
        <div className="dialog-actions">
          <button className="button danger" onClick={() => setAsking("wipe")} type="button">
            Borrar datos de este dispositivo
          </button>
        </div>
      </section>
      {asking === "recent" && (
        <ConfirmDialog
          confirmLabel="Borrar historial"
          message="¿Borrar el historial de Recientes? Las canciones siguen en tu biblioteca; solo se olvida cuándo sonaron."
          onClose={() => setAsking(null)}
          onConfirm={() => {
            library.clearPlayed();
            toast("Historial de Recientes borrado");
          }}
          title="Borrar el historial de Recientes"
        />
      )}
      {asking === "wipe" && <WipeDialog onClose={() => setAsking(null)} signedIn={Boolean(userId)} />}
    </section>
  );
}
