import { supabaseAdmin } from "@/lib/supabaseClient";
import { getNextGrade } from "@/lib/gradePromotion";

const TERMINALE_LEVELS = new Set([
  "terminale-generale",
  "terminale-generale-maths",
  "terminale-generale-expertes",
  "terminale-generale-complementaires",
]);

export interface GradePromotionResult {
  runId: number;
  advanced: number;
  needsManualChoice: number;
  graduated: number;
}

/**
 * Fait avancer tous les comptes enfant d'un niveau (voir NEXT_GRADE). Les
 * élèves en Seconde ne peuvent pas être avancés automatiquement (choix de
 * spécialité maths) : on les marque needs_grade_choice=true, ce qui déclenche
 * un choix obligatoire à leur prochaine connexion (voir ChildGradeChoiceModal).
 * Les élèves déjà en Terminale sont marqués "diplômés" (graduated_at).
 *
 * Chaque changement est snapshotté (grade_promotion_runs +
 * grade_promotion_snapshots) pour permettre une annulation (voir
 * /api/admin/grade-promotion/undo).
 */
export async function runGradePromotion(runBy?: number): Promise<GradePromotionResult> {
  const { data: run, error: runError } = await supabaseAdmin
    .from("grade_promotion_runs")
    .insert({ run_by: runBy ?? null })
    .select("id")
    .single();
  if (runError || !run) throw new Error(runError?.message || "Impossible de créer le run");

  const { data: children } = await supabaseAdmin
    .from("users")
    .select("id, grade_level, needs_grade_choice, graduated_at")
    .eq("role", "child");

  let advanced = 0;
  let needsManualChoice = 0;
  let graduated = 0;

  for (const child of children || []) {
    const next = getNextGrade(child.grade_level);
    if (next) {
      await supabaseAdmin.from("grade_promotion_snapshots").insert({
        run_id: run.id,
        user_id: child.id,
        previous_grade_level: child.grade_level,
        previous_needs_grade_choice: child.needs_grade_choice,
      });
      await supabaseAdmin.from("users").update({ grade_level: next }).eq("id", child.id);
      advanced++;
    } else if (child.grade_level === "2nde" && !child.needs_grade_choice) {
      await supabaseAdmin.from("grade_promotion_snapshots").insert({
        run_id: run.id,
        user_id: child.id,
        previous_grade_level: child.grade_level,
        previous_needs_grade_choice: child.needs_grade_choice,
      });
      await supabaseAdmin.from("users").update({ needs_grade_choice: true }).eq("id", child.id);
      needsManualChoice++;
    } else if (TERMINALE_LEVELS.has(child.grade_level) && !child.graduated_at) {
      await supabaseAdmin.from("users").update({ graduated_at: new Date().toISOString() }).eq("id", child.id);
      graduated++;
    }
  }

  return { runId: run.id, advanced, needsManualChoice, graduated };
}

export interface UndoResult {
  restored: number;
}

/** Annule le dernier passage de classe non encore annulé. */
export async function undoLastGradePromotion(): Promise<UndoResult> {
  const { data: lastRun } = await supabaseAdmin
    .from("grade_promotion_runs")
    .select("id")
    .is("undone_at", null)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastRun) throw new Error("Aucun passage de classe à annuler.");

  const { data: snapshots } = await supabaseAdmin
    .from("grade_promotion_snapshots")
    .select("user_id, previous_grade_level, previous_needs_grade_choice")
    .eq("run_id", lastRun.id);

  let restored = 0;
  for (const s of snapshots || []) {
    // Ne restaure que si l'élève n'a pas déjà fait un choix de spécialité
    // entre-temps (sinon on écraserait un choix réel avec l'ancien état).
    const { data: current } = await supabaseAdmin
      .from("users")
      .select("needs_grade_choice")
      .eq("id", s.user_id)
      .maybeSingle();
    if (current && current.needs_grade_choice === false && s.previous_needs_grade_choice !== false) {
      continue; // choix déjà fait, on laisse tel quel
    }

    await supabaseAdmin.from("users").update({
      grade_level: s.previous_grade_level,
      needs_grade_choice: s.previous_needs_grade_choice,
    }).eq("id", s.user_id);
    restored++;
  }

  await supabaseAdmin.from("grade_promotion_runs").update({ undone_at: new Date().toISOString() }).eq("id", lastRun.id);

  return { restored };
}
