import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Device } from "../core/quality";
import { backgroundColors, gradientCss, isAnimated } from "../core/background";
import type { BackgroundSettings } from "../core/background";
import type { Rgb } from "../core/palette";
import { createGovernor, fpsCap, QUALITY_LEVELS, startLevel } from "../core/quality";
import { bandEnergies, createBeatDetector, follow } from "../core/rhythm";
import { useBackground } from "../state/background";
import { player } from "../state/player";
import { createRenderer } from "./backdropRenderer";
import { PaletteContext } from "./usePalette";

// Fondo del reproductor. Portada / Ritmo: lienzo WebGL animado. Estático: degradado CSS fijo. AMOLED: nada (negro).
// Respaldo CSS (mismo aspecto, sin movimiento) si no hay WebGL, se pierde el contexto o el sistema pide menos movimiento.
// El lienzo solo existe mientras este componente está montado: con el reproductor colapsado no hay bucle ni contexto.

const reducedQuery = "(prefers-reduced-motion: reduce)";
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(reducedQuery);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(reducedQuery).matches,
  );
}

type BatteryManager = EventTarget & { charging: boolean; level: number };
type NavigatorExtras = Navigator & { getBattery?: () => Promise<BatteryManager>; connection?: { saveData?: boolean }; deviceMemory?: number };

interface Stats {
  frames: number;
  /** Media móvil (ms) del trabajo de JavaScript por cuadro: lectura del analizador, análisis y envío del dibujo. */
  cpuMs: number;
  level: number;
  mode: string;
  intensity: number;
}

/** Bucle de dibujo. Devuelve la función que lo detiene y libera todo. */
function run(host: HTMLElement, canvas: HTMLCanvasElement, live: { current: { settings: BackgroundSettings; colors: Rgb[] } }, onFail: () => void): () => void {
  const renderer = createRenderer(canvas, onFail);
  if (!renderer) {
    onFail();
    return () => undefined;
  }
  const nav = navigator as NavigatorExtras;
  const device = (): Device => ({ cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory, saveData: nav.connection?.saveData });
  const governor = createGovernor(startLevel(device(), live.current.settings.batterySaver));
  const buffer = new Uint8Array(1024);
  const detector = createBeatDetector();
  const shown = live.current.colors.map((color) => [...color] as Rgb); // colores en pantalla: se acercan a los objetivos al cambiar de pista
  const stats: Stats = { frames: 0, cpuMs: 0, level: governor.level, mode: "", intensity: 0 };
  if (import.meta.env.DEV) ((window as unknown as { __backdrop?: Stats[] }).__backdrop ??= []).push(stats); // solo desarrollo: lo leen las pruebas

  let bass = 0;
  let mid = 0;
  let treble = 0;
  let pulse = 0;
  let time = 0;
  let last = performance.now();
  let raf = 0;
  let sizedFor = -1;
  let dirty = true;
  const observer = new ResizeObserver(() => (dirty = true));
  observer.observe(host);

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const { settings, colors } = live.current;
    const interval = 1000 / fpsCap(settings.fps, governor.level);
    const dt = now - last;
    if (dt < interval - 2) return; // tope de cuadros (2 ms de holgura por la irregularidad de rAF)
    last = now;
    const level = governor.frame(dt, interval);
    const started = performance.now();

    const analyser = player.analyser();
    let beat = false;
    if (settings.mode === "rhythm" && analyser) {
      analyser.getByteFrequencyData(buffer);
      const rate = analyser.context.sampleRate;
      const bands = bandEnergies(buffer, rate, analyser.fftSize);
      // Los agudos y medios traen mucha menos energía que los graves en la escala del analizador: se compensan.
      bass = follow(bass, Math.min(1, bands.bass * 1.15), dt);
      mid = follow(mid, Math.min(1, bands.mid * 1.8), dt);
      treble = follow(treble, Math.min(1, bands.treble * 3), dt);
      beat = detector.push(buffer, rate, analyser.fftSize, now).beat;
    } else {
      bass = follow(bass, 0, dt);
      mid = follow(mid, 0, dt);
      treble = follow(treble, 0, dt);
    }
    pulse = beat ? 1 : pulse * Math.exp(-dt / 120);
    time += (dt / 1000) * settings.speed;

    const ease = 1 - Math.exp(-dt / 250);
    shown.forEach((color, i) => {
      const target = colors[i % colors.length];
      for (let c = 0; c < 3; c++) color[c] += (target[c] - color[c]) * ease;
    });

    if (dirty || level !== sizedFor) {
      const quality = QUALITY_LEVELS[level];
      renderer!.resize(host.clientWidth * quality.scale, host.clientHeight * quality.scale);
      sizedFor = level;
      dirty = false;
    }
    renderer!.draw({ time, bass, mid, treble, beat: pulse }, { colors: shown, intensity: settings.intensity, blobs: QUALITY_LEVELS[level].blobs });

    stats.frames += 1;
    stats.cpuMs = stats.cpuMs * 0.95 + (performance.now() - started) * 0.05;
    stats.level = level;
    stats.mode = settings.mode;
    stats.intensity = settings.intensity;
  }

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  if (!document.hidden) raf = requestAnimationFrame(tick);

  // Con el ahorro automático, batería ≤ 20 % sin cargar baja la calidad (solo Chromium expone la API).
  let battery: BatteryManager | undefined;
  let stopped = false;
  const checkBattery = () => {
    if (battery && !battery.charging && battery.level <= 0.2 && live.current.settings.batterySaver) governor.raise(1);
  };
  void nav.getBattery?.().then((manager) => {
    if (stopped) return;
    battery = manager;
    checkBattery();
    manager.addEventListener("levelchange", checkBattery);
    manager.addEventListener("chargingchange", checkBattery);
  });

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    observer.disconnect();
    battery?.removeEventListener("levelchange", checkBattery);
    battery?.removeEventListener("chargingchange", checkBattery);
    renderer.dispose();
    const all = (window as unknown as { __backdrop?: Stats[] }).__backdrop;
    if (all && all.includes(stats)) all.splice(all.indexOf(stats), 1);
  };
}

