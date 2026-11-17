import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUT_RAMP, PlayerEngine } from "./PlayerEngine";

// Máquina de estados de pausa y rampa del motor, con un <audio> y un AudioContext falsos (Vitest corre en Node).
// Los tiempos imitan un móvil lento: resume() tarda 30 ms y audio.play() 10 ms; los eventos del <audio> llegan como tareas.

type Call = [kind: "cancel" | "set" | "ramp", value: number, time?: number];

class FakeParam {
  value = 1;
  calls: Call[] = [];
  cancelScheduledValues(time: number) {
    this.calls.push(["cancel", time]);
  }
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.calls.push(["set", value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push(["ramp", value, time]);
  }
}

const node = () => {
  const n = { gain: new FakeParam(), pan: new FakeParam(), frequency: new FakeParam(), Q: new FakeParam(), threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam(), connect: (to: unknown) => to };
  return n;
};

class FakeContext {
  static last: FakeContext;
  currentTime = 0;
  state = "running";
  sampleRate = 48000;
  destination = node();
  constructor() {
    FakeContext.last = this;
  }
  resume = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
  createGain = node;
  createBiquadFilter = node;
  createStereoPanner = node;
  createDynamicsCompressor = node;
  createAnalyser = node;
  createMediaElementSource = node;
}

class FakeAudio extends EventTarget {
  static all: FakeAudio[] = [];
  paused = true;
  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  currentTime = 0;
  duration = NaN;
  plays = 0;
  private attrs = new Map<string, string>();
  constructor() {
    super();
    FakeAudio.all.push(this);
  }
  set src(url: string) {
    this.attrs.set("src", url);
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  load() {}
  private fire(type: string) {
    setTimeout(() => this.dispatchEvent(new Event(type)), 0);
  }
  play() {
    this.plays += 1;
    if (this.paused) {
      this.paused = false;
      this.fire("play");
    }
    return new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.fire("pause");
  }
}

let reported: boolean[];
let engine: PlayerEngine;
const master = () => (engine as unknown as { master: { gain: FakeParam } }).master.gain;
const audio = () => FakeAudio.all[0];
/** Como `player.toggle`: decide con el último estado visible. */
const toggle = () => (reported.at(-1) ? engine.pause() : void engine.play());

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { AudioContext: FakeContext });
  vi.stubGlobal("Audio", FakeAudio);
  FakeAudio.all = [];
  reported = [];
  const noop = () => {};
  engine = new PlayerEngine({ onPlaying: (playing) => reported.push(playing), onStarted: noop, onTime: noop, onDuration: noop, onEnded: noop, onError: noop });
  engine.load("blob:pista");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pausa y reanudación", () => {
  it.each([20, 21])("%i toques cada 5 ms (más rápido que resume): cada uno cuenta y el último gana", async (taps) => {
    for (let i = 0; i < taps; i++) {
      toggle();
      expect(reported.at(-1)).toBe(i % 2 === 0); // el estado visible cambia en el mismo toque
      await vi.advanceTimersByTimeAsync(5);
    }
    FakeContext.last.currentTime = 10; // el reloj de audio pasa el fin de cualquier rampa
    await vi.advanceTimersByTimeAsync(500);
    const playing = taps % 2 === 1;
    expect(engine.paused).toBe(!playing);
    expect(audio().paused).toBe(!playing);
    expect(reported.at(-1)).toBe(playing); // los eventos tardíos del <audio> no lo contradicen
  });

  it("una pausa mientras el contexto se reanuda gana: el <audio> ni arranca", async () => {
    void engine.play();
    engine.pause();
    await vi.advanceTimersByTimeAsync(200);
    expect(audio().plays).toBe(0);
    expect(engine.paused).toBe(true);
    expect(reported).toEqual([true, false]);
  });

  it("un pause que no pedimos (fin de pista, otra app se queda el audio) deja el motor en pausa", async () => {
    void engine.play();
    await vi.advanceTimersByTimeAsync(100);
    audio().pause();
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.paused).toBe(true);
    expect(reported.at(-1)).toBe(false);
  });
});

describe("rampa al cortar", () => {
  async function playing() {
    void engine.play();
    await vi.advanceTimersByTimeAsync(100);
    FakeContext.last.currentTime = 10;
    master().calls = [];
  }

  it("pausar sin fundido baja el volumen en CUT_RAMP y solo después pausa el <audio>", async () => {
    await playing();
    engine.pause(0);
    expect(master().calls).toContainEqual(["ramp", 0, 10 + CUT_RAMP]);
    expect(CUT_RAMP).toBeGreaterThanOrEqual(0.01);
    expect(CUT_RAMP).toBeLessThanOrEqual(0.03);
    expect(audio().paused).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(audio().paused).toBe(false); // el reloj de audio no avanzó: la rampa aún no se calculó entera
    FakeContext.last.currentTime = 10.05;
    await vi.advanceTimersByTimeAsync(20);
    expect(audio().paused).toBe(true);
  });

  it("reanudar sin fundido sube desde 0 cuando el <audio> ya entrega muestras", async () => {
    await playing();
    engine.pause(0);
    FakeContext.last.currentTime = 10.05;
    await vi.advanceTimersByTimeAsync(50);
    master().calls = [];
    void engine.play(0);
    await vi.advanceTimersByTimeAsync(30); // resume
    expect(master().calls.slice(-2)).toEqual([["set", 0, 10.05], ["ramp", 0, 10.05]]); // en 0 hasta que el <audio> arranque
    await vi.advanceTimersByTimeAsync(10); // audio.play() resuelve
    expect(master().calls.at(-1)).toEqual(["ramp", 1, 10.05 + CUT_RAMP]);
  });

  it("un toque a mitad de la rampa sube desde el valor en que iba, sin salto", async () => {
    await playing();
    engine.pause(0);
    FakeContext.last.currentTime = 10 + CUT_RAMP / 2;
    master().calls = [];
    void engine.play(0);
    await vi.advanceTimersByTimeAsync(30);
    const [set, ramp] = master().calls.filter(([kind]) => kind !== "cancel");
    expect(set[0]).toBe("set");
    expect(set[1]).toBeCloseTo(0.5);
    expect(ramp).toEqual(["ramp", 1, 10 + CUT_RAMP / 2 + CUT_RAMP]);
    expect(audio().paused).toBe(false);
  });
});
