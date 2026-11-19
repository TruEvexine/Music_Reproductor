import { wakeBackdrop } from "./Backdrop";
import { motionReduced, tokenMs, tokenValue } from "./motion";

// Transformación de contenedor entre la barra (mini reproductor en móvil, barra en escritorio) y el reproductor grande, con un solo
// número: p = 0 en la barra, 1 abierto. La tarjeta crece desde la barra, la portada viaja de la miniatura a su sitio, los controles
// llegan, el ambiente de la portada nace de la miniatura y la barra inferior se apaga. Solo transform y opacity. Las medidas se toman
// una vez al empezar (start); por cuadro solo se escriben estilos en línea (arrastre) o corre una animación WAAPI, en el compositor
// (abrir o cerrar guiados por tiempo y el final de un arrastre). Un solo reproductor: estado de módulo.

interface Geometry {
  sheet: HTMLElement;
  /** Rectángulos de diseño (sin transformar, con la hoja en su sitio). */
  frame: DOMRect;
  mini: DOMRect;
  big: DOMRect;
  art: DOMRect;
  /** Recorrido de la hoja: de la barra a arriba. */
  travel: number;
  barH: number;
  /** Lado del halo de luz sin escalar (px). */
  bloomSize: number;
  parts: Record<"surface" | "bloom" | "backdrop" | "art" | "header" | "grabber" | "controls", HTMLElement | null>;
  barCover: HTMLElement | null;
  barParts: HTMLElement[];
  nav: HTMLElement | null;
}

type Pose = [HTMLElement | null, Keyframe];

let geo: Geometry | null = null;
let p = 0;
let anims: Animation[] = [];
let heading: { target: number; from: number; done?: () => void } | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function poses(at: number, g: Geometry): Pose[] {
  const { frame, mini, big, art, travel } = g;
  const sheetY = travel * (1 - at);
  // Portada: x decelera e y va al paso del dedo, así hace un arco y no una diagonal. Se mueve el contenedor (.now-art), con origen en su esquina.
  const left = lerp(mini.left, big.left, 1 - (1 - at) ** 2);
  const top = lerp(mini.top, big.top, at);
  const s = lerp(mini.width, big.width, at) / big.width;
  const artX = left - art.left - s * (big.left - art.left);
  const artY = top - (art.top + sheetY) - s * (big.top - art.top);
  // La luz de la portada: un halo que sale de la miniatura, la acompaña y crece hasta llenar la pantalla mientras el ambiente (lienzo)
  // se enciende debajo; después se apaga y queda el ambiente. El lienzo no se escala: sus bordes duros se leían como otra tarjeta.
  const w = s * big.width;
  const bloomScale = lerp((w * 2.4) / g.bloomSize, (Math.hypot(frame.width, frame.height) * 1.3) / g.bloomSize, at);
  const bloomX = left + w / 2 - frame.left - g.bloomSize / 2;
  const bloomY = top + w / 2 - frame.top - sheetY - g.bloomSize / 2;
  const fadeIn = (from: number) => String(ramp(at, from, 1));
  const out: Pose[] = [
    [g.sheet, { transform: `translateY(${sheetY}px)` }],
    [g.parts.surface, { transform: `scaleY(${lerp(g.barH / frame.height, 1, at)})`, opacity: String(ramp(at, 0, 0.12)) }],
    [g.parts.bloom, { transform: `translate(${bloomX}px, ${bloomY}px) scale(${bloomScale})`, opacity: String(ramp(at, 0, 0.2) * (1 - ramp(at, 0.6, 1))) }],
    [g.parts.backdrop, { opacity: String(ramp(at, 0.25, 0.9)) }],
    [g.parts.art, { transform: `translate(${artX}px, ${artY}px) scale(${s})` }],
    [g.parts.header, { opacity: fadeIn(0.5) }],
    [g.parts.grabber, { opacity: fadeIn(0.5) }],
    [g.parts.controls, { opacity: fadeIn(0.45), transform: `translateY(${(1 - at) * 32}px)` }],
    [g.barCover, { opacity: at > 0 ? "0" : "1" }], // la portada grande ya está en su sitio, encima
    [g.nav, { opacity: String(1 - ramp(at, 0, 0.5)) }],
  ];
  for (const part of g.barParts) out.push([part, { opacity: String(1 - ramp(at, 0, 0.15)) }]);
  return out;
}

const write = (at: number) => {
  if (!geo) return;
  for (const [el, frame] of poses(at, geo)) if (el) Object.assign(el.style, frame);
};

const all = (g: Geometry) => [g.sheet, ...Object.values(g.parts), g.barCover, g.nav, ...g.barParts].filter((el): el is HTMLElement => Boolean(el));

/** p de la animación en curso (la de la hoja es lineal en p: su avance da p exacto). */
function current(): number {
  const sheet = anims[0];
  if (!heading || !sheet) return p;
  const progress = sheet.effect?.getComputedTiming().progress ?? 1;
  return lerp(heading.from, heading.target, progress ?? 1);
}

function stopAnimations() {
  p = current();
  for (const anim of anims) anim.cancel();
  anims = [];
  heading = null;
}

