import { supabaseAdmin } from "@/lib/supabaseClient";
import { getNextGrade } from "@/lib/gradePromotion";
import { selectAllPages } from "@/lib/selectAllPages";

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
const BATCH = 500;

function chunks<T>(arr: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Regroupe des ids par clé (ex. niveau de départ → niveau d'arrivée). */
function groupIds<T>(rows: T[], key: (r: T) => string, id: (r: T) => number): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, [...(m.get(k) ?? []), id(r)]);
  }
  return m;
}

type ChildRow = { id: number; grade_level: string | null; needs_grade_choice: boolean | null; graduated_at: string | null };

/*
 * Tout se fait PAR LOTS : lecture paginée de tous les élèves (un simple
 * select s'arrêtait silencieusement aux 1000 premiers), puis instantanés et
 * mises à jour groupés par niveau (500 élèves par requête). L'ancienne boucle
 * faisait 2 requêtes par élève : 20 000 requêtes pour 10 000 élèves, bien au-delà
 * du temps d'exécution d'une fonction serveur.
 */
export async function runGradePromotion(runBy?: number): Promise<GradePromotionResult> {
  const { data: run, error: runError } = await supabaseAdmin
    .from("grade_promotion_runs")
    .insert({ run_by: runBy ?? null })
    .select("id")
    .single();
  if (runError || !run) throw new Error(runError?.message || "Impossible de créer le run");

  const children = await selectAllPages<ChildRow>((from, to) =>
    supabaseAdmin
      .from("users")
      .select("id, grade_level, needs_grade_choice, graduated_at")
      .eq("role", "child")
      .order("id")
      .range(from, to),
  );

  const toAdvance = children.filter((c) => getNextGrade(c.grade_level));
  const toChoose = children.filter((c) => !getNextGrade(c.grade_level) && c.grade_level === "2nde" && !c.needs_grade_choice);
  const toGraduate = children.filter((c) => TERMINALE_LEVELS.has(c.grade_level ?? "") && !c.graduated_at);

  // Instantanés d'abord : l'annulation doit pouvoir tout restaurer.
  for (const batch of chunks([...toAdvance, ...toChoose])) {
    const { error } = await supabaseAdmin.from("grade_promotion_snapshots").insert(
      batch.map((c) => ({
        run_id: run.id,
        user_id: c.id,
        previous_grade_level: c.grade_level,
        previous_needs_grade_choice: c.needs_grade_choice,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const [level, ids] of groupIds(toAdvance, (c) => c.grade_level ?? "", (c) => c.id)) {
    const next = getNextGrade(level)!;
    for (const batch of chunks(ids)) {
      const { error } = await supabaseAdmin.from("users").update({ grade_level: next }).in("id", batch);
      if (error) throw new Error(error.message);
    }
  }
  for (const batch of chunks(toChoose.map((c) => c.id))) {
    const { error } = await supabaseAdmin.from("users").update({ needs_grade_choice: true }).in("id", batch);
    if (error) throw new Error(error.message);
  }
  const graduatedAt = new Date().toISOString();
  for (const batch of chunks(toGraduate.map((c) => c.id))) {
    const { error } = await supabaseAdmin.from("users").update({ graduated_at: graduatedAt }).in("id", batch);
    if (error) throw new Error(error.message);
  }

  return { runId: run.id, advanced: toAdvance.length, needsManualChoice: toChoose.length, graduated: toGraduate.length };
}

export interface UndoResult {
  restored: number;
}

type SnapshotRow = { user_id: number; previous_grade_level: string | null; previous_needs_grade_choice: boolean | null };

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

  const snapshots = await selectAllPages<SnapshotRow>((from, to) =>
    supabaseAdmin
      .from("grade_promotion_snapshots")
      .select("user_id, previous_grade_level, previous_needs_grade_choice")
      .eq("run_id", lastRun.id)
      .order("user_id")
      .range(from, to),
  );

  // Un élève de Seconde que le passage a obligé à choisir sa spécialité et qui
  // l'a DÉJÀ fait (needs_grade_choice revenu à false) garde son choix :
  // l'annuler le renverrait en Seconde. (L'ancienne condition ne repérait
  // jamais ce cas : l'instantané d'un élève de Seconde vaut toujours false.)
  const secondIds = snapshots.filter((s) => s.previous_grade_level === "2nde").map((s) => s.user_id);
  const alreadyChose = new Set<number>();
  for (const batch of chunks(secondIds)) {
    const { data } = await supabaseAdmin.from("users").select("id").in("id", batch).eq("needs_grade_choice", false);
    (data ?? []).forEach((u) => alreadyChose.add(u.id));
  }
  const toRestore = snapshots.filter((s) => !alreadyChose.has(s.user_id));

  const groups = groupIds(
    toRestore,
    (s) => JSON.stringify([s.previous_grade_level, s.previous_needs_grade_choice]),
    (s) => s.user_id,
  );
  for (const [key, ids] of groups) {
    const [grade_level, needs_grade_choice] = JSON.parse(key) as [string | null, boolean | null];
    for (const batch of chunks(ids)) {
      const { error } = await supabaseAdmin.from("users").update({ grade_level, needs_grade_choice }).in("id", batch);
      if (error) throw new Error(error.message);
    }
  }

  await supabaseAdmin.from("grade_promotion_runs").update({ undone_at: new Date().toISOString() }).eq("id", lastRun.id);

  return { restored: toRestore.length };
}
