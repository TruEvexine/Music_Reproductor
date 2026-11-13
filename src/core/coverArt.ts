// Portada generativa para las pistas sin carátula: arte original (sin personajes, marcas ni obras reconocibles), determinista por pista y de coste mínimo.
// Todo sale de un hash del título y el artista: la misma canción tiene siempre la misma portada y dos canciones distintas casi nunca se parecen.
// Los tonos respetan los rangos de DESIGN.md (croma del acento ≤ 0,14; luminosidad entre las superficies y el acento y nunca más oscura que ellas), así que se
// distingue del fondo también en AMOLED; el modo HDR le aplica el mismo filtro de `.cover` que a cualquier portada.

const normalize = (text: string) => text.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** La semilla de una canción: título y artista sin distinguir mayúsculas ni espacios de más. */
export const coverSeed = (title: string, artist: string) => `${normalize(title)}\u0000${normalize(artist)}`;

/**
 * Estilo de la portada sin carátula. «campos» es el actual (arte generativo, arriba). Las otras tres son propuestas de portada natural, sin formas al azar:
 * un tono plano que sale del título (`hueOf`) y, encima, su inicial, una nota musical o el título escrito. Cambiar de estilo es cambiar esta constante.
 */
export type CoverStyle = "campos" | "inicial" | "nota" | "tarjeta";
export const COVER_STYLE: CoverStyle = "campos";

/** FNV-1a de 32 bits. */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

/** mulberry32: números repetibles en [0, 1) a partir de la semilla. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Matiz (0–359) de la portada plana: el mismo título da siempre el mismo tono; luminosidad y croma fijos por estilo (base.css), así todas forman una familia. */
export const hueOf = (seed: string) => (hash32(seed) >>> 8) % 360;

/** Primera letra o cifra del título en mayúscula (la primera letra aunque lleve acento); sin ninguna, el primer carácter; sin nada, una corchea. */
export function initialOf(title: string): string {
  const text = title.normalize("NFC").trim();
  const letter = text.match(/[\p{L}\p{N}]/u)?.[0] ?? Array.from(text)[0];
  return letter ? letter.toLocaleUpperCase("es") : "\u266a";
}

export interface Tone {
  l: number;
  c: number;
  h: number;
}

export interface Art {
  /** Claro, medio y profundo. */
  tones: [Tone, Tone, Tone];
  /** Siete números en [0, 1): el primero elige la composición; los demás, tamaños y posiciones. */
  spots: number[];
}

// Rangos permitidos (los comprueba el test): croma como el acento de DESIGN.md y luminosidad por encima de la superficie más clara,
// para que ninguna portada se pierda contra el negro del modo AMOLED.
export const TONE_LIMITS = { l: [0.24, 0.82], c: [0.03, 0.14] } as const;
const spreads = [26, 38, 150, 180]; // análogos, divididos y complementarios suaves: nunca un arcoíris

export function artOf(seedText: string): Art {
  const next = random(hash32(seedText));
  const hue = next() * 360;
  const spread = spreads[Math.floor(next() * spreads.length)];
  const wrap = (h: number) => ((h % 360) + 360) % 360;
  const tones: Art["tones"] = [
    { l: 0.66 + next() * 0.14, c: 0.08 + next() * 0.05, h: hue },
    { l: 0.44 + next() * 0.12, c: 0.07 + next() * 0.05, h: wrap(hue + spread) },
    { l: 0.26 + next() * 0.08, c: 0.04 + next() * 0.04, h: wrap(hue - spread / 2) },
  ];
  return { tones, spots: Array.from({ length: 7 }, next) };
}

const color = ({ l, c, h }: Tone, alpha = 1) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)}${alpha < 1 ? ` / ${alpha}` : ""})`;
const pct = (value: number) => `${value.toFixed(1)}%`;

/** Un rectángulo plano colocado por su esquina y tamaño en %, sin imágenes ni degradados reales: una capa de `background`. */
const box = (left: number, top: number, width: number, height: number, tone: string) =>
  `linear-gradient(${tone}, ${tone}) ${pct((left / Math.max(1, 100 - width)) * 100)} ${pct((top / Math.max(1, 100 - height)) * 100)} / ${pct(width)} ${pct(height)} no-repeat`;

/** Cuántas composiciones distintas hay (las elige el hash). */
export const LAYOUTS = 3;

/**
 * Valor de `background` de la portada: campos de color planos, de bordes duros, sobre el tono profundo. Tres composiciones (un bloque desplazado con otro dentro,
 * dos mitades con un cuadrado en la costura, un horizonte con un bloque sobre él) con tamaños, posiciones y tonos que salen del hash. `rich` añade una franja
 * (reproductor grande, donde además se mueve despacio); en listas es un `background` estático de dos o tres capas: barato incluso con miles de filas.
 */
export function artBackground(art: Art, rich = false): string {
  const [light, mid, deep] = art.tones;
  const [layout, a, b, c, d, e, f] = art.spots;
  const [bright, soft] = [color(light), color(mid)];
  const layers: string[] = [];
  switch (Math.floor(layout * LAYOUTS)) {
    case 0: {
      const w = 56 + a * 24;
      const h = 56 + b * 24;
      const left = 6 + c * (88 - w);
      const top = 6 + d * (88 - h);
      layers.push(box(left + w * (0.12 + e * 0.3), top + h * (0.14 + f * 0.3), 22 + a * 16, 22 + b * 16, bright), box(left, top, w, h, soft));
      break;
    }
    case 1: {
      const split = 34 + a * 32;
      const size = 22 + b * 14;
      layers.push(box(split - size / 2, 10 + c * (80 - size), size, size, bright), box(0, 0, split, 100, soft));
      break;
    }
    default: {
      const horizon = 42 + a * 22;
      const size = 26 + b * 16;
      layers.push(box(8 + c * (84 - size), horizon - size * (0.55 + d * 0.3), size, size, bright), box(0, horizon, 100, 100 - horizon, soft));
    }
  }
  if (rich) layers.unshift(box(0, 78 + e * 10, 100, 3 + f * 3, color({ ...light, l: 0.5 }, 0.9)));
  return [...layers, color(deep)].join(", ");
}
