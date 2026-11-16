import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { trackCoverSeed } from "../core/coverArt";
import { editFromForm, formOf, isEdited, originalOf } from "../core/edits";
import type { EditForm, NumberField, TextField } from "../core/edits";
import { UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "../core/track";
import type { Track } from "../core/track";
import { prepareCover } from "../state/covers";
import type { CoverRecord } from "../state/covers";
import { library } from "../state/library";
import { Cover, Dialog, IconButton, iconSmall } from "./parts";
import { toast } from "./toast";

// Editar la información de una canción (core/edits.ts): nada se escribe en el archivo. Lo editado se guarda aparte y se ve en toda la app;
// playlists, cola, historial y sincronización siguen usando lo que dice el archivo.

type Key = TextField | NumberField;
const LABELS: Record<Key, string> = {
  title: "Título",
  artist: "Artista",
  albumArtist: "Artista del álbum",
  album: "Álbum",
  year: "Año",
  genre: "Género",
  trackNumber: "N.º de pista",
  discNumber: "N.º de disco",
};
const INVALID: Record<NumberField, string> = {
  year: "Escribe un año de 1 a 9999, o déjalo vacío.",
  trackNumber: "Escribe un número de 1 a 999, o déjalo vacío.",
  discNumber: "Escribe un número de 1 a 999, o déjalo vacío.",
};
const COVER_ERRORS = {
  size: "Esa imagen pesa más de 12 MB. Elige una más ligera.",
  type: "Ese archivo no es una imagen JPG, PNG o WebP.",
  unreadable: "No se pudo abrir esa imagen. Prueba con otra.",
} as const;

function Field({
  name,
  form,
  original,
  invalid,
  onChange,
  numeric,
}: {
  name: Key;
  form: EditForm;
  original: EditForm;
  invalid: boolean;
  onChange: (name: Key, value: string) => void;
  numeric?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const changed = form[name].trim() !== original[name] && !(name === "title" && !form[name].trim());
  const label = LABELS[name];
  return (
    <div className={`edit-field edit-${name}`}>
      <label htmlFor={id}>{label}</label>
      <div className="edit-input">
        <input
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          enterKeyHint="done"
          id={id}
          inputMode={numeric ? "numeric" : undefined}
          maxLength={numeric ? 4 : 200}
          onChange={(event) => onChange(name, event.currentTarget.value)}
          placeholder={name === "title" ? original.title : undefined}
          ref={input}
          spellCheck={!numeric}
          type="text"
          value={form[name]}
        />
        {changed && (
          <IconButton
            label={`Restablecer ${label.toLocaleLowerCase()}`}
            onClick={() => {
              onChange(name, original[name]);
              input.current?.focus();
            }}
          >
            <RotateCcw {...iconSmall} />
          </IconButton>
        )}
      </div>
      <p className={invalid ? "hint error" : "hint"} id={`${id}-hint`}>
        {invalid
          ? INVALID[name as NumberField]
          : name === "title" && !form.title.trim()
            ? "Vacío vuelve al título del archivo."
            : changed
              ? `Original: ${original[name] ? `«${original[name]}»` : "vacío"}`
              : ""}
      </p>
    </div>
  );
}

/** La carátula elegida, mientras no se guarda: se ve desde su miniatura grande, sin pasar por el almacén de portadas. */
function usePreview(record: CoverRecord | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!record) return setUrl(undefined);
    const created = URL.createObjectURL(record.large);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [record]);
  return url;
}

