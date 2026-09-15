import type { StructuredCourseBlock } from "@/lib/ai/structuredContent";

/**
 * P0 « Calia en classe » : script codé en dur, aucune IA. Chaque beat cible
 * génériquement les N-ièmes titres/paragraphes/figures trouvés dans la leçon
 * ouverte (via `nth`), pas des ids précis — le compilateur de blocs
 * (compileCourseBlock, voir structuredContent.ts) ne pose aucun id stable sur
 * les blocs rendus, donc ce script fonctionne sur n'importe quelle leçon
 * simple plutôt que d'être couplé à un contenu précis en base.
 */
export type SceneBeat =
  | { kind: "say"; text: string; ms?: number }
  | { kind: "highlight"; selector: string; nth?: number }
  | { kind: "scroll_to"; selector: string; nth?: number }
  | { kind: "point_at"; selector: string; nth?: number }
  | { kind: "board_write"; block: StructuredCourseBlock }
  | { kind: "await_continue" };

const LESSON_CONTENT_SELECTOR = "h3, h4, p, .course-figure, .course-callout, .course-definition";

export const CALIA_SCENE_SCRIPT: SceneBeat[] = [
  { kind: "say", text: "Salut ! On regarde cette leçon ensemble ?", ms: 2200 },
  { kind: "scroll_to", selector: LESSON_CONTENT_SELECTOR, nth: 0 },
  { kind: "highlight", selector: LESSON_CONTENT_SELECTOR, nth: 0 },
  { kind: "say", text: "On commence juste ici — regarde ce premier passage.", ms: 2400 },
  { kind: "point_at", selector: LESSON_CONTENT_SELECTOR, nth: 0 },
  { kind: "say", text: "À ton avis, qu'est-ce que ça veut dire ? Redis-le moi avec tes mots.", ms: 2600 },
  { kind: "await_continue" },
  {
    kind: "board_write",
    block: { type: "display_math", latex: "\\dfrac{3}{4} + \\dfrac{2}{4}" },
  },
  { kind: "say", text: "Petit rappel au tableau : même dénominateur, on additionne les numérateurs.", ms: 2600 },
  {
    kind: "board_write",
    block: { type: "display_math", latex: "= \\dfrac{3+2}{4}" },
  },
  {
    kind: "board_write",
    block: { type: "display_math", latex: "= \\dfrac{5}{4}" },
  },
  { kind: "say", text: "Voilà l'idée. On continue sur la suite ?", ms: 2400 },
  { kind: "scroll_to", selector: LESSON_CONTENT_SELECTOR, nth: 1 },
  { kind: "highlight", selector: LESSON_CONTENT_SELECTOR, nth: 1 },
  { kind: "point_at", selector: LESSON_CONTENT_SELECTOR, nth: 1 },
  { kind: "say", text: "Et ici, qu'est-ce que tu remarques ?", ms: 2400 },
  { kind: "await_continue" },
  { kind: "say", text: "Nickel. C'est tout pour la démo — merci d'avoir testé !", ms: 2600 },
];
