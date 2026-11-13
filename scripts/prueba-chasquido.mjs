// Chasquido al pausar y reanudar con fundido: mide la mayor diferencia entre muestras consecutivas alrededor de cada transición.
// Uso: node scripts/prueba-chasquido.mjs [url-base] (contra `npm run dev`). Sale con 1 si algo falla.
//
// Conduce el PlayerEngine real sobre un OfflineAudioContext que se renderiza a trozos al ritmo del reloj de pared (así sus
// setTimeout y el reloj de audio divergen como en un dispositivo). El <audio> se simula con un tono de 440 Hz que:
//   - tarda START_S en entregar muestras tras play() (arranque del decodificador),
//   - sigue entregándolas TAIL_S tras pause() (la cola interna de MediaElementAudioSourceNode).
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
  const CHUNK = 512 / SR; // render a trozos de ~10,7 ms
  const ctx = new OfflineAudioContext(1, SR * 4, SR);
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  const amp = ctx.createGain();
  amp.gain.value = 0.8;
  osc.connect(amp);
  osc.start();

  const tasks = [];
  const at = (time, run) => tasks.push({ time, run });
  // El "<audio>": un interruptor (ganancia 0/1) entre el tono y el grafo del motor.
  ctx.createMediaElementSource = (audio) => {
    const pipe = ctx.createGain();
    pipe.gain.value = 0;
    amp.connect(pipe);
    audio.__pipe = pipe;
    return pipe;
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // El motor llama a ctx.resume() (anulada arriba); el bucle usa la real del OfflineAudioContext.
  const loop = (time) =>
    ctx.suspend(time).then(async () => {
      for (const task of tasks.splice(0).sort((a, b) => a.time - b.time)) {
        if (task.time <= ctx.currentTime + 1e-9) task.run();
        else tasks.push(task);
      }
      await sleep(CHUNK * 1000); // el reloj de JS avanza mientras el de audio espera
      if (time + CHUNK < 4 - CHUNK) loop(time + CHUNK);
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
const quiet = result.silentWhilePaused < 1e-4;
if (!quiet) failed += 1;
console.log(`${quiet ? "OK  " : "FAIL"} en pausa no sale nada (pico ${result.silentWhilePaused.toFixed(5)})`);
process.exit(failed ? 1 : 0);
