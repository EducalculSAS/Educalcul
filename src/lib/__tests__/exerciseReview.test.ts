import { describe, expect, it } from "vitest";
import { collectQuestions, hasBrokenTable, hasChainedCalculation, parseReview, removeQuestions } from "@/lib/ai/exerciseReview";
import { configuredProviders, cooldownMs } from "@/lib/llmProviders";
import { mathToReadableText } from "@/lib/ai/structuredMath";

const exercise = [
  { blocks: [
    { type: "text", content: "<p>Un code de 1 à 100.</p>" },
    { type: "text_input", content: "<p>Calcule $P(A)$.</p>", correctAnswer: "$\\frac{1}{2}$", explanation: "<p>50 cas sur 100.</p>" },
    { type: "qcm", content: "<p>Choisis.</p>", options: ["a", "b"], correctAnswer: "a" },
  ] },
  { blocks: [{ type: "text_input", content: "<p>Q3</p>", correctAnswer: "3" }] },
];

describe("relecture des exercices", () => {
  it("repère un calcul mené jusqu'au résultat dans l'énoncé", () => {
    expect(hasChainedCalculation("<p>On a $P(A) = \\frac{50}{100} = \\frac{1}{2}$.</p>")).toBe(true);
    expect(hasChainedCalculation("<p>Soit $f(x) = 2x + 3$ et $x \\leq 4$.</p>")).toBe(false);
    expect(hasChainedCalculation("<p>$a \\neq b$ et $c = d$</p>")).toBe(false);
  });
  it("repère un tableau LaTeX cassé hors formule", () => {
    expect(hasBrokenTable("<p>|c|c|c| hlineSéance 1</p>")).toBe(true);
    expect(hasBrokenTable("<p>$\\begin{array}{|c|c|}\\hline a & b\\end{array}$</p>")).toBe(false);
  });
  it("numérote les questions et retire celles rejetées", () => {
    const { questions, context } = collectQuestions(exercise);
    expect(questions.map((q) => q.n)).toEqual([1, 2, 3]);
    expect(questions[1].options).toEqual(["a", "b"]);
    expect(context).toContain("Un code");
    const kept = removeQuestions(exercise, new Set([3])) as { blocks: { type: string }[] }[];
    expect(kept).toHaveLength(1);
    expect(kept[0].blocks).toHaveLength(3);
  });
  it("lit les verdicts", () => {
    expect(parseReview({ questions: [{ n: 2, verdict: "fuite", raison: "x" }, { n: 0 }] })).toEqual([{ n: 2, verdict: "fuite", raison: "x" }]);
    expect(parseReview(null)).toEqual([]);
  });
  it("ne laisse plus « hline » ni la spécification de colonnes dans le texte de secours", () => {
    const text = mathToReadableText("\\begin{array}{|c|c|}\\hline x & 2 \\\\ \\hline y & 5\\end{array}");
    expect(text).not.toMatch(/hline|\|c\|/);
  });
});

describe("aiguillage des fournisseurs", () => {
  it("n'utilise que les fournisseurs dont la clé est renseignée", () => {
    expect(configuredProviders({})).toEqual([]);
    const list = configuredProviders({ GROQ_API_KEY: "k", CEREBRAS_API_KEY: " " });
    expect(list.map((p) => p.id)).toEqual(["groq"]);
    expect(list[0].model).toBe("openai/gpt-oss-120b");
  });
  it("met de côté plus longtemps un quota du jour", () => {
    expect(cooldownMs(429, "Rate limit reached on tokens per day (TPD)", null)).toBe(3_600_000);
    expect(cooldownMs(429, "slow down", null)).toBe(60_000);
    expect(cooldownMs(429, "", "12")).toBe(12_000);
  });
});
