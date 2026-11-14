// Perfil básico, solo local: nombre opcional (empieza vacío) y foto. Puro y sin DOM; state/profile.ts guarda y ui/ProfileSection.tsx pinta.
import { safeCoverMime } from "./coverMime";

export const MAX_NAME = 60;
/** Lado de la foto guardada: se recorta a cuadrado y se reduce a esto (unos 15 a 30 KB). */
export const AVATAR_PX = 256;
export const MAX_AVATAR_BYTES = 12 * 1024 * 1024;

/** Nombre limpio: espacios juntos y sin los de los extremos, hasta 60 caracteres (sin partir un emoji). Lo que no es texto es «sin nombre». */
export function sanitizeName(raw: unknown): string {
  return typeof raw === "string" ? [...raw.replace(/\s+/g, " ").trim()].slice(0, MAX_NAME).join("") : "";
}

/** ¿Se acepta este archivo como foto? Mismas reglas que las portadas: ≤ 12 MB y solo mapas de bits (nunca SVG ni HTML con nombre de imagen). */
export function checkAvatar(file: { type: string; size: number }): "ok" | "size" | "type" {
  if (!safeCoverMime(file.type)) return "type";
  return file.size > MAX_AVATAR_BYTES ? "size" : "ok";
}

/** El cuadrado centrado más grande de una imagen de `width` × `height`: de ahí sale la foto. */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}
