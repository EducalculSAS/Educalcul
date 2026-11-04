import type { Block } from "@/components/admin/ExerciseBuilder";
import { itemsCorrect } from "@/lib/exerciseScoring";

/** Correction exacte des blocs à choix / à manipuler (pas d'IA). */
export function gradeStructured(block: Block, answer: unknown): boolean {
  const type = block.type;
  if (type === "multiple_choice" || type === "qcm") {
    const correct = Array.isArray(block.correctAnswer) ? block.correctAnswer : [block.correctAnswer];
    const selected = Array.isArray(answer) ? answer : [answer];
    return correct.length === selected.length && correct.every((a: unknown) => selected.includes(a));
  }
  if (type === "single_choice" || type === "true_false") return answer === block.correctAnswer;
  if (type === "fill_in_the_blank") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = block.blanks || [];
    return expected.length > 0 && expected.every((exp: string, i: number) => {
      const alts = exp.split("|").map((s) => s.trim().toLowerCase());
      return alts.includes(String(given[i] ?? "").trim().toLowerCase());
    });
  }
  if (type === "matching") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const pairs = block.pairs || [];
    return pairs.length > 0 && pairs.every((p, i: number) => given[i] === p.right);
  }
  if (type === "ordering") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = block.items || [];
    return expected.length > 0 && given.length === expected.length && expected.every((item, i) => given[i] === item);
  }
  if (type === "categorize") {
    const given: (string | null)[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = (block.categoryItems || []).map((it) => it.category);
    return expected.length > 0 && given.length === expected.length && expected.every((cat, i) => given[i] === cat);
  }
  if (type === "number_line_point") {
    const given = typeof answer === "number" ? answer : parseFloat(String(answer));
    const expected = parseFloat(String(block.correctAnswer));
    return !Number.isNaN(given) && !Number.isNaN(expected) && Math.abs(given - expected) < 1e-6;
  }
  if (type === "click_error") {
    const given = typeof answer === "number" ? answer : parseInt(String(answer), 10);
    return !Number.isNaN(given) && given === parseInt(String(block.correctAnswer), 10);
  }
  const expected = block.correctAnswer;
  if (Array.isArray(expected)) {
    const ansArr = Array.isArray(answer) ? answer : [answer];
    return expected.every((e: unknown) => ansArr.includes(e)) && ansArr.length === expected.length;
  }
  return answer === expected;
}

/** Révélation renvoyée APRÈS correction (écran de correction), jamais avant. */
export function revealFor(block: Block) {
  if (block.type === "matching") return { pairs: block.pairs };
  if (block.type === "ordering") return { items: block.items };
  if (block.type === "fill_in_the_blank") return { blanks: block.blanks };
  if (block.type === "categorize") return { categoryItems: block.categoryItems };
  return { correctAnswer: block.correctAnswer };
}

/**
 * Correction complète d'un bloc à choix / à manipuler, avec crédit partiel (un point par élément bien placé pour les
 * associations, catégories et trous). Même résultat que la correction d'un exercice enregistré.
 */
export function gradeBlock(block: Block, answer: unknown, maxPoints: number) {
  const partial = itemsCorrect(block, answer);
  if (partial) {
    const all = partial.correct === partial.total;
    const score = Math.round(((maxPoints * partial.correct) / partial.total) * 100) / 100;
    const unit = block.type === "matching" ? "association" : block.type === "categorize" ? "élément bien classé" : "réponse";
    return {
      score, max_score: maxPoints, is_correct: all,
      feedback: all ? "Bonne réponse !" : partial.correct === 0 ? "Aucune bonne réponse cette fois." : `${partial.correct} sur ${partial.total} : ${partial.correct} ${unit}${partial.correct > 1 && unit !== "élément bien classé" ? "s" : ""} correct${partial.correct > 1 ? "s" : ""}.`,
      reveal: revealFor(block),
    };
  }
  const ok = gradeStructured(block, answer);
  return { score: ok ? maxPoints : 0, max_score: maxPoints, is_correct: ok, feedback: ok ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.", reveal: revealFor(block) };
}
