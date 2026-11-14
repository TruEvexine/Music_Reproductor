import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_DESCRIPTOR, APP_NAME } from "./brand";

describe("nombre del producto", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

  it("index.html (que no puede importar brand.ts) usa el mismo nombre y descriptor", () => {
    expect(html).toContain(`<title>${APP_NAME} — ${APP_DESCRIPTOR}</title>`);
    expect(html).toContain(`content="${APP_NAME}, ${APP_DESCRIPTOR} para`);
    expect(html).toContain(`aria-label="Cargando ${APP_NAME}"`);
  });
});
