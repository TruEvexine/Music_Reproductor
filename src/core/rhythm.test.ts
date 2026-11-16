import { describe, expect, it } from "vitest";
import { bandEnergies, createAnalysis, createLight, follow } from "./rhythm";
import type { Bands, Sensitivity } from "./rhythm";
import { createAnalyserSim, lightMetrics, luminanceOf, maxStep, SIM_FFT, SIM_RATE, worstFlashesPerSecond } from "./rhythm.sim";
import type { LightFrame } from "./rhythm.sim";

// Señales sintéticas → mismo camino que el navegador (rhythm.sim.ts: ventana de Blackman, FFT, suavizado, dB → byte como AnalyserNode).
const HOP = SIM_RATE / 60;
const DT = 1000 / 60;

// Ruido determinista (sin Math.random: el test no puede ser inestable).
function noise(seed: number) {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

/** Bombo (seno de 55 Hz con caída) en cada instante de `kicks`, más un colchón de 440 Hz y hi-hats de ruido cada `hatGap` s. */
function music(kicks: number[], amplitude: (t: number) => number, hatGap = 0.25) {
  const random = noise(7);
  const hats: number[] = [];
  for (let t = 0.25; t < 20; t += hatGap) hats.push(t);
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

interface Step {
  bands: Bands;
  beat: boolean;
  pace: number;
  now: number;
}

/** Cuadros a 60 fps por el mismo análisis que `ui/Backdrop.tsx`. */
function analyse(signal: (t: number) => number, seconds: number, sensitivity: Sensitivity = "auto"): Step[] {
  const analyser = createAnalyserSim();
  const analysis = createAnalysis();
  const steps: Step[] = [];
  for (let frame = 0; frame * HOP < seconds * SIM_RATE; frame++) {
    const now = (frame * HOP * 1000) / SIM_RATE;
    steps.push({ ...analysis.push(analyser.frame(signal, now / 1000), SIM_RATE, SIM_FFT, now, sensitivity), now });
  }
  return steps;
}

const beatsOf = (steps: Step[]) => steps.filter((step) => step.beat).map((step) => step.now / 1000);

/** Cuántos golpes reales se detectaron dentro de `window` s tras ellos, y cuántas detecciones no corresponden a ninguno. */
function score(kicks: number[], beats: number[], window = 0.15) {
  const hit = kicks.filter((kick) => beats.some((beat) => beat >= kick - 0.03 && beat <= kick + window)).length;
  const false_ = beats.filter((beat) => !kicks.some((kick) => beat >= kick - 0.03 && beat <= kick + window)).length;
  return { hit, falsePositives: false_ };
}

function lit(steps: Step[], speed = 1): (LightFrame & { drift: number })[] {
  const light = createLight();
  return steps.map((step) => light.push({ ...step, dtMs: DT, speed }));
}

describe("energía por bandas", () => {
  const energies = (frequency: number) => bandEnergies(createAnalyserSim(0).frame((t) => 0.5 * Math.sin(2 * Math.PI * frequency * t), 1), SIM_RATE, SIM_FFT);

  it("un seno grave carga los graves; uno de voz, los medios; uno agudo, los agudos", () => {
    const low = energies(60);
    expect(low.bass).toBeGreaterThan(0.3);
    expect(low.bass).toBeGreaterThan(low.mid * 3);
    expect(low.bass).toBeGreaterThan(low.treble * 5);
    const high = energies(8000);
    expect(high.treble).toBeGreaterThan(high.bass * 5);
    expect(energies(800).mid).toBeGreaterThan(energies(800).bass * 3);
  });

  it("el silencio da energía cero", () => {
    expect(bandEnergies(new Uint8Array(1024), SIM_RATE, SIM_FFT)).toEqual({ bass: 0, mid: 0, treble: 0 });
  });
});

describe("detección de golpes (flujo espectral con umbral relativo)", () => {
  const kicks = Array.from({ length: 18 }, (_, i) => 1 + i * 0.5); // 120 BPM

  it("encuentra los bombos de un compás de 120 BPM con hi-hats, sin falsos golpes", () => {
    const { hit, falsePositives } = score(kicks, beatsOf(analyse(music(kicks, () => 0.7), 10.5)));
    expect(hit).toBeGreaterThanOrEqual(16);
    expect(falsePositives).toBeLessThanOrEqual(1);
  });

  it("un tono constante o el silencio no producen golpes ni mueven el nivel", () => {
    const tone = analyse((t) => 0.3 * Math.sin(2 * Math.PI * 80 * t), 6);
    expect(beatsOf(tone)).toEqual([]);
    expect(Math.abs(tone.at(-1)!.bands.bass - 0.5)).toBeLessThan(0.05);
    const silence = analyse(() => 0, 6);
    expect(beatsOf(silence)).toEqual([]);
    expect(silence.at(-1)!.bands).toEqual({ bass: 0, mid: 0, treble: 0 });
  });

  it("el umbral se adapta: sigue detectando cuando la música baja 17 dB", () => {
    const beats = beatsOf(analyse(music(kicks, (t) => (t < 5.9 ? 0.8 : 0.11)), 10.5));
    const quiet = kicks.filter((kick) => kick > 7); // tras 1–2 s de adaptación
    expect(score(quiet, beats).hit).toBeGreaterThanOrEqual(quiet.length - 1);
  });

  it("respeta la separación mínima entre golpes", () => {
    const fast = Array.from({ length: 30 }, (_, i) => 1 + i * 0.1); // 600 BPM: más rápido que el límite
    const beats = beatsOf(analyse(music(fast, () => 0.7), 4.2));
    for (let i = 1; i < beats.length; i++) expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(0.19);
  });

  it("la sensibilidad Baja dispara menos que Auto, y Auto menos que Alta", () => {
    const soft = music(kicks, (t) => 0.15 + 0.1 * Math.sin(t * 7)); // bombos de fuerza irregular
    const count = (sensitivity: Sensitivity) => beatsOf(analyse(soft, 10.5, sensitivity)).length;
    expect(count("low")).toBeLessThanOrEqual(count("auto"));
    expect(count("auto")).toBeLessThanOrEqual(count("high"));
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

/** Bombos secos y separados (55 Hz que se apagan en 35 ms): cada golpe sube y baja del todo, como un fondo que parpadea. */
const punch = (kicks: number[], level = 0.3) => (t: number) =>
  kicks.reduce((sum, kick) => (t >= kick && t < kick + 0.12 ? sum + level * Math.exp(-(t - kick) / 0.035) * Math.sin(2 * Math.PI * 55 * (t - kick)) : sum), 0);

/**
 * Máster comprimido de poca dinámica (el caso de "The Spins"): un bajo que nunca para, colchón y voz constantes, y bombos que
 * apenas asoman 3 dB sobre el bajo. Antes, los graves se quedaban pegados al techo del analizador y la luz no se movía.
 */
function dense(t: number) {
  const beat = t % 0.66; // ~91 BPM
  const kick = beat < 0.15 ? 0.35 * Math.exp(-beat / 0.05) : 0;
  return (0.5 + kick) * Math.sin(2 * Math.PI * 50 * t) + 0.25 * Math.sin(2 * Math.PI * 600 * t) + 0.05 * Math.sin(2 * Math.PI * 6000 * t);
}

describe("luz del fondo", () => {
  const everyBeat = (gap: number) => Array.from({ length: Math.floor(7 / gap) }, (_, i) => 1 + i * gap);
  const luminance = (frames: LightFrame[]) => frames.map((frame) => luminanceOf(frame.swell));

  it("a 240 y 300 BPM no destella más de 3 veces por segundo ni cambia el brillo más de un 10 % en 100 ms", () => {
    for (const gap of [0.25, 0.2]) {
      const after = luminance(lit(analyse(punch(everyBeat(gap), 0.06), 8)));
      expect(worstFlashesPerSecond(after)).toBeLessThanOrEqual(3);
      expect(maxStep(after)).toBeLessThan(0.1);
    }
  });

  it("peor caso: golpe en cada cuadro y graves que saltan de 0 a 1 en cada cuadro; los topes aguantan por construcción", () => {
    const light = createLight();
    const frames = Array.from({ length: 600 }, (_, i) => light.push({ bands: { bass: i % 2, mid: i % 2, treble: 0 }, beat: true, pace: 1, dtMs: DT, now: i * DT, speed: 1 }));
    expect(worstFlashesPerSecond(luminance(frames))).toBeLessThanOrEqual(3);
    expect(maxStep(luminance(frames))).toBeLessThan(0.1);
    expect(frames.filter((frame) => frame.flash).length / 10).toBeLessThanOrEqual(3);
  });

  it("una mezcla comprimida de poca dinámica también late, dentro de los topes", () => {
    const metrics = lightMetrics(lit(analyse(dense, 20)));
    expect(metrics.actividad).toBeGreaterThan(1);
    expect(metrics.destellos).toBeGreaterThan(0.5);
    expect(metrics.peorDestellos).toBeLessThanOrEqual(3);
    expect(metrics.maxPaso).toBeLessThan(0.1);
  });

  it("la velocidad sigue a los platos: más rápida con hi-hats densos, más lenta sin ellos, sin saltos", () => {
    const kicks = Array.from({ length: 36 }, (_, i) => 0.5 + i * 0.5);
    const [bare, busy] = [music(kicks, () => 0.5, 100), music(kicks, () => 0.5, 0.125)];
    const frames = lit(analyse((t) => (t < 9 ? bare(t) : busy(t)), 19));
    const rate = (seconds: number) => frames[Math.round(seconds * 60)].rate;
    expect(rate(8.5)).toBeLessThan(0.95); // sin platos
    expect(rate(18.5)).toBeGreaterThan(1.2); // corcheas de hi-hat a 240/min
    // No llega de golpe, la velocidad cambia menos de 1 por segundo y la fase de la deriva avanza siempre, sin saltos.
    const total = rate(18.5) - rate(8.5);
    expect(rate(9.5) - rate(8.5)).toBeLessThan(total / 2);
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
    let frame = light.push({ bands: null, beat: true, pace: 1, dtMs: DT, now: 0, speed: 1 });
    for (let i = 1; i < 600; i++) frame = light.push({ bands: null, beat: true, pace: 1, dtMs: DT, now: i * DT, speed: 1 });
    expect(frame.rate).toBeCloseTo(1, 6);
    expect(frame.swell).toBe(0);
    expect(frame.flash).toBe(false);
  });
});
