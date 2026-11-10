import { describe, expect, it } from "vitest";
import {
  dbToGain,
  eqChainOf,
  defaultAudioSettings,
  EQ_BANDS,
  EQ_PRESETS,
  eqPreampDb,
  presetNameOf,
  replayGainFor,
  sanitizeAudioSettings,
  sleepShouldFade,
} from "./audio";

describe("ecualizador", () => {
  it("todos los presets tienen 10 bandas dentro de ±12 dB", () => {
    for (const gains of Object.values(EQ_PRESETS)) {
      expect(gains).toHaveLength(EQ_BANDS.length);
      expect(Math.max(...gains.map(Math.abs))).toBeLessThanOrEqual(12);
    }
  });

  it("el preamplificador compensa la banda más alta y nunca amplifica", () => {
    expect(eqPreampDb(EQ_PRESETS.Graves)).toBe(-6);
    expect(eqPreampDb([-3, -2, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it("reconoce el preset activo", () => {
    expect(presetNameOf(EQ_PRESETS.Rock)).toBe("Rock");
    expect(presetNameOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeUndefined();
  });
});

describe("ajustes guardados", () => {
  it("sin datos devuelve los valores por defecto", () => {
    expect(sanitizeAudioSettings(undefined)).toEqual(defaultAudioSettings);
  });

  it("corrige valores fuera de rango o corruptos", () => {
    const fixed = sanitizeAudioSettings({
      volume: 7,
      crossfade: 99,
      eqGains: [40, -40, 0, 0, 0, 0, 0, 0, 0, Number.NaN],
      replayGain: "x" as never,
    });
    expect(fixed.volume).toBe(1);
    expect(fixed.crossfade).toBe(12);
    expect(fixed.eqGains.slice(0, 2)).toEqual([12, -12]);
    expect(fixed.eqGains[9]).toBe(-12);
    expect(fixed.replayGain).toBe("off");
    expect(sanitizeAudioSettings({ eqGains: [1, 2] }).eqGains).toEqual(defaultAudioSettings.eqGains);
  });
});

describe("ReplayGain", () => {
  it("dbToGain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });

  it("aplica la ganancia según el modo y deja intactas las pistas sin tag", () => {
    const track = { gainTrackDb: -6, gainAlbumDb: -3 };
    expect(replayGainFor(track, "off")).toBe(1);
    expect(replayGainFor(track, "track")).toBeCloseTo(dbToGain(-6));
    expect(replayGainFor(track, "album")).toBeCloseTo(dbToGain(-3));
    expect(replayGainFor({ gainTrackDb: -6 }, "album")).toBeCloseTo(dbToGain(-6));
    expect(replayGainFor({}, "track")).toBe(1);
    expect(replayGainFor(undefined, "track")).toBe(1);
    expect(replayGainFor({ gainTrackDb: 60 }, "track")).toBeCloseTo(dbToGain(15));
  });
});

describe("temporizador de apagado", () => {
  it("empieza el fundido 5 s antes de la hora", () => {
    expect(sleepShouldFade({ endsAt: 100_000 }, 90_000)).toBe(false);
    expect(sleepShouldFade({ endsAt: 100_000 }, 95_000)).toBe(true);
    expect(sleepShouldFade({ endsAt: 100_000 }, 120_000)).toBe(true);
  });

  it("'al terminar la pista' no corta el final", () => {
    expect(sleepShouldFade({ endOfTrack: true }, 0)).toBe(false);
    expect(sleepShouldFade(null, 0)).toBe(false);
  });
});

describe("controles de sonido del menú", () => {
  it("el ecualizador apagado no aplica nada; encendido suma el preamp manual a la compensación", () => {
    expect(eqChainOf({ ...defaultAudioSettings, bass: 6 })).toBeNull();
    const on = { ...defaultAudioSettings, eqEnabled: true, eqGains: [...EQ_PRESETS.Graves], preamp: 2, bass: 3, treble: -2 };
    expect(eqChainOf(on)).toEqual({ gains: EQ_PRESETS.Graves, preampDb: -4, bass: 3, treble: -2 });
  });

  it("acota preamp, graves, agudos, balance y velocidad; datos antiguos reciben los valores neutros", () => {
    const fixed = sanitizeAudioSettings({ preamp: 40, bass: -40, treble: 99, balance: 5, speed: 9, fadePause: 1 as unknown as boolean });
    expect(fixed).toMatchObject({ preamp: 12, bass: -12, treble: 12, balance: 1, speed: 2, fadePause: true });
    expect(sanitizeAudioSettings({ speed: 0 }).speed).toBe(0.5);
    expect(sanitizeAudioSettings({ volume: 0.5 })).toMatchObject({ preamp: 0, bass: 0, treble: 0, balance: 0, speed: 1, fadePause: false });
  });
});
