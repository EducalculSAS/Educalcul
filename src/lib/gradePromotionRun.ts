import { supabaseAdmin } from "@/lib/supabaseClient";
import { getNextGrade } from "@/lib/gradePromotion";

export interface GradePromotionResult {
  advanced: number;
  needsManualChoice: number;
}

/**
 * Fait avancer tous les comptes enfant d'un niveau (voir NEXT_GRADE). Les
 * élèves en Seconde ne peuvent pas être avancés automatiquement (choix de
 * spécialité maths) : on les marque needs_grade_choice=true, ce qui déclenche
 * un choix obligatoire à leur prochaine connexion (voir ChildGradeChoiceModal).
 */
export async function runGradePromotion(): Promise<GradePromotionResult> {
  const { data: children } = await supabaseAdmin
    .from("users")
    .select("id, grade_level")
    .eq("role", "child");

  let advanced = 0;
  let needsManualChoice = 0;

  for (const child of children || []) {
    const next = getNextGrade(child.grade_level);
    if (next) {
      await supabaseAdmin.from("users").update({ grade_level: next }).eq("id", child.id);
      advanced++;
    } else if (child.grade_level === "2nde") {
      await supabaseAdmin.from("users").update({ needs_grade_choice: true }).eq("id", child.id);
      needsManualChoice++;
    }
  }

  return { advanced, needsManualChoice };
}
