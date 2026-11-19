import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Device } from "../core/quality";
import { backgroundColors, gradientCss, isAnimated } from "../core/background";
import type { BackgroundSettings, HdrLook } from "../core/background";
import type { Palette, Rgb } from "../core/palette";
import type { Bands } from "../core/rhythm";
import { createGovernor, fpsCap, QUALITY_LEVELS, startLevel } from "../core/quality";
import { createAnalysis, createLight, follow } from "../core/rhythm";
import { useBackground } from "../state/background";
import { player } from "../state/player";
import { APP_BASE, createRenderer } from "./backdropRenderer";
import { useHdrLook } from "./hdr";
import { useReducedMotion } from "./motion";
import { PaletteContext } from "./usePalette";

// Navegadores sin interpolación `in oklch` (Chrome < 111, Safari < 16.2, Firefox < 127) reciben el degradado de siempre.
const oklch = typeof CSS !== "undefined" && CSS.supports("background-image", "linear-gradient(in oklch, red, blue)");

// Fondo del reproductor. Portada / Ritmo: lienzo WebGL animado (con el interruptor HDR, con curva de contraste y reflejos). Estático: degradado CSS fijo. AMOLED: nada (negro).
// Respaldo CSS (mismo aspecto, sin movimiento) si no hay WebGL, se pierde el contexto o el sistema pide menos movimiento.
// El lienzo existe mientras este componente está montado, y el reproductor sigue montado tras abrirse o precargarse (useKeptPanel): con él
// cerrado (`active` en falso) el bucle se para y el contexto sigue, para que abrir no lo cree en el toque.

const BLACK: Rgb = [0, 0, 0];

/**
 * Color hacia el que va el gesto del carrusel de portadas: la paleta de la vecina y cuánto se ha avanzado (0–1). El bucle lo lee en cada
 * cuadro, sin re-render. Solo el lienzo lo interpola; el respaldo CSS (Estático, movimiento reducido) cambia de golpe al completar el gesto.
 */
export const backdropPreview: { palette: Palette | null; amount: number } = { palette: null, amount: 0 };

/** Despierto aunque el reproductor siga cerrado: mientras la transformación desde la barra lo enseña (ui/playerMorph.ts). */
let awake = false;
const wakers = new Set<() => void>();
export function wakeBackdrop(on: boolean) {
  if (awake === on) return;
  awake = on;
  for (const wake of wakers) wake();
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
  /** Multiplicador de velocidad y brillo por la música en el último cuadro (solo para las pruebas). */
  rate: number;
  swell: number;
  /** Mayor salto (ms) del reloj que ven el análisis y las luces entre dos cuadros: no debe incluir el tiempo con la página oculta. */
  analysisGapMs: number;
  lastAnalysis: number;
}

