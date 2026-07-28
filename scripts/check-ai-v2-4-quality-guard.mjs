import assert from "node:assert/strict";
import {
  containsSuspiciousUnstructuredMath,
  runStructuredQualityGuard,
} from "@/lib/ai/qualityGuard";

assert.equal(containsSuspiciousUnstructuredMath("définie sur mathbb{R}"), true);
assert.equal(containsSuspiciousUnstructuredMath("une fonction continue sur les réels"), false);

const sample = {
  title: "Chapitre",
  lessons: [
    {
      title: "Leçon",
      duration: 30,
      blocks: [
        {
          type: "paragraph",
          content: {
            parts: [
              {
                type: "text",
                value: "La fonction est définie sur mathbb{R} et vérifie exp(x) = e^x.",
              },
            ],
          },
        },
        {
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
        },
      ],
      exercises: [],
    },
  ],
};

const fakeGenerate = async (_user, system) => {
  if (system.includes("contrôleur mathématique final")) {
    return { verdict: "ok", reason: "", patches: [] };
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

assert.equal(guarded.report.mathTextRepairs, 1);
assert.equal(guarded.report.suspiciousMathAfter, 0);
assert.equal(guarded.report.removedCurveFigures, 1);
assert.equal(guarded.value.lessons[0].blocks.length, 1);
assert.equal(
  guarded.value.lessons[0].blocks[0].content.parts.some(
    (part) => part.type === "math" && part.latex === "\\mathbb{R}",
  ),
  true,
);

console.log("OK — garde qualité V2.4 : LaTeX textuel réparé, cohérence ciblée active, SVG de courbe supprimé.");
