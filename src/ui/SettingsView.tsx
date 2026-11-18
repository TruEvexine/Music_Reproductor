import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { APP_NAME } from "../core/brand";
import { useBackground, background } from "../state/background";
import type { AuthController } from "../sync/useAuthController";
import { CafeNote } from "./CafeLink";
import { FoldersSection } from "./LibrarySheet";
import { tutorials } from "../state/tutorials";
import { PrivacySection } from "./PrivacySection";
import { ProfileSection } from "./ProfileSection";
import { navigate } from "./router";
import { openShortcutHelp } from "./ShortcutsHelp";
import { useReducedMotion } from "./motion";
import { BackgroundPage, EqPage, SoundControls, SwitchRow } from "./PlayerMenu";

// Ajustes: los mismos controles del menú del reproductor (fondo y HDR, sonido, ecualizador) y de la hoja de la biblioteca
// (carpetas, copia de seguridad), reunidos en una página. Cada ajuste escribe en el mismo store, así que menú y página nunca discrepan.
// No hay tema claro ni más idiomas que el español: por eso no hay ajustes de tema ni de idioma.
const sections: [id: string, label: string][] = [
  ["set-profile", "Perfil"],
  ["set-look", "Apariencia y luces"],
  ["set-play", "Reproducción"],
  ["set-lib", "Biblioteca"],
  ["set-a11y", "Accesibilidad"],
  ["set-data", "Privacidad y datos"],
  ["set-about", "Acerca de"],
];

// Borradores (LegalPage.tsx): solo se enlazan desde aquí. navigate() porque en la app nativa la ruta va en el hash.
const legalLinks: [to: string, label: string][] = [
  ["/privacidad", "Aviso de privacidad"],
  ["/terminos", "Términos de uso"],
];

// Índice de escritorio (styles/library.css lo oculta por debajo de 1000 px): salta a la sección y deja el foco en su título.
// Sin desplazamiento suave (nada que reducir con movimiento reducido) y sin tocar la URL: en la app nativa el hash es la ruta.
function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  showSection(id);
}

function showSection(id: string) {
  const heading = document.getElementById(id);
  const main = heading?.closest(".main");
  if (!heading || !main) return;
  // Solo se desplaza .main: scrollIntoView movía también la cuadrícula de la app (con la barra) cuando la sección está al final.
  // 24 px = --s5, el mismo aire que deja arriba el índice fijo.
  main.scrollTop += heading.getBoundingClientRect().top - main.getBoundingClientRect().top - 24;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

export function SettingsView({ auth }: { auth: AuthController }) {
  const reduceMotion = useBackground((state) => state.reduceMotion);
  const shortcuts = useBackground((state) => state.shortcuts);
  const reduced = useReducedMotion();
  const [rewatched, setRewatched] = useState(false);
  // De vuelta de una página legal (su «Volver» o el atrás del sistema): a «Acerca de», que es de donde se salió.
  useEffect(() => {
    const section = (history.state as { section?: string } | null)?.section;
    if (!section) return;
    history.replaceState(null, "");
    showSection(section);
  }, []);
  return (
    <section className="view settings">
      <header className="view-header">
        <div>
          <h1>Ajustes</h1>
          <p className="subtitle">Se guardan en este dispositivo.</p>
        </div>
      </header>
      <div className="settings-columns">
        <nav aria-label="Apartados de Ajustes" className="settings-nav">
          {sections.map(([id, label]) => (
            <a href={`#${id}`} key={id} onClick={(event) => jump(event, id)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-body">
          {/* Escritorio ancho: dos columnas fijas de tarjetas (styles/library.css); en lo demás, display: contents. */}
          <div className="settings-col">
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
          </div>
          <div className="settings-col">
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
            <PrivacySection auth={auth} />
            <section aria-labelledby="set-about" className="settings-section">
              <h2 id="set-about">Acerca de</h2>
              <h3 className="settings-sub">Sobre {APP_NAME}</h3>
              <div className="help-about">
                <p>
                  Hola. Detrás de {APP_NAME} no hay una empresa ni un equipo: hay una sola persona en México que no quiso conformarse con las opciones que había y empezó a construir el reproductor que le gustaría usar, con la idea de compartirlo con los demás.
                </p>
                <p>
                  Por eso existe {APP_NAME}: un reproductor para tu propia música. Tus canciones son tuyas y se quedan en tu dispositivo, y usarlo así es gratis.
                </p>
              </div>
              <CafeNote />
              <div className="about-links">
                {legalLinks.map(([to, label]) => (
                  <a className="link" href={to} key={to} onClick={(event) => {
                      event.preventDefault();
                      history.replaceState({ section: "set-about" }, "");
                      navigate(to, false, { fromApp: true });
                    }}>
                    {label}
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
