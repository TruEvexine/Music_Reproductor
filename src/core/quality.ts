// Calidad adaptativa del fondo animado: tres niveles y un gobernador que baja solo si mide cuadros lentos.
// Solo degrada (nunca vuelve a subir): evita oscilar y, en un móvil flojo, es lo que se quiere.

export interface Quality {
  /** Manchas de color dibujadas. */
  blobs: number;
  /** Tope de cuadros por segundo de este nivel. */
  fps: number;
  /** Resolución del lienzo respecto al tamaño CSS (los degradados suaves no necesitan más). */
  scale: number;
}

export const QUALITY_LEVELS: readonly Quality[] = [
  { blobs: 5, fps: 60, scale: 0.35 },
  { blobs: 3, fps: 30, scale: 0.25 },
  { blobs: 2, fps: 20, scale: 0.18 },
];

export type FpsSetting = 30 | 60 | "auto";

export interface Device {
  cores?: number;
  memoryGb?: number;
  /** Modo ahorro de datos del navegador. */
  saveData?: boolean;
  /** Batería ≤ 20 % y sin cargar. */
  lowBattery?: boolean;
}

/** Nivel inicial: dispositivo flojo → 1; con ahorro automático y batería baja (o ahorro de datos) → al menos 1, y 2 si además es flojo. */
export function startLevel(device: Device, batterySaver: boolean): number {
  const weak = (device.cores ?? 8) <= 4 || (device.memoryGb ?? 8) <= 2;
  const saving = batterySaver && (device.lowBattery === true || device.saveData === true);
  return Math.min(QUALITY_LEVELS.length - 1, (weak ? 1 : 0) + (saving ? 1 : 0));
}

/** Cuadros por segundo reales: el menor entre lo que pide el usuario y lo que aguanta el nivel. */
export function fpsCap(setting: FpsSetting, level: number): number {
  return Math.min(setting === "auto" ? 60 : setting, QUALITY_LEVELS[level].fps);
}

/**
 * Cada `windowFrames` cuadros compara el intervalo medio con el objetivo; si lo supera en un 40 % baja un nivel.
 * Los intervalos de más de 250 ms son una pausa (pestaña oculta, depurador), no lentitud: no cuentan.
 */
export function createGovernor(start = 0, windowFrames = 45) {
  let level = start;
  let sum = 0;
  let count = 0;
  return {
    get level() {
      return level;
    },
    /** Registra un cuadro; devuelve el nivel vigente. */
    frame(deltaMs: number, targetMs: number): number {
      if (deltaMs > 250) return level;
      sum += deltaMs;
      count += 1;
      if (count >= windowFrames) {
        if (sum / count > targetMs * 1.4 && level < QUALITY_LEVELS.length - 1) level += 1;
        sum = 0;
        count = 0;
      }
      return level;
    },
    /** Sube el nivel mínimo (batería baja detectada con el fondo ya en marcha). */
    raise(minimum: number) {
      level = Math.min(QUALITY_LEVELS.length - 1, Math.max(level, minimum));
    },
  };
}