/** Llena a su contenedor posicionado (debe ser `position: relative/absolute/fixed`). Va detrás del contenido (z-index -1). */
export function Backdrop() {
  const settings = useBackground();
  const palette = useContext(PaletteContext);
  const colors = backgroundColors(settings, palette);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ settings, colors });
  useLayoutEffect(() => {
    live.current = { settings, colors };
  });

  const animated = isAnimated(settings.mode) && !reduced && !failed;
  useEffect(() => {
    if (!animated || !host.current) return;
    // El lienzo se crea y se retira aquí: así cada montaje (también el doble de StrictMode) tiene un contexto nuevo.
    const canvas = document.createElement("canvas");
    canvas.className = "backdrop-canvas";
    host.current.append(canvas);
    const stop = run(host.current, canvas, live, () => setFailed(true));
    return () => {
      stop();
      canvas.remove();
    };
  }, [animated]);

  if (animated) return <div aria-hidden="true" className="backdrop" ref={host} />;
  if (settings.mode === "amoled") return null;
  const kind = settings.mode === "static" ? "linear" : "blobs";
  return <div aria-hidden="true" className="backdrop" style={{ background: gradientCss(colors, settings.intensity, kind) }} />;
}

/** Tinte sutil de toda la app con el reproductor colapsado (solo en los modos con color): CSS, sin lienzo ni bucle. */
export function Tint() {
  const settings = useBackground();
  const palette = useContext(PaletteContext);
  if (!isAnimated(settings.mode)) return null;
  return <div aria-hidden="true" className="tint" style={{ background: gradientCss(backgroundColors(settings, palette), settings.intensity * 0.3) }} />;
}
