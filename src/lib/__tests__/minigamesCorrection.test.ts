import { describe, expect, it } from "vitest";
import { correctSheet } from "@/lib/minigames/correction";
import { formatClock, formatCountdown, formatDuration, GAME_BY_KEY, secondsToNextSheet, shareText } from "@/lib/minigames/catalog";

describe("correctSheet", () => {
  const sheet = [{ prompt: "2+2", answer: 4 }, { prompt: "3×3", answer: 9 }, { prompt: "10-7", answer: 3 }];

  it("corrige chaque question dans l'ordre et compte une question passée comme fausse", () => {
    const lines = correctSheet(sheet, [{ index: 2, value: 3 }, { index: 0, value: "4" }], "number");
    expect(lines.map((l) => l.correct)).toEqual([true, false, true]);
    expect(lines[1]).toMatchObject({ given: null, expected: 9 });
  });

  it("ne compte qu'une réponse par question et ignore les index hors fiche", () => {
    const lines = correctSheet(sheet, [{ index: 0, value: 5 }, { index: 0, value: 4 }, { index: 7, value: 4 }, { index: -1, value: 4 }], "number");
    expect(lines.filter((l) => l.correct)).toHaveLength(0);
    expect(lines[0].given).toBe(5);
  });

  it("compare les textes sans tenir compte de la casse, des espaces ni des accents", () => {
    const lines = correctSheet([{ prompt: "?", answer: "Élève" }], [{ index: 0, value: "  eleve " }], "text");
    expect(lines[0].correct).toBe(true);
  });

  it("refuse une réponse vide ou non numérique à une question numérique", () => {
    expect(correctSheet([{ prompt: "0", answer: 0 }], [{ index: 0, value: "" }], "number")[0].correct).toBe(false);
    expect(correctSheet([{ prompt: "0", answer: 0 }], [{ index: 0, value: "abc" }], "number")[0].correct).toBe(false);
  });
});

describe("affichage des mini-jeux", () => {
  it("formate durées, chrono et compte à rebours", () => {
    expect(formatDuration(72)).toBe("1 min 12 s");
    expect(formatDuration(48)).toBe("48 s");
    expect(formatDuration(null)).toBeNull();
    expect(formatClock(67)).toBe("1:07");
    expect(formatCountdown(5 * 3600 + 12 * 60)).toBe("5 h 12 min");
    expect(formatCountdown(40)).toBe("moins d'une minute");
  });

  it("compte jusqu'à minuit en temps universel", () => {
    expect(secondsToNextSheet(new Date("2026-11-11T23:00:00Z"))).toBe(3600);
  });

  it("compose un résultat à partager sans dévoiler la fiche", () => {
    const text = shareText(GAME_BY_KEY.calcul_mental, { date: "2026-11-11", score: 4, max: 5, marks: [true, true, false, true, true], durationSeconds: 72, streak: 3 });
    expect(text).toBe("Educalcul · Calcul mental du 11/11/2026\n🟩🟩⬜🟩🟩\n4 / 5 en 1 min 12 s · série de 3 jours");
    expect(shareText(GAME_BY_KEY.mathador, { date: "2026-11-11", score: 1 })).toContain("1 point");
  });
});
