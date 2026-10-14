import { redirect } from "next/navigation";
import { selectAllPages } from "@/lib/selectAllPages";
import PageHero from "@/components/PageHero";
import { Brain } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ExercisesCatalog from "@/components/child/ExercisesCatalog";
import { resolveLevelScope, type CatalogFolder } from "@/lib/childCatalog";
import { loadPublishedCatalog, loadPublishedFolders } from "@/lib/childCatalogLoaders";
import { visibleLevels } from "@/lib/specialties";

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
  const [{ data: userData }, allFolders, attempts] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders<CatalogFolder & { grade_level?: string; color?: string; icon?: string }>(
      "exercise_folders",
      "id, parent_id, name, color, icon, grade_level",
    ),
    // Paginé : une ligne par exercice tenté, un élève assidu dépasse les 1000.
    selectAllPages<{ exercise_id: string; attempts_history: unknown[] | null }>((from, to) =>
      supabaseAdmin
        .from("user_exercise_attempts")
        .select("exercise_id, attempts_history")
        .eq("user_id", authUser.id)
        .order("id")
        .range(from, to),
    ),
  ]);
  // Classe principale + niveaux en plus (maths expertes, niveau attribué par l'admin).
  const scope = resolveLevelScope(allFolders, visibleLevels(userData?.grade_level, userData?.extra_levels));

  // Seul le sous-arbre du niveau de l'élève, paginé (voir childCatalog.ts).
  // Pas de content_json : il n'est chargé qu'à l'ouverture d'un exercice.
  const allExercises = await loadPublishedCatalog(
    "exercises",
    `id, title, description, question, difficulty_level, thumbnail_url, folder_id, course_id, display_order, courses (title)`,
    {
      courseId: filterCourseId ?? null,
      folderIds: scope.folderIds,
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
      <PageHero back={{ href: "/child/dashboard", label: "Tableau de bord" }} icon={Brain} title="Exercices" badge="Entraînement" subtitle="Pratique et améliore tes compétences !" />
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <ExercisesCatalog
          allFolders={allFolders || []}
          allExercises={(allExercises || []) as any}
          levelFolderId={scope.levelFolderId}
          rootFolderIds={scope.rootFolderIds}
          initialProgress={initialProgress}
          filterCourseId={filterCourseId ?? null}
        />
      </div>
    </div>
  );
}
