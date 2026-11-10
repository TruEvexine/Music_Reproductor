// Ajustes de audio como datos puros: ecualizador, ReplayGain y temporizador. El motor los aplica.

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_LIMIT_DB = 12;

export const EQ_PRESETS: Record<string, readonly number[]> = {
  Plano: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Graves: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Agudos: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  Voz: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Rock: [4, 3, 2, 0, -1, -1, 1, 2, 3, 4],
  Electrónica: [5, 4, 1, 0, -2, 0, 1, 3, 4, 5],
  Acústica: [3, 2, 1, 1, 2, 2, 2, 3, 2, 1],
};

export type ReplayGainMode = "off" | "track" | "album";

export interface AudioSettings {
  volume: number;
  muted: boolean;
  eqEnabled: boolean;
  eqGains: number[];
  /** Segundos de fundido entre pistas (0 = sin crossfade). */
  crossfade: number;
  replayGain: ReplayGainMode;
}

export const defaultAudioSettings: AudioSettings = {
  volume: 1,
  muted: false,
  eqEnabled: false,
  eqGains: [...EQ_PRESETS.Plano],
  crossfade: 0,
  replayGain: "off",
};

export const MAX_CROSSFADE = 12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** Acepta ajustes guardados por cualquier versión anterior (o corruptos) y devuelve unos válidos. */
export function sanitizeAudioSettings(saved: Partial<AudioSettings> | undefined): AudioSettings {
  const s = { ...defaultAudioSettings, ...saved };
  const gains = Array.isArray(s.eqGains) && s.eqGains.length === EQ_BANDS.length ? s.eqGains : defaultAudioSettings.eqGains;
  return {
    volume: clamp(s.volume, 0, 1),
    muted: Boolean(s.muted),
    eqEnabled: Boolean(s.eqEnabled),
    eqGains: gains.map((gain) => clamp(gain, -EQ_LIMIT_DB, EQ_LIMIT_DB)),
    crossfade: clamp(s.crossfade, 0, MAX_CROSSFADE),
    replayGain: s.replayGain === "track" || s.replayGain === "album" ? s.replayGain : "off",
  };
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Preamplificador que compensa la banda más alta, para que subir el EQ no sature. */
export function eqPreampDb(gains: readonly number[]): number {
  return 0 - Math.max(0, ...gains);
}

export function presetNameOf(gains: readonly number[]): string | undefined {
  return Object.keys(EQ_PRESETS).find((name) => EQ_PRESETS[name].every((gain, index) => gain === gains[index]));
}

/**
 * Ganancia lineal de ReplayGain para una pista. Sin tag → 1 (no se toca).
 * En modo álbum, si falta la ganancia de álbum se usa la de pista. Acotada a ±15 dB por si el tag es absurdo.
 */
export function replayGainFor(track: { gainTrackDb?: number; gainAlbumDb?: number } | undefined, mode: ReplayGainMode): number {
  if (!track || mode === "off") return 1;
  const db = mode === "album" ? (track.gainAlbumDb ?? track.gainTrackDb) : track.gainTrackDb;
  return db === undefined || !Number.isFinite(db) ? 1 : dbToGain(clamp(db, -15, 15));
}

/** Temporizador de apagado: a una hora concreta o al terminar la pista actual. */
export type SleepTimer = { endsAt: number } | { endOfTrack: true } | null;

export const SLEEP_FADE_SECONDS = 5;

/** ¿Debe empezar ya el fundido final? */
export function sleepShouldFade(timer: SleepTimer, now: number): boolean {
  if (timer === null) return false;
  if ("endOfTrack" in timer) return false; // se detiene al terminar la pista, sin cortar el final
  return timer.endsAt - now <= SLEEP_FADE_SECONDS * 1000;
}
