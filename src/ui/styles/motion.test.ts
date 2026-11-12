import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guardas del sistema de movimiento (DESIGN.md §3): el CSS no puede salirse del conjunto de duraciones, curvas y propiedades.
const dir = import.meta.dirname;
const sheets = readdirSync(dir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({ name, css: readFileSync(join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }));
const rest = sheets.filter(({ name }) => name !== "tokens.css");

const declarations = (property: RegExp) =>
  rest.flatMap(({ name, css }) => [...css.matchAll(new RegExp(String.raw`(?:^|[\s;{])(${property.source})\s*:\s*([^;}]+)`, "g"))].map((match) => ({ name, property: match[1], value: match[2].trim() })));

describe("movimiento", () => {
  it("las transiciones solo animan transform y opacity", () => {
    const transitions = declarations(/transition(?:-property)?/);
    expect(transitions.length).toBeGreaterThan(0);
    for (const { name, value } of transitions) {
      const properties = value.split(",").map((part) => part.trim().split(/\s+/)[0]).filter((word) => !/^(var|calc|\d)/.test(word) && word !== "none");
      for (const word of properties) expect(["transform", "opacity"], `${name}: ${value}`).toContain(word);
    }
  });

  it("los @keyframes solo mueven transform y opacity", () => {
    for (const { name, css } of rest) {
      for (const [, id, body] of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)) {
        const used = [...body.matchAll(/([\w-]+)\s*:/g)].map((match) => match[1]);
        for (const property of used) expect(["transform", "opacity"], `${name} @keyframes ${id}`).toContain(property);
      }
    }
  });

  it("toda duración sale de un token (--fast, --base, --slow, --exit, --page); solo el escalonado de la landing usa ms sueltos", () => {
    for (const { name, property, value } of declarations(/animation|transition|animation-duration|transition-duration|animation-delay|transition-delay/)) {
      if (/^(animation|transition)-delay$/.test(property)) continue;
      if (name === "base.css" && /0\.01ms !important/.test(value)) continue; // la regla de movimiento reducido
      expect(value, `${name} ${property}`).not.toMatch(/\d(ms|s)\b/);
    }
  });

  it("toda animación o transición usa una de las dos curvas", () => {
    for (const { name, property, value } of declarations(/animation|transition/)) {
      if (value === "none" || /!important/.test(value)) continue;
      expect(value, `${name} ${property}`).toMatch(/var\(--ease(-move)?\)/);
    }
  });

  it("todo :hover está dentro de @media (hover: hover): nada depende del puntero en táctil", () => {
    for (const { name, css } of rest) {
      for (const match of css.matchAll(/:hover/g)) {
        const before = css.slice(0, match.index);
        const open = before.lastIndexOf("@media (hover: hover)");
        expect(open, `${name}: :hover fuera de @media (hover: hover)`).toBeGreaterThanOrEqual(0);
        const between = before.slice(open);
        const opens = (between.match(/\{/g) ?? []).length;
        const closes = (between.match(/\}/g) ?? []).length;
        expect(opens - closes, `${name}: :hover fuera de @media (hover: hover)`).toBeGreaterThan(0);
      }
    }
  });

  it("existe la regla global de prefers-reduced-motion y entradas y salidas comparten keyframes", () => {
    const base = sheets.find(({ name }) => name === "base.css")!.css;
    expect(base).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\*[^}]*\{[^}]*animation-duration: 0\.01ms !important;[^}]*transition-duration: 0\.01ms !important/s);
    for (const keyframes of ["enter-sheet", "enter-pop", "enter-rise", "enter-fade", "exit-sheet", "exit-pop", "exit-fade"]) expect(base).toContain(`@keyframes ${keyframes}`);
  });

  it("los tokens de movimiento existen", () => {
    const tokens = sheets.find(({ name }) => name === "tokens.css")!.css;
    for (const token of ["--fast", "--base", "--slow", "--exit", "--page", "--ease", "--ease-move", "--press", "--press-wide"]) expect(tokens).toContain(`${token}:`);
    expect(Number(tokens.match(/--press:\s*([\d.]+)/)![1])).toBeGreaterThanOrEqual(0.95); // por debajo se siente exagerado
    expect(parseInt(tokens.match(/--exit:\s*(\d+)ms/)![1])).toBeLessThan(parseInt(tokens.match(/--base:\s*(\d+)ms/)![1]));
  });
});
