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

describe("manifest de la PWA", () => {
  const at = (path: string) => new URL(`../../${path}`, import.meta.url);
  const manifest = JSON.parse(readFileSync(at("public/manifest.webmanifest"), "utf8"));
  const html = readFileSync(at("index.html"), "utf8");
  // DESIGN.md: --bg = oklch(0.145 0.004 70) = #0b0a08 (el mismo valor que el theme-color de index.html).
  const bg = /<meta name="theme-color" content="(#[0-9a-f]{6})"/.exec(html)?.[1];

  it("lleva el nombre, el modo y los colores del sistema de diseño", () => {
    expect(manifest).toMatchObject({ name: APP_NAME, short_name: APP_NAME, display: "standalone", start_url: "/app", scope: "/", theme_color: bg, background_color: bg });
    expect(bg).toBe("#0b0a08");
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it("sus iconos existen, miden lo que dicen y son copia de los de docs/marca", () => {
    const purposes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(purposes).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const png = readFileSync(at(`public/${icon.src}`));
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes); // IHDR: ancho y alto
      const name = icon.src.split("/").pop();
      expect(png.equals(readFileSync(at(`docs/marca/logo/iconos/${name}`)))).toBe(true);
    }
  });
});
