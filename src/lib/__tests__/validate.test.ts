import { describe, expect, it, vi } from "vitest";
import { parseList, parseOrNull, relationOne } from "@/lib/validate";
import { attemptSummarySchema, badgeUnlockSchema, historyEntrySchema, hintSchema, questionSchema, subscriptionPlanSchema } from "@/lib/schemas";
import { legacyPeriodField } from "@/lib/stripePeriod";

vi.spyOn(console, "warn").mockImplementation(() => {});

describe("parseList", () => {
  it("garde les éléments valides et écarte le reste", () => {
    expect(parseList(questionSchema, [{ id: 1 }, null, "x", { id: "a", text: "t" }, { text: "sans id" }], "t")).toEqual([{ id: 1 }, { id: "a", text: "t" }]);
  });
  it("donne [] pour null, objet ou chaîne", () => {
    expect(parseList(questionSchema, null, "t")).toEqual([]);
    expect(parseList(questionSchema, { id: 1 }, "t")).toEqual([]);
    expect(parseList(questionSchema, "[]", "t")).toEqual([]);
  });
});

describe("attemptSummarySchema", () => {
  it("complète les champs manquants", () => {
    expect(parseList(attemptSummarySchema, [{ score_percent: 80, passed: true, completed_at: "2026-01-01" }, { completed_at: 5 }, {}], "t")).toEqual([
      { score_percent: 80, passed: true, completed_at: "2026-01-01" },
      { score_percent: null, passed: null, completed_at: "" },
    ]);
  });
});

describe("historyEntrySchema", () => {
  it("accepte une entrée sans détail et refuse un détail mal formé", () => {
    expect(historyEntrySchema.safeParse({ score: 3 }).success).toBe(true);
    expect(historyEntrySchema.safeParse({ detail: { results: { a: "oui" } } }).success).toBe(false);
    expect(historyEntrySchema.safeParse("texte").success).toBe(false);
  });
});

describe("hintSchema et relations", () => {
  it("accepte texte ou objet", () => {
    expect(parseList(hintSchema, ["a", { text: "b" }, 3, { hint: "c" }], "t")).toEqual(["a", { text: "b" }, { hint: "c" }]);
  });
  it("relationOne lit objet ou tableau et rejette le reste", () => {
    expect(relationOne(badgeUnlockSchema, { unlocks_avatar_border: "or" })).toEqual({ unlocks_avatar_border: "or" });
    expect(relationOne(badgeUnlockSchema, [{ unlocks_name_animation: "x" }])).toEqual({ unlocks_name_animation: "x" });
    expect(relationOne(badgeUnlockSchema, "oups")).toBeNull();
    expect(relationOne(badgeUnlockSchema, [])).toBeNull();
    expect(relationOne(badgeUnlockSchema, null)).toBeNull();
  });
});

describe("subscriptionPlanSchema", () => {
  it("normalise un plan réel et rejette un plan sans prix", () => {
    const ok = parseOrNull(subscriptionPlanSchema, { id: 2, name: "Premium", price: 9.9, billing_interval: "month", features: { ai: true, n: 3, bad: [1] } }, "t");
    expect(ok).toMatchObject({ id: 2, trial_days: 0, description: null, features: { ai: true, n: 3, bad: null } });
    expect(parseOrNull(subscriptionPlanSchema, { id: 2, name: "x" }, "t")).toBeNull();
  });
});

describe("legacyPeriodField", () => {
  it("ne renvoie que de vrais nombres", () => {
    expect(legacyPeriodField({ current_period_end: 100 }, "current_period_end")).toBe(100);
    expect(legacyPeriodField({ current_period_end: "100" }, "current_period_end")).toBeUndefined();
    expect(legacyPeriodField({ current_period_end: NaN }, "current_period_end")).toBeUndefined();
    expect(legacyPeriodField({}, "current_period_start")).toBeUndefined();
  });
});

import { keepRows, rowGuard } from "@/lib/validate";
import { toChooserPlans } from "@/components/PlanChooser";
import { isJxgModule } from "@/lib/jsxgraphTypes";
import { exerciseProgressSchema, quizProgressSchema } from "@/lib/schemas";

describe("rowGuard / keepRows", () => {
  const isRow = rowGuard<{ id: number | string; title: string }>({ id: "id", title: "string" });
  it("écarte les lignes sans titre ou sans identifiant", () => {
    expect(keepRows([{ id: 1, title: "a" }, { id: "x", title: "b" }, { id: null, title: "c" }, { id: 2 }, null, "z"], isRow, "t")).toEqual([
      { id: 1, title: "a" }, { id: "x", title: "b" },
    ]);
  });
});

describe("toChooserPlans", () => {
  it("remplace les valeurs vides et lit les fonctionnalités en texte JSON", () => {
    const [a, b, c] = toChooserPlans([
      { id: 1, name: "A", price: 0, billing_interval: "month", trial_days: null, features: null },
      { id: 2, name: "B", price: 5, billing_interval: "month", features: '{"ai":true}' },
      { id: 3, name: "C", price: 5, billing_interval: "month", features: "pas du json" },
    ]);
    expect(a).toMatchObject({ trial_days: 0, features: {}, description: null });
    expect(b.features).toEqual({ ai: true });
    expect(c.features).toEqual({});
  });
});

describe("isJxgModule", () => {
  it("exige JSXGraph.initBoard et freeBoard", () => {
    expect(isJxgModule({ JSXGraph: { initBoard() {}, freeBoard() {} } })).toBe(true);
    expect(isJxgModule({ JSXGraph: { initBoard() {} } })).toBe(false);
    expect(isJxgModule(null)).toBe(false);
    expect(isJxgModule({})).toBe(false);
  });
});

describe("progression de revue", () => {
  it("ignore un champ de mauvais type au lieu de le propager", () => {
    const r = exerciseProgressSchema.parse({ answers: "oups", results: { a: true }, score: "12", blockModes: { a: "draw", b: "autre" } });
    expect(r.answers).toBeUndefined();
    expect(r.score).toBeUndefined();
    expect(r.results).toEqual({ a: true });
    expect(r.blockModes).toBeUndefined();
    const q = quizProgressSchema.parse({ answers: { 0: "a", 1: ["b", "c"] }, questionResults: { 0: true }, revealed: { 0: { correctAnswer: "a" } } });
    expect(q.answers).toEqual({ 0: "a", 1: ["b", "c"] });
  });
});
