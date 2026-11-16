const allowedCoverTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * El MIME de una portada viene del tag del archivo y no es de fiar: un archivo
 * manipulado puede declarar image/svg+xml o text/html. Solo se aceptan imágenes
 * de mapa de bits; lo demás se descarta (undefined).
 */
export function safeCoverMime(declared: string | undefined): string | undefined {
  const type = (declared ?? "").trim().toLowerCase().split(";")[0];
  if (type === "image/jpg" || type === "jpg" || type === "jpeg") return "image/jpeg";
  if (type === "png") return "image/png";
  return allowedCoverTypes.has(type) ? type : undefined;
}
