// Reescala una portada a los píxeles reales de pantalla. Worker propio: el de metadatos tiene un tiempo máximo por archivo y se reinicia.
import { scaleBitmap } from "./coverScale";

export interface CoverScaleJob {
  id: number;
  blob: Blob;
  px: number;
}
export interface CoverScaleReply {
  id: number;
  blob?: Blob;
}

const scope = self as unknown as { onmessage: ((event: MessageEvent<CoverScaleJob>) => void) | null; postMessage(data: CoverScaleReply): void };

scope.onmessage = async ({ data: { id, blob, px } }) => {
  try {
    const bitmap = await createImageBitmap(blob);
    const scaled = await scaleBitmap(bitmap, px, 0.92);
    bitmap.close();
    scope.postMessage({ id, blob: scaled });
  } catch {
    scope.postMessage({ id }); // imagen corrupta o sin memoria: se queda la portada guardada
  }
};
