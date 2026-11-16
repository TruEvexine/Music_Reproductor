// Mapa de teclas de los atajos como datos puros: qué acción corresponde a una tecla según dónde esté el foco.
// No toca el DOM (src/ui/useShortcuts.ts adapta el elemento enfocado a `FocusTarget`).

export type ShortcutAction =
  | "toggle"
  | "previous"
  | "next"
  | "seekBack"
  | "seekForward"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "shuffle"
  | "repeat"
  | "queue"
  | "help";

export interface KeyPress {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

/** Lo mínimo del elemento con foco que decide qué teclas son suyas. */
export interface FocusTarget {
  tag: string;
  type?: string;
  role?: string | null;
  editable?: boolean;
}

// Tipos de <input> en los que no se escribe texto.
const NOT_TEXT = ["button", "submit", "reset", "image", "checkbox", "radio", "range", "file", "color"];
// Roles que mueven la selección con las flechas.
const ARROW_ROLES = ["slider", "radio", "tab", "menuitem", "menuitemradio", "menuitemcheckbox", "option", "spinbutton"];
// Roles que se activan con Espacio.
const PRESS_ROLES = ["button", "link", "switch", "checkbox", "radio", "tab", "menuitem", "menuitemradio", "menuitemcheckbox", "option"];

/**
 * ¿La tecla ya significa algo para el elemento enfocado? Si sí, el atajo se aparta (nunca hay doble acción):
 * campos de texto, todo; deslizadores y grupos de opciones, las flechas; botones y enlaces, Espacio.
 */
export function ownsKey(target: FocusTarget, key: string): boolean {
  const isText = target.editable || target.tag === "TEXTAREA" || target.tag === "SELECT" || (target.tag === "INPUT" && !NOT_TEXT.includes(target.type ?? "text"));
  if (isText) return true;
  if (key.startsWith("Arrow")) return target.type === "range" || target.type === "radio" || ARROW_ROLES.includes(target.role ?? "");
  if (key === " ") return ["BUTTON", "A", "SUMMARY"].includes(target.tag) || (target.tag === "INPUT" && target.type !== "range") || PRESS_ROLES.includes(target.role ?? "");
  return false;
}

// Mantener pulsada la tecla repite el evento: solo tiene sentido para lo continuo (buscar, volumen), no para cambiar de canción ni alternar.
const REPEATABLE: readonly ShortcutAction[] = ["seekBack", "seekForward", "volumeUp", "volumeDown"];

/** Lista de la hoja de ayuda. `Mayús` con las flechas busca ∓5 s; solas, cambian de canción. */
export interface ShortcutInfo {
  action: ShortcutAction;
  label: string;
  /** Teclas tal como se muestran en la hoja de ayuda. */
  keys: string[];
  /** La pulsación que lo dispara (la prueba comprueba que ayuda y mapa no discrepan). */
  press: { key: string; shiftKey?: boolean };
}

export const SHORTCUTS: readonly ShortcutInfo[] = [
  { action: "toggle", label: "Reproducir o pausar", keys: ["Espacio"], press: { key: " " } },
  { action: "previous", label: "Canción anterior", keys: ["←"], press: { key: "ArrowLeft" } },
  { action: "next", label: "Canción siguiente", keys: ["→"], press: { key: "ArrowRight" } },
  { action: "seekBack", label: "Retroceder 5 s", keys: ["Mayús", "←"], press: { key: "ArrowLeft", shiftKey: true } },
  { action: "seekForward", label: "Avanzar 5 s", keys: ["Mayús", "→"], press: { key: "ArrowRight", shiftKey: true } },
  { action: "shuffle", label: "Aleatorio", keys: ["X"], press: { key: "x" } },
  { action: "repeat", label: "Repetir: desactivado → cola → canción", keys: ["P"], press: { key: "p" } },
  { action: "volumeUp", label: "Subir volumen", keys: ["↑"], press: { key: "ArrowUp" } },
  { action: "volumeDown", label: "Bajar volumen", keys: ["↓"], press: { key: "ArrowDown" } },
  { action: "mute", label: "Silenciar", keys: ["M"], press: { key: "m" } },
  { action: "queue", label: "Abrir o cerrar la cola", keys: ["Q"], press: { key: "q" } },
  { action: "help", label: "Mostrar esta ayuda", keys: ["?"], press: { key: "?" } },
];

function actionOf({ key, shiftKey }: KeyPress): ShortcutAction | null {
  switch (key) {
    case " ":
      return "toggle";
    case "ArrowLeft":
      return shiftKey ? "seekBack" : "previous";
    case "ArrowRight":
      return shiftKey ? "seekForward" : "next";
    case "ArrowUp":
      return "volumeUp";
    case "ArrowDown":
      return "volumeDown";
    case "x":
    case "X":
      return "shuffle";
    case "p":
    case "P":
      return "repeat";
    case "m":
    case "M":
      return "mute";
    case "q":
    case "Q":
      return "queue";
    case "?":
      return "help";
    default:
      return null;
  }
}

/** La acción de una pulsación, o null si no es un atajo o la tecla es del elemento enfocado. Ctrl, Alt y Meta nunca disparan. */
export function shortcutFor(event: KeyPress, target: FocusTarget): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const action = actionOf(event);
  if (!action || ownsKey(target, event.key)) return null;
  if (event.repeat && !REPEATABLE.includes(action)) return null;
  return action;
}
