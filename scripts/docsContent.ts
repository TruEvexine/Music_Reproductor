// Contenido de la app que sale de docs/producto (FAQ.md y LEGAL_BORRADORES.md), para que ayuda y páginas legales no se desfasen del documento.
// Puro y sin DOM: vite.config.ts lo usa en el módulo virtual `virtual:docs` y scripts/docsContent.test.ts lo comprueba.

export interface FaqGroup {
  group: string;
  items: { question: string; answer: string[] }[];
}

/** `{{NOMBRE}}`: dato personal que se completa al publicar, nunca en el repositorio. */
const MARKER = /\{\{[A-Z_]+\}\}/g;

/** Marcadores sin sustituir en un texto (los del build de producción no pueden quedar). */
export function findMarkers(text: string): string[] {
  return [...new Set(text.match(MARKER) ?? [])];
}

/** Marcadores sin sustituir en los archivos de un build (`ruta → texto`), como «ruta: {{X}}». Vacío si el build está listo para publicarse. */
export function unfilledMarkers(files: Record<string, string>): string[] {
  return Object.entries(files).flatMap(([name, text]) => findMarkers(text).map((marker) => `${name}: ${marker}`));
}

/** Sustituye `{{X}}` por `values.X` cuando existe y no está vacío; si no, lo deja como está (el build de producción lo rechaza). */
export function fillMarkers(text: string, values: Record<string, string | undefined>): string {
  return text.replace(MARKER, (marker) => values[marker.slice(2, -2)]?.trim() || marker);
}

/**
 * Texto que depende de si el build trae cuentas (VITE_CUENTAS=1): `<!-- cuentas -->…<!-- /cuentas -->` solo con cuentas y
 * `<!-- sin cuentas -->…<!-- /sin cuentas -->` solo sin ellas. Cada marcador va en su propia línea (también dentro de una cita, `> <!-- … -->`).
 */
export function forAccounts(markdown: string, enabled: boolean): string {
  const marker = (name: string) => `^(?:> ?)?<!-- ${name} -->[ \\t]*\\r?\\n`;
  const drop = enabled ? "sin cuentas" : "cuentas";
  return markdown
    .replace(new RegExp(`${marker(drop)}[\\s\\S]*?${marker(`/${drop}`)}`, "gm"), "")
    .replace(new RegExp(marker("/?(?:sin )?cuentas"), "gm"), "");
}

/** Preguntas de FAQ.md por grupo (`##`) y pregunta (`###`). La línea «Comprobado en:» es de mantenimiento y no se publica. */
export function parseFaq(markdown: string): FaqGroup[] {
  const groups: FaqGroup[] = [];
  let question: FaqGroup["items"][number] | undefined;
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (question && text && !text.startsWith("Comprobado en:")) question.answer.push(text);
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      flush();
      question = undefined;
      groups.push({ group: line.slice(3).trim(), items: [] });
    } else if (line.startsWith("### ") && groups.length > 0) {
      flush();
      question = { question: line.slice(4).trim(), answer: [] };
      groups[groups.length - 1].items.push(question);
    } else if (line.trim() === "---" || line.trim() === "") flush();
    else paragraph.push(line.trim());
  }
  flush();
  return groups.filter((group) => group.items.length > 0);
}

/** Las notas internas del borrador («[Decides tú]», «[Abogado]») llegan hasta el final de su párrafo y no se publican. */
export function stripNotes(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.replace(/\*\*\[(Decides tú|Abogado)\]\*\*[\s\S]*$/, "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Texto citado (`>`) bajo el encabezado que cumple `heading`, hasta el siguiente encabezado o separador, sin las notas internas. */
export function legalSection(markdown: string, heading: RegExp): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && heading.test(line));
  if (start < 0) return "";
  const quoted: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3} /.test(line) || line.trim() === "---") break;
    if (line.startsWith(">")) quoted.push(line.replace(/^>\s?/, ""));
  }
  return stripNotes(quoted.join("\n"));
}

export interface LegalDocs {
  aviso: string;
  terminos: string;
  almacenamiento: string;
}

export function parseLegal(markdown: string): LegalDocs {
  return {
    aviso: legalSection(markdown, /^### 3\.1 /),
    terminos: legalSection(markdown, /^## 4\. /),
    almacenamiento: legalSection(markdown, /^## 5\. /),
  };
}
