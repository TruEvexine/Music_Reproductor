import { describe, expect, it } from "vitest";
import { coverBucket, ENLARGE_SHARPEN, halvings, MAX_COVER_PX, resample, unsharp } from "./resample";
import type { Raster } from "./resample";

const raster = (width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Raster => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([...pixel(x, y), 255], (y * width + x) * 4);
  }
  return { data, width, height };
};

/** Portada sintética parecida a una real: fondo suave, formas de bordes duros con su antialiasing y barras finas. Determinista. */
const detailed = (side: number) => {
  const edge = (distance: number) => Math.min(1, Math.max(0, 0.5 + distance * side)); // cobertura de un borde con ~1 px de antialiasing
  const mix = (base: number[], color: number[], cover: number) => base.map((value, i) => value + (color[i] - value) * cover);
  return raster(side, side, (x, y) => {
    const u = (x + 0.5) / side;
    const v = (y + 0.5) / side;
    let pixel = [40 + 90 * u, 30 + 70 * v, 100 + 80 * (1 - u)];
    pixel = mix(pixel, [235, 190, 90], edge(0.22 - Math.hypot(u - 0.35, v - 0.4)));
    pixel = mix(pixel, [245, 245, 238], edge(Math.min(u - 0.55, 0.85 - u, v - 0.2, 0.5 - v)));
    const bar = Math.abs(((u * 12) % 1) - 0.5) / 12; // barras verticales de 0,02 de ancho cada 1/12
    pixel = mix(pixel, [15, 15, 25], v > 0.7 ? edge(0.01 - (0.5 / 12 - bar)) * edge(v - 0.7) : 0);
    return pixel as [number, number, number];
  });
};

/** Reducción por promedio de área (la «vida real» de una portada pequeña bien hecha). */
function area(src: Raster, side: number): Raster {
  const k = src.width / side;
  return raster(side, side, (x, y) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let j = Math.floor(y * k); j < Math.floor((y + 1) * k); j++) {
      for (let i = Math.floor(x * k); i < Math.floor((x + 1) * k); i++, n++) for (let c = 0; c < 3; c++) sum[c] += src.data[(j * src.width + i) * 4 + c];
    }
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  });
}

/** Lo que hace el navegador al ampliar un <img>: interpolación bilineal. */
function bilinear(src: Raster, side: number): Raster {
  const k = src.width / side;
  const at = (x: number, y: number, c: number) => src.data[(Math.min(src.height - 1, Math.max(0, y)) * src.width + Math.min(src.width - 1, Math.max(0, x))) * 4 + c];
  return raster(side, side, (x, y) => {
    const fx = (x + 0.5) * k - 0.5;
    const fy = (y + 0.5) * k - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const channel = (c: number) => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty) + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty;
    return [channel(0), channel(1), channel(2)];
  });
}

function psnr(a: Raster, b: Raster): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++, n++) sum += (a.data[i + c] - b.data[i + c]) ** 2;
  return 10 * Math.log10((255 * 255) / (sum / n));
}

/** Energía de bordes: gradiente medio de la luminancia. Más alto = más nítida. */
function edges(img: Raster): number {
  const y = (x: number, row: number) => img.data[(row * img.width + x) * 4 + 1];
  let total = 0;
  for (let row = 0; row < img.height - 1; row++) for (let x = 0; x < img.width - 1; x++) total += Math.abs(y(x + 1, row) - y(x, row)) + Math.abs(y(x, row + 1) - y(x, row));
  return total / (img.width * img.height);
}

