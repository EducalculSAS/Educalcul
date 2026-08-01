import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import CoursesCatalog from "@/components/child/CoursesCatalog";

export default async function ChildCoursesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("grade_level")
    .eq("id", authUser.id)
    .maybeSingle();
  const level = userData?.grade_level || null;

  const [{ data: allFolders }, { data: allCourses }, { data: progressRows }] = await Promise.all([
    supabaseAdmin.from("course_folders").select("*").eq("status", "published").order("name"),
    supabaseAdmin.from("courses").select("*").eq("status", "published"),
    supabaseAdmin.from("user_course_progress").select("course_id, status, progress_json").eq("user_id", authUser.id),
  ]);

  const lvl = String(level || "").toLowerCase().trim();
  const levelFolder = (allFolders || []).find(
    (f) => f.parent_id == null && lvl && (
      String(f.grade_level || "").toLowerCase().trim() === lvl ||
      String(f.name || "").toLowerCase().trim() === lvl
    )
  );

  const courseProgress: Record<string, { status: string; pct: number }> = {};
  for (const c of allCourses || []) {
    const dbp = (progressRows || []).find((p) => p.course_id === c.id);
    const status = dbp?.status || "not_started";
    const done: string[] = dbp?.progress_json?.lessonsCompleted || [];
    const totalL = (c.content_json || []).reduce((a: number, ch: any) => a + (ch.lessons?.length || 0), 0);
    const pct = totalL > 0 ? Math.round((done.length / totalL) * 100) : 0;
    if (status !== "not_started" || pct > 0) courseProgress[c.id] = { status, pct };
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
          allFolders={allFolders || []}
          allCourses={allCourses || []}
          levelFolderId={levelFolder?.id ?? null}
          courseProgress={courseProgress}
        />
      </div>
    </div>
  );
}
