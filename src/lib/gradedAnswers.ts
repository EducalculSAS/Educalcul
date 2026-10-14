import { supabaseAdmin } from "@/lib/supabaseClient";

export type GradedKind = "exercise" | "quiz";

export interface GradedRow {
  blockId: string;
  score: number;
  maxScore: number;
  isCorrect: boolean;
}

/**
 * Verdicts de correction gardés côté serveur (table graded_answers). La note d'une tentative est calculée à partir
 * d'eux au moment de l'enregistrer : un navigateur ne peut plus déclarer le score qu'il veut.
 * Un nouveau verdict pour la même question remplace le précédent (la tentative en cours garde le dernier).
 */
export async function recordGrades(userId: number, kind: GradedKind, itemId: string | number, rows: GradedRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("graded_answers").upsert(
    rows.map((r) => ({ user_id: userId, kind, item_id: String(itemId), block_id: r.blockId, score: r.score, max_score: r.maxScore, is_correct: r.isCorrect, graded_at: new Date().toISOString() })),
    { onConflict: "user_id,kind,item_id,block_id" },
  );
  if (error) console.error("[graded_answers] écriture échouée :", error.message);
}

/** Note de la tentative en cours : somme des verdicts des questions existantes, bornée au barème. */
export async function serverScore(userId: number, kind: GradedKind, itemId: string | number, validBlockIds: Set<string>, maxPoints: number): Promise<number> {
  const { data } = await supabaseAdmin.from("graded_answers").select("block_id, score").eq("user_id", userId).eq("kind", kind).eq("item_id", String(itemId));
  let total = 0;
  for (const r of data ?? []) if (validBlockIds.has(String(r.block_id))) total += Number(r.score) || 0;
  return Math.min(Math.round(total * 100) / 100, maxPoints);
}

/** Fin de tentative : la suivante (« refaire ») repart de zéro. */
export async function clearGrades(userId: number, kind: GradedKind, itemId: string | number): Promise<void> {
  await supabaseAdmin.from("graded_answers").delete().eq("user_id", userId).eq("kind", kind).eq("item_id", String(itemId));
}
