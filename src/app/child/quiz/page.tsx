import { redirect } from "next/navigation";
import { freeCourseIds } from "@/lib/freeAccess";
import type { ComponentProps } from "react";
import { selectAllPages } from "@/lib/selectAllPages";
import PageHero from "@/components/PageHero";

import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import QuizCatalog from "@/components/child/QuizCatalog";
import { resolveLevelScope } from "@/lib/childCatalog";
import { loadPublishedCatalog, loadPublishedFolders } from "@/lib/childCatalogLoaders";
import { rowGuard } from "@/lib/validate";

type Props = ComponentProps<typeof QuizCatalog>;
const isFolder = rowGuard<Props["allFolders"][number]>({ id: "number", name: "string" });
const isQuiz = rowGuard<Props["allQuizzes"][number]>({ id: "id", title: "string" });
import { visibleLevels } from "@/lib/specialties";

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
    supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders("quiz_folders", "*", isFolder, { byDisplayOrder: true }),
    selectAllPages<{ quiz_id: string; attempts_history: unknown[] | null }>((from, to) =>
      supabaseAdmin
        .from("user_quiz_attempts")
        .select("quiz_id, attempts_history")
        .eq("user_id", authUser.id)
        .order("id")
        .range(from, to),
    ),
  ]);
  // Classe principale + niveaux en plus (maths expertes, niveau attribué par l'admin).
  const scope = resolveLevelScope(allFolders, visibleLevels(userData?.grade_level, userData?.extra_levels));

  // Seul le sous-arbre du niveau de l'élève, paginé (voir childCatalog.ts).
  // Pas de content_json : il n'est chargé qu'à l'ouverture d'un quiz.
  const openCourseIds = await freeCourseIds(authUser);
  const allQuizzesRaw = await loadPublishedCatalog(
    "quizzes",
    `id, title, description, course_id, folder_id,
      time_limit_minutes, min_score_percent, status, type,
      difficulty_level, level, max_attempts, grading_type,
      estimated_time, created_at, updated_at, display_order,
      courses (title)`,
    {
      courseId: filterCourseId ?? null,
      folderIds: scope.folderIds,
    },
    isQuiz,
  );
  // Formule gratuite : les quiz des cours verrouillés ne sont pas listés.
  const allQuizzes = openCourseIds ? allQuizzesRaw.filter((q) => !q.course_id || openCourseIds.has(String(q.course_id))) : allQuizzesRaw;

  const initialProgress: Record<string, { status: string; score: number; attempts: number }> = {};
  for (const a of attempts || []) {
    const history = (a.attempts_history || []) as { passed?: boolean; score_percent?: number }[];
    if (history.length === 0) continue;
    const everPassed = history.some((h) => h.passed === true);
    const best = history.reduce((max: number, h) => Math.max(max, h.score_percent ?? 0), 0);
    initialProgress[a.quiz_id] = { status: everPassed ? "passed" : "failed", score: best, attempts: history.length };
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero back={{ href: "/child/dashboard", label: "Tableau de bord" }} emblem="quiz" title="Quiz" badge="Défi" subtitle="Vérifie ce que tu as retenu, chapitre par chapitre." />
      <div className="container mx-auto px-4 pb-12 max-w-6xl" data-tour="catalog">
        <QuizCatalog
          allFolders={allFolders}
          allQuizzes={allQuizzes}
          levelFolderId={scope.levelFolderId}
          rootFolderIds={scope.rootFolderIds}
          initialProgress={initialProgress}
          filterCourseId={filterCourseId ?? null}
        />
      </div>
    </div>
  );
}
