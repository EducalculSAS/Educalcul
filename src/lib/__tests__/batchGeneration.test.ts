import { describe, it, expect } from "vitest";
import { buildCourseLevelContext, htmlToPlain } from "@/lib/ai/courseContext";
import { checkExerciseFigures } from "@/lib/figures/checkContent";
import { eduFigHtml } from "@/lib/figures/render";

const course = [{
  title: "Pythagore",
  lessons: [{
    title: "1. Théorème",
    content: '<p>Dans un triangle rectangle…</p><blockquote class="course-callout"><strong>Énoncé</strong><p>$BC^2 = AB^2 + AC^2$</p></blockquote><div class="lesson-exercise" data-exercise-id="x"></div>',
    exercises: [{ question: "Soit ABC rectangle en A, AB = 5 et AC = 12. Calcule BC.", answer: "13 cm" }],
  }],
}];

describe("contexte de cours pour la génération", () => {
  it("résume plan, notions et exercices étalons, sans HTML", () => {
    const ctx = buildCourseLevelContext("Théorème de Pythagore", course);
    expect(ctx).toContain("- 1. Théorème");
    expect(ctx).toContain("$BC^2 = AB^2 + AC^2$");
    expect(ctx).toContain("ÉTALON DE NIVEAU");
    expect(ctx).toContain("Calcule BC. (réponse : 13 cm)");
    expect(ctx).not.toMatch(/<[a-z]/);
  });
  it("borne la taille", () => {
    const big = [{ title: "x", lessons: [{ title: "L", content: `<p>${"mot ".repeat(5000)}</p>` }] }];
    expect(buildCourseLevelContext("x", big, 3000).length).toBeLessThan(3200);
  });
  it("htmlToPlain garde une ligne par paragraphe", () => {
    expect(htmlToPlain("<p>a&#39;b</p><p>c</p>")).toBe("a'b\nc");
  });
});

describe("vérification des figures d'un exercice généré", () => {
  const fig = eduFigHtml({ v: 1, kind: "geometry", unit: "cm", steps: [{ op: "triangle", names: ["A", "B", "C"], right: "B", lengths: { AB: 5, BC: 12 } }] });
  it("signale une figure contraire à l'énoncé", () => {
    const content = [{ blocks: [{ type: "text_input", content: `<p>ABC est rectangle en A avec AB = 5 cm et BC = 12 cm.</p>${fig}` }] }];
    expect(checkExerciseFigures(content).length).toBeGreaterThan(0);
  });
  it("ne dit rien quand la figure est conforme", () => {
    const content = [{ blocks: [{ type: "text_input", content: `<p>ABC est rectangle en B avec AB = 5 cm et BC = 12 cm.</p>${fig}` }] }];
    expect(checkExerciseFigures(content)).toEqual([]);
  });
});
