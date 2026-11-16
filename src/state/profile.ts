import { create } from "zustand";
import { AVATAR_PX, checkAvatar, sanitizeName, squareCrop } from "../core/profile";
import { storage } from "../platform";

// Perfil básico, solo en este dispositivo: nombre (clave kv `profile.name`, vacío por defecto) y foto (`profile.avatar`, un JPEG de 256 px).
// Nada de esto se sube ni se sincroniza con la cuenta. Borrar los datos del dispositivo lo vacía (storage.clear).
export const useProfile = create<{ name: string; avatarUrl: string | null }>(() => ({ name: "", avatarUrl: null }));

function show(blob: Blob | undefined) {
  const previous = useProfile.getState().avatarUrl;
  if (previous) URL.revokeObjectURL(previous); // las URL blob: se revocan al dejar de usarse (AGENTS §5)
  useProfile.setState({ avatarUrl: blob ? URL.createObjectURL(blob) : null });
}

/** Recorta a cuadrado y reduce a 256 px en un canvas. Volver a codificar quita los metadatos de la foto original, incluida la ubicación GPS. */
async function reencode(file: File): Promise<Blob | undefined> {
  const image = await createImageBitmap(file); // aplica la orientación EXIF antes de que se pierda
  try {
    const { sx, sy, side } = squareCrop(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_PX;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#1b1a18"; // un PNG con transparencia no queda sobre negro puro
    context.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
    context.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", 0.85));
  } finally {
    image.close();
  }
}

export const profile = {
  async setName(raw: string) {
    const name = sanitizeName(raw);
    useProfile.setState({ name });
    if (name) await storage.set("profile.name", name);
    else await storage.delete("profile.name");
    return name;
  },
  /** «ok», o el motivo por el que no se guardó: «size» (más de 12 MB), «type» (no es un mapa de bits) o «unreadable» (no se pudo decodificar). */
  async setAvatar(file: File): Promise<"ok" | "size" | "type" | "unreadable"> {
    const check = checkAvatar(file);
    if (check !== "ok") return check;
    const blob = await reencode(file).catch(() => undefined);
    if (!blob) return "unreadable";
    await storage.set("profile.avatar", blob);
    show(blob);
    return "ok";
  },
  async removeAvatar() {
    show(undefined);
    await storage.delete("profile.avatar");
  },
};

export async function initProfile() {
  const [name, avatar] = await Promise.all([storage.get<string>("profile.name"), storage.get<Blob>("profile.avatar")]);
  useProfile.setState({ name: sanitizeName(name) });
  if (avatar instanceof Blob) show(avatar);
}