export function EditDialog({ track, onClose }: { track: Track; onClose: () => void }) {
  const original = originalOf(track);
  const fromFile = formOf(original);
  const [form, setForm] = useState(() => formOf(track));
  const [invalid, setInvalid] = useState<NumberField[]>([]);
  // Carátula: el hash elegido (undefined = la del archivo) y, si es nueva, la ya preparada que se guardará al pulsar «Guardar».
  const [coverHash, setCoverHash] = useState(isEdited(track, "coverHash") ? track.coverHash : undefined);
  const [prepared, setPrepared] = useState<CoverRecord>();
  const [coverState, setCoverState] = useState<{ busy?: true; error?: string }>({});
  const [saving, setSaving] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const preview = usePreview(prepared?.hash === coverHash ? prepared : undefined);

  const change = (name: Key, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    setInvalid((current) => current.filter((key) => key !== name));
  };
  const differs = (Object.keys(fromFile) as Key[]).some((key) => form[key].trim() !== fromFile[key]) || coverHash !== undefined;
  // La funda por defecto se recalcula con lo escrito (estable por álbum): así se ve antes de guardar.
  const seed = trackCoverSeed({
    title: form.title.trim() || original.title,
    artist: form.artist.trim() || UNKNOWN_ARTIST,
    album: form.album.trim() || UNKNOWN_ALBUM,
    albumArtist: form.albumArtist.trim() || undefined,
  });
  const name = form.title.trim() || original.title;

  async function choose(file: File | undefined) {
    if (!file) return;
    setCoverState({ busy: true });
    const result = await prepareCover(file);
    if (typeof result === "string") return setCoverState({ error: COVER_ERRORS[result] });
    setPrepared(result);
    setCoverHash(result.hash);
    setCoverState({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { edit, invalid: wrong } = editFromForm(original, form, coverHash);
    if (wrong.length > 0) {
      setInvalid(wrong);
      // El foco va al primer campo que falla; su mensaje lo lee el lector de pantalla (aria-describedby).
      formRef.current?.querySelector<HTMLInputElement>(`.edit-${wrong[0]} input`)?.focus();
      return;
    }
    setSaving(true);
    await library.saveEdit(track.id, edit, prepared);
    onClose();
    toast(edit ? "Información guardada" : "Información del archivo restablecida");
  }

  return (
    <Dialog className="edit-dialog" onClose={onClose} title="Editar información">
      <form className="form edit-form" noValidate onSubmit={(event) => void submit(event)} ref={formRef}>
        <div className="edit-cover">
          {preview ? (
            <span className="cover edit-art">
              <img alt={`Carátula elegida para «${name}»`} src={preview} />
            </span>
          ) : (
            <Cover className="edit-art" hash={coverHash ?? original.coverHash} label={`«${name}»`} seed={seed} size="large" />
          )}
          <div className="edit-cover-actions">
            <button className="button" disabled={coverState.busy} onClick={() => picker.current?.click()} type="button">
              {coverState.busy ? "Preparando…" : "Elegir imagen"}
            </button>
            {coverHash !== undefined && (
              <button className="link" onClick={() => (setCoverHash(undefined), setCoverState({}))} type="button">
                Usar la del archivo
              </button>
            )}
            <p className={coverState.error ? "hint error" : "hint"} role={coverState.error ? "alert" : "status"}>
              {coverState.error ?? (coverState.busy ? "Preparando la imagen…" : "JPG, PNG o WebP, hasta 12 MB. Se guarda solo en este dispositivo.")}
            </p>
            <input
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void choose(event.currentTarget.files?.[0]);
                event.currentTarget.value = ""; // elegir la misma imagen otra vez vuelve a avisar
              }}
              ref={picker}
              tabIndex={-1}
              type="file"
            />
          </div>
        </div>
        <div className="edit-fields">
          {(["title", "artist", "albumArtist", "album", "genre"] as const).map((key) => (
            <Field form={form} invalid={false} key={key} name={key} onChange={change} original={fromFile} />
          ))}
          <div className="edit-numbers">
            {(["year", "trackNumber", "discNumber"] as const).map((key) => (
              <Field form={form} invalid={invalid.includes(key)} key={key} name={key} numeric onChange={change} original={fromFile} />
            ))}
          </div>
          <p className="hint edit-note">Tus archivos no cambian: esto se guarda solo en este dispositivo y no se sube.</p>
        </div>
        <div className="dialog-actions edit-actions">
          {differs && (
            <button
              className="link edit-reset"
              onClick={() => {
                setForm(fromFile);
                setInvalid([]);
                setCoverHash(undefined);
                setCoverState({});
              }}
              type="button"
            >
              Restablecer todo
            </button>
          )}
          <button className="button" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="button primary" disabled={saving || coverState.busy} type="submit">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
