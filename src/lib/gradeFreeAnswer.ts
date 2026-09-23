import "server-only";
import { gradeAnswer, gradeImageAnswer } from "@/lib/llm";
import { tryDeterministicMathCheck } from "@/lib/mathAnswerCheck";

export interface FreeAnswerResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  /** Panne de l'IA sans verdict fiable : l'élève doit pouvoir resoumettre. */
  unavailable?: boolean;
}

/** Écriture comparable : sans espaces, \text{}, \left/\right, espacements LaTeX. */
function normalizeWriting(value: string): string {
  return value
    .replace(/\$/g, "")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\(left|right)/g, "")
    .replace(/\\[,;:! ]/g, "")
    .replace(/\\[dt]frac/g, "\\frac")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\{,\}/g, ",")
    .replace(/\s+/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/** Explication rédigée du contenu, raccourcie pour un retour d'une ligne ou deux. */
function shortExplanation(explanation: string | null | undefined): string {
  const text = String(explanation ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, end > 120 ? end + 1 : 220).trim()}…`;
}

/**
 * Correction d'une réponse libre (exercices, quiz, mini-exercices des cours) :
 * une seule logique pour les trois, donc un même verdict et un même retour.
 *
 * 1. Calcul exact d'abord (mathAnswerCheck) — instantané et fiable.
 * 2. Bonne réponse confirmée par le calcul : PAS d'appel à l'IA (c'était
 *    l'essentiel de l'attente) ; on affiche l'explication rédigée du contenu.
 * 3. Sinon l'IA tranche (ou explique l'erreur déjà établie), en 2 phrases.
 * 4. IA indisponible : le calcul exact suffit s'il a tranché ; sinon
 *    « réessaie », jamais un verdict deviné.
 */
export async function gradeFreeAnswer(opts: {
  question: string;
  correctAnswer: unknown;
  studentAnswer: unknown;
  explanation?: string | null;
  level: string;
  maxPoints: number;
  mode?: "numeric" | "justification";
}): Promise<FreeAnswerResult> {
  const { question, explanation, level, maxPoints } = opts;
  const mode = opts.mode ?? "numeric";
  const correct = typeof opts.correctAnswer === "string" ? opts.correctAnswer : JSON.stringify(opts.correctAnswer ?? "");
  const student = typeof opts.studentAnswer === "string" ? opts.studentAnswer : JSON.stringify(opts.studentAnswer ?? "");
  const isImage = student.startsWith("data:image");

  const deterministic =
    !isImage && mode !== "justification" ? tryDeterministicMathCheck(correct, student) : { decided: false as const };

  if (deterministic.decided && deterministic.reason === "incomplete") {
    return { is_correct: false, score: 0, feedback: "Réponse incomplète : remplis toutes les cases avant de valider." };
  }
  // Même écriture que la réponse attendue (aux espaces et à la mise en forme
  // LaTeX près) : juste, sans attendre l'IA — le cas le plus fréquent.
  const sameWriting = !isImage && mode !== "justification" && normalizeWriting(correct) !== "" && normalizeWriting(correct) === normalizeWriting(student);
  if ((deterministic.decided && deterministic.isCorrect) || sameWriting) {
    const why = shortExplanation(explanation);
    return { is_correct: true, score: maxPoints, feedback: why ? `Bonne réponse ! ${why}` : "Bonne réponse !" };
  }

  try {
    const r = isImage
      ? await gradeImageAnswer(question, correct, student, explanation ?? undefined, level, maxPoints)
      : await gradeAnswer(question, correct, student, explanation ?? undefined, level, maxPoints, deterministic.decided ? deterministic.isCorrect : undefined, mode);
    return { is_correct: r.is_correct, score: r.is_correct ? maxPoints : 0, feedback: r.feedback };
  } catch (e) {
    console.error("[gradeFreeAnswer] IA indisponible:", e instanceof Error ? e.message : e);
    if (deterministic.decided) {
      const shown = /[\\^_{}]/.test(correct) && !correct.includes("$") ? `$${correct}$` : correct;
      return { is_correct: false, score: 0, feedback: `Ce n'est pas la bonne réponse. La réponse attendue était ${shown}.` };
    }
    return { is_correct: false, score: 0, feedback: "Réessaie dans quelques secondes.", unavailable: true };
  }
}
