// Chasquido al pausar y reanudar (con y sin fundido) y al buscar: mide la mayor diferencia entre muestras consecutivas alrededor de cada transición.
// Uso: node scripts/prueba-chasquido.mjs [url-base] (contra `npm run dev`). Sale con 1 si algo falla.
//
// Conduce el PlayerEngine real sobre un OfflineAudioContext que se renderiza a trozos al ritmo del reloj de pared (así sus
// setTimeout y el reloj de audio divergen como en un dispositivo). El <audio> se simula con un tono de 440 Hz que:
//   - tarda START_S en entregar muestras tras play() (arranque del decodificador),
//   - sigue entregándolas TAIL_S tras pause() (la cola interna de MediaElementAudioSourceNode),
//   - al escribir currentTime, SEEK_S después cambia de golpe al tono invertido (otro punto de la onda) y lanza `seeked`.
// La búsqueda se mide antes (escribir currentTime a pelo, como hacía el motor) y después (engine.seek, con bajada y subida).
// Sin chasquido, la mayor diferencia alrededor de una transición no supera la del propio tono sonando (2π·440·0,8/48000 ≈ 0,046).
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/`);

const result = await page.evaluate(async () => {
  const SR = 48000;
  const START_S = 0.06;
  const TAIL_S = 0.02;
  const FADE = 0.35; // FADE_PAUSE_SECONDS
  const SEEK_S = 0.03;
  const LENGTH = 9;
  const CHUNK = 512 / SR; // render a trozos de ~10,7 ms
  const ctx = new OfflineAudioContext(1, SR * LENGTH, SR);
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  const amp = ctx.createGain();
  amp.gain.value = 0.8;
  osc.connect(amp);
  const inverted = ctx.createGain();
  inverted.gain.value = -0.8;
  osc.connect(inverted);
  osc.start();

  const tasks = [];
  const at = (time, run) => tasks.push({ time, run });
  // El "<audio>": dos interruptores (ganancia 0/1), tono e invertido; buscar pasa del uno al otro.
  ctx.createMediaElementSource = (audio) => {
    const out = ctx.createGain();
    audio.__pipes = [amp, inverted].map((source) => {
      const pipe = ctx.createGain();
      pipe.gain.value = 0;
      source.connect(pipe).connect(out);
      return pipe;
    });
    audio.__side = 0;
    Object.defineProperty(audio, "__pipe", { get: () => audio.__pipes[audio.__side] });
    return out;
  };
  ctx.resume = async () => {};
  Object.defineProperty(ctx, "state", { get: () => "running" });
  window.AudioContext = function () {
    return ctx;
  };
  const media = HTMLMediaElement.prototype;
  Object.defineProperty(media, "paused", { configurable: true, get() { return this.__paused ?? true; } });
  media.load = () => {};
  media.play = function () {
    this.__paused = false;
    const start = ctx.currentTime + START_S;
    return new Promise((resolve) => at(start, () => (this.__pipe?.gain.setValueAtTime(1, start), resolve())));
  };
  Object.defineProperty(media, "currentTime", {
    configurable: true,
    get() {
      return this.__time ?? 0;
    },
    set(value) {
      this.__time = value;
      const turn = (this.__seekTurn = (this.__seekTurn ?? 0) + 1); // una búsqueda nueva anula la que aún no terminó
      const when = ctx.currentTime + SEEK_S;
      at(when, () => {
        if (turn !== this.__seekTurn) return;
        if (!this.__paused && this.__pipes) {
          this.__pipe.gain.setValueAtTime(0, when);
          this.__side = 1 - this.__side;
          this.__pipe.gain.setValueAtTime(1, when);
        }
        this.dispatchEvent(new Event("seeked"));
      });
    },
  });
  media.pause = function () {
    this.__paused = true;
    this.__pipe?.gain.setValueAtTime(0, ctx.currentTime + TAIL_S);
  };

  const { PlayerEngine } = await import("/src/engine/PlayerEngine.ts");
  const noop = () => {};
  const engine = new PlayerEngine({ onPlaying: noop, onStarted: noop, onTime: noop, onDuration: noop, onEnded: noop, onError: noop });
  engine.load("data:,");
  at(0.2, () => void engine.play());
  at(1.0, () => engine.pause(FADE)); // pausa suave
  at(2.0, () => void engine.play(FADE)); // reanudar suave
  at(3.0, () => engine.pause(FADE)); // alternar rápido: pausa, reanuda a mitad, vuelve a pausar
  at(3.15, () => void engine.play(FADE));
  at(3.25, () => engine.pause(FADE));
  at(3.8, () => void engine.play());
  at(4.2, () => (engine.decks[engine.active].audio.currentTime = 30)); // antes: salto a pelo
  at(4.8, () => engine.seek(60)); // después: bajada, salto y subida
  at(5.6, () => engine.seek(90)); // interrumpir: otra búsqueda a mitad de la bajada y otra durante el salto
  at(5.62, () => engine.seek(100));
  at(5.68, () => engine.seek(110));
  // Sin fundido de usuario (el ajuste por defecto): la micro-rampa (CUT_RAMP) evita el corte en seco.
  at(6.9, () => engine.pause());
  at(7.4, () => void engine.play());
  at(7.9, () => engine.pause()); // toques muy seguidos: cada uno interrumpe la rampa del anterior desde donde iba
  at(7.93, () => void engine.play());
  at(7.96, () => engine.pause());
  at(8.0, () => void engine.play());

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // El motor llama a ctx.resume() (anulada arriba); el bucle usa la real del OfflineAudioContext.
  const loop = (time) =>
    ctx.suspend(time).then(async () => {
      for (const task of tasks.splice(0).sort((a, b) => a.time - b.time)) {
        if (task.time <= ctx.currentTime + 1e-9) task.run();
        else tasks.push(task);
      }
      await sleep(CHUNK * 1000); // el reloj de JS avanza mientras el de audio espera
      if (time + CHUNK < LENGTH - CHUNK) loop(time + CHUNK);
      void OfflineAudioContext.prototype.resume.call(ctx);
    });
  loop(CHUNK);
  const data = (await ctx.startRendering()).getChannelData(0);
  const maxStep = (from, to) => {
    let max = 0;
    for (let i = Math.floor(from * SR) + 1; i < Math.floor(to * SR); i++) max = Math.max(max, Math.abs(data[i] - data[i - 1]));
    return max;
  };
  const silentAfter = (from, to) => {
    let max = 0;
    for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) max = Math.max(max, Math.abs(data[i]));
    return max;
  };
  return {
    steady: maxStep(0.5, 0.9),
    pause: maxStep(1.0, 1.9),
    resume: maxStep(2.0, 2.9),
    rapid: maxStep(3.0, 3.95),
    silentWhilePaused: silentAfter(1.5, 1.95),
    seekRaw: maxStep(4.15, 4.6),
    seek: maxStep(4.75, 5.4),
    seekInterrupted: maxStep(5.55, 6.4),
    levelBefore: silentAfter(0.5, 0.9),
    levelAfterSeeks: silentAfter(6.4, 6.9),
    pauseNoFade: maxStep(6.85, 7.3),
    resumeNoFade: maxStep(7.35, 7.8),
    rapidNoFade: maxStep(7.85, 8.6),
    silentNoFade: silentAfter(7.1, 7.38),
  };
});
await browser.close();

let failed = 0;
const limit = result.steady * 1.1;
const check = (name, value) => {
  const ok = value <= limit;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: mayor salto entre muestras ${value.toFixed(4)} (tono sonando: ${result.steady.toFixed(4)})`);
};
check("pausa con fundido", result.pause);
check("reanudar con fundido", result.resume);
check("alternar rápido (pausa → reanuda a mitad → pausa)", result.rapid);
check("pausa sin fundido (micro-rampa)", result.pauseNoFade);
check("reanudar sin fundido (micro-rampa)", result.resumeNoFade);
check("alternar sin fundido cuatro veces en 100 ms", result.rapidNoFade);
check("buscar (bajada, salto y subida)", result.seek);
check("buscar interrumpido por otras dos búsquedas", result.seekInterrupted);
console.log(`     antes, buscar sin transición: mayor salto ${result.seekRaw.toFixed(4)} (referencia, no se exige)`);
const restored = result.levelAfterSeeks > result.levelBefore * 0.98;
if (!restored) failed += 1;
console.log(`${restored ? "OK  " : "FAIL"} tras las búsquedas el volumen vuelve entero (pico ${result.levelAfterSeeks.toFixed(3)}; sonando antes: ${result.levelBefore.toFixed(3)})`);
const silent = Math.max(result.silentWhilePaused, result.silentNoFade);
const quiet = silent < 1e-4;
if (!quiet) failed += 1;
console.log(`${quiet ? "OK  " : "FAIL"} en pausa no sale nada, con y sin fundido (pico ${silent.toFixed(5)})`);
process.exit(failed ? 1 : 0);
