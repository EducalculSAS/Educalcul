// Contrôle de cohérence d'un exercice ou d'un quiz AVANT publication : ce qui rendrait une question
// impossible à réussir ou à corriger. Les brouillons restent libres, seule la publication est bloquée.

const plain = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
const CHOICE_TYPES = ["qcm", "multiple_choice", "single_choice"];
const FREE_TYPES = ["text_input", "coding", "impossible_search"];

function optionKeys(options: unknown): string[] {
  return (Array.isArray(options) ? options : []).map((o) => (typeof o === "string" ? o : String((o as any)?.id ?? (o as any)?.text ?? "")));
}

function choiceProblems(label: string, options: unknown, correct: unknown, out: string[]) {
  const opts = optionKeys(options);
  if (opts.length < 2) out.push(`${label} : moins de 2 choix`);
  if (new Set(opts).size !== opts.length) out.push(`${label} : des choix sont en double`);
  const ca = Array.isArray(correct) ? correct : [correct];
  if (!ca.length || ca.some((a) => a === undefined || a === null || a === "")) out.push(`${label} : aucune bonne réponse`);
  else if (!ca.every((a) => opts.includes(a as string))) out.push(`${label} : la bonne réponse n'est pas parmi les choix`);
}

/** Liste lisible des défauts bloquants d'un exercice (content_json = pages de blocs). */
export function exerciseBlockingProblems(contentJson: unknown): string[] {
  const out: string[] = [];
  const pages = Array.isArray(contentJson) ? contentJson : [];
  let n = 0;
  for (const page of pages) {
    for (const b of (page as any)?.blocks ?? []) {
      if (!b || typeof b !== "object" || b.type === "text" || b.type === "image") continue;
      n++;
      const label = `Question ${n}${b.title ? ` (${plain(b.title)})` : ""}`;
      if (CHOICE_TYPES.includes(b.type)) choiceProblems(label, b.options, b.correctAnswer, out);
      else if (FREE_TYPES.includes(b.type) && !plain(b.correctAnswer)) out.push(`${label} : pas de réponse attendue`);
      else if (b.type === "true_false" && (b.correctAnswer === undefined || b.correctAnswer === null)) out.push(`${label} : pas de réponse attendue`);
      else if (b.type === "click_error") {
        const idx = parseInt(b.correctAnswer, 10);
        if (!Array.isArray(b.steps) || !(idx >= 0 && idx < b.steps.length)) out.push(`${label} : l'étape erronée n'est pas valide`);
      }
    }
  }
  if (n === 0) out.push("Aucune question");
  return out;
}

/** Idem pour un quiz (content_json = liste de questions). */
export function quizBlockingProblems(contentJson: unknown): string[] {
  const out: string[] = [];
  const qs = Array.isArray(contentJson) ? contentJson : [];
  qs.forEach((q: any, i: number) => {
    const label = `Question ${i + 1}`;
    if (CHOICE_TYPES.includes(q?.type) || (Array.isArray(q?.options) && q.options.length > 0)) choiceProblems(label, q.options, q.correctAnswer, out);
    else if (q?.type === "text_input" && !plain(q.correctAnswer)) out.push(`${label} : pas de réponse attendue`);
  });
  if (qs.length === 0) out.push("Aucune question");
  return out;
}

export function publishRefusal(problems: string[]): string {
  const shown = problems.slice(0, 5).join(" ; ");
  return `Publication impossible, corrige d'abord : ${shown}${problems.length > 5 ? ` (et ${problems.length - 5} autre(s))` : ""}.`;
}
