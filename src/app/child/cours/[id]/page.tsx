import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import CourseDetailClient from "@/components/child/CourseDetailClient";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pid?: string }>;
}) {
  const { id: courseId } = await params;

  // Mode preview (ouvert depuis l'admin, contenu pas encore enregistré) —
  // transmis via une ligne content_previews temporaire, jamais via
  // localStorage. Réservé aux admins connectés (la ligne elle-même est déjà
  // scopée à l'admin qui l'a créée, mais on revérifie le rôle ici aussi).
  if (courseId === "preview") {
    const { pid } = await searchParams;
    const admin = await getServerUser();
    if (!admin || admin.role !== "admin") redirect("/auth/connexion");
    if (!pid) return <CourseDetailClient courseId={courseId} initialCourse={null} />;

    const { data: preview } = await supabaseAdmin
      .from("content_previews")
      .select("payload")
      .eq("id", pid)
      .eq("admin_id", admin.id)
      .eq("type", "course")
      .maybeSingle();

    return <CourseDetailClient courseId={courseId} initialCourse={(preview?.payload as any) || null} />;
  }

  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: courseData, error } = await supabaseAdmin
    .from("courses")
    .select("id, title, description, content_json, subject, level, thumbnail_url")
    .eq("id", courseId)
    .maybeSingle();

  const course = error || !courseData ? null : courseData;

  return <CourseDetailClient courseId={courseId} initialCourse={course} />;
}
