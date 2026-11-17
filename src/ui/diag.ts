import { player } from "../state/player";
import "./styles/diag.css";

// Panel de diagnóstico de audio: solo con ?diag=1. Todo se queda en el dispositivo: no hay ninguna petición de red; el usuario copia el
// informe a mano. DOM plano (sin React) y un temporizador de 250 ms: lo mínimo para no ser él mismo la causa de un corte.

const MAX_LINES = 300;
const TICK_MS = 250;
const JUMP_MS = 30; // un reloj que se atrasa más que esto en un tic es un corte
const DISCONTINUITY_MS = 2000; // más que esto es una búsqueda o un cambio de pista, no un corte
const MEDIA_EVENTS = ["play", "playing", "pause", "waiting", "stalled", "suspend", "ended", "error", "seeking", "seeked", "emptied"];

type Stats = { toJSON?: () => unknown };
type ContextExtras = AudioContext & { playbackStats?: Stats; playoutStats?: Stats };

export function startDiagnostics() {
  const log: string[] = [];
  const stamp = () => (performance.now() / 1000).toFixed(3).padStart(9);
  const note = (text: string) => {
    log.push(`${stamp()}  ${text}`);
    if (log.length > MAX_LINES) log.shift();
    logView.textContent = log.slice().reverse().join("\n");
  };

  const panel = document.createElement("aside");
  panel.className = "diag";
  panel.setAttribute("aria-label", "Diagnóstico de audio");
  const bar = document.createElement("div");
  bar.className = "diag-bar";
  const title = document.createElement("strong");
  title.textContent = "Diagnóstico de audio · solo en este dispositivo";
  const copy = document.createElement("button");
  copy.className = "button";
  copy.type = "button";
  copy.textContent = "Copiar";
  const fold = document.createElement("button");
  fold.className = "button";
  fold.type = "button";
  fold.textContent = "Ocultar";
  fold.setAttribute("aria-expanded", "true");
  const stateView = document.createElement("pre");
  const logView = document.createElement("pre");
  logView.className = "diag-log";
  bar.append(title, copy, fold);
  panel.append(bar, stateView, logView);
  document.body.append(panel);

  fold.addEventListener("click", () => {
    const open = panel.toggleAttribute("data-folded");
    fold.textContent = open ? "Mostrar" : "Ocultar";
    fold.setAttribute("aria-expanded", String(!open));
  });
  copy.addEventListener("click", async () => {
    const report = `Diagnóstico de audio\n${navigator.userAgent}\n${location.pathname}\n\n${stateView.textContent}\n\nEventos (más antiguo primero):\n${log.join("\n")}\n`;
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Sin permiso de portapapeles: se selecciona el texto en un campo para copiarlo a mano.
      const area = document.createElement("textarea");
      area.value = report;
      panel.append(area);
      area.select();
      document.execCommand("copy");
    }
    copy.textContent = "Copiado";
    setTimeout(() => (copy.textContent = "Copiar"), 1500);
  });

  for (const type of ["visibilitychange", "freeze", "resume"]) document.addEventListener(type, () => note(`página: ${type} (${document.visibilityState})`));
  for (const type of ["pagehide", "pageshow"]) window.addEventListener(type, () => note(`página: ${type}`));

  let watched: AudioContext | undefined;
  const audiosWatched = new WeakSet<HTMLAudioElement>();
  let ctxOffset: number | undefined; // ms: reloj de pared − reloj de audio
  let ctxDrift = 0;
  let ctxCuts = 0;
  let mediaOffset: number | undefined;
  let mediaCuts = 0;
  let mediaSettle = 0; // el <audio> tarda en mover currentTime tras empezar o saltar: no se mide en ese margen
  let underruns = 0;

  function tick() {
    const info = player.diagnostics();
    info.audios.forEach((audio, index) => {
      if (audiosWatched.has(audio)) return;
      audiosWatched.add(audio);
      for (const type of MEDIA_EVENTS) audio.addEventListener(type, () => note(`<audio> ${"AB"[index]}${player.diagnostics().active === index ? " (activo)" : ""}: ${type} @ ${audio.currentTime.toFixed(2)} s`));
      for (const type of ["playing", "seeked"])
        audio.addEventListener(type, () => {
          mediaOffset = undefined;
          mediaSettle = performance.now() + 500;
        });
    });
    const context = info.context as ContextExtras | undefined;
    if (context && context !== watched) {
      watched = context;
      note(`AudioContext creado: ${context.state}, ${context.sampleRate} Hz, latencyHint "${info.latencyHint}"`);
      context.addEventListener("statechange", () => {
        ctxOffset = undefined;
        note(`AudioContext: ${context.state}`);
      });
    }

    // Deriva del reloj de audio frente a performance.now(): si el contexto deja de entregar muestras, su reloj se atrasa.
    const now = performance.now();
    // Siempre el mismo método: getOutputTimestamp si existe (y ya hay salida), si no currentTime; mezclarlos da saltos falsos.
    const pair = context?.state === "running" ? context.getOutputTimestamp?.() : undefined;
    const offset = !context || context.state !== "running" ? undefined : pair ? (pair.performanceTime ? pair.performanceTime - (pair.contextTime ?? 0) * 1000 : undefined) : now - context.currentTime * 1000;
    if (offset !== undefined) {
      const jump = ctxOffset === undefined ? 0 : offset - ctxOffset;
      if (jump > JUMP_MS && jump < DISCONTINUITY_MS) {
        ctxCuts += 1;
        note(`corte: el reloj de audio se atrasó ${jump.toFixed(0)} ms`);
      }
      if (Math.abs(jump) < DISCONTINUITY_MS) ctxDrift += jump;
      ctxOffset = offset;
    }
    const audio = info.audios[info.active];
    if (!audio.paused && !audio.seeking && audio.readyState >= 2 && now > mediaSettle) {
      const offset = now - (audio.currentTime * 1000) / (audio.playbackRate || 1);
      const jump = mediaOffset === undefined ? 0 : offset - mediaOffset;
      if (jump > JUMP_MS && jump < DISCONTINUITY_MS) {
        mediaCuts += 1;
        note(`corte: el <audio> se atrasó ${jump.toFixed(0)} ms`);
      }
      mediaOffset = Math.abs(jump) < DISCONTINUITY_MS ? offset : undefined;
    } else mediaOffset = undefined;

    const stats = context?.playbackStats ?? context?.playoutStats;
    const raw = (stats?.toJSON?.() ?? stats) as { underrunEvents?: number; underrunDuration?: number } | undefined;
    if (raw?.underrunEvents !== undefined && raw.underrunEvents > underruns) {
      note(`el navegador cuenta ${raw.underrunEvents} subdesbordamientos de salida (${((raw.underrunDuration ?? 0) * 1000).toFixed(0)} ms en total)`);
      underruns = raw.underrunEvents;
    }
    const ms =(seconds: number | undefined) => (seconds === undefined ? "no disponible" : `${(seconds * 1000).toFixed(1)} ms`);
    stateView.textContent = [
      `página: ${document.visibilityState}`,
      context
        ? `AudioContext: ${context.state} · ${context.sampleRate} Hz · latencyHint "${info.latencyHint}"`
        : `AudioContext: no creado (latencyHint previsto "${info.latencyHint}")`,
      `baseLatency: ${ms(context?.baseLatency)} · outputLatency: ${ms(context?.outputLatency)}`,
      `cadena: ${info.chain}`,
      `<audio> ${"AB"[info.active]}: ${audio.paused ? "pausado" : "sonando"} · ${audio.currentTime.toFixed(2)} s · readyState ${audio.readyState} · networkState ${audio.networkState}`,
      `deriva del reloj de audio: ${ctxDrift.toFixed(0)} ms acumulados · ${ctxCuts} cortes · <audio>: ${mediaCuts} cortes`,
      `estadísticas del navegador: ${raw ? JSON.stringify(raw) : "no disponibles"}`,
    ].join("\n");
  }

  note("panel abierto (?diag=1): no envía nada; «Copiar» lleva el informe al portapapeles");
  tick();
  setInterval(tick, TICK_MS);
}
