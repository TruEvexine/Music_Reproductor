import { describe, expect, it } from "vitest";
import { cycleRepeat, emptyQueue } from "./queue";
import { SHORTCUTS, shortcutFor } from "./shortcuts";
import type { FocusTarget, KeyPress } from "./shortcuts";

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra });
const body: FocusTarget = { tag: "BODY" };
const text: FocusTarget = { tag: "INPUT", type: "text" };
const search: FocusTarget = { tag: "INPUT" }; // sin type = texto
const slider: FocusTarget = { tag: "INPUT", type: "range" };
const button: FocusTarget = { tag: "BUTTON" };
const link: FocusTarget = { tag: "A" };
const switchRole: FocusTarget = { tag: "DIV", role: "switch" };

describe("mapa de teclas", () => {
  it("cada atajo de la ayuda dispara su acción (ayuda y mapa no discrepan)", () => {
    for (const { action, press: p } of SHORTCUTS) expect(shortcutFor(press(p.key, { shiftKey: p.shiftKey ?? false }), body)).toBe(action);
    expect(new Set(SHORTCUTS.map((item) => item.action)).size).toBe(SHORTCUTS.length);
  });

  it("Espacio alterna, ←/→ cambian de canción, X aleatorio y P repetición (mayúsculas incluidas)", () => {
    expect([" ", "ArrowLeft", "ArrowRight", "x", "X", "p", "P"].map((key) => shortcutFor(press(key), body))).toEqual(["toggle", "previous", "next", "shuffle", "shuffle", "repeat", "repeat"]);
  });

  it("con Ctrl, Alt o Meta no se dispara nada (Ctrl+P imprime, Alt+← es «atrás»)", () => {
    for (const mod of ["ctrlKey", "altKey", "metaKey"] as const) for (const key of [" ", "ArrowLeft", "x", "p", "?"]) expect(shortcutFor(press(key, { [mod]: true }), body)).toBeNull();
  });

  it("en un campo de texto no se dispara ninguno (ni siquiera Espacio, X o P)", () => {
    for (const target of [text, search, { tag: "TEXTAREA" }, { tag: "SELECT" }, { tag: "DIV", editable: true }, { tag: "INPUT", type: "email" }]) {
      for (const key of [" ", "ArrowLeft", "x", "p", "?", "m"]) expect(shortcutFor(press(key), target)).toBeNull();
    }
  });

  it("en un deslizador las flechas son suyas; lo demás sigue funcionando", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) expect(shortcutFor(press(key), slider)).toBeNull();
    expect(shortcutFor(press("ArrowLeft", { shiftKey: true }), slider)).toBeNull();
    expect(shortcutFor(press("ArrowLeft"), { tag: "DIV", role: "slider" })).toBeNull();
    expect(shortcutFor(press("x"), slider)).toBe("shuffle");
  });

  it("en un botón, enlace o interruptor Espacio lo activa a él: no alterna además la reproducción", () => {
    for (const target of [button, link, switchRole, { tag: "INPUT", type: "checkbox" }, { tag: "SUMMARY" }]) expect(shortcutFor(press(" "), target)).toBeNull();
    expect(shortcutFor(press("ArrowRight"), button)).toBe("next"); // un botón no usa las flechas
    expect(shortcutFor(press("p"), link)).toBe("repeat");
  });

  it("los grupos de opciones conservan sus flechas", () => {
    expect(shortcutFor(press("ArrowRight"), { tag: "INPUT", type: "radio" })).toBeNull();
    expect(shortcutFor(press("ArrowLeft"), { tag: "BUTTON", role: "tab" })).toBeNull();
  });

  it("mantener pulsada la tecla solo repite lo continuo", () => {
    expect(shortcutFor(press(" ", { repeat: true }), body)).toBeNull();
    expect(shortcutFor(press("ArrowRight", { repeat: true }), body)).toBeNull();
    expect(shortcutFor(press("x", { repeat: true }), body)).toBeNull();
    expect(shortcutFor(press("ArrowRight", { shiftKey: true, repeat: true }), body)).toBe("seekForward");
    expect(shortcutFor(press("ArrowUp", { repeat: true }), body)).toBe("volumeUp");
  });

  it("teclas que no son atajos no hacen nada", () => {
    expect(["Enter", "a", "Tab", "Escape", "s", "r"].map((key) => shortcutFor(press(key), body))).toEqual([null, null, null, null, null, null]);
  });
});

describe("repetición con P", () => {
  it("cicla desactivado → cola → canción → desactivado (la semántica del núcleo)", () => {
    const modes = [emptyQueue];
    for (let i = 0; i < 3; i++) modes.push(cycleRepeat(modes[i]));
    expect(modes.map((state) => state.repeat)).toEqual(["off", "queue", "track", "off"]);
  });
});
