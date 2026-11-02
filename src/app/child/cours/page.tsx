import type { Loose } from "@/types/loose";
import { redirect } from "next/navigation";
import { selectAllPages } from "@/lib/selectAllPages";
import PageHero from "@/components/PageHero";
import { BookOpen } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import CoursesCatalog from "@/components/child/CoursesCatalog";
import { resolveLevelScope, type CatalogFolder } from "@/lib/childCatalog";
import { loadPublishedCatalog, loadPublishedFolders } from "@/lib/childCatalogLoaders";
import { visibleLevels } from "@/lib/specialties";

export default async function ChildCoursesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  // Niveau, dossiers et progression sont indépendants : ils partent ensemble.
  const [{ data: userData }, allFolders, progressRows] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders<CatalogFolder & Record<string, unknown>>(
      "course_folders",
      "id, parent_id, name, color, icon, grade_level, display_order",
      { byDisplayOrder: true },
    ),
    selectAllPages<{ course_id: string; status: string | null; progress_json: Loose }>((from, to) =>
      supabaseAdmin
        .from("user_course_progress")
        .select("course_id, status, progress_json")
        .eq("user_id", authUser.id)
        .order("id")
        .range(from, to),
    ),
  ]);
  // Classe principale + niveaux en plus (maths expertes, niveau attribué par l'admin).
  const scope = resolveLevelScope(allFolders, visibleLevels(userData?.grade_level, userData?.extra_levels));

  // `lesson_count` est une colonne générée par Postgres : avant, le
  // content_json COMPLET de chaque cours publié (~23 Mo pour 756 cours)
  // transitait à chaque visite uniquement pour compter les leçons. Et seul le
  // sous-arbre du niveau de l'élève est chargé, paginé (voir childCatalog.ts).
  const allCourses = await loadPublishedCatalog<Record<string, Loose>>(
    "courses",
    "id, folder_id, title, description, thumbnail_url, subject, chapter_order, is_theme_summary, lesson_count",
    { folderIds: scope.folderIds },
  );

  // Progression indexée une fois (Map) au lieu d'un .find() par cours.
  const progressByCourse = new Map((progressRows || []).map((p) => [p.course_id, p]));
  const courseProgress: Record<string, { status: string; pct: number }> = {};
  const coursesForClient = allCourses.map((c) => {
    const lessonCount = Number(c.lesson_count) || 0;
    const dbp = progressByCourse.get(c.id);
    const status = dbp?.status || "not_started";
    const done: string[] = dbp?.progress_json?.lessonsCompleted || [];
    const pct = lessonCount > 0 ? Math.round((done.length / lessonCount) * 100) : 0;
    if (status !== "not_started" || pct > 0) courseProgress[c.id] = { status, pct };
    return c;
  });

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero back={{ href: "/child/dashboard", label: "Tableau de bord" }} icon={BookOpen} title="Mes cours" badge="Leçons" subtitle="Explore et deviens expert en mathématiques !" />
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <CoursesCatalog
          allFolders={allFolders as Loose}
          allCourses={coursesForClient as Loose}
          levelFolderId={scope.levelFolderId}
          rootFolderIds={scope.rootFolderIds}
          courseProgress={courseProgress}
        />
      </div>
    </div>
  );
}
