import { describe, expect, it } from "vitest";
import { createGovernor, fpsCap, QUALITY_LEVELS, startLevel } from "./quality";

const run = (governor: ReturnType<typeof createGovernor>, deltas: number, count: number, target = 1000 / 60) => {
  for (let i = 0; i < count; i++) governor.frame(deltas, target);
  return governor.level;
};

describe("gobernador de calidad", () => {
  it("con cuadros a tiempo no degrada nunca", () => {
    expect(run(createGovernor(), 16.7, 1000)).toBe(0);
  });

  it("con cuadros lentos baja de nivel y se detiene en el mínimo", () => {
    const governor = createGovernor();
    expect(run(governor, 40, 45)).toBe(1); // 25 fps cuando se pedían 60
    expect(run(governor, 80, 45, 1000 / 30)).toBe(2); // nivel 1 pide 30 fps y tampoco llega
    expect(run(governor, 200, 500, 1000 / 20)).toBe(QUALITY_LEVELS.length - 1);
  });

  it("40 ms con un objetivo de 30 fps es aceptable: no sigue bajando", () => {
    expect(run(createGovernor(1), 40, 500, 1000 / 30)).toBe(1);
  });

  it("las pausas largas (pestaña oculta) no cuentan como lentitud", () => {
    const governor = createGovernor();
    for (let i = 0; i < 200; i++) governor.frame(1500, 1000 / 60);
    expect(governor.level).toBe(0);
  });

  it("raise sube el nivel mínimo y no lo baja", () => {
    const governor = createGovernor(2);
    governor.raise(1);
    expect(governor.level).toBe(2);
    const calm = createGovernor();
    calm.raise(1);
    expect(calm.level).toBe(1);
  });
});

describe("nivel inicial y tope de cuadros", () => {
  it("dispositivo potente: nivel 0; flojo: 1; flojo con batería baja y ahorro automático: 2", () => {
    expect(startLevel({ cores: 8, memoryGb: 8 }, true)).toBe(0);
    expect(startLevel({ cores: 4 }, true)).toBe(1);
    expect(startLevel({ memoryGb: 2 }, false)).toBe(1);
    expect(startLevel({ cores: 4, lowBattery: true }, true)).toBe(2);
  });

  it("sin ahorro automático la batería baja no cuenta", () => {
    expect(startLevel({ cores: 8, lowBattery: true, saveData: true }, false)).toBe(0);
    expect(startLevel({ cores: 8, lowBattery: true }, true)).toBe(1);
  });

  it("el tope es el menor entre lo pedido y lo que aguanta el nivel", () => {
    expect(fpsCap("auto", 0)).toBe(60);
    expect(fpsCap(30, 0)).toBe(30);
    expect(fpsCap(60, 1)).toBe(30);
    expect(fpsCap("auto", 2)).toBe(20);
  });
});
