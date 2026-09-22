import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ExercisesCatalog from "@/components/child/ExercisesCatalog";
import { findLevelFolder, loadPublishedCatalog, loadPublishedFolders, subtreeIds, type CatalogFolder } from "@/lib/childCatalog";

export default async function ChildExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { course: filterCourseId } = await searchParams;

  // Niveau, dossiers et progression sont indépendants : ils partent ensemble.
  const [{ data: userData }, allFolders, { data: attempts }] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders<CatalogFolder & { grade_level?: string; color?: string; icon?: string }>(
      "exercise_folders",
      "id, parent_id, name, color, icon, grade_level",
    ),
    supabaseAdmin.from("user_exercise_attempts").select("exercise_id, attempts_history").eq("user_id", authUser.id),
  ]);
  const levelFolder = findLevelFolder(allFolders, userData?.grade_level ?? null);

  // Seul le sous-arbre du niveau de l'élève, paginé (voir childCatalog.ts).
  // Pas de content_json : il n'est chargé qu'à l'ouverture d'un exercice.
  const allExercises = await loadPublishedCatalog(
    "exercises",
    `id, title, description, question, difficulty_level, thumbnail_url, folder_id, course_id, courses (title)`,
    {
      courseId: filterCourseId ?? null,
      folderIds: levelFolder ? subtreeIds(allFolders, levelFolder.id) : null,
    },
  );

  const initialProgress: Record<string, { status: string; score: number; attempts: number }> = {};
  for (const a of attempts || []) {
    const history = a.attempts_history || [];
    if (history.length === 0) continue;
    const everPassed = history.some((h: any) => h.passed === true);
    const best = history.reduce((max: number, h: any) => Math.max(max, h.score_percent ?? 0), 0);
    initialProgress[a.exercise_id] = { status: everPassed ? "passed" : "failed", score: best, attempts: history.length };
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <Brain className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              EXERCICES
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">ENTRAÎNEMENT</span>
              <span>Pratique et améliore tes compétences !</span>
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <ExercisesCatalog
          allFolders={allFolders || []}
          allExercises={(allExercises || []) as any}
          levelFolderId={levelFolder?.id ?? null}
          initialProgress={initialProgress}
          filterCourseId={filterCourseId ?? null}
        />
      </div>
    </div>
  );
}
