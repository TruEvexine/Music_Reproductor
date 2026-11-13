// Mide la actividad de las luces del modo Ritmo con audio real, sin navegador (docs/LUCES_REACTIVAS.md §5).
// Uso: node scripts/medir-luces.ts [--antes <ref-git>] [--desde <s>] [--segundos <s>] [--sensibilidad auto|low|high] <audio>...
// Decodifica cada archivo con ffmpeg (mono, 44,1 kHz), lo pasa por el analizador simulado y por core/rhythm.ts, y escribe las cifras.
// --antes carga core/rhythm.ts de esa revisión para comparar. El audio nunca sale de tu equipo ni se versiona.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createAnalyserSim, fromSamples, lightMetrics, SIM_FFT, SIM_RATE } from "../src/core/rhythm.sim.ts";
import type { LightFrame } from "../src/core/rhythm.sim.ts";

const argv = process.argv.slice(2);
const option = (name: string) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv.splice(at, 2)[1] : undefined;
};
const ref = option("--antes");
const from = Number(option("--desde") ?? 0);
const seconds = option("--segundos");
const sensitivity = option("--sensibilidad") ?? "auto";
if (argv.length === 0) {
  console.error("Uso: node scripts/medir-luces.ts [--antes <ref>] [--desde s] [--segundos s] [--sensibilidad auto|low|high] <audio>...");
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el módulo puede ser de otra versión, con otra forma
type Rhythm = any;
async function load(): Promise<Rhythm> {
  if (!ref) return import("../src/core/rhythm.ts");
  const file = join(mkdtempSync(join(tmpdir(), "luces-")), "rhythm.ts");
  writeFileSync(file, execFileSync("git", ["show", `${ref}:src/core/rhythm.ts`]));
  return import(pathToFileURL(file).href);
}

function decode(path: string): Float32Array {
  const cut = [...(from ? ["-ss", String(from)] : []), ...(seconds ? ["-t", seconds] : [])];
  const pcm = execFileSync("ffmpeg", ["-v", "error", ...cut, "-i", path, "-ac", "1", "-ar", String(SIM_RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
}

/** El bucle de `ui/Backdrop.tsx` a 60 fps: análisis → luz. Acepta la versión anterior (sin `createAnalysis`) y la actual. */
function drive(rhythm: Rhythm, samples: Float32Array): LightFrame[] {
  const legacy = !rhythm.createAnalysis;
  const analyser = legacy ? createAnalyserSim(0.4, -100, -30) : createAnalyserSim(0.4, rhythm.ANALYSER_DB.min, rhythm.ANALYSER_DB.max); // antes, el analizador iba de −100 a −30 dB
  const signal = fromSamples(samples);
  const light = rhythm.createLight();
  const analysis = legacy ? rhythm.createBeatDetector() : rhythm.createAnalysis();
  const dt = 1000 / 60;
  const frames: LightFrame[] = [];
  let lastFlash = -Infinity;
  for (let now = 0; now < (samples.length / SIM_RATE) * 1000; now += dt) {
    const spectrum = analyser.frame(signal, now / 1000);
    let bands, beat, pace;
    if (legacy) {
      const raw = rhythm.bandEnergies(spectrum, SIM_RATE, SIM_FFT);
      bands = { bass: Math.min(1, raw.bass * 1.15), mid: Math.min(1, raw.mid * 1.8), treble: Math.min(1, raw.treble * 3) };
      beat = analysis.push(spectrum, SIM_RATE, SIM_FFT, now).beat;
    } else ({ bands, beat, pace } = analysis.push(spectrum, SIM_RATE, SIM_FFT, now, sensitivity));
    const frame = light.push({ bands, beat, pace, dtMs: dt, now, speed: 1 });
    // La versión anterior no informaba del destello: se reconstruye con su misma regla (golpe y separación mínima).
    const flash = frame.flash ?? (beat && now - lastFlash >= rhythm.FLASH_GAP_MS);
    if (flash) lastFlash = now;
    frames.push({ swell: frame.swell, mid: frame.mid, rate: frame.rate, flash });
  }
  return frames;
}

const rhythm = await load();
const rows = argv.map((path) => {
  const m = lightMetrics(drive(rhythm, decode(path)));
  return {
    pista: basename(path).replace(/\.[^.]+$/, ""),
    actividad: m.actividad.toFixed(2),
    "destellos/s": m.destellos.toFixed(2),
    "velocidad σ": m.velocidad.toFixed(3),
    "peor destellos/s": m.peorDestellos.toFixed(1),
    "máx. paso 100 ms": m.maxPaso.toFixed(3),
  };
});
console.log(ref ? `core/rhythm.ts de ${ref}` : `core/rhythm.ts actual · sensibilidad ${sensitivity}`);
console.table(rows);