describe("reescalado Lanczos", () => {
  it("un color liso sigue liso en cualquier tamaño", () => {
    const flat = raster(37, 37, () => [200, 100, 30]);
    for (const side of [20, 37, 80]) {
      const out = resample(flat, side, side);
      expect(Math.max(...out.data.filter((_, i) => i % 4 === 0).map((v) => Math.abs(v - 200)))).toBeLessThanOrEqual(1);
    }
  });

  it("al mismo tamaño no cambia ningún píxel", () => {
    const img = detailed(48);
    expect(Array.from(resample(img, 48, 48).data)).toEqual(Array.from(img.data));
  });

  it("no hay bordes de color ni valores fuera de rango en un salto duro (el recorte lo impide)", () => {
    const edge = raster(30, 30, (x) => (x < 15 ? [0, 0, 0] : [255, 255, 255]));
    const out = resample(edge, 90, 90);
    expect(out.data.every((value) => value >= 0 && value <= 255)).toBe(true);
    expect(out.data[(45 * 90 + 0) * 4]).toBe(0);
    expect(out.data[(45 * 90 + 89) * 4]).toBe(255);
  });

  it("al ampliar 2,1× se parece más al original que la interpolación bilineal del navegador (PSNR)", () => {
    const truth = detailed(512);
    const small = area(truth, 120);
    const reference = area(truth, 256);
    const before = psnr(reference, bilinear(small, 256));
    const lanczos = psnr(reference, resample(small, 256, 256));
    expect(lanczos).toBeGreaterThan(before + 0.3);
  });

  it("con el enfoque ligero, los bordes ganan nitidez y la fidelidad sigue por encima de la bilineal", () => {
    const truth = detailed(512);
    const small = area(truth, 120);
    const reference = area(truth, 256);
    const soft = bilinear(small, 256);
    const sharp = unsharp(resample(small, 256, 256), ENLARGE_SHARPEN);
    expect(edges(sharp)).toBeGreaterThan(edges(soft) * 1.1);
    expect(psnr(reference, sharp)).toBeGreaterThan(psnr(reference, soft) + 0.3);
  });
});

describe("enfoque con tope", () => {
  const options = { amount: 0.8, radius: 1, cap: 20, threshold: 3 };

  it("una imagen lisa no cambia", () => {
    const flat = raster(16, 16, () => [90, 90, 90]);
    expect(Array.from(unsharp(flat, options).data)).toEqual(Array.from(flat.data));
  });

  it("en un borde duro el realce nunca pasa del tope (sin halos) y no modifica la entrada", () => {
    const edge = raster(40, 8, (x) => (x < 20 ? [60, 60, 60] : [200, 200, 200]));
    const copy = Array.from(edge.data);
    const out = unsharp(edge, options);
    let worst = 0;
    for (let i = 0; i < out.data.length; i += 4) worst = Math.max(worst, Math.abs(out.data[i] - edge.data[i]));
    expect(worst).toBeLessThanOrEqual(options.cap);
    expect(worst).toBeGreaterThan(0);
    expect(Array.from(edge.data)).toEqual(copy);
  });

  it("el umbral deja el ruido fino y los artefactos suaves como están", () => {
    const noisy = raster(24, 24, (x, y) => [128 + ((x * 7 + y * 13) % 3) - 1, 128, 128]);
    expect(Array.from(unsharp(noisy, { ...options, threshold: 4 }).data)).toEqual(Array.from(noisy.data));
  });

  it("el enfoque de una ampliación es ligero: tope bajo y umbral que respeta el ruido", () => {
    expect(ENLARGE_SHARPEN.amount).toBeLessThanOrEqual(0.5);
    expect(ENLARGE_SHARPEN.cap).toBeLessThanOrEqual(16);
    expect(ENLARGE_SHARPEN.threshold).toBeGreaterThan(0);
  });
});

describe("reducción por pasos", () => {
  it("mitades mientras la mitad no baje del destino; lo que sobra (1×–2×) lo hace Lanczos", () => {
    expect(halvings(4000, 640)).toEqual([2000, 1000]);
    expect(halvings(1280, 640)).toEqual([640]);
    expect(halvings(900, 640)).toEqual([]);
    expect(halvings(300, 640)).toEqual([]);
  });
});

describe("tamaño según la pantalla", () => {
  it("redondea hacia arriba a múltiplos de 64, con tope y sin tamaños inventados para 0", () => {
    expect(coverBucket(640)).toBe(640);
    expect(coverBucket(641)).toBe(704);
    expect(coverBucket(1088)).toBe(1088);
    expect(coverBucket(9000)).toBe(MAX_COVER_PX);
    expect(coverBucket(0)).toBe(0);
    expect(coverBucket(NaN)).toBe(0);
  });
});
