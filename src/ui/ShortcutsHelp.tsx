import { Fragment } from "react";
import { create } from "zustand";
import { SHORTCUTS } from "../core/shortcuts";
import { background, useBackground } from "../state/background";
import { SwitchRow } from "./PlayerMenu";
import { Dialog } from "./parts";

// Hoja de ayuda con la lista de atajos. Se abre con «?» o desde Ajustes → Accesibilidad.
const useHelp = create<{ open: boolean }>(() => ({ open: false }));
export const openShortcutHelp = () => useHelp.setState({ open: true });

/** La lista de atajos, leída de `SHORTCUTS` (el mismo mapa que usa el teclado). La comparten esta hoja y Ayuda. */
export function ShortcutsList() {
  return (
    <dl className="shortcuts">
      {SHORTCUTS.map(({ action, label, keys }) => (
        <div key={action}>
          <dt>{label}</dt>
          <dd>
            {keys.map((key, index) => (
              <Fragment key={key}>
                {index > 0 && <span aria-hidden="true">+</span>}
                <kbd>{key}</kbd>
              </Fragment>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsHelp() {
  const open = useHelp((state) => state.open);
  const enabled = useBackground((state) => state.shortcuts);
  if (!open) return null;
  return (
    <Dialog onClose={() => useHelp.setState({ open: false })} title="Atajos de teclado">
      <ShortcutsList />
      <section className="menu-group">
        <SwitchRow checked={enabled} label="Atajos de teclado" onChange={(shortcuts) => background.set({ shortcuts })} />
        <p className="hint">No actúan al escribir; un deslizador, botón o enlace enfocado conserva sus propias teclas.</p>
      </section>
    </Dialog>
  );
}
