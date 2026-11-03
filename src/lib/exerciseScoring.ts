/**
 * Points d'un bloc d'exercice. Les blocs « à plusieurs éléments » (associations, classements en catégories, texte à
 * trous) rapportent UN POINT PAR ÉLÉMENT bien placé : 8 associations = 8 points, et 5 bonnes sur 8 = 5 points, pas un
 * « tout ou rien ». Les autres blocs gardent leurs points.
 *
 * Fonctions pures, partagées par la correction (serveur), l'envoi de l'exercice à l'élève et le calcul des totaux.
 */

import type { Block } from "@/components/admin/ExerciseBuilder";

/** Nombre d'éléments à placer dans le bloc, ou 0 si le bloc se corrige d'un seul tenant. */
export function itemTotal(block: Block): number {
  if (!block) return 0;
  if (block.type === "matching") return Array.isArray(block.pairs) ? block.pairs.length : 0;
  if (block.type === "categorize") return Array.isArray(block.categoryItems) ? block.categoryItems.length : 0;
  if (block.type === "fill_in_the_blank") return Array.isArray(block.blanks) ? block.blanks.length : 0;
  return 0;
}

/** Points maximum du bloc : un par élément dès qu'il y en a plusieurs, sinon les points du bloc. */
export function blockMaxPoints(block: Block, fallback = 0): number {
  const total = itemTotal(block);
  if (total > 1) return total;
  return block?.points || fallback;
}

/** Combien d'éléments sont corrects dans la réponse de l'élève ; null si le bloc n'est pas à corriger élément par élément. */
export function itemsCorrect(block: Block, answer: unknown): { correct: number; total: number } | null {
  const total = itemTotal(block);
  if (total < 1) return null;
  const given: unknown[] = Array.isArray(answer) ? answer : [];
  let correct = 0;
  if (block.type === "matching") {
    (block.pairs ?? []).forEach((p, i) => {
      if (given[i] === p.right) correct++;
    });
  } else if (block.type === "categorize") {
    (block.categoryItems ?? []).forEach((it, i) => {
      if (given[i] === it.category) correct++;
    });
  } else if (block.type === "fill_in_the_blank") {
    (block.blanks ?? []).forEach((expected, i) => {
      const alternatives = String(expected).split("|").map((s) => s.trim().toLowerCase());
      if (alternatives.includes(String(given[i] ?? "").trim().toLowerCase())) correct++;
    });
  }
  return { correct, total };
}
