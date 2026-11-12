import { describe, expect, it } from "vitest";
import { bandEnergies, createBeatDetector, createLight, follow } from "./rhythm";
import type { Bands } from "./rhythm";

// Señales sintéticas → mismo camino que el navegador: ventana de Blackman, FFT, suavizado, escala dB → byte (AnalyserNode).
const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const HOP = SAMPLE_RATE / 60;

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

class FakeAnalyser {
  private smooth = new Float64Array(FFT_SIZE / 2);
  constructor(private readonly smoothing = 0.4) {}
  /** `signal(t)` en segundos; `end` = instante del último muestreo de la ventana. */
  frame(signal: (t: number) => number, end: number): Uint8Array {
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE) + 0.08 * Math.cos((4 * Math.PI * i) / FFT_SIZE);
      re[i] = signal(end - (FFT_SIZE - 1 - i) / SAMPLE_RATE) * w;
    }
    fft(re, im);
    const bytes = new Uint8Array(FFT_SIZE / 2);
    for (let k = 0; k < bytes.length; k++) {
      const magnitude = Math.hypot(re[k], im[k]) / FFT_SIZE;
      this.smooth[k] = this.smoothing * this.smooth[k] + (1 - this.smoothing) * magnitude;
      const db = 20 * Math.log10(Math.max(this.smooth[k], 1e-12));
      bytes[k] = Math.round(Math.min(255, Math.max(0, (255 * (db + 100)) / 70)));
    }
    return bytes;
  }
}

