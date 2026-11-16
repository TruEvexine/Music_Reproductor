import { useEffect, useRef, useState } from "react";
import { Download, FolderSync, RefreshCw, Trash2, Upload } from "lucide-react";
import type { AudioSettings } from "../core/audio";
import type { BackgroundSettings } from "../core/background";
import { formatBytes } from "../core/format";
import { buildBackup, MAX_BACKUP_BYTES, parseBackup } from "../core/backup";
import { library, useLibrary } from "../state/library";
import type { RootView } from "../state/library";
import { background, useBackground } from "../state/background";
import { player, usePlayer } from "../state/player";
import { playlists, usePlaylists, visiblePlaylists } from "../state/playlists";
import { ConfirmDialog } from "./dialogs";
import { downloadJson } from "./download";
import { Dialog, IconButton, iconSmall } from "./parts";

const kindText: Record<RootView["kind"], string> = {
  folder: "Carpeta del dispositivo",
  copy: "Copia guardada en este navegador",
  session: "Solo hasta recargar la página",
};

function accessText(root: RootView) {
  if (root.access === "prompt" || root.access === "denied") return "Necesita tu permiso";
  if (root.access === "missing") return "No disponible";
  return `${root.count} ${root.count === 1 ? "canción" : "canciones"}`;
}

/** Carpetas de música: reconectar, buscar cambios y quitar. La comparten la hoja de la biblioteca y Ajustes. */
export function FoldersSection() {
  const roots = useLibrary((state) => state.roots);
  const scanning = useLibrary((state) => state.scan !== null);
  const [space, setSpace] = useState<{ usage: number; quota: number }>();
  const [removing, setRemoving] = useState<RootView | null>(null);

  useEffect(() => {
    void library.space().then(setSpace);
  }, [roots]);

  return (
    <>
      <section className="sheet-section">
        <h3>Carpetas</h3>
        {roots.length === 0 ? (
          <p className="subtitle">Todavía no has añadido música.</p>
        ) : (
          <ul className="root-list">
            {roots.map((root) => (
              <li className="root-row" key={root.id}>
                <span className="row-copy">
                  <span className="title">{root.name}</span>
                  <span className="subtitle">
                    {kindText[root.kind]} · {accessText(root)}
                  </span>
                </span>
                {root.kind === "folder" && (root.access === "prompt" || root.access === "denied") ? (
                  <IconButton label={`Reconectar ${root.name}`} onClick={() => void library.reconnect(root.id)}>
                    <FolderSync {...iconSmall} />
                  </IconButton>
                ) : (
                  root.kind === "folder" && (
                    <IconButton disabled={scanning} label={`Buscar cambios en ${root.name}`} onClick={() => void library.rescan(root.id)}>
                      <RefreshCw {...iconSmall} />
                    </IconButton>
                  )
                )}
                <IconButton label={`Quitar ${root.name}`} onClick={() => setRemoving(root)}>
                  <Trash2 {...iconSmall} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {space && (
          <p className="subtitle">
            Este navegador usa {formatBytes(space.usage)} de {formatBytes(space.quota)} disponibles.
          </p>
        )}
      </section>
      {removing && (
        <ConfirmDialog
          confirmLabel="Quitar"
          message={
            removing.kind === "copy"
              ? `Se borrará la copia de «${removing.name}» guardada en este navegador. Tus archivos originales no se tocan.`
              : `«${removing.name}» dejará de aparecer en tu biblioteca. Tus archivos no se tocan.`
          }
          onClose={() => setRemoving(null)}
          onConfirm={() => void library.removeRoot(removing.id)}
          title="¿Quitar de la biblioteca?"
        />
      )}
    </>
  );
}

/** Copia de seguridad (exportar e importar JSON). La comparten la hoja de la biblioteca y Ajustes → Privacidad y datos. */
export function BackupSection() {
  const [status, setStatus] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  function exportBackup() {
    const backup = buildBackup(visiblePlaylists(usePlaylists.getState().all, playlists.user), {
      audio: usePlayer.getState().audio,
      background: useBackground.getState(),
    });
    downloadJson(`reproductor-copia-${backup.exportedAt.slice(0, 10)}.json`, backup);
    setStatus("Copia descargada.");
  }

  async function importBackup(chosen: File | undefined) {
    if (!chosen) return;
    if (chosen.size > MAX_BACKUP_BYTES) {
      setStatus("El archivo es demasiado grande para ser una copia de seguridad.");
      return;
    }
    const result = parseBackup(await chosen.text());
    if ("error" in result) {
      setStatus(result.error);
      return;
    }
    const { playlists: items, settings } = result.backup;
    await playlists.importMany(items);
    // Los ajustes pasan por los mismos saneadores que los guardados: un archivo manipulado no rompe nada.
    if (settings.audio) player.setAudio(settings.audio as Partial<AudioSettings>);
    if (settings.background) background.set(settings.background as Partial<BackgroundSettings>);
    setStatus(`Copia importada: ${items.length} ${items.length === 1 ? "playlist" : "playlists"}${settings.audio || settings.background ? " y ajustes" : ""}.`);
  }

  return (
    <section className="sheet-section">
      <h3>Copia de seguridad</h3>
      <p className="subtitle">Tus playlists y ajustes en un archivo JSON. La música no se incluye.</p>
      <div className="dialog-actions">
        <button className="button" onClick={exportBackup} type="button">
          <Download {...iconSmall} />
          Exportar
        </button>
        <button className="button" onClick={() => file.current?.click()} type="button">
          <Upload {...iconSmall} />
          Importar
        </button>
      </div>
      <input
        accept="application/json,.json"
        aria-label="Elegir copia de seguridad"
        className="visually-hidden"
        onChange={(event) => {
          void importBackup(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={file}
        tabIndex={-1}
        type="file"
      />
      {status && (
        <p className="subtitle" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

export function LibrarySheet({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose} title="Tu biblioteca">
      <FoldersSection />
      <BackupSection />
    </Dialog>
  );
}
