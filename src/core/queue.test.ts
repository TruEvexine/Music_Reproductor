import { describe, expect, it } from "vitest";
import {
  clearQueue,
  currentIndex,
  cycleRepeat,
  emptyQueue,
  enqueue,
  moveInQueue,
  nextInQueue,
  playEntry,
  playNext,
  previousInQueue,
  removeFromQueue,
  replaceQueue,
  restoreQueue,
  toggleShuffle,
  upgradeQueue,
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

// Las entradas tienen claves propias: los tests comparan ids de pista y eligen entradas por id.
const ids = (q: QueueState) => q.order.map((item) => item.id);
const cur = (q: QueueState) => q.current?.id ?? null;
const keyOf = (q: QueueState, id: string, nth = 0) => q.order.filter((item) => item.id === id)[nth].key;
const at = (q: QueueState, id: string) => playEntry(q, keyOf(q, id));

const abc = replaceQueue(emptyQueue, ["a", "b", "c"], "a");

describe("cola", () => {
  it("replaceQueue empieza en la pista elegida y elimina duplicados", () => {
    const q = replaceQueue(emptyQueue, ["a", "b", "b", "c"], "b");
    expect(ids(q)).toEqual(["a", "b", "c"]);
    expect(cur(q)).toBe("b");
  });

  it("enqueue añade al final aunque ya esté y selecciona si estaba vacía", () => {
    const q = enqueue(enqueue(enqueue(emptyQueue, "a"), "b"), "a");
    expect(ids(q)).toEqual(["a", "b", "a"]);
    expect(new Set(q.order.map((item) => item.key)).size).toBe(3);
    expect(q.current).toBe(q.order[0]);
  });

  it("quitar una copia repetida deja la otra, y si la otra suena sigue sonando", () => {
    const q = enqueue(enqueue(abc, "a"), "b"); // a(suena) b c a b
    const removed = removeFromQueue(q, keyOf(q, "a", 1));
    expect(ids(removed)).toEqual(["a", "b", "c", "b"]);
    expect(removed.current).toBe(q.current);
    expect(ids(removeFromQueue(removed, keyOf(removed, "b", 0)))).toEqual(["a", "c", "b"]);
  });

  it("la misma canción dos veces suena dos veces y se puede elegir cada copia", () => {
    let q = enqueue(enqueue(abc, "c"), "c"); // a b c c c
    const second = playEntry(q, keyOf(q, "c", 1));
    expect(currentIndex(second)).toBe(3);
    const played = [cur(q)];
    while ((q = nextInQueue(q, true)).current) played.push(cur(q));
    expect(played).toEqual(["a", "b", "c", "c", "c"]);
  });

  it("deshacer (volver a la cola guardada) recupera la copia quitada sin tocar la que suena", () => {
    // queueAction guarda la cola de antes y Deshacer la reaplica; el reproductor solo recarga si cambia la clave actual.
    const before = enqueue(abc, "a"); // a(suena) b c a
    const removed = removeFromQueue(before, keyOf(before, "a", 1));
    expect(ids(removed)).toEqual(["a", "b", "c"]);
    expect(removed.current?.key).toBe(before.current?.key);
    const added = enqueue(before, "a");
    expect(ids(added)).toEqual(["a", "b", "c", "a", "a"]);
    expect(added.current?.key).toBe(before.current?.key);
  });

  it("playNext deja la pista justo detrás de la actual, la mueva o la añada, sin cambiar la actual", () => {
    const moved = playNext(abc, "c");
    expect(ids(moved)).toEqual(["a", "c", "b"]);
    expect(moved.original.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(cur(moved)).toBe("a");
    expect(ids(playNext(abc, "x"))).toEqual(["a", "x", "b", "c"]);
    expect(ids(playNext(at(abc, "b"), "a"))).toEqual(["b", "a", "c"]);
    expect(playNext(abc, "a")).toBe(abc); // la que suena ya está "ahora"
    expect(playNext(emptyQueue, "x")).toMatchObject({ order: [{ id: "x" }], current: { id: "x" } });
  });

  it("playNext con clave mueve esa copia y no otra", () => {
    const q = enqueue(enqueue(abc, "b"), "c"); // a b c b c
    const moved = playNext(q, "c", keyOf(q, "c", 1));
    expect(ids(moved)).toEqual(["a", "c", "b", "c", "b"]);
    expect(moved.order[1].key).toBe(keyOf(q, "c", 1));
  });

  it("playNext con aleatorio coloca la pista tras la actual en el orden barajado y en el original", () => {
    const shuffled = toggleShuffle(abc, seeded(3));
    const next = playNext(shuffled, "c");
    expect(ids(next)[ids(next).indexOf("a") + 1]).toBe("c");
    const original = next.original.map((item) => item.id);
    expect(original[original.indexOf("a") + 1]).toBe("c");
  });

  it("playEntry elige una entrada por su clave", () => {
    expect(cur(at(abc, "c"))).toBe("c");
    expect(playEntry(abc, "no-existe")).toBe(abc);
  });

  it("mover conserva la pista actual", () => {
    const q = moveInQueue(at(abc, "b"), 0, 2);
    expect(ids(q)).toEqual(["b", "c", "a"]);
    expect(cur(q)).toBe("b");
    expect(currentIndex(q)).toBe(0);
    expect(moveInQueue(abc, 0, 9)).toBe(abc);
  });

  it("quitar la actual pasa a la siguiente, o a la anterior si era la última", () => {
    expect(cur(removeFromQueue(at(abc, "b"), keyOf(abc, "b")))).toBe("c");
    expect(cur(removeFromQueue(at(abc, "c"), keyOf(abc, "c")))).toBe("b");
    const one = replaceQueue(emptyQueue, ["a"], "a");
    expect(removeFromQueue(one, keyOf(one, "a")).current).toBeNull();
    expect(cur(removeFromQueue(abc, keyOf(abc, "c")))).toBe("a");
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
    expect(cur(q)).toBe("c");
    expect(nextInQueue(q, true).current).toBeNull();
  });

  it("repetir cola da la vuelta en ambos sentidos", () => {
    const q = { ...abc, repeat: "queue" as const };
    expect(cur(nextInQueue(at(q, "c"), true))).toBe("a");
    expect(cur(previousInQueue(q))).toBe("c");
    expect(cur(previousInQueue(abc))).toBe("a");
  });

  it("repetir pista solo aplica al terminar sola, no al pulsar siguiente", () => {
    const q = { ...abc, repeat: "track" as const };
    expect(cur(nextInQueue(q, true))).toBe("a");
    expect(cur(nextInQueue(q, false))).toBe("b");
  });

  it("cycleRepeat recorre off → queue → track → off", () => {
    expect(cycleRepeat(abc).repeat).toBe("queue");
    expect(cycleRepeat(cycleRepeat(abc)).repeat).toBe("track");
    expect(cycleRepeat(cycleRepeat(cycleRepeat(abc))).repeat).toBe("off");
  });
});

describe("shuffle", () => {
  const tracks = Array.from({ length: 20 }, (_, i) => `t${i}`);

  it("no repite ninguna pista hasta agotar la cola", () => {
    let q = toggleShuffle(replaceQueue(emptyQueue, tracks, "t5"), seeded());
    expect(q.order[0].id).toBe("t5");
    const played = [cur(q)];
    for (let i = 1; i < tracks.length; i++) {
      q = nextInQueue(q, true, seeded(i));
      played.push(cur(q));
    }
    expect(new Set(played).size).toBe(tracks.length);
    expect(nextInQueue(q, true).current).toBeNull();
  });

  it("con copias repetidas baraja cada copia una vez y al apagarlo vuelve al orden con las dos", () => {
    const q = enqueue(enqueue(abc, "a"), "b"); // a b c a b
    const on = toggleShuffle(q, seeded(5));
    expect(on.order[0]).toBe(q.current);
    expect(new Set(on.order.map((item) => item.key)).size).toBe(5);
    expect(ids(on).sort()).toEqual(["a", "a", "b", "b", "c"]);
    expect(ids(toggleShuffle(on))).toEqual(["a", "b", "c", "a", "b"]);
  });

  it("con repetir cola rebaraja sin empezar por la que acaba de sonar", () => {
    for (let seed = 1; seed < 30; seed++) {
      let q = toggleShuffle({ ...replaceQueue(emptyQueue, ["a", "b", "c"], "a"), repeat: "queue" }, seeded(seed));
      q = { ...q, current: q.order[2] };
      const wrapped = nextInQueue(q, true, seeded(seed + 100));
      expect(wrapped.current).not.toBe(q.current);
      expect(ids(wrapped).sort()).toEqual(["a", "b", "c"]);
    }
  });

  it("apagarlo devuelve el orden original y mantiene la pista", () => {
    const on = toggleShuffle(at(replaceQueue(emptyQueue, tracks, "t0"), "t7"), seeded(3));
    expect(ids(on)).not.toEqual(tracks);
    const off = toggleShuffle(on);
    expect(ids(off)).toEqual(tracks);
    expect(cur(off)).toBe("t7");
  });

  it("replaceQueue con shuffle activo empieza por la elegida", () => {
    const q = replaceQueue({ ...emptyQueue, shuffle: true }, tracks, "t9", seeded(7));
    expect(q.order[0].id).toBe("t9");
    expect(q.original.map((item) => item.id)).toEqual(tracks);
  });
});

describe("restoreQueue", () => {
  it("descarta pistas que ya no existen y recoloca la actual", () => {
    const saved: QueueState = { ...at(abc, "b"), repeat: "queue" };
    expect(restoreQueue(saved, new Set(["a", "c"]))).toMatchObject({ order: [{ id: "a" }, { id: "c" }], current: { id: "a" }, repeat: "queue" });
    expect(cur(restoreQueue(saved, new Set(["a", "b", "c"])))).toBe("b");
    expect(restoreQueue(saved, new Set()).current).toBeNull();
  });

  it("restaura la copia exacta que sonaba aunque haya otra de la misma pista", () => {
    const q = enqueue(abc, "a");
    const saved = playEntry(q, keyOf(q, "a", 1));
    expect(currentIndex(restoreQueue(saved, new Set(["a", "b", "c"])))).toBe(3);
  });

  it("convierte una sesión guardada con ids sueltos en entradas", () => {
    const legacy = { order: ["b", "a"], original: ["a", "b"], current: "a", repeat: "off", shuffle: true } as unknown as QueueState;
    const q = upgradeQueue(legacy);
    expect(ids(q)).toEqual(["b", "a"]);
    expect(q.original[0]).toBe(q.order[1]);
    expect(q.current).toBe(q.order[1]);
    expect(upgradeQueue(abc)).toBe(abc);
  });
});
