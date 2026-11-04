import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_EXERCISE, DEMO_QUIZ } from "@/lib/demoContent";
import { stripAnswers as stripExercise } from "@/lib/exerciseContent";
import { stripAnswers as stripQuiz } from "@/lib/quizContent";

let allowed = true;
vi.mock("@/lib/rateLimitAdvanced", () => ({ rateLimitWithBackoff: async () => ({ allowed }) }));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: {} }));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/demo/grade/route");
  const res = await POST(new Request("http://localhost/api/demo/grade", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" } }));
  return { status: res.status, body: await res.json() };
};
beforeEach(() => { allowed = true; });

describe("démo de la page Offres", () => {
  it("le navigateur ne reçoit aucune réponse avant correction", () => {
    const ex = JSON.stringify(stripExercise(DEMO_EXERCISE));
    expect(ex).not.toMatch(/correctAnswer|"right"|0\.75|explanation/);
    const qz = JSON.stringify(stripQuiz(DEMO_QUIZ));
    expect(qz).not.toMatch(/correctAnswer|explanation/);
  });

  it("exercice : bonnes réponses → tout juste, avec la correction révélée", async () => {
    const { status, body } = await post({ kind: "exercise", items: [
      { block_id: "demo-b-1", answer: "$\\frac{5}{12}$" },
      { block_id: "demo-b-2", answer: ["$\\frac{4}{8}$", "$\\frac{6}{9}$", "$\\frac{9}{12}$"] },
      { block_id: "demo-b-3", answer: ["$\\frac{1}{4}$", "$\\frac{2}{4}$", "$\\frac{3}{4}$", "$\\frac{5}{4}$"] },
      { block_id: "demo-b-4", answer: 0.75 },
    ] });
    expect(status).toBe(200);
    expect(body.results.map((r: { is_correct: boolean }) => r.is_correct)).toEqual([true, true, true, true]);
    expect(body.results[0].reveal).toEqual({ correctAnswer: "$\\frac{5}{12}$" });
  });

  it("exercice : crédit partiel sur l'association, erreurs reconnues", async () => {
    const { body } = await post({ kind: "exercise", items: [
      { block_id: "demo-b-1", answer: "$\\frac{12}{5}$" },
      { block_id: "demo-b-2", answer: ["$\\frac{4}{8}$", "$\\frac{9}{12}$", "$\\frac{6}{9}$"] },
      { block_id: "inconnu", answer: 1 },
    ] });
    expect(body.results[0].is_correct).toBe(false);
    expect(body.results[1]).toMatchObject({ is_correct: false, score: 1, max_score: 3 });
    expect(body.results[2]).toMatchObject({ is_correct: false, max_score: 0 });
  });

  it("quiz : choix unique, vrai/faux, choix multiples", async () => {
    expect((await post({ kind: "quiz", question_id: "demo-q-1", answer: "$\\frac{4}{10}$" })).body.is_correct).toBe(true);
    expect((await post({ kind: "quiz", question_id: "demo-q-2", answer: "Faux" })).body.is_correct).toBe(false);
    expect((await post({ kind: "quiz", question_id: "demo-q-3", answer: ["$\\frac{3}{9}$", "$\\frac{2}{6}$"] })).body.is_correct).toBe(true);
    expect((await post({ kind: "quiz", question_id: "demo-q-3", answer: ["$\\frac{3}{9}$"] })).body.is_correct).toBe(false);
    expect((await post({ kind: "quiz", question_id: "x", answer: "a" })).status).toBe(404);
  });

  it("ne corrige QUE le contenu de démonstration et limite le débit", async () => {
    expect((await post({ kind: "autre" })).status).toBe(400);
    allowed = false;
    expect((await post({ kind: "quiz", question_id: "demo-q-1", answer: "x" })).status).toBe(429);
  });
});
