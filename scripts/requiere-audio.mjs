// Importar al inicio de las pruebas que usan tests/fixtures/audio: falla claro si no se generó (el audio nunca se versiona).
import { existsSync } from "node:fs";
import { join } from "node:path";

if (!existsSync(join(import.meta.dirname, "..", "tests", "fixtures", "audio", "01-amanecer.flac"))) {
  console.error("Falta el audio sintético de tests/fixtures/audio: ejecuta npm run test:audio (necesita ffmpeg).");
  process.exit(1);
}
