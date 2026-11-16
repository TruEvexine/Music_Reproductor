// Deriva de src/assets/landing/*.jpg las versiones AVIF que sirve la landing, a los anchos reales con que se muestran
// (390 y 780 en las de móvil; 390, 780 y 1440 en las de escritorio). El JPG original se queda como respaldo (<img src>).
// Uso: node scripts/avif-landing.mjs (requiere ffmpeg con libaom-av1). Repetir tras node scripts/gen-landing.mjs.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "src", "assets", "landing");
const widthsOf = (name) => (name.includes("escritorio") ? [390, 780, 1440] : [390, 780]);

for (const file of readdirSync(dir).filter((name) => name.endsWith(".jpg"))) {
  const name = file.replace(/\.jpg$/, "");
  for (const width of widthsOf(name)) {
    const out = join(dir, `${name}-${width}.avif`);
    const run = spawnSync(
      "ffmpeg",
      ["-y", "-v", "error", "-i", join(dir, file), "-vf", `scale=${width}:-2:flags=lanczos`, "-c:v", "libaom-av1", "-crf", "34", "-b:v", "0", "-cpu-used", "4", "-still-picture", "1", "-frames:v", "1", out],
      { encoding: "utf8" },
    );
    if (run.status !== 0) throw new Error(`ffmpeg falló con ${file} a ${width}px: ${run.stderr}`);
    console.log(`${name}-${width}.avif`);
  }
}
