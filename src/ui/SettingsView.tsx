import { useState } from "react";
import { library } from "../state/library";
import { useBackground, background } from "../state/background";
import { ConfirmDialog } from "./dialogs";
import { BackupSection, FoldersSection } from "./LibrarySheet";
import { openShortcutHelp } from "./ShortcutsHelp";
import { useReducedMotion } from "./motion";
import { BackgroundPage, EqPage, SoundControls, SwitchRow } from "./PlayerMenu";

// Ajustes: los mismos controles del menú del reproductor (fondo y HDR, sonido, ecualizador) y de la hoja de la biblioteca
// (carpetas, copia de seguridad), reunidos en una página. Cada ajuste escribe en el mismo store, así que menú y página nunca discrepan.
// No hay tema claro ni más idiomas que el español: por eso no hay ajustes de tema ni de idioma.
export function SettingsView() {
  const reduceMotion = useBackground((state) => state.reduceMotion);
  const shortcuts = useBackground((state) => state.shortcuts);
  const reduced = useReducedMotion();
  const [wiping, setWiping] = useState(false);
  return (
    <section className="view settings">
      <header className="view-header">
        <div>
          <h1>Ajustes</h1>
          <p className="subtitle">Se guardan en este dispositivo.</p>
        </div>
      </header>
      <section aria-labelledby="set-look" className="settings-section">
        <h2 id="set-look">Apariencia y luces</h2>
        <div className="settings-stack">
          <BackgroundPage />
        </div>
      </section>
      <section aria-labelledby="set-play" className="settings-section">
        <h2 id="set-play">Reproducción</h2>
        <div className="settings-stack">
          <SoundControls />
          <h3 className="settings-sub">Ecualizador</h3>
          <EqPage />
        </div>
      </section>
      <section aria-labelledby="set-lib" className="settings-section">
        <h2 id="set-lib">Biblioteca</h2>
        <FoldersSection />
      </section>
      <section aria-labelledby="set-a11y" className="settings-section">
        <h2 id="set-a11y">Accesibilidad</h2>
        <div className="settings-stack">
          <section className="menu-group">
            <SwitchRow checked={reduceMotion} label="Reducir movimiento" onChange={(next) => background.set({ reduceMotion: next })} />
            <p className="hint" role="status">
              Quita animaciones y transiciones y deja el fondo quieto.
              {reduced && !reduceMotion ? " Tu sistema ya pide menos movimiento: se respeta aunque esto esté apagado." : " Si tu sistema lo pide, se respeta siempre."}
            </p>
          </section>
          <section className="menu-group">
            <SwitchRow checked={shortcuts} label="Atajos de teclado" onChange={(next) => background.set({ shortcuts: next })} />
            <p className="hint">Espacio, flechas, X, P y más. Apágalos si chocan con tu dictado por voz o tu lector de pantalla.</p>
            <button className="link" onClick={openShortcutHelp} type="button">
              Ver la lista de atajos
            </button>
          </section>
        </div>
      </section>
      <section aria-labelledby="set-data" className="settings-section">
        <h2 id="set-data">Datos locales</h2>
        <BackupSection />
        <section className="sheet-section">
          <h3>Borrar datos</h3>
          <p className="subtitle">Quita de este navegador tu biblioteca, copias de música, playlists y ajustes. Tus archivos originales no se tocan.</p>
          <div className="dialog-actions">
            <button className="button danger" onClick={() => setWiping(true)} type="button">
              Borrar datos locales
            </button>
          </div>
        </section>
      </section>
      {wiping && (
        <ConfirmDialog
          confirmLabel="Borrar todo"
          message="Se borrarán de este navegador tu biblioteca, las copias de música guardadas, tus playlists y tus ajustes. Si tienes sesión iniciada, las playlists de tu cuenta volverán a sincronizarse. Tus archivos originales no se tocan. Esto no se puede deshacer."
          onClose={() => setWiping(false)}
          onConfirm={() => void library.wipeAll().then(() => location.reload())}
          title="¿Borrar los datos locales?"
        />
      )}
    </section>
  );
}
