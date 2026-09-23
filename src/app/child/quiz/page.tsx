import { redirect } from "next/navigation";
import { selectAllPages } from "@/lib/selectAllPages";
import PageHero from "@/components/PageHero";
import { Trophy } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import QuizCatalog from "@/components/child/QuizCatalog";
import { findLevelFolder, loadPublishedCatalog, loadPublishedFolders, subtreeIds, type CatalogFolder } from "@/lib/childCatalog";

export default async function ChildQuizPage({
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
    supabaseAdmin.from("users").select("grade_level").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders<CatalogFolder & Record<string, unknown>>("quiz_folders", "*"),
    selectAllPages<{ quiz_id: string; attempts_history: any[] | null }>((from, to) =>
      supabaseAdmin
        .from("user_quiz_attempts")
        .select("quiz_id, attempts_history")
        .eq("user_id", authUser.id)
        .order("id")
        .range(from, to),
    ),
  ]);
  const levelFolder = findLevelFolder(allFolders, userData?.grade_level ?? null);

  // Seul le sous-arbre du niveau de l'élève, paginé (voir childCatalog.ts).
  // Pas de content_json : il n'est chargé qu'à l'ouverture d'un quiz.
  const allQuizzes = await loadPublishedCatalog(
    "quizzes",
    `id, title, description, course_id, folder_id,
      time_limit_minutes, min_score_percent, status, type,
      difficulty_level, level, max_attempts, grading_type,
      estimated_time, created_at, updated_at,
      courses (title)`,
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
    initialProgress[a.quiz_id] = { status: everPassed ? "passed" : "failed", score: best, attempts: history.length };
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero icon={Trophy} title="Quiz & défis" badge="Défi" subtitle="Teste tes connaissances et gagne des trophées !" />
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <QuizCatalog
          allFolders={allFolders as any}
          allQuizzes={allQuizzes as any}
          levelFolderId={levelFolder?.id ?? null}
          initialProgress={initialProgress}
          filterCourseId={filterCourseId ?? null}
        />
      </div>
    </div>
  );
}
