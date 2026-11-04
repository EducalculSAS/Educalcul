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
