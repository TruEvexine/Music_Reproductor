import { describe, expect, it } from "vitest";
import {
  clearQueue,
  currentIndex,
  cycleRepeat,
  emptyQueue,
  enqueue,
  moveInQueue,
  nextInQueue,
  playNext,
  playNow,
  previousInQueue,
  removeFromQueue,
  replaceQueue,
  restoreQueue,
  toggleShuffle,
} from "./queue";
import type { QueueState } from "./queue";

// Generador determinista para que el barajado sea reproducible en los tests.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const abc = replaceQueue(emptyQueue, ["a", "b", "c"], "a");

describe("cola", () => {
  it("replaceQueue empieza en la pista elegida y elimina duplicados", () => {
    const q = replaceQueue(emptyQueue, ["a", "b", "b", "c"], "b");
    expect(q.order).toEqual(["a", "b", "c"]);
    expect(q.current).toBe("b");
  });

  it("enqueue añade al final sin duplicar y selecciona si estaba vacía", () => {
    const q = enqueue(enqueue(enqueue(emptyQueue, "a"), "b"), "a");
    expect(q.order).toEqual(["a", "b"]);
    expect(q.current).toBe("a");
  });

  it("playNext deja la pista justo detrás de la actual, la mueva o la añada, sin cambiar la actual", () => {
    const moved = playNext(abc, "c");
    expect(moved.order).toEqual(["a", "c", "b"]);
    expect(moved.original).toEqual(["a", "c", "b"]);
    expect(moved.current).toBe("a");
    expect(playNext(abc, "x").order).toEqual(["a", "x", "b", "c"]);
    expect(playNext({ ...abc, current: "b" }, "a").order).toEqual(["b", "a", "c"]);
    expect(playNext(abc, "a")).toBe(abc); // la que suena ya está "ahora"
    expect(playNext(emptyQueue, "x")).toMatchObject({ order: ["x"], current: "x" });
  });

  it("playNext con aleatorio coloca la pista tras la actual en el orden barajado y en el original", () => {
    const shuffled = toggleShuffle({ ...abc, order: ["a", "b", "c"] }, seeded(3));
    const next = playNext(shuffled, "c");
    expect(next.order[next.order.indexOf("a") + 1]).toBe("c");
    expect(next.original[next.original.indexOf("a") + 1]).toBe("c");
  });

  it("playNow inserta después de la actual", () => {
    const q = playNow({ ...abc, current: "a" }, "x");
    expect(q.order).toEqual(["a", "x", "b", "c"]);
    expect(q.current).toBe("x");
  });

  it("mover conserva la pista actual", () => {
    const q = moveInQueue({ ...abc, current: "b" }, 0, 2);
    expect(q.order).toEqual(["b", "c", "a"]);
    expect(q.current).toBe("b");
    expect(currentIndex(q)).toBe(0);
    expect(moveInQueue(abc, 0, 9)).toBe(abc);
  });

  it("quitar la actual pasa a la siguiente, o a la anterior si era la última", () => {
    expect(removeFromQueue({ ...abc, current: "b" }, "b").current).toBe("c");
    expect(removeFromQueue({ ...abc, current: "c" }, "c").current).toBe("b");
    expect(removeFromQueue(replaceQueue(emptyQueue, ["a"], "a"), "a").current).toBeNull();
    expect(removeFromQueue({ ...abc, current: "a" }, "c").current).toBe("a");
  });

  it("clear vacía pero conserva repetición y shuffle", () => {
    const q = clearQueue(cycleRepeat(abc));
    expect(q).toMatchObject({ order: [], current: null, repeat: "queue" });
  });
});

describe("avance y repetición", () => {
  it("sin repetición termina al agotar la cola", () => {
    let q: QueueState = abc;
    q = nextInQueue(q, true);
    q = nextInQueue(q, true);
    expect(q.current).toBe("c");
    expect(nextInQueue(q, true).current).toBeNull();
  });

  it("repetir cola da la vuelta en ambos sentidos", () => {
    const q = { ...abc, repeat: "queue" as const };
    expect(nextInQueue({ ...q, current: "c" }, true).current).toBe("a");
    expect(previousInQueue({ ...q, current: "a" }).current).toBe("c");
    expect(previousInQueue({ ...abc, current: "a" }).current).toBe("a");
  });

  it("repetir pista solo aplica al terminar sola, no al pulsar siguiente", () => {
    const q = { ...abc, repeat: "track" as const };
    expect(nextInQueue(q, true).current).toBe("a");
    expect(nextInQueue(q, false).current).toBe("b");
  });

  it("cycleRepeat recorre off → queue → track → off", () => {
    expect(cycleRepeat(abc).repeat).toBe("queue");
    expect(cycleRepeat(cycleRepeat(abc)).repeat).toBe("track");
    expect(cycleRepeat(cycleRepeat(cycleRepeat(abc))).repeat).toBe("off");
  });
});

describe("shuffle", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `t${i}`);

  it("no repite ninguna pista hasta agotar la cola", () => {
    let q = toggleShuffle(replaceQueue(emptyQueue, ids, "t5"), seeded());
    expect(q.order[0]).toBe("t5");
    const played = [q.current];
    for (let i = 1; i < ids.length; i++) {
      q = nextInQueue(q, true, seeded(i));
      played.push(q.current);
    }
    expect(new Set(played).size).toBe(ids.length);
    expect(nextInQueue(q, true).current).toBeNull();
  });

  it("con repetir cola rebaraja sin empezar por la que acaba de sonar", () => {
    for (let seed = 1; seed < 30; seed++) {
      let q = toggleShuffle({ ...replaceQueue(emptyQueue, ["a", "b", "c"], "a"), repeat: "queue" }, seeded(seed));
      q = { ...q, current: q.order[2] };
      const wrapped = nextInQueue(q, true, seeded(seed + 100));
      expect(wrapped.current).not.toBe(q.current);
      expect([...wrapped.order].sort()).toEqual(["a", "b", "c"]);
    }
  });

  it("apagarlo devuelve el orden original y mantiene la pista", () => {
    const on = toggleShuffle({ ...replaceQueue(emptyQueue, ids, "t0"), current: "t7" }, seeded(3));
    expect(on.order).not.toEqual(ids);
    const off = toggleShuffle(on);
    expect(off.order).toEqual(ids);
    expect(off.current).toBe("t7");
  });

  it("replaceQueue con shuffle activo empieza por la elegida", () => {
    const q = replaceQueue({ ...emptyQueue, shuffle: true }, ids, "t9", seeded(7));
    expect(q.order[0]).toBe("t9");
    expect(q.original).toEqual(ids);
  });
});

describe("restoreQueue", () => {
  it("descarta pistas que ya no existen y recoloca la actual", () => {
    const saved: QueueState = { ...abc, current: "b", repeat: "queue" };
    expect(restoreQueue(saved, new Set(["a", "c"]))).toMatchObject({ order: ["a", "c"], current: "a", repeat: "queue" });
    expect(restoreQueue(saved, new Set(["a", "b", "c"])).current).toBe("b");
    expect(restoreQueue(saved, new Set()).current).toBeNull();
  });
});
