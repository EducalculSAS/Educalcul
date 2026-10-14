import { randomUUID } from "crypto";
import { blockMaxPoints, itemTotal } from "@/lib/exerciseScoring";

/** Identifiants de question uniques dans TOUT l'exercice (pages comprises). La correction retrouve chaque question par
 * son identifiant : deux questions au même identifiant (cas d'une page régénérée par l'IA, qui réutilise « block-1 »,
 * « block-2 »…) et la seconde écrasait la première, donc la correction se faisait sur l'ancienne question. */
export function dedupeBlockIds<T>(pages: T): T {
  if (!Array.isArray(pages)) return pages;
  const seen = new Set<string>();
  return pages.map((page: any) => {
    if (!page || !Array.isArray(page.blocks)) return page;
    return {
      ...page,
      blocks: page.blocks.map((b: any) => {
        if (!b || typeof b !== "object") return b;
        let id = typeof b.id === "string" && b.id ? b.id : "";
        if (!id || seen.has(id)) id = `block-${randomUUID()}`;
        seen.add(id);
        return id === b.id ? b : { ...b, id };
      }),
    };
  }) as unknown as T;
}

// Extrait de src/app/api/admin/exercises/route.ts pour être réutilisé tel
// quel côté serveur (page /child/exercises/[id]) sans dupliquer une logique
// sensible : elle retire les champs qui révèlent la bonne réponse avant
// qu'un contenu n'atteigne un élève. Toute modification doit rester
// cohérente entre les deux usages.

// Mélange déterministe (seedé par une chaîne), miroir de celui utilisé côté
// client (ExerciseViewer) pour l'affichage — garantit un ordre stable.
export function seededShuffle<T>(arr: T[], seed: string): T[] {
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

// Retire les champs qui révèlent la réponse correcte d'un bloc avant de
// renvoyer l'exercice à un lecteur non-admin (élève). Pour "matching"/"ordering",
// le client a besoin d'une liste mélangée à afficher : on la fournit déjà
// mélangée côté serveur (matchingOptions / shuffledItems) sans jamais exposer
// la correspondance/l'ordre correct.
export function stripBlockAnswers(block: any) {
  const { correctAnswer, blanks, ...stripped } = block;
  // Un point par élément pour les associations / catégories / trous : le client ne voit jamais les réponses, mais il
  // doit connaître le bon total de points.
  const rest = itemTotal(block) > 1 ? { ...stripped, points: blockMaxPoints(block) } : stripped;
  if (block.type === "matching" && Array.isArray(block.pairs)) {
    const { pairs, ...safe } = rest;
    return {
      ...safe,
      pairs: pairs.map((p: any) => ({ left: p.left })),
      matchingOptions: seededShuffle(pairs.map((p: any) => p.right), block.id || ""),
    };
  }
  if (block.type === "ordering" && Array.isArray(block.items)) {
    const { items, ...safe } = rest;
    return {
      ...safe,
      shuffledItems: seededShuffle(items, block.id || ""),
    };
  }
  if (block.type === "categorize" && Array.isArray(block.categoryItems)) {
    const { categoryItems, ...safe } = rest;
    return {
      ...safe,
      categoryItems: categoryItems.map((it: any) => ({ text: it.text })),
    };
  }
  return rest;
}

// Garantit qu'un exercice a toujours au moins un bloc de contenu affichable
// (certains exercices legacy ont un content_json vide) : reconstruit un bloc
// par défaut à partir du type d'exercice et de son énoncé/titre.
export function fillEmptyContentJson(exercise: any) {
  if (exercise.content_json && !(Array.isArray(exercise.content_json) && exercise.content_json.length === 0)) {
    return exercise;
  }
  const fallbackQuestion = exercise.question || exercise.description || exercise.title || "Énoncé non spécifié";

  let defaultBlock: any = {
    id: "block-1",
    type: "text",
    content: fallbackQuestion,
  };

  if (exercise.type === "single_choice" || exercise.type === "multiple_choice") {
    defaultBlock = {
      id: "block-1",
      type: exercise.type === "multiple_choice" ? "multiple_choice" : "single_choice",
      content: fallbackQuestion,
      options: [
        { id: "opt-1", text: "Réponse A" },
        { id: "opt-2", text: "Réponse B" },
        { id: "opt-3", text: "Réponse C" },
      ],
      correctAnswer: "opt-1",
    };
  } else if (exercise.type === "true_false") {
    defaultBlock = {
      id: "block-1",
      type: "true_false",
      statement: fallbackQuestion,
      correctAnswer: true,
    };
  } else if (exercise.type === "text_input") {
    defaultBlock = {
      id: "block-1",
      type: "text_input",
      label: fallbackQuestion,
      placeholder: "Votre réponse",
      expectedAnswer: "",
    };
  }

  return {
    ...exercise,
    content_json: [
      {
        id: "page-1",
        blocks: [defaultBlock],
      },
    ],
  };
}

export function stripAnswers(content: any) {
  if (!content?.content_json || !Array.isArray(content.content_json)) return content;
  return {
    ...content,
    content_json: content.content_json.map((page: any) => ({
      ...page,
      blocks: Array.isArray(page.blocks) ? page.blocks.map(stripBlockAnswers) : page.blocks,
    })),
  };
}
