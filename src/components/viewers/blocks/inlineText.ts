/** État de la correction immédiate d'une réponse libre (texte, code…) dans un exercice. */
export interface InlineTextState {
  attempts: number;
  status: "grading" | "correct" | "wrong" | "revealed" | "unavailable";
  feedback?: string;
  resolvedScore?: number;
  resolvedCorrect?: boolean;
  revealedAnswer?: string;
}