// Ruido determinista (sin Math.random: el test no puede ser inestable).
function noise(seed: number) {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

/** Bombo (seno de 55 Hz con caída) en cada instante de `kicks`, más un colchón de 440 Hz y hi-hats de ruido en cada corchea. */
function music(kicks: number[], amplitude: (t: number) => number) {
  const random = noise(7);
  const hats: number[] = [];
  for (let t = 0.25; t < 20; t += 0.25) hats.push(t);
  return (t: number) => {
    let value = 0.04 * Math.sin(2 * Math.PI * 440 * t);
    for (const kick of kicks) {
      const dt = t - kick;
      if (dt >= 0 && dt < 0.4) value += amplitude(kick) * Math.exp(-dt / 0.09) * Math.sin(2 * Math.PI * 55 * dt);
    }
    for (const hat of hats) {
      const dt = t - hat;
      if (dt >= 0 && dt < 0.03) value += 0.08 * Math.exp(-dt / 0.008) * random();
    }
    return value;
  };
}

function detect(signal: (t: number) => number, seconds: number) {
  const analyser = new FakeAnalyser();
  const detector = createBeatDetector();
  const beats: number[] = [];
  for (let frame = 0; frame * HOP < seconds * SAMPLE_RATE; frame++) {
    const now = (frame * HOP) / SAMPLE_RATE;
    const { beat } = detector.push(analyser.frame(signal, now), SAMPLE_RATE, FFT_SIZE, now * 1000);
    if (beat) beats.push(now);
  }
  return beats;
}

/** Cuántos golpes reales se detectaron dentro de `window` s tras ellos, y cuántas detecciones no corresponden a ninguno. */
function score(kicks: number[], beats: number[], window = 0.15) {
  const hit = kicks.filter((kick) => beats.some((beat) => beat >= kick - 0.03 && beat <= kick + window)).length;
  const false_ = beats.filter((beat) => !kicks.some((kick) => beat >= kick - 0.03 && beat <= kick + window)).length;
  return { hit, falsePositives: false_ };
}

describe("energía por bandas", () => {
  const analyse = (frequency: number) => {
    const analyser = new FakeAnalyser(0);
    return bandEnergies(analyser.frame((t) => 0.5 * Math.sin(2 * Math.PI * frequency * t), 1), SAMPLE_RATE, FFT_SIZE);
  };

  it("un seno grave carga los graves; uno agudo, los agudos", () => {
    const low = analyse(60);
    expect(low.bass).toBeGreaterThan(0.3);
    expect(low.mid).toBeLessThan(0.1);
    expect(low.treble).toBeLessThan(0.05);
    const high = analyse(6000);
    expect(high.treble).toBeGreaterThan(0.005);
    expect(high.treble).toBeGreaterThan(high.bass * 5);
    expect(analyse(800).mid).toBeGreaterThan(analyse(800).bass * 3);
  });

  it("el silencio da energía cero", () => {
    expect(bandEnergies(new Uint8Array(1024), SAMPLE_RATE, FFT_SIZE)).toEqual({ bass: 0, mid: 0, treble: 0 });
  });
});

describe("detección de golpes", () => {
  const kicks = Array.from({ length: 18 }, (_, i) => 1 + i * 0.5); // 120 BPM

  it("encuentra los bombos de un compás de 120 BPM con hi-hats, sin falsos golpes", () => {
    const beats = detect(music(kicks, () => 0.7), 10.5);
    const { hit, falsePositives } = score(kicks, beats);
    expect(hit).toBeGreaterThanOrEqual(16);
    expect(falsePositives).toBeLessThanOrEqual(1);
  });

  it("un tono constante o el silencio no producen golpes", () => {
    expect(detect((t) => 0.3 * Math.sin(2 * Math.PI * 80 * t), 6)).toEqual([]);
    expect(detect(() => 0, 6)).toEqual([]);
  });

  it("el umbral se adapta: sigue detectando cuando la música baja 17 dB", () => {
    const loudThenQuiet = music(kicks, (t) => (t < 5.9 ? 0.8 : 0.11));
    const beats = detect(loudThenQuiet, 10.5);
    const quiet = kicks.filter((kick) => kick > 7); // tras 1–2 s de adaptación
    const { hit } = score(quiet, beats);
    expect(hit).toBeGreaterThanOrEqual(quiet.length - 1);
  });

  it("respeta la separación mínima entre golpes", () => {
    const fast = Array.from({ length: 30 }, (_, i) => 1 + i * 0.1); // 600 BPM: más rápido que el límite
    const beats = detect(music(fast, () => 0.7), 4.2);
    for (let i = 1; i < beats.length; i++) expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(0.19);
  });
});

describe("follow", () => {
  it("sube rápido y baja despacio", () => {
    const up = follow(0, 1, 16);
    const down = 1 - follow(1, 0, 16);
    expect(up).toBeGreaterThan(down * 3);
    expect(follow(0.5, 0.5, 16)).toBe(0.5);
  });
});

// --- Luz del fondo: lo que llega al shader (brillo, velocidad) medido sobre el mismo camino que usa el navegador. ---
interface Step {
  bands: Bands;
  beat: boolean;
  now: number;
}

/** Cuadros a 60 fps con las bandas escaladas igual que `ui/Backdrop.tsx` y el golpe del detector. */
function drive(signal: (t: number) => number, seconds: number): Step[] {
  const analyser = new FakeAnalyser();
  const detector = createBeatDetector();
  const steps: Step[] = [];
  for (let frame = 0; frame * HOP < seconds * SAMPLE_RATE; frame++) {
    const t = (frame * HOP) / SAMPLE_RATE;
    const spectrum = analyser.frame(signal, t);
    const raw = bandEnergies(spectrum, SAMPLE_RATE, FFT_SIZE);
    const bands = { bass: Math.min(1, raw.bass * 1.15), mid: Math.min(1, raw.mid * 1.8), treble: Math.min(1, raw.treble * 3) };
    steps.push({ bands, beat: detector.push(spectrum, SAMPLE_RATE, FFT_SIZE, t * 1000).beat, now: t * 1000 });
  }
  return steps;
}

/** Colchón de banda ancha (grave, medio y agudo) con volumen `amplitude(t)`: música "llena" frente a música "suave". */
const bed = (amplitude: (t: number) => number) => (t: number) =>
  amplitude(t) * (Math.sin(2 * Math.PI * 60 * t) + Math.sin(2 * Math.PI * 800 * t) + Math.sin(2 * Math.PI * 5000 * t)) / 3;

/** Bombos secos y separados (55 Hz que se apagan en 35 ms): cada golpe sube y baja del todo, como un fondo que parpadea. */
const punch = (kicks: number[], level = 0.3) => (t: number) =>
  kicks.reduce((sum, kick) => (t >= kick && t < kick + 0.12 ? sum + level * Math.exp(-(t - kick) / 0.035) * Math.sin(2 * Math.PI * 55 * (t - kick)) : sum), 0);

const DT = 1000 / 60;
const GAIN_MAX = 1.25;

/** Brillo relativo (0–1) del fondo antes de este cambio: la fórmula del shader anterior, con la música tal cual. */
function legacyLuminance(steps: Step[]): number[] {
  let bass = 0;
  let pulse = 0;
  return steps.map(({ bands, beat }) => {
    bass = follow(bass, bands.bass, DT);
    pulse = beat ? 1 : pulse * Math.exp(-DT / 120);
    return Math.min(0.9 + bass * 0.5 + pulse * 0.3, GAIN_MAX) / GAIN_MAX;
  });
}

function currentLuminance(steps: Step[], speed = 1) {
  const light = createLight();
  return steps.map((step) => {
    const frame = light.push({ ...step, dtMs: DT, speed });
    return { luminance: (0.9 + frame.swell * 0.35) / GAIN_MAX, rate: frame.rate, drift: frame.drift };
  });
}

/** Mayor cambio de brillo en 100 ms. */
function maxStep(series: number[], window = 6) {
  let worst = 0;
  for (let i = window; i < series.length; i++) worst = Math.max(worst, Math.abs(series[i] - series[i - window]));
  return worst;
}

/** Destellos por segundo en la peor ventana de 1 s: un destello = subida y bajada de al menos `minSwing` (5 %, el doble de exigente que el 10 % de WCAG). */
function worstFlashesPerSecond(series: number[], minSwing = 0.05) {
  const swings: number[] = []; // instantes (s) en que termina cada subida o bajada completa
  let extreme = series[0];
  let rising = true;
  series.forEach((value, i) => {
    if (rising ? value > extreme : value < extreme) extreme = value;
    else if (Math.abs(extreme - value) >= minSwing) {
      swings.push(i / 60);
      extreme = value;
      rising = !rising;
    }
  });
  return Math.max(0, ...swings.map((from) => swings.filter((t) => t >= from && t < from + 1).length)) / 2;
}

describe("luz del fondo", () => {
  const everyBeat = (gap: number) => Array.from({ length: Math.floor(7 / gap) }, (_, i) => 1 + i * gap);
  const frantic = drive(punch(everyBeat(0.25), 0.06), 8); // 240 BPM con bombos limpios: lo que más parpadeaba

  it("antes parpadeaba más de 3 veces por segundo y con saltos de brillo; ahora no", () => {
    const before = legacyLuminance(frantic);
    const after = currentLuminance(frantic).map((frame) => frame.luminance);
    expect(worstFlashesPerSecond(before)).toBeGreaterThan(3);
    expect(maxStep(before)).toBeGreaterThan(0.1);
    expect(worstFlashesPerSecond(after)).toBeLessThanOrEqual(3);
    expect(maxStep(after)).toBeLessThan(0.1);
  });

  it("aunque el detector dispare en todos los cuadros, el fondo no destella más de 3 veces por segundo", () => {
    const light = createLight();
    const luminance = Array.from({ length: 360 }, (_, i) => (0.9 + light.push({ bands: { bass: 0.5, mid: 0.3, treble: 0.2 }, beat: true, dtMs: DT, now: i * DT, speed: 1 }).swell * 0.35) / GAIN_MAX);
    expect(worstFlashesPerSecond(luminance)).toBeLessThanOrEqual(3);
  });

  it("a 300 BPM sigue por debajo de 3 destellos por segundo", () => {
    const after = currentLuminance(drive(punch(everyBeat(0.2), 0.06), 8)).map((frame) => frame.luminance);
    expect(worstFlashesPerSecond(after)).toBeLessThanOrEqual(3);
  });

  it("la velocidad responde a la energía: más rápida con música fuerte, más lenta con música suave, sin saltos", () => {
    const frames = currentLuminance(drive(bed((t) => (t < 9 ? 0.003 : 0.5)), 19));
    const rate = (seconds: number) => frames[Math.round(seconds * 60)].rate;
    expect(rate(8.5)).toBeLessThan(0.95); // suave
    expect(rate(18.5)).toBeGreaterThan(1.2); // fuerte
    expect(rate(18.5) - rate(8.5)).toBeGreaterThan(0.3);
    // No llega de golpe: medio segundo después del cambio ha recorrido menos de un tercio y a los 3 s ya más de la mitad.
    const total = rate(18.5) - rate(8.5);
    expect(rate(9.5) - rate(8.5)).toBeLessThan(total / 3);
    expect(rate(12) - rate(8.5)).toBeGreaterThan(total / 2);
    // La velocidad cambia menos de 1 por segundo (el tope de diseño: 2 de ganancia / 2 s de ataque) y la fase de la deriva avanza siempre, sin saltos.
    let maxRateStep = 0;
    for (let i = 1; i < frames.length; i++) {
      maxRateStep = Math.max(maxRateStep, Math.abs(frames[i].rate - frames[i - 1].rate) * 60);
      const advance = frames[i].drift - frames[i - 1].drift;
      expect(advance).toBeGreaterThan(0);
      expect(advance).toBeLessThanOrEqual((DT / 1000) * 2.5 + 1e-9);
    }
    expect(maxRateStep).toBeLessThan(1);
  });

  it("la fase de la deriva escala con la velocidad elegida y no salta al cambiarla", () => {
    const light = createLight();
    const step = (speed: number) => light.push({ bands: null, beat: false, dtMs: DT, now: 0, speed });
    for (let i = 0; i < 60; i++) step(1);
    const before = step(1).drift;
    const after = step(2).drift;
    expect(after - before).toBeCloseTo((DT / 1000) * 2, 6);
  });

  it("sin reacción al audio (modo Portada) la velocidad es exactamente la elegida y el brillo no se mueve", () => {
    const light = createLight();
    let frame = light.push({ bands: null, beat: true, dtMs: DT, now: 0, speed: 1 });
    for (let i = 1; i < 600; i++) frame = light.push({ bands: null, beat: true, dtMs: DT, now: i * DT, speed: 1 });
    expect(frame.rate).toBeCloseTo(1, 6);
    expect(frame.swell).toBe(0);
  });
});
