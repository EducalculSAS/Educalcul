import "server-only";
import { commentOnMistake, gradeAnswerFast, gradeImageAnswer, runInteractive, transcribeAnswerImage } from "@/lib/llm";
import { openComment, sealComment } from "@/lib/commentToken";
import { tryDeterministicMathCheck } from "@/lib/mathAnswerCheck";
import { integerValuesDiffer } from "@/lib/exactIntegerValue";

export interface FreeAnswerResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  /** Panne de l'IA sans verdict fiable : l'élève doit pouvoir resoumettre. */
  unavailable?: boolean;
  /** Erreur constatée par le calcul : la réponse de base part tout de suite, ce jeton permet de demander le mini commentaire de l'IA. */
  comment_token?: string;
}

const BASE_WRONG = "Ce n'est pas la bonne réponse : reprends ton calcul étape par étape.";

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
    // Tous les tirets typographiques (moins « − », demi-cadratin, trait d'union insécable…) valent « - ».
    .replace(/[\u2212\u2013\u2014\u2010\u2011\u2012\u207B\uFE63\uFF0D]/g, "-")
    // Exposant / indice d'un seul caractère : x^{2} = x^2, u_{n} = u_n (MathLive écrit parfois les accolades, parfois non).
    .replace(/([\^_])\{(\w)\}/g, "$1$2")
    .replace(/\s+/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Sur une erreur, l'élève peut retenter : le retour ne doit jamais contenir
 * la réponse attendue (l'IA la glissait parfois malgré la consigne). On retire
 * les phrases qui la contiennent ; la réponse n'apparaît que dans la
 * correction finale (« Réponse attendue »), affichée séparément.
 */
function withoutAnswer(feedback: string, correct: string): string {
  const target = normalizeWriting(correct);
  if (!target) return feedback;
  const leaks = (sentence: string) => {
    const n = normalizeWriting(sentence);
    return target.length >= 2 ? n.includes(target) : n.includes(`=${target}`);
  };
  const kept = (feedback.match(/[^.!?]+[.!?]*\s*/g) ?? [feedback]).filter((x) => !leaks(x)).join("").trim();
  return kept || "Ce n'est pas encore ça : reprends ton calcul étape par étape.";
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
 *
 * Réponse manuscrite (image) : on LIT d'abord la réponse finale (vision), puis on la corrige comme une réponse tapée
 * (étapes 1 à 4). Le modèle de vision qui lisait et jugeait en une fois pouvait se contredire (« tu as écrit la bonne
 * réponse… mais c'est faux ») ; il ne sert plus de repli que si la lecture est impossible.
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
  let student = typeof opts.studentAnswer === "string" ? opts.studentAnswer : JSON.stringify(opts.studentAnswer ?? "");
  let isImage = student.startsWith("data:image");
  const originalImage = isImage ? student : "";
  // Ce que le modèle a lu sur la copie : montré à l'élève quand la réponse est jugée fausse, pour qu'il voie s'il a été mal lu.
  let reading = "";
  if (isImage && mode !== "justification") {
    try {
      const t = await runInteractive(() => transcribeAnswerImage(originalImage, question));
      if (t.legible) {
        student = t.answer.startsWith("$") ? t.answer : `$${t.answer}$`;
        reading = student;
        isImage = false;
      }
    } catch (e) {
      console.error("[gradeFreeAnswer] lecture manuscrite impossible, repli sur la vision :", e instanceof Error ? e.message : e);
    }
  }
  const withReading = (feedback: string) => (reading ? `J'ai lu ${reading}. ${feedback}` : feedback);

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

  // Deux calculs d'entiers de valeurs différentes (ex. 2^3 × 5^5 = 40000 contre 2^2 × 5^5 = 12500) : fausse à coup sûr.
  // Un petit modèle de langage se trompait parfois sur des écritures proches ; on ne laisse plus ce verdict à l'IA.
  const exactMismatch = !isImage && mode !== "justification" && !deterministic.decided && integerValuesDiffer(correct, student);

  // Erreur établie par le calcul exact : verdict et réponse de base instantanés, l'IA commente ensuite (jeton).
  if ((deterministic.decided && !deterministic.isCorrect && !isImage) || exactMismatch) {
    return {
      is_correct: false,
      score: 0,
      feedback: withReading(BASE_WRONG),
      comment_token: sealComment({ question, correct, student, explanation: explanation ?? undefined, level }),
    };
  }

  try {
    const r = isImage
      ? await runInteractive(() => gradeImageAnswer(question, correct, student, explanation ?? undefined, level, maxPoints))
      : await gradeAnswerFast(question, correct, student, explanation ?? undefined, level, maxPoints, mode);
    if (r.is_correct) return { is_correct: true, score: maxPoints, feedback: r.feedback || "Bonne réponse !" };
    return { is_correct: false, score: 0, feedback: withReading(withoutAnswer(r.feedback || BASE_WRONG, correct)) };
  } catch (e) {
    console.error("[gradeFreeAnswer] IA indisponible:", e instanceof Error ? e.message : e);
    if (deterministic.decided) {
      return { is_correct: false, score: 0, feedback: "Ce n'est pas la bonne réponse : reprends ton calcul étape par étape." };
    }
    return { is_correct: false, score: 0, feedback: "Réessaie dans quelques secondes.", unavailable: true };
  }
}

/** Mini commentaire de l'IA sur une erreur déjà constatée (jeton remis par la correction) ; chaîne vide si rien d'utile. */
export async function miniComment(token: string): Promise<string> {
  const data = openComment(token);
  if (!data) return "";
  try {
    const comment = await commentOnMistake(data.question, data.correct, data.student, data.level);
    if (!comment) return "";
    const clean = withoutAnswer(comment, data.correct);
    return clean === "Ce n'est pas encore ça : reprends ton calcul étape par étape." ? "" : clean;
  } catch {
    return "";
  }
}
