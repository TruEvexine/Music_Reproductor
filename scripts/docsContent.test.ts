import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillMarkers, findMarkers, parseFaq, parseLegal, stripNotes, unfilledMarkers } from "./docsContent";

const read = (name: string) => readFileSync(new URL(`../docs/producto/${name}`, import.meta.url), "utf8");

describe("marcadores", () => {
  it("encuentra los {{X}} y los sustituye solo con valores no vacíos", () => {
    const text = "Escribe a {{CORREO_PRIVACIDAD}}. Responsable: {{RESPONSABLE}} ({{RESPONSABLE}}).";
    expect(findMarkers(text)).toEqual(["{{CORREO_PRIVACIDAD}}", "{{RESPONSABLE}}"]);
    const filled = fillMarkers(text, { CORREO_PRIVACIDAD: "a@b.c", RESPONSABLE: "  " });
    expect(filled).toBe("Escribe a a@b.c. Responsable: {{RESPONSABLE}} ({{RESPONSABLE}}).");
    expect(findMarkers(filled)).toEqual(["{{RESPONSABLE}}"]);
  });

  it("no confunde código con marcadores", () => {
    expect(findMarkers("const a={b:{c:1}};`${x}` {{minuscula}} {}")).toEqual([]);
  });
});

describe("comprobación de build", () => {
  it("lista cada marcador sin sustituir con su archivo, y nada si el build está completo", () => {
    expect(unfilledMarkers({ "assets/a.js": 'x="{{RESPONSABLE}} {{DOMICILIO}}"', "index.html": "<p>{{RESPONSABLE}}</p>", "assets/b.css": "a{b:c}" })).toEqual([
      "assets/a.js: {{RESPONSABLE}}",
      "assets/a.js: {{DOMICILIO}}",
      "index.html: {{RESPONSABLE}}",
    ]);
    expect(unfilledMarkers({ "assets/a.js": 'x="Ana, Calle 1"' })).toEqual([]);
  });

  it("los documentos solo usan los tres marcadores que el build sabe completar", () => {
    const used = findMarkers(read("FAQ.md") + parseLegalAll());
    expect(used.sort()).toEqual(["{{CORREO_PRIVACIDAD}}", "{{DOMICILIO}}", "{{RESPONSABLE}}"]);
  });
});

function parseLegalAll() {
  return Object.values(parseLegal(read("LEGAL_BORRADORES.md"))).join("\n");
}

describe("FAQ.md", () => {
  const faq = parseFaq(read("FAQ.md"));
  const questions = faq.flatMap((group) => group.items);

  it("publica los grupos con preguntas y no la sección de lo que queda fuera ni los riesgos", () => {
    expect(faq.map((group) => group.group)).toEqual(["Tu música y tus datos", "Añadir música", "Reproducción y sonido", "La app"]);
    expect(questions.length).toBeGreaterThanOrEqual(20);
  });

  it("cada pregunta tiene respuesta y ninguna lleva la línea de mantenimiento", () => {
    for (const { question, answer } of questions) {
      expect(answer.length, question).toBeGreaterThan(0);
      expect(answer.join(" "), question).not.toContain("Comprobado en");
    }
  });
});

describe("LEGAL_BORRADORES.md", () => {
  const legal = parseLegal(read("LEGAL_BORRADORES.md"));

  it("extrae aviso, términos y almacenamiento sin notas internas", () => {
    for (const [name, text] of Object.entries(legal)) {
      expect(text.length, name).toBeGreaterThan(500);
      expect(text, name).not.toMatch(/Decides tú|\[Abogado\]/);
    }
    expect(legal.aviso).toContain("{{RESPONSABLE}}");
    expect(legal.terminos).toContain("**10. Contacto.**");
    expect(legal.almacenamiento).toContain("| Qué | Para qué | Cómo borrarlo |");
  });

  it("la nota se corta al final de su párrafo y conserva el resto", () => {
    expect(stripNotes("Texto uno.\n\nPlazo de [30] días. **[Decides tú]** el plazo;\nmás nota. **[Abogado]** otra.\n\nTexto dos.")).toBe(
      "Texto uno.\n\nPlazo de [30] días.\n\nTexto dos.",
    );
  });
});