function measure(sheet: HTMLElement): Geometry | null {
  const shell = sheet.closest(".shell");
  const bar = shell?.querySelector<HTMLElement>(".player-bar");
  const cover = sheet.querySelector<HTMLElement>(".now-slot:not([data-side]) .now-cover");
  if (!bar || !cover) return null;
  const parts = {
    surface: sheet.querySelector<HTMLElement>(".now-surface"),
    bloom: sheet.querySelector<HTMLElement>(".now-bloom"),
    backdrop: sheet.querySelector<HTMLElement>(":scope > .backdrop"),
    art: sheet.querySelector<HTMLElement>(".now-art"),
    header: sheet.querySelector<HTMLElement>(".now-header"),
    grabber: sheet.querySelector<HTMLElement>(".now-grabber"),
    controls: sheet.querySelector<HTMLElement>(".now-controls"),
  };
  for (const el of [sheet, parts.art]) if (el) el.style.transform = ""; // rectángulos de diseño
  const barCover = bar.querySelector<HTMLElement>(".bar-cover");
  const frame = sheet.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  return {
    sheet,
    frame,
    mini: (barCover ?? bar).getBoundingClientRect(),
    big: cover.getBoundingClientRect(),
    art: parts.art!.getBoundingClientRect(),
    travel: barRect.top - frame.top,
    barH: barRect.height,
    bloomSize: parts.bloom?.offsetWidth || 1,
    parts,
    barCover,
    barParts: [...bar.querySelectorAll<HTMLElement>(":scope > :is(.bar-progress, .bar-center, .bar-mini, .bar-end), .bar-copy")],
    // La barra inferior solo existe en móvil; en escritorio la navegación es la columna lateral y no se apaga.
    nav: matchMedia("(max-width: 999px)").matches ? shell!.querySelector<HTMLElement>(".nav") : null,
  };
}

/** Deja de transformar: estilos en línea fuera, la hoja visible o no según dónde quedó. */
function finish() {
  if (!geo) return;
  const g = geo;
  for (const el of all(g)) for (const property of ["transform", "opacity", "visibility"] as const) el.style[property] = "";
  // Cerrada: oculta ya (React la marca data-closed después de la salida), así no tapa la barra ni recibe toques.
  if (p === 0) g.sheet.style.visibility = "hidden";
  g.sheet.removeAttribute("data-morph");
  wakeBackdrop(false);
  geo = null;
}

/**
 * Empieza (o agarra a mitad) la transformación: mide una vez, hace visible la hoja y la deja en la pose actual. Devuelve p y el
 * recorrido en px (para convertir el arrastre en p). Null si falta algo que medir.
 */
export function morphStart(sheet: HTMLElement): { at: number; travel: number } | null {
  stopAnimations();
  const g = measure(sheet);
  if (!g) return null;
  geo = g;
  sheet.setAttribute("data-morph", "");
  sheet.style.visibility = "visible";
  wakeBackdrop(true);
  write(p);
  return { at: p, travel: g.travel };
}

export function morphDrag(at: number) {
  p = clamp01(at);
  write(p);
}

export const morphActive = () => geo !== null;

/**
 * Lleva la transformación a 0 o 1. Sin `velocity` (p/ms) va guiada por tiempo: abrir dura --slow y cerrar --exit, en proporción a lo
 * que falta. Con velocidad, la heredada: la curva --ease arranca a ≈ 4 veces su velocidad media, así que dura 4·distancia/velocidad,
 * entre --fast y --slow. `done` se llama al llegar (no si otra orden la interrumpe).
 */
export function morphTo(sheet: HTMLElement, target: 0 | 1, { velocity, done }: { velocity?: number; done?: () => void } = {}) {
  if (heading?.target === target && geo) {
    heading.done = done ?? heading.done;
    return;
  }
  if (motionReduced()) {
    // Movimiento reducido: sin recorrido. Abrir es un fundido corto de la hoja ya en su sitio; cerrar, al instante.
    stopAnimations();
    if (!geo && !morphStart(sheet)) return done?.();
    p = target;
    finish();
    if (target === 1) sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tokenMs("--fast"), easing: tokenValue("--ease") });
    return done?.();
  }
  if (!geo) {
    if (target === 0 && p === 0) return done?.(); // ya cerrada
    if (!morphStart(sheet)) return done?.();
  } else stopAnimations();
  const g = geo!;
  const from = p;
  const distance = Math.abs(target - from);
  const speed = velocity !== undefined && Math.sign(velocity) === (target > from ? 1 : -1) ? Math.abs(velocity) : 0;
  const duration = speed > 0 ? Math.min(Math.max((4 * distance) / speed, tokenMs("--fast")), tokenMs("--slow")) : tokenMs(target === 1 ? "--slow" : "--exit") * distance;
  heading = { target, from, done };
  if (duration < 1) return settle();
  // Cada elemento recibe su pose muestreada en p (lineal entre muestras) y la curva va en el tiempo: pose(ease(t)).
  const steps = 10;
  const frames = new Map<HTMLElement, Keyframe[]>();
  for (let i = 0; i <= steps; i++) {
    for (const [el, frame] of poses(lerp(from, target, i / steps), g)) if (el) (frames.get(el) ?? frames.set(el, []).get(el)!).push(frame);
  }
  const easing = tokenValue("--ease");
  anims = [...frames].map(([el, list]) => el.animate(list, { duration, easing, fill: "forwards" }));
  anims[0].finished.then(settle, () => undefined); // cancelada: la interrumpió otra orden
}

function settle() {
  const done = heading?.done;
  p = heading?.target ?? p;
  for (const anim of anims) anim.cancel();
  anims = [];
  heading = null;
  write(p);
  finish();
  done?.();
}
