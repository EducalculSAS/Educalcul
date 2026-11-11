import type { AnswerType } from "@/lib/minigames/gameTypes";

export interface SheetQuestion { prompt: string; answer: number | string }
export interface GivenAnswer { index: number; value: number | string }
export interface CorrectionLine {
  index: number;
  prompt: string;
  /** Réponse de l'élève ; null si la question a été passée. */
  given: number | string | null;
  expected: number | string;
  correct: boolean;
}

/** Normalise pour une comparaison texte tolérante : espaces, casse, accents. */
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function normalizeText(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

export function isAnswerCorrect(answerType: AnswerType, expected: number | string | undefined, value: unknown): boolean {
  if (answerType === "number") {
    return typeof expected === "number" && value !== null && value !== "" && Number.isFinite(Number(value)) && Math.abs(expected - Number(value)) < 1e-9;
  }
  return typeof expected === "string" && typeof value === "string" && normalizeText(expected) === normalizeText(value);
}

/**
 * Correction d'une fiche : une ligne par question, dans l'ordre. Une seule réponse comptée par question (renvoyer
 * plusieurs fois la même ne rapporte rien de plus) ; une question sans réponse est fausse. N'est calculée — et
 * envoyée au navigateur — qu'une fois la partie terminée, donc jamais avant que l'élève ait répondu.
 */
export function correctSheet(questions: SheetQuestion[], answers: GivenAnswer[], answerType: AnswerType): CorrectionLine[] {
  const first = new Map<number, number | string>();
  for (const a of answers) {
    if (Number.isInteger(a?.index) && a.index >= 0 && a.index < questions.length && !first.has(a.index)) first.set(a.index, a.value);
  }
  return questions.map((q, index) => {
    const given = first.has(index) ? first.get(index)! : null;
    return { index, prompt: q.prompt, given, expected: q.answer, correct: given !== null && isAnswerCorrect(answerType, q.answer, given) };
  });
}
