import { ChevronDown } from "lucide-react";
import { faq } from "virtual:docs";
import { GESTURES } from "../core/gestures";
import { Inline } from "./Markdown";
import { icon } from "./parts";
import { openShortcutHelp, ShortcutsList } from "./ShortcutsHelp";

// Ayuda = cómo se usa. Atajos y gestos salen de los mismos datos que el código (core/shortcuts.ts, core/gestures.ts) y las preguntas de
// docs/producto/FAQ.md (vite.config.ts), así que ninguna se desfasa. «Sobre Satin» vive en Ajustes → Acerca de.
// En escritorio, dos columnas (styles/library.css): empezar y atajos | gestos y preguntas; en móvil los envoltorios no cuentan y queda una.
const steps: [title: string, text: string][] = [
  ["Añade tu música", "En Biblioteca, pulsa «Añadir» y elige una carpeta completa o canciones sueltas. En la computadora también puedes arrastrarlas a la ventana."],
  ["Toca una canción", "Empieza a sonar y la lista que estás viendo pasa a ser la cola."],
  ["Abre el reproductor", "Toca la canción que suena, abajo, para verla en grande. En su menú ≡ están el sonido, el ecualizador, el temporizador y el fondo."],
];

export function HelpView() {
  return (
    <section className="view settings help">
      <header className="view-header">
        <div>
          <h1>Ayuda</h1>
          <p className="subtitle">Cómo se usa: primeros pasos, atajos, gestos y preguntas frecuentes.</p>
        </div>
      </header>
      <div className="help-columns">
        <div className="help-col">
          <section aria-labelledby="help-start" className="settings-section">
            <h2 id="help-start">Empezar</h2>
            <ol className="help-list">
              {steps.map(([title, text]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="help-keys" className="settings-section">
            <h2 id="help-keys">Atajos de teclado</h2>
            <ShortcutsList />
            <p className="hint">Se pueden apagar en Ajustes → Accesibilidad. Con «?» se abre esta lista desde cualquier sitio.</p>
            <button className="link" onClick={openShortcutHelp} type="button">
              Abrir la lista aparte
            </button>
          </section>
        </div>
        <div className="help-col">
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
          <section aria-labelledby="help-faq" className="settings-section">
            <h2 id="help-faq">Preguntas frecuentes</h2>
            <div className="help-group">
              {faq
                .flatMap((group) => group.items)
                .map(({ question, answer }) => (
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
          </section>
        </div>
      </div>
    </section>
  );
}
