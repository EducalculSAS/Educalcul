import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import CoursesCatalog from "@/components/child/CoursesCatalog";
import { findLevelFolder, loadPublishedCatalog, loadPublishedFolders, subtreeIds, type CatalogFolder } from "@/lib/childCatalog";

export default async function ChildCoursesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  // Niveau, dossiers et progression sont indépendants : ils partent ensemble.
  const [{ data: userData }, allFolders, { data: progressRows }] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level").eq("id", authUser.id).maybeSingle(),
    loadPublishedFolders<CatalogFolder & Record<string, unknown>>(
      "course_folders",
      "id, parent_id, name, color, icon, grade_level, display_order",
      { byDisplayOrder: true },
    ),
    supabaseAdmin.from("user_course_progress").select("course_id, status, progress_json").eq("user_id", authUser.id),
  ]);
  const levelFolder = findLevelFolder(allFolders, userData?.grade_level ?? null);

  // `lesson_count` est une colonne générée par Postgres : avant, le
  // content_json COMPLET de chaque cours publié (~23 Mo pour 756 cours)
  // transitait à chaque visite uniquement pour compter les leçons. Et seul le
  // sous-arbre du niveau de l'élève est chargé, paginé (voir childCatalog.ts).
  const allCourses = await loadPublishedCatalog<Record<string, any>>(
    "courses",
    "id, folder_id, title, description, thumbnail_url, subject, chapter_order, is_theme_summary, lesson_count",
    { folderIds: levelFolder ? subtreeIds(allFolders, levelFolder.id) : null },
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
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <BookOpen className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              MES COURS
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">LEÇONS</span>
              <span>Explore et deviens expert en mathématiques !</span>
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <CoursesCatalog
          allFolders={allFolders as any}
          allCourses={coursesForClient as any}
          levelFolderId={levelFolder?.id ?? null}
          courseProgress={courseProgress}
        />
      </div>
    </div>
  );
}
