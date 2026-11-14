import { describe, expect, it } from "vitest";
import { inlineParts, parseBlocks } from "./markdown";

describe("parseBlocks", () => {
  it("separa párrafos, listas y tablas, y une las líneas de un mismo párrafo", () => {
    const blocks = parseBlocks("**Título**\n\nUna frase\nen dos líneas.\n\n- uno\n- dos\n\nTexto:\n- tres\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
    expect(blocks).toEqual([
      { type: "p", text: "**Título**" },
      { type: "p", text: "Una frase en dos líneas." },
      { type: "ul", items: ["uno", "dos"] },
      { type: "p", text: "Texto:" },
      { type: "ul", items: ["tres"] },
      { type: "table", head: ["A", "B"], rows: [["1", "2"], ["3", "4"]] },
    ]);
  });
});

describe("inlineParts", () => {
  it("marca la negrita y el código sin dejar los asteriscos ni las comillas", () => {
    expect(inlineParts("Ve a **Ajustes** y pulsa `Q` ya.")).toEqual([{ text: "Ve a " }, { text: "Ajustes", kind: "strong" }, { text: " y pulsa " }, { text: "Q", kind: "code" }, { text: " ya." }]);
  });
});
