// Escalado de portadas con la mejor calidad que se puede en un worker (OffscreenCanvas): el canvas reduce por mitades exactas y el último tramo
// de una reducción (menos de 2×); al ampliar se usa core/resample.ts: Lanczos y un enfoque ligero con tope.
// Ningún algoritmo clásico añade detalle que no existe; esto evita el desenfoque del navegador al ampliar y el aliasing al reducir.
import { ENLARGE_SHARPEN, halvings, resample, unsharp } from "../../core/resample";

/** Recorta el cuadrado central de `bitmap` y lo entrega de `target` px de lado, en JPEG. Parte siempre de la imagen que recibe, nunca de una miniatura suya. */
export async function scaleBitmap(bitmap: ImageBitmap, target: number, quality: number): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height);
  let source: ImageBitmap | OffscreenCanvas = bitmap;
  let crop: [number, number, number, number] = [(bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side];
  let current = side;
  const draw = (from: ImageBitmap | OffscreenCanvas, rect: typeof crop, size: number) => {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("sin contexto 2D");
    context.imageSmoothingQuality = "high";
    context.drawImage(from, ...rect, 0, 0, size, size);
    return { canvas, context };
  };
  for (const next of halvings(side, target)) {
    source = draw(source, crop, next).canvas;
    crop = [0, 0, next, next];
    current = next;
  }
  if (target <= current) return draw(source, crop, target).canvas.convertToBlob({ type: "image/jpeg", quality }); // reducir: el canvas, nativo y rápido
  const { context } = draw(source, crop, current);
  const final = unsharp(resample(context.getImageData(0, 0, current, current), target, target), ENLARGE_SHARPEN);
  const canvas = new OffscreenCanvas(target, target);
  canvas.getContext("2d")!.putImageData(new ImageData(final.data as Uint8ClampedArray<ArrayBuffer>, target, target), 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
