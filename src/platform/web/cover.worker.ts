// Trabajo de píxeles de portadas fuera del hilo principal: reescalar a los píxeles reales de pantalla y sacar la paleta.
// Worker propio: el de metadatos tiene un tiempo máximo por archivo y se reinicia.
import { paletteFromPixels } from "../../core/palette";
import type { Palette } from "../../core/palette";
import { scaleBitmap } from "./coverScale";

/** `px`: reescalar a ese lado. Sin `px`: calcular la paleta (core/palette, sobre 32×32 px como antes en el hilo principal). */
export interface CoverScaleJob {
  id: number;
  blob: Blob;
  px?: number;
}
export interface CoverScaleReply {
  id: number;
  blob?: Blob;
  palette?: Palette;
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

scope.onmessage = async ({ data: { id, blob, px } }) => {
  try {
    if (!px) return scope.postMessage({ id, palette: await palette(blob) });
    const bitmap = await createImageBitmap(blob);
    const scaled = await scaleBitmap(bitmap, px, 0.92);
    bitmap.close();
    scope.postMessage({ id, blob: scaled });
  } catch {
    scope.postMessage({ id }); // imagen corrupta o sin memoria: se queda la portada guardada (o la paleta neutra)
  }
};
