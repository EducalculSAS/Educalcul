import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { DEMO_EXERCISE, DEMO_QUIZ } from "@/lib/demoContent";
import { gradeBlock, revealFor } from "@/lib/structuredGrading";
import { gradeDemoWritten, isDemoWrittenBlock } from "@/lib/demoGrading";

/**
 * Correction de la DÉMONSTRATION de la page Offres (sans compte) : uniquement les questions du contenu de démonstration,
 * corrigées comme un vrai exercice / quiz, rien n'est enregistré. Limitée par adresse IP.
 *  - { kind: "exercise", items: [{ block_id, answer }] } → { results: [...] }
 *  - { kind: "quiz", question_id, answer } → { score, max_score, is_correct, feedback, reveal }
 */
const MAX_PER_MINUTE = 40;

export async function POST(req: Request) {
  const rl = await rateLimitWithBackoff(`demo:grade:${getClientIp(req)}`, MAX_PER_MINUTE, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Trop de corrections d'un coup : réessaie dans une minute." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  if (body?.kind === "exercise") {
    const blocks = new Map(DEMO_EXERCISE.content_json.flatMap((p) => p.blocks).map((b) => [b.id, b]));
    const items: { block_id?: unknown; answer?: unknown }[] = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const results = items.map((it) => {
      const block = blocks.get(String(it.block_id ?? ""));
      if (!block) return { block_id: it.block_id, score: 0, max_score: 0, is_correct: false, feedback: "Question inconnue." };
      // Réponses écrites : correction déterministe, présentée comme un retour de Calia (aucune IA appelée).
      if (isDemoWrittenBlock(block.id)) return { block_id: block.id, ...gradeDemoWritten(block.id, it.answer, block.points || 1), reveal: revealFor(block) };
      return { block_id: block.id, ...gradeBlock(block, it.answer, block.points || 1) };
    });
    return NextResponse.json({ results });
  }
  if (body?.kind === "quiz") {
    const q = DEMO_QUIZ.content_json.find((x) => x.id === String(body.question_id ?? ""));
    if (!q) return NextResponse.json({ error: "Question inconnue" }, { status: 404 });
    const answer = body.answer;
    const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
    const selected = (Array.isArray(answer) ? answer : [answer]).map(String);
    const ok = q.type === "multiple_choice"
      ? correct.length === selected.length && correct.every((a) => selected.includes(String(a)))
      : String(answer) === String(q.correctAnswer);
    const pts = q.points || 1;
    return NextResponse.json({ score: ok ? pts : 0, max_score: pts, is_correct: ok, feedback: ok ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.", reveal: { correctAnswer: q.correctAnswer, explanation: q.explanation } });
  }
  return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
}
