const allowedCoverTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * El MIME de una portada viene del tag del archivo y no es de fiar: un archivo
 * manipulado puede declarar image/svg+xml o text/html. Solo se aceptan imágenes
 * de mapa de bits; lo demás se descarta (undefined).
 */
export type ChosenImageType = "image/jpeg" | "image/png" | "image/webp";

/** Tipo de una imagen elegida por el usuario según sus primeros bytes (no por la extensión ni por lo que declara): JPEG, PNG o WebP; lo demás, undefined. */
export function sniffImageType(bytes: Uint8Array): ChosenImageType | undefined {
  const starts = (offset: number, ...values: number[]) => values.every((value, i) => bytes[offset + i] === value);
  if (starts(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0, 0x52, 0x49, 0x46, 0x46) && starts(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp"; // «RIFF» … «WEBP»
  return undefined;
}

export function safeCoverMime(declared: string | undefined): string | undefined {
  const type = (declared ?? "").trim().toLowerCase().split(";")[0];
  if (type === "image/jpg" || type === "jpg" || type === "jpeg") return "image/jpeg";
  if (type === "png") return "image/png";
  return allowedCoverTypes.has(type) ? type : undefined;
}
