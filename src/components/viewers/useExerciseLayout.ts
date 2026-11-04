import { useMemo } from "react";
import type { Page } from "@/components/admin/ExerciseBuilder";

// Mélange déterministe (seedé par une chaîne) pour que l'ordre affiché aux
// élèves (association / mise en ordre) reste stable entre deux rendus tant
// que l'exercice n'a pas changé, sans avoir à le persister séparément.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Disposition des écrans de l'exercice et ordre mélangé (stable) des éléments à associer, remettre en ordre ou classer.
 * Tout est calculé une fois par exercice : le mélange est seedé par l'identifiant du bloc.
 */
export function useExerciseLayout(pages: Page[], exerciseId: string | number | undefined) {
  // Une page = une question : le contenu est authored/généré avec plusieurs
  // blocs-question regroupés dans une seule Page (voir compiler.ts), donc on
  // aplatit tous les blocs et on les redécoupe côté client en un écran par
  // question, avec la consigne (blocs "text"/"image" en tête) sur son propre
  // écran — sur deux si elle est longue. Purement présentationnel : la
  // correction (validateAllAnswers) continue d'itérer `pages`/blocs bruts.
  const screens = useMemo(() => {
    // Un écran par PAGE authorée, pas par bloc : une page à un seul bloc est
    // une question indépendante (un écran) ; une page à plusieurs blocs est
    // un groupe de "questions liées" sur le même thème, affichées ENSEMBLE
    // sur le même écran (voir contexte du plan — l'ancien comportement
    // aplatissait tous les blocs de toutes les pages et en refaisait un écran
    // par bloc, ce qui séparait les questions liées une par une malgré leur
    // regroupement en base).
    return pages.filter((p) => p.blocks.length > 0).map((p) => ({ blocks: p.blocks, layout: p.layout, sequential: p.sequential === true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  // Affichage mélangé (stable) des blocs "association" (choix de droite) et
  // "mise en ordre" (éléments à réordonner), calculé une fois par exercice.
  // Les valeurs déjà mélangées (matchingOptions/shuffledItems) viennent de
  // l'API quand la réponse correcte a été retirée (élève, avant soumission).
  // pairs/items complets ne sont présents qu'en contexte admin (builder/aperçu).
  const shuffledRightOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "matching") {
          if (b.pairs && b.pairs.every((pr) => pr.right !== undefined)) {
            map[b.id] = seededShuffle(b.pairs.map((pr) => pr.right), b.id);
          } else if (b.matchingOptions) {
            map[b.id] = b.matchingOptions;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  const shuffledOrderingItems = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "ordering") {
          if (b.items) {
            map[b.id] = seededShuffle(b.items, b.id);
          } else if (b.shuffledItems) {
            map[b.id] = b.shuffledItems;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  const shuffledCategorizeItems = useMemo(() => {
    const map: Record<string, { originalIndex: number; text: string }[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "categorize" && b.categoryItems) {
          const indices = b.categoryItems.map((_, i) => i);
          const shuffledIndices = seededShuffle(indices, b.id);
          map[b.id] = shuffledIndices.map((originalIndex) => ({
            originalIndex,
            text: b.categoryItems![originalIndex].text,
          }));
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  return { screens, shuffledRightOptions, shuffledOrderingItems, shuffledCategorizeItems };
}
