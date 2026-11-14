import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CircleUser } from "lucide-react";
import { MAX_NAME } from "../core/profile";
import { profile, useProfile } from "../state/profile";

const problems = {
  size: "Esa imagen pesa más de 12 MB. Prueba con otra.",
  type: "Ese archivo no es una imagen compatible (JPG, PNG, WebP o GIF).",
  unreadable: "No se pudo leer esa imagen. Prueba con otra.",
} as const;

// Ajustes → Perfil: nombre opcional (empieza vacío) y foto, solo en este dispositivo (docs/producto/PERFIL_Y_RECAPS.md §1).
export function ProfileSection() {
  const saved = useProfile((state) => state.name);
  const avatarUrl = useProfile((state) => state.avatarUrl);
  const [name, setName] = useState(saved);
  const [status, setStatus] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setName(saved), [saved]); // la carga inicial llega después de montar la página

  const save = (event?: FormEvent) => {
    event?.preventDefault();
    void profile.setName(name).then(setName);
  };

  async function choose(chosen: File | undefined) {
    if (!chosen) return;
    const result = await profile.setAvatar(chosen);
    setStatus(result === "ok" ? "Foto guardada en este dispositivo." : problems[result]);
  }

  return (
    <section aria-labelledby="set-profile" className="settings-section">
      <h2 id="set-profile">Perfil</h2>
      <div className="profile">
        <span className="profile-avatar">
          {avatarUrl ? <img alt="Tu foto de perfil" height={256} src={avatarUrl} width={256} /> : <CircleUser aria-hidden="true" size={40} strokeWidth={1.5} />}
        </span>
        <div className="profile-fields">
          <form className="form" onSubmit={save}>
            <label>
              Nombre visible (opcional)
              <input autoComplete="nickname" maxLength={MAX_NAME} onBlur={() => save()} onChange={(event) => setName(event.currentTarget.value)} placeholder="Sin nombre" type="text" value={name} />
            </label>
          </form>
          <div className="dialog-actions">
            <button className="button" onClick={() => file.current?.click()} type="button">
              {avatarUrl ? "Cambiar foto" : "Elegir foto"}
            </button>
            {avatarUrl && (
              <button
                className="button"
                onClick={() => {
                  void profile.removeAvatar();
                  setStatus("Foto quitada.");
                }}
                type="button"
              >
                Quitar foto
              </button>
            )}
          </div>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Elegir foto de perfil"
            className="visually-hidden"
            onChange={(event) => {
              void choose(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            ref={file}
            tabIndex={-1}
            type="file"
          />
        </div>
      </div>
      <p className="hint" role="status">
        {status ?? "Los dos son opcionales y se quedan solo en este dispositivo: no se suben ni se sincronizan con tu cuenta. La foto se recorta a un cuadrado y se guarda reducida, sin la información oculta de la original, como la ubicación."}
      </p>
    </section>
  );
}
