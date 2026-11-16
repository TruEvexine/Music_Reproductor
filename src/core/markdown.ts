// Markdown mínimo de los textos de docs/producto (FAQ y borradores legales): párrafos, listas con «- » y tablas. Puro y sin DOM;
// src/ui/Markdown.tsx lo pinta como elementos de React (nunca como HTML) y los inline `**negrita**` y `código` los trocea `inlineParts`.

export type Block = { type: "p"; text: string } | { type: "ul"; items: string[] } | { type: "table"; head: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let open: Block | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) {
      open = undefined;
    } else if (open?.type === "ul" && /^\s+\S/.test(line) && !text.startsWith("- ")) {
      open.items[open.items.length - 1] += ` ${text}`; // línea sangrada: sigue el elemento anterior de la lista
    } else if (text.startsWith("- ")) {
      if (open?.type !== "ul") blocks.push((open = { type: "ul", items: [] }));
      open.items.push(text.slice(2));
    } else if (text.startsWith("|")) {
      if (open?.type !== "table") blocks.push((open = { type: "table", head: cells(text), rows: [] }));
      else if (!/^[\s|:-]+$/.test(text)) open.rows.push(cells(text));
    } else if (open?.type === "p") {
      open.text += ` ${text}`;
    } else {
      blocks.push((open = { type: "p", text }));
    }
  }
  return blocks;
}

/** Trozos de una línea: los de índice impar son `**negrita**` o `código` (con sus marcas ya quitadas y su tipo). */
export function inlineParts(text: string): { text: string; kind?: "strong" | "code" }[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .map((part, index) => (index % 2 === 0 ? { text: part } : part.startsWith("**") ? { text: part.slice(2, -2), kind: "strong" as const } : { text: part.slice(1, -1), kind: "code" as const }))
    .filter((part) => part.text);
}
