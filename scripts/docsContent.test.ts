import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "../src/core/shortcuts";
import { fillMarkers, findMarkers, forAccounts, parseFaq, parseLegal, stripNotes, unfilledMarkers } from "./docsContent";

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

  it("los documentos solo usan los marcadores que el build sabe completar", () => {
    const used = findMarkers(read("FAQ.md") + parseLegalAll());
    expect(used.sort()).toEqual(["{{CORREO_PRIVACIDAD}}", "{{DOMICILIO}}", "{{FECHA_ACTUALIZACION}}", "{{NOMBRE_APP}}", "{{RESPONSABLE}}", "{{URL_APP}}"]);
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

describe("textos legales publicados", () => {
  it("no llevan datos pendientes entre corchetes que el build no detectaría: nombre, fecha y URL son marcadores", () => {
    expect(Object.values(parseLegal(read("LEGAL_BORRADORES.md"))).join("\n")).not.toMatch(/\[(Nombre de la app|fecha|URL|ciudad)\]/);
  });
});

describe("FAQ de atajos", () => {
  it("nombra exactamente las teclas de SHORTCUTS: si el mapa cambia y la FAQ no, falla", () => {
    const answer = questionsOf("FAQ.md").find(({ question }) => question.includes("atajos"))?.answer.join(" ") ?? "";
    // «**Mayús + ← / →**» → «Mayús + ←», «Mayús + →»
    const inFaq = [...answer.matchAll(/\*\*([^*]+)\*\*/g)].flatMap(([, keys]) => {
      const parts = keys.split(" + ");
      const last = parts.pop() ?? "";
      return last.split(" / ").map((key) => [...parts, key].join(" + "));
    });
    expect(inFaq.sort()).toEqual(SHORTCUTS.map(({ keys }) => keys.join(" + ")).sort());
  });
});

function questionsOf(name: string) {
  return parseFaq(read(name)).flatMap((group) => group.items);
}

describe("forAccounts", () => {
  const doc = [
    "Siempre.",
    "<!-- cuentas -->",
    "Con cuenta.",
    "<!-- /cuentas -->",
    "<!-- sin cuentas -->",
    "Sin cuenta.",
    "<!-- /sin cuentas -->",
    "> Cita.",
    "> <!-- cuentas -->",
    "> Cita con cuenta.",
    "> <!-- /cuentas -->",
    "> Fin.",
    "",
  ].join("\r\n");
  it("sin cuentas quita los bloques de cuentas y los marcadores", () => {
    expect(forAccounts(doc, false)).toBe(["Siempre.", "Sin cuenta.", "> Cita.", "> Fin.", ""].join("\r\n"));
  });
  it("con cuentas quita los bloques sin cuentas y los marcadores", () => {
    expect(forAccounts(doc, true)).toBe(["Siempre.", "Con cuenta.", "> Cita.", "> Cita con cuenta.", "> Fin.", ""].join("\r\n"));
  });
});

describe("FAQ y borradores en los dos estados de cuentas", () => {
  const publish = (enabled: boolean) => {
    const faq = parseFaq(forAccounts(read("FAQ.md"), enabled));
    const legal = parseLegal(forAccounts(read("LEGAL_BORRADORES.md"), enabled));
    return { faq: JSON.stringify(faq), questions: faq.flatMap((group) => group.items.map((item) => item.question)), legal: Object.values(legal).join("\n") };
  };
  it("no publica ningún marcador", () => {
    for (const enabled of [true, false]) {
      const { faq, legal } = publish(enabled);
      expect(faq + legal).not.toMatch(/<!--|-->/);
    }
  });
  it("sin cuentas no habla de registro, sesión ni datos de la cuenta", () => {
    const { questions, legal, faq } = publish(false);
    expect(questions).not.toContain("Olvidé mi contraseña.");
    expect(questions).not.toContain("Si creo una cuenta, ¿qué se guarda en ella?");
    expect(legal).not.toMatch(/Si creas una cuenta|Supabase|Tu sesión/);
    expect(legal).toMatch(/no tiene cuentas/);
    expect(faq).toMatch(/sin dar ningún dato personal/);
  });
  it("con cuentas mantiene lo de la cuenta", () => {
    const { questions, legal } = publish(true);
    expect(questions).toContain("Olvidé mi contraseña.");
    expect(legal).toMatch(/Si creas una cuenta/);
    expect(legal).not.toMatch(/no tiene cuentas/);
  });
});
