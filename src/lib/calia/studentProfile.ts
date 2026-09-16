import { supabaseAdmin } from "@/lib/supabaseClient";

const MAX_NOTIONS_STORED = 15;
const MAX_NOTIONS_IN_PROMPT = 5;

interface NotionEntry {
  notion: string;
  since: string;
}

interface MethodStats {
  [method: string]: { tries: number; successes: number };
}

interface StudentProfileRow {
  user_id: number;
  mastered_notions: NotionEntry[];
  weak_notions: NotionEntry[];
  method_stats: MethodStats;
  preferred_method: string | null;
  behavior_notes: string | null;
  last_summary: string | null;
}

/** Contexte eleve compact et de taille FIXE, injecte dans le prompt de
 * chaque tour (Calia en classe et chatbot) — jamais le profil brut, qui
 * grossit sur des mois d'usage. Ne pas augmenter MAX_NOTIONS_IN_PROMPT sans
 * repenser la latence : ceci part dans TOUS les appels, pas seulement le
 * resume de fin de session. */
export async function getCaliaStudentContext(userId: number): Promise<string> {
  const [{ data: user }, { data: profile }, { data: exercises }] = await Promise.all([
    supabaseAdmin.from("users").select("first_name, grade_level").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("calia_student_profile").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("user_exercise_attempts")
      .select("is_correct", { count: "exact" })
      .eq("user_id", userId)
      .order("attempted_at", { ascending: false })
      .limit(30),
  ]);

  const totalEx = exercises?.length || 0;
  const correctEx = exercises?.filter((e: { is_correct: boolean }) => e.is_correct).length || 0;
  const successRate = totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : null;

  const lines: string[] = [];
  lines.push(`Prenom : ${user?.first_name || "eleve"}`);
  lines.push(
    totalEx > 0
      ? `Exercices recents : ${totalEx}, taux de reussite : ${successRate}%`
      : "Pas encore d'exercice fait sur la plateforme."
  );

  const p = profile as StudentProfileRow | null;
  if (p) {
    const mastered = (p.mastered_notions || []).slice(-MAX_NOTIONS_IN_PROMPT).map((n) => n.notion);
    if (mastered.length) lines.push(`Notions deja maitrisees (n'y reviens pas comme si c'etait nouveau) : ${mastered.join(", ")}`);

    const weak = (p.weak_notions || []).slice(-MAX_NOTIONS_IN_PROMPT).map((n) => n.notion);
    if (weak.length) lines.push(`Points faibles connus (a retravailler en priorite) : ${weak.join(", ")}`);

    if (p.preferred_method) lines.push(`Methode pedagogique qui marche le mieux avec cet eleve : ${p.preferred_method}`);
    if (p.behavior_notes) lines.push(`Notes comportementales : ${p.behavior_notes}`);
    if (p.last_summary) lines.push(`Resume de la derniere session : ${p.last_summary}`);
  }

  return lines.join("\n");
}

/** Fusionne le resume d'une session qui vient de se terminer dans le profil
 * — jamais un append illimite : notions plafonnees, behavior_notes/
 * last_summary reecrits en entier a chaque fois. Fire-and-forget cote
 * appelant, ne doit jamais bloquer l'UI. */
export async function mergeCaliaSessionSummary(
  userId: number,
  summary: {
    newMasteredNotions: string[];
    newWeakNotions: string[];
    methodUsed: string | null;
    methodWorked: boolean | null;
    behaviorNotes: string;
    summary: string;
  },
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("calia_student_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const p = existing as StudentProfileRow | null;
  const now = new Date().toISOString();

  const mergeNotions = (current: NotionEntry[] | undefined, additions: string[]): NotionEntry[] => {
    const byName = new Map((current || []).map((n) => [n.notion, n]));
    for (const notion of additions) byName.set(notion, { notion, since: byName.get(notion)?.since || now });
    return Array.from(byName.values()).slice(-MAX_NOTIONS_STORED);
  };

  const methodStats: MethodStats = { ...(p?.method_stats || {}) };
  if (summary.methodUsed) {
    const stats = methodStats[summary.methodUsed] || { tries: 0, successes: 0 };
    stats.tries += 1;
    if (summary.methodWorked) stats.successes += 1;
    methodStats[summary.methodUsed] = stats;
  }
  const bestMethod = Object.entries(methodStats).sort((a, b) => b[1].successes / Math.max(1, b[1].tries) - a[1].successes / Math.max(1, a[1].tries))[0]?.[0] || null;

  await supabaseAdmin.from("calia_student_profile").upsert(
    {
      user_id: userId,
      mastered_notions: mergeNotions(p?.mastered_notions, summary.newMasteredNotions),
      weak_notions: mergeNotions(p?.weak_notions, summary.newWeakNotions),
      method_stats: methodStats,
      preferred_method: bestMethod,
      behavior_notes: summary.behaviorNotes,
      last_summary: summary.summary,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
}
