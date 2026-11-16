// Carpeta de salida de las pruebas que regeneran PNG: temporal por defecto; docs/capturas solo con --actualizar.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const docs = resolve(import.meta.dirname, "..", "docs", "capturas");

export function carpetaCapturas(explicita, nombre) {
  const actualizar = process.argv.includes("--actualizar");
  const dir = explicita ? resolve(explicita) : actualizar ? docs : mkdtempSync(join(tmpdir(), `${nombre}-`));
  if (dir === docs && !actualizar) throw new Error("docs/capturas solo se actualiza con --actualizar.");
  mkdirSync(dir, { recursive: true });
  console.log(`Capturas en ${dir}`);
  return dir;
}
