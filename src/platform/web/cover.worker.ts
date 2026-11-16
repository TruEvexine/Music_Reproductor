// Trabajo de píxeles de portadas fuera del hilo principal: reescalar a los píxeles reales de pantalla y sacar la paleta.
// Worker propio: el de metadatos tiene un tiempo máximo por archivo y se reinicia.
import { paletteFromPixels } from "../../core/palette";
import type { Palette } from "../../core/palette";
import { scaleBitmap } from "./coverScale";

/** `px`: reescalar a ese lado. `make`: hacer la portada completa de una imagen elegida por el usuario. Sin ninguno: calcular la paleta (core/palette, sobre 32×32 px). */
export interface CoverScaleJob {
  id: number;
  blob: Blob;
  px?: number;
  make?: true;
}
export interface MadeCover {
  small: Blob;
  large: Blob;
  master: Blob;
  largeSide: number;
  palette: Palette;
}
export interface CoverScaleReply {
  id: number;
  blob?: Blob;
  palette?: Palette;
  made?: MadeCover;
}

// Mismos tamaños que las portadas incrustadas (metadata.worker.ts). Volver a codificar en JPEG quita los metadatos (EXIF, GPS) de la imagen elegida.
const MASTER_SIDE = 1024;
const THUMB_SIZES = { small: 96, large: 600 } as const;
/** Una imagen pequeña en bytes puede ser enorme en píxeles: por encima de esto (≈ 160 MB en RGBA) no se reescala. Si ya al decodificar falta memoria, solo cae este worker. */
const MAX_PIXELS = 40_000_000;

async function make(blob: Blob): Promise<MadeCover | undefined> {
  const bitmap = await createImageBitmap(blob); // aplica la orientación EXIF antes de que se pierda
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) return undefined;
    const side = Math.min(bitmap.width, bitmap.height);
    const [small, large, master] = await Promise.all([
      scaleBitmap(bitmap, Math.min(THUMB_SIZES.small, side), 0.86),
      scaleBitmap(bitmap, Math.min(THUMB_SIZES.large, side), 0.86),
      scaleBitmap(bitmap, Math.min(MASTER_SIDE, side), 0.86),
    ]);
    return { small, large, master, largeSide: Math.min(THUMB_SIZES.large, side), palette: await palette(small) };
  } finally {
    bitmap.close();
  }
}

const scope = self as unknown as { onmessage: ((event: MessageEvent<CoverScaleJob>) => void) | null; postMessage(data: CoverScaleReply): void };

async function palette(blob: Blob): Promise<Palette> {
  const bitmap = await createImageBitmap(blob, { resizeWidth: 32, resizeHeight: 32, resizeQuality: "medium" });
  const canvas = new OffscreenCanvas(32, 32);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, 32, 32);
  bitmap.close();
  return paletteFromPixels(context.getImageData(0, 0, 32, 32).data);
}

scope.onmessage = async ({ data: { id, blob, px, make: making } }) => {
  try {
    if (making) return scope.postMessage({ id, made: await make(blob) });
    if (!px) return scope.postMessage({ id, palette: await palette(blob) });
    const bitmap = await createImageBitmap(blob);
    const scaled = await scaleBitmap(bitmap, px, 0.92);
    bitmap.close();
    scope.postMessage({ id, blob: scaled });
  } catch {
    scope.postMessage({ id }); // imagen corrupta o sin memoria: se queda la portada guardada (o la paleta neutra)
  }
};
