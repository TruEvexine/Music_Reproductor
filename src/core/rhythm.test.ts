import { describe, expect, it } from "vitest";
import { bandEnergies, createBeatDetector, follow } from "./rhythm";

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
