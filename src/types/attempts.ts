/** Résumé d'une tentative d'exercice ou de quiz, tel qu'affiché dans l'historique de l'élève. */
export interface AttemptSummary {
  score_percent: number | null;
  passed: boolean | null;
  pending?: boolean;
  completed_at: string;
}
