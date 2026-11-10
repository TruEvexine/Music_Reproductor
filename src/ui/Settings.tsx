import { useState } from "react";
import { Moon, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { EQ_BANDS, EQ_LIMIT_DB, EQ_PRESETS, MAX_CROSSFADE, presetNameOf } from "../core/audio";
import type { ReplayGainMode } from "../core/audio";
import { player, usePlayer } from "../state/player";
import { Dialog, icon, IconButton, iconSmall } from "./parts";

export function VolumeControl() {
  const volume = usePlayer((state) => state.audio.volume);
  const muted = usePlayer((state) => state.audio.muted);
  return (
    <div className="volume">
      <IconButton label={muted ? "Activar sonido" : "Silenciar"} onClick={player.toggleMute}>
        {muted || volume === 0 ? <VolumeX {...icon} /> : <Volume2 {...icon} />}
      </IconButton>
      <input
        aria-label="Volumen"
        aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} %`}
        max={1}
        min={0}
        onChange={(event) => player.setVolume(Number(event.currentTarget.value))}
        step={0.01}
        style={{ "--progress": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
        type="range"
        value={muted ? 0 : volume}
      />
    </div>
  );
}

const sleepOptions: { label: string; value: number | "track" }[] = [
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "60 minutos", value: 60 },
  { label: "Al terminar la canción", value: "track" },
];

const replayLabels: Record<ReplayGainMode, string> = { off: "Desactivado", track: "Por canción", album: "Por álbum" };

function SleepRow() {
  const sleep = usePlayer((state) => state.sleep);
  return (
    <fieldset className="settings-group">
      <legend>
        <Moon {...iconSmall} /> Apagar música
      </legend>
      <div className="chips">
        {sleepOptions.map((option) => (
          <button className="chip" key={option.label} onClick={() => player.setSleep(option.value)} type="button">
            {option.label}
          </button>
        ))}
        <button className="chip" disabled={sleep === null} onClick={() => player.setSleep(null)} type="button">
          Cancelar
        </button>
      </div>
      <p className="subtitle" role="status">
        {sleep === null
          ? "Sin temporizador."
          : "endOfTrack" in sleep
            ? "Se detendrá al terminar esta canción."
            : `Se apagará a las ${new Date(sleep.endsAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}.`}
      </p>
    </fieldset>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const audio = usePlayer((state) => state.audio);
  const [tab, setTab] = useState<"audio" | "eq">("audio");
  const preset = presetNameOf(audio.eqGains);
  return (
    <Dialog onClose={onClose} title="Sonido">
      <div className="tabs" role="tablist">
        {(["audio", "eq"] as const).map((id) => (
          <button aria-selected={tab === id} className="tab" key={id} onClick={() => setTab(id)} role="tab" type="button">
            {id === "audio" ? "General" : "Ecualizador"}
          </button>
        ))}
      </div>
      {tab === "audio" ? (
        <div className="form">
          <label>
            Fundido entre canciones: {audio.crossfade === 0 ? "desactivado" : `${audio.crossfade} s`}
            <input
              max={MAX_CROSSFADE}
              min={0}
              onChange={(event) => player.setAudio({ crossfade: Number(event.currentTarget.value) })}
              step={1}
              type="range"
              value={audio.crossfade}
            />
          </label>
          <label>
            Nivelar volumen (ReplayGain)
            <select onChange={(event) => player.setAudio({ replayGain: event.currentTarget.value as ReplayGainMode })} value={audio.replayGain}>
              {(Object.keys(replayLabels) as ReplayGainMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {replayLabels[mode]}
                </option>
              ))}
            </select>
            <span className="hint">Solo actúa en canciones que traen esa información en sus etiquetas.</span>
          </label>
          <SleepRow />
        </div>
      ) : (
        <div className="form">
          <label className="switch">
            <input checked={audio.eqEnabled} onChange={(event) => player.setAudio({ eqEnabled: event.currentTarget.checked })} type="checkbox" />
            Ecualizador activado
          </label>
          <label>
            Preajuste
            <select
              onChange={(event) => player.setAudio({ eqGains: [...EQ_PRESETS[event.currentTarget.value]], eqEnabled: true })}
              value={preset ?? ""}
            >
              {preset === undefined && <option value="">Personalizado</option>}
              {Object.keys(EQ_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="eq" role="group" aria-label="Bandas del ecualizador">
            {EQ_BANDS.map((frequency, index) => (
              <label className="eq-band" key={frequency}>
                <input
                  aria-label={`${frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`}`}
                  aria-valuetext={`${audio.eqGains[index]} dB`}
                  disabled={!audio.eqEnabled}
                  max={EQ_LIMIT_DB}
                  min={-EQ_LIMIT_DB}
                  onChange={(event) => {
                    const gains = [...audio.eqGains];
                    gains[index] = Number(event.currentTarget.value);
                    player.setAudio({ eqGains: gains });
                  }}
                  step={1}
                  type="range"
                  value={audio.eqGains[index]}
                />
                <span className="time">{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <IconButton label="Sonido: ecualizador y ajustes" onClick={onOpen}>
      <SlidersHorizontal {...icon} />
    </IconButton>
  );
}
