import { describe, expect, it } from "vitest";
import { initialTutorials, markSeen, nextTutorial, sanitizeTutorials, skipAll, TUTORIALS } from "./tutorials";

describe("avisos de primera vez", () => {
  it("no muestra nada hasta que la persona encuentra la cosa", () => {
    expect(nextTutorial(initialTutorials, [], "touch", "dock")).toBeNull();
    expect(nextTutorial(initialTutorials, ["swipe"], "touch", "dock")?.id).toBe("swipe");
  });

  it("uno a la vez: cada superficie muestra el suyo y, descartado, no vuelve", () => {
    const both = ["player-touch", "swipe"] as const;
    expect(nextTutorial(initialTutorials, both, "touch", "dock")?.id).toBe("swipe");
    expect(nextTutorial(initialTutorials, both, "touch", "player")?.id).toBe("player-touch");
    const afterSwipe = markSeen(initialTutorials, "swipe");
    expect(nextTutorial(afterSwipe, both, "touch", "dock")).toBeNull();
    expect(nextTutorial(markSeen(afterSwipe, "player-touch"), both, "touch", "player")).toBeNull();
  });

  it("solo los de su dispositivo: los gestos al dedo y los atajos con puntero", () => {
    const all = TUTORIALS.map((tutorial) => tutorial.id);
    expect(nextTutorial(initialTutorials, all, "pointer", "dock")?.id).toBe("shortcuts");
    expect(nextTutorial(initialTutorials, ["swipe"], "pointer", "dock")).toBeNull();
    expect(nextTutorial(initialTutorials, ["shortcuts"], "touch", "dock")).toBeNull();
  });

  it("«omitir todos» los apaga y «ver otra vez» (el estado inicial) los devuelve", () => {
    const skipped = skipAll(markSeen(initialTutorials, "swipe"));
    expect(nextTutorial(skipped, ["player-touch"], "touch", "player")).toBeNull();
    expect(nextTutorial(initialTutorials, ["swipe"], "touch", "dock")?.id).toBe("swipe");
  });

  it("lo guardado se sanea: sin ids desconocidos ni repetidos y con `off` solo si es true", () => {
    expect(sanitizeTutorials({ seen: ["swipe", "swipe", "otro", 3], off: "si" })).toEqual({ seen: ["swipe"], off: false });
    expect(sanitizeTutorials({ seen: ["shortcuts"], off: true })).toEqual({ seen: ["shortcuts"], off: true });
    expect(sanitizeTutorials(undefined)).toEqual(initialTutorials);
    expect(sanitizeTutorials("basura")).toEqual(initialTutorials);
  });
});