/** Bucle de dibujo. Devuelve `stop` (lo detiene y libera todo) y `sync` (pausa o reanuda según `active` y la visibilidad de la página). */
function run(host: HTMLElement, canvas: HTMLCanvasElement, live: { current: { settings: BackgroundSettings; colors: Rgb[]; hdr: HdrLook; active: boolean } }, onFail: () => void) {
  const renderer = createRenderer(canvas, onFail);
  if (!renderer) {
    onFail();
    return { stop: () => undefined, sync: () => undefined };
  }
  const nav = navigator as NavigatorExtras;
  const device = (): Device => ({ cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory, saveData: nav.connection?.saveData });
  const governor = createGovernor(startLevel(device(), live.current.settings.batterySaver));
  const buffer = new Uint8Array(1024);
  const analysis = createAnalysis();
  const light = createLight();
  const shown = live.current.colors.map((color) => [...color] as Rgb); // colores en pantalla: se acercan a los objetivos al cambiar de pista
  const stats: Stats = { frames: 0, cpuMs: 0, level: governor.level, mode: "", intensity: 0, rate: 1, swell: 0, analysisGapMs: 0, lastAnalysis: 0 };
  if (import.meta.env.DEV) ((window as unknown as { __backdrop?: Stats[] }).__backdrop ??= []).push(stats); // solo desarrollo: lo leen las pruebas

  let previewFor: Palette | null = null;
  let previewColors: Rgb[] = [];
  let shownIntensity = live.current.settings.intensity;
  let time = 0;
  let last = performance.now();
  let hiddenAt = 0;
  let hiddenFor = 0; // ms con la página oculta: el análisis y las luces ven un reloj continuo, sin el hueco (si no, saltan al volver)
  let raf = 0;
  let sizedFor = -1;
  let dirty = true;
  const observer = new ResizeObserver(() => (dirty = true));
  observer.observe(host);

  function tick(frameTime: number) {
    raf = requestAnimationFrame(tick);
    const now = frameTime - hiddenFor;
    const { settings, colors, hdr } = live.current;
    const interval = 1000 / fpsCap(settings.fps, governor.level);
    const dt = now - last;
    if (dt < interval - 2) return; // tope de cuadros (2 ms de holgura por la irregularidad de rAF)
    last = now;
    const level = governor.frame(dt, interval);
    const started = performance.now();
    stats.analysisGapMs = Math.max(stats.analysisGapMs, now - (stats.lastAnalysis || now));
    stats.lastAnalysis = now;

    const analyser = player.analyser();
    let bands: Bands | null = null;
    let beat = false;
    let pace = 0;
    if (settings.mode === "rhythm") {
      bands = { bass: 0, mid: 0, treble: 0 };
      if (analyser) {
        analyser.getByteFrequencyData(buffer);
        ({ bands, beat, pace } = analysis.push(buffer, analyser.context.sampleRate, analyser.fftSize, now, settings.sensitivity));
      }
    }
    const frame = light.push({ bands, beat, pace, dtMs: dt, now, speed: settings.speed });
    time += (dt / 1000) * settings.speed;
    shownIntensity = follow(shownIntensity, settings.intensity, dt, 120, 400); // el control de intensidad no da saltos

    const { palette: toward, amount } = backdropPreview;
    if (toward !== previewFor) {
      previewFor = toward;
      previewColors = toward ? backgroundColors(settings, toward, hdr) : [];
    }
    const ease = 1 - Math.exp(-dt / (toward ? 60 : 250)); // con el dedo, casi directo; al cambiar de pista o volver, suave
    shown.forEach((color, i) => {
      const from = colors[i % colors.length];
      const to = previewColors.length ? previewColors[i % previewColors.length] : from;
      for (let c = 0; c < 3; c++) color[c] += (from[c] + (to[c] - from[c]) * amount - color[c]) * ease;
    });

    if (dirty || level !== sizedFor) {
      const quality = QUALITY_LEVELS[level];
      renderer!.resize(host.clientWidth * quality.scale, host.clientHeight * quality.scale);
      sizedFor = level;
      dirty = false;
    }
    const hdrOn = settings.hdr;
    renderer!.draw(
      { time, drift: frame.drift, swell: frame.swell, mid: frame.mid },
      {
        colors: shown,
        intensity: shownIntensity,
        blobs: QUALITY_LEVELS[level].blobs,
        base: hdrOn ? BLACK : APP_BASE,
        gamut: hdrOn ? hdr.gamut : "srgb",
        contrast: hdrOn ? hdr.contrast : 0,
        glint: hdrOn ? hdr.glint : 0,
      },
    );

    stats.frames += 1;
    stats.cpuMs = stats.cpuMs * 0.95 + (performance.now() - started) * 0.05;
    stats.level = level;
    stats.mode = settings.mode;
    stats.intensity = settings.intensity;
    stats.rate = frame.rate;
    stats.swell = frame.swell;
    if (!live.current.active && !awake) sync(); // creado con el reproductor cerrado: un cuadro dibujado (abrir no enseña el lienzo vacío) y se para
  }

  // Página oculta o reproductor cerrado: sin bucle. El análisis y las luces ven un reloj continuo, sin el hueco.
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (document.hidden || (!live.current.active && !awake && stats.frames > 0)) hiddenAt ||= performance.now();
    else {
      if (hiddenAt) {
        hiddenFor += performance.now() - hiddenAt;
        // Lo que cambió mientras estaba parado (otra pista, otra intensidad) aparece ya puesto, sin barrido de color al abrir.
        shown.forEach((color, i) => color.splice(0, 3, ...live.current.colors[i % live.current.colors.length]));
        shownIntensity = live.current.settings.intensity;
      }
      hiddenAt = 0;
      last = performance.now() - hiddenFor;
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", sync);
  wakers.add(sync);
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

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", sync);
    wakers.delete(sync);
    observer.disconnect();
    battery?.removeEventListener("levelchange", checkBattery);
    battery?.removeEventListener("chargingchange", checkBattery);
    renderer.dispose();
    const all = (window as unknown as { __backdrop?: Stats[] }).__backdrop;
    if (all && all.includes(stats)) all.splice(all.indexOf(stats), 1);
  };
  return { stop, sync };
}

/** Llena a su contenedor posicionado (debe ser `position: relative/absolute/fixed`). Va detrás del contenido (z-index -1). */
export function Backdrop({ active = true }: { active?: boolean }) {
  const settings = useBackground();
  const palette = useContext(PaletteContext);
  const hdr = useHdrLook();
  const colors = backgroundColors(settings, palette, hdr);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ settings, colors, hdr, active });
  const loop = useRef<ReturnType<typeof run>>(undefined);
  useLayoutEffect(() => {
    live.current = { settings, colors, hdr, active };
  });

  const animated = isAnimated(settings.mode) && !reduced && !failed;
  useEffect(() => {
    if (!animated || !host.current) return;
    // El lienzo se crea y se retira aquí: así cada montaje (también el doble de StrictMode) tiene un contexto nuevo.
    const canvas = document.createElement("canvas");
    canvas.className = "backdrop-canvas";
    host.current.append(canvas);
    loop.current = run(host.current, canvas, live, () => setFailed(true));
    return () => {
      loop.current?.stop();
      loop.current = undefined;
      canvas.remove();
    };
  }, [animated]);
  useEffect(() => loop.current?.sync(), [active]);

  if (animated) return <div aria-hidden="true" className="backdrop" ref={host} />;
  if (settings.mode === "amoled") return <div aria-hidden="true" className="backdrop" style={{ background: "var(--bg)" }} />; // negro que crece desde la miniatura, como el ambiente
  const kind = settings.mode === "static" ? "linear" : "blobs";
  return <div aria-hidden="true" className="backdrop" style={{ background: gradientCss(colors, settings.intensity, kind, settings.hdr ? hdr.gamut : "srgb", oklch) }} />;
}

/** Tinte sutil de toda la app con el reproductor colapsado (solo en los modos con color): CSS, sin lienzo ni bucle. */
export function Tint() {
  const settings = useBackground();
  const palette = useContext(PaletteContext);
  const hdr = useHdrLook();
  if (!isAnimated(settings.mode)) return null;
  return <div aria-hidden="true" className="tint" style={{ background: gradientCss(backgroundColors(settings, palette, hdr), settings.intensity * 0.3, "blobs", settings.hdr ? hdr.gamut : "srgb", oklch) }} />;
}
