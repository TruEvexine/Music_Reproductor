import { ChevronDown } from "lucide-react";
import { faq } from "virtual:docs";
import { APP_NAME } from "../core/brand";
import { GESTURES } from "../core/gestures";
import { supabaseConfigured } from "../sync/supabaseClient";
import { Inline } from "./Markdown";
import { icon } from "./parts";
import { openShortcutHelp, ShortcutsList } from "./ShortcutsHelp";

// Ayuda: atajos y gestos salen de los mismos datos que el código (core/shortcuts.ts, core/gestures.ts) y las preguntas de
// docs/producto/FAQ.md (vite.config.ts), así que ninguna se desfasa. «Nosotros» es la presentación anónima decidida en D26.
// En escritorio, dos columnas (styles/library.css); en móvil los envoltorios no cuentan y queda una.
export function HelpView() {
  return (
    <section className="view settings help">
      <header className="view-header">
        <div>
          <h1>Ayuda</h1>
          <p className="subtitle">Atajos, gestos y respuestas a lo que más se pregunta.</p>
        </div>
      </header>
      <div className="help-columns">
        <div className="help-col">
          <section aria-labelledby="help-keys" className="settings-section">
            <h2 id="help-keys">Atajos de teclado</h2>
            <ShortcutsList />
            <p className="hint">Se pueden apagar en Ajustes → Accesibilidad. Con «?» se abre esta lista desde cualquier sitio.</p>
            <button className="link" onClick={openShortcutHelp} type="button">
              Abrir la lista aparte
            </button>
          </section>
          <section aria-labelledby="help-gestures" className="settings-section">
            <h2 id="help-gestures">Gestos en el móvil</h2>
            <p className="hint">Funcionan con el dedo; con ratón o teclado, cada uno tiene su alternativa.</p>
            <ul className="help-list">
              {GESTURES.map((gesture) => (
                <li key={gesture.id}>
                  <h3>{gesture.title}</h3>
                  <p>{gesture.how}</p>
                  <p className="hint">Sin gesto: {gesture.alternative}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="help-col">
          <section aria-labelledby="help-faq" className="settings-section">
            <h2 id="help-faq">Preguntas frecuentes</h2>
            {faq.map(({ group, items }) => (
              <div className="help-group" key={group}>
                <h3>{group}</h3>
                {items.map(({ question, answer }) => (
                  <details className="faq-item" key={question}>
                    <summary>
                      <span>{question}</span>
                      <ChevronDown {...icon} />
                    </summary>
                    {answer.map((paragraph) => (
                      <p key={paragraph}>
                        <Inline text={paragraph} />
                      </p>
                    ))}
                  </details>
                ))}
              </div>
            ))}
          </section>
          <section aria-labelledby="help-about" className="settings-section">
            <h2 id="help-about">Nosotros</h2>
            <div className="help-about">
              <p>Detrás de {APP_NAME} hay una persona en México.</p>
              <p>La idea es sencilla: tu música es tuya. Se queda en tu dispositivo, no hay anuncios, cookies ni analítica{supabaseConfigured ? ", y la cuenta es opcional: solo sirve para sincronizar tus playlists." : ", y no hay cuentas: no recogemos datos personales."}</p>
              <p>El código es público, bajo la licencia PolyForm Noncommercial 1.0.0, para que cualquiera pueda ver cómo funciona.</p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
