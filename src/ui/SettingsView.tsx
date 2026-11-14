import { useState } from "react";
import { useBackground, background } from "../state/background";
import type { AuthController } from "../sync/useAuthController";
import { CafeSection } from "./CafeLink";
import { FoldersSection } from "./LibrarySheet";
import { tutorials } from "../state/tutorials";
import { PrivacySection } from "./PrivacySection";
import { ProfileSection } from "./ProfileSection";
import { openShortcutHelp } from "./ShortcutsHelp";
import { useReducedMotion } from "./motion";
import { BackgroundPage, EqPage, SoundControls, SwitchRow } from "./PlayerMenu";

// Ajustes: los mismos controles del menú del reproductor (fondo y HDR, sonido, ecualizador) y de la hoja de la biblioteca
// (carpetas, copia de seguridad), reunidos en una página. Cada ajuste escribe en el mismo store, así que menú y página nunca discrepan.
// No hay tema claro ni más idiomas que el español: por eso no hay ajustes de tema ni de idioma.
export function SettingsView({ auth }: { auth: AuthController }) {
  const reduceMotion = useBackground((state) => state.reduceMotion);
  const shortcuts = useBackground((state) => state.shortcuts);
  const reduced = useReducedMotion();
  const [rewatched, setRewatched] = useState(false);
  return (
    <section className="view settings">
      <header className="view-header">
        <div>
          <h1>Ajustes</h1>
          <p className="subtitle">Se guardan en este dispositivo.</p>
        </div>
      </header>
      <ProfileSection />
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
          <section className="menu-group">
            <button className="button" onClick={() => (tutorials.reset(), setRewatched(true))} type="button">
              Ver tutoriales otra vez
            </button>
            <p className="hint" role="status">
              {rewatched ? "Listo: cada aviso volverá a salir la próxima vez que encuentres esa función." : "Los avisos de primera vez, como el de deslizar una canción, vuelven a aparecer."}
            </p>
          </section>
        </div>
      </section>
      <CafeSection />
      <PrivacySection auth={auth} />
    </section>
  );
}
