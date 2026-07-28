import assert from "node:assert/strict";
import {
  containsSuspiciousUnstructuredMath,
  runStructuredQualityGuard,
} from "@/lib/ai/qualityGuard";

assert.equal(containsSuspiciousUnstructuredMath("définie sur mathbb{R}"), true);
assert.equal(
  containsSuspiciousUnstructuredMath("P(x) = ax^2 + bx + c"),
  true,
);
assert.equal(
  containsSuspiciousUnstructuredMath("une fonction continue sur les réels"),
  false,
);

const blocks = Array.from({ length: 31 }, (_, index) => ({
  type: "paragraph",
  content: {
    parts: [
      {
        type: "text",
        value:
          index === 0
            ? "La fonction est définie sur mathbb{R} et vérifie exp(x) = e^x."
            : `Paragraphe pédagogique ${index + 1} sans formule.`,
      },
    ],
  },
}));
blocks.push({
  type: "figure",
  caption: "Courbe de la fonction exponentielle et tangente en zéro",
  elements: [
    {
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
      tone: "navy",
      dashed: false,
      arrowEnd: false,
    },
  ],
});

const sample = {
  title: "Chapitre",
  lessons: [
    {
      title: "Leçon",
      duration: 30,
      blocks,
      exercises: [],
    },
  ],
};

let semanticCalls = 0;
let mathCalls = 0;
const fakeGenerate = async (_user, system, _contract, _temperature, maxTokens) => {
  assert.ok(maxTokens <= 5_500, `budget inattendu : ${maxTokens}`);
  if (system.includes("contrôleur mathématique final")) {
    semanticCalls += 1;
    return { verdict: "ok", reason: "", patches: [] };
  }

  mathCalls += 1;
  if (mathCalls === 1) {
    return {
      repairs: [
        {
          id: "field-1",
          content: {
            parts: [
              { type: "text", value: "La fonction est définie sur " },
              { type: "math", latex: "\\mathbb{R}" },
              { type: "text", value: " et vérifie exp(x) = e^x." },
            ],
          },
        },
      ],
    };
  }

  return {
    repairs: [
      {
        id: "field-1",
        content: {
          parts: [
            { type: "text", value: "La fonction est définie sur " },
            { type: "math", latex: "\\mathbb{R}" },
            { type: "text", value: " et vérifie " },
            { type: "math", latex: "\\exp(x)=e^x" },
            { type: "text", value: "." },
          ],
        },
      },
    ],
  };
};

const guarded = await runStructuredQualityGuard(sample, {
  generate: fakeGenerate,
  label: "test",
  level: "Première",
  subject: "fonction exponentielle",
});

assert.ok(semanticCalls >= 3, "l'audit mathématique doit être fractionné");
assert.equal(mathCalls, 2, "une réparation partielle doit être reprise seule");
assert.equal(guarded.report.suspiciousMathAfter, 0);
assert.equal(guarded.report.removedCurveFigures, 1);
assert.equal(guarded.value.lessons[0].blocks.length, 31);
assert.equal(
  guarded.value.lessons[0].blocks[0].content.parts.some(
    (part) => part.type === "math" && part.latex === "\\mathbb{R}",
  ),
  true,
);
assert.equal(
  guarded.value.lessons[0].blocks[0].content.parts.some(
    (part) => part.type === "math" && part.latex === "\\exp(x)=e^x",
  ),
  true,
);

console.log(
  "OK — V2.4.1 : audit mathématique fractionné, réparation LaTeX partielle reprise champ par champ, SVG de courbe supprimé.",
);
