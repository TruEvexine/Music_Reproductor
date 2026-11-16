import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
  return Object.values(parseLegal(read("LEGAL_BORRADORES.md"), read("TERMINOS.md"))).join("\n");
}

describe("FAQ.md", () => {
  const faq = parseFaq(read("FAQ.md"));
  const questions = faq.flatMap((group) => group.items);

  it("publica un solo grupo y no la sección de lo que se quitó ni los riesgos", () => {
    expect(faq.map((group) => group.group)).toEqual(["Preguntas frecuentes"]);
  });

  it("cada pregunta tiene respuesta y ninguna lleva la línea de mantenimiento", () => {
    for (const { question, answer } of questions) {
      expect(answer.length, question).toBeGreaterThan(0);
      expect(answer.join(" "), question).not.toContain("Comprobado en");
    }
  });
});

describe("LEGAL_BORRADORES.md y TERMINOS.md", () => {
  const legal = parseLegal(read("LEGAL_BORRADORES.md"), read("TERMINOS.md"));

  it("extrae aviso, términos y almacenamiento sin notas internas", () => {
    for (const [name, text] of Object.entries(legal)) {
      expect(text.length, name).toBeGreaterThan(500);
      expect(text, name).not.toMatch(/Decides tú|\[Abogado\]/);
    }
    expect(legal.aviso).toContain("{{RESPONSABLE}}");
    expect(legal.terminos).toMatch(/^\*\*Términos de uso de \{\{NOMBRE_APP\}\}\*\*/);
    expect(legal.terminos).toContain("**18. Contacto.**");
    expect(legal.terminos).not.toContain("Por qué cada cláusula"); // la tabla de fundamentos es interna
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
    expect(parseLegalAll()).not.toMatch(/\[(Nombre de la app|fecha|URL|ciudad)\]/);
  });
});

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
    const legal = parseLegal(forAccounts(read("LEGAL_BORRADORES.md"), enabled), forAccounts(read("TERMINOS.md"), enabled));
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
    expect(legal).not.toMatch(/Si creas una cuenta|Supabase|Tu sesión|contra-aviso|Datos de tu cuenta|desde el correo de la cuenta/);
    expect(legal).toMatch(/no tiene cuentas/);
    expect(faq).toMatch(/sin dar ningún dato personal/);
  });
  it("con cuentas mantiene lo de la cuenta", () => {
    const { faq, legal } = publish(true);
    expect(faq).toMatch(/tu cuenta solo guarda tus playlists/);
    expect(legal).toMatch(/Si creas una cuenta/);
    expect(legal).not.toMatch(/no tiene cuentas/);
  });
});

// La FAQ es para quien usa la app: nada de tecnologías, pruebas, versiones ni cómo se comprobó algo (eso va en «Comprobado en»).
const FORBIDDEN = /IndexedDB|\bCSP\b|PKCE|Supabase|AVIF|OPFS|Web Audio|Media Session|ReplayGain|WebKit|Vercel|JSON|SHA-?256|\bhash|worker|\bbuild|compil|prueba|prob(?:ad|am|é|ó)|versi[oó]n|c[oó]digo|servidor/i;

describe("FAQ para personas, en los dos estados de cuentas", () => {
  for (const enabled of [true, false]) {
    const items = parseFaq(forAccounts(read("FAQ.md"), enabled)).flatMap((group) => group.items);
    it(`${enabled ? "con" : "sin"} cuentas: de 1 a 10 preguntas`, () => {
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(10);
    });
    it(`${enabled ? "con" : "sin"} cuentas: ninguna pregunta ni respuesta lleva una palabra prohibida`, () => {
      for (const { question, answer } of items) expect(`${question} ${answer.join(" ")}`, question).not.toMatch(FORBIDDEN);
    });
    it(`${enabled ? "con" : "sin"} cuentas: cada respuesta tiene de 1 a 3 frases`, () => {
      for (const { question, answer } of items) {
        const sentences = answer.join(" ").match(/[.?!](?=\s|$)/g)?.length ?? 0;
        expect(sentences, question).toBeGreaterThanOrEqual(1);
        expect(sentences, question).toBeLessThanOrEqual(3);
      }
    });
  }
  it("la lista de prohibidas detecta lo que debe", () => {
    for (const text of ["Se guarda en IndexedDB", "la CSP lo impide", "un build nuevo", "Lo probamos en Safari", "En esta versión", "con pruebas"]) expect(text).toMatch(FORBIDDEN);
    for (const text of ["Sube o baja los graves", "AMOLED (negro puro)", "en Chrome y Edge"]) expect(text).not.toMatch(FORBIDDEN);
  });
});

// Avisos de terceros (scripts/licencias.mjs): si se añade una dependencia de producción sin regenerar la lista, falla.
describe("licencias de terceros", () => {
  it("el resumen nombra cada dependencia de producción de package.json", () => {
    const list = read("LICENCIAS_TERCEROS.md");
    const deps = Object.keys(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).dependencies);
    for (const name of deps) expect(list, name).toContain(`| \`${name}\` |`);
  });
});
