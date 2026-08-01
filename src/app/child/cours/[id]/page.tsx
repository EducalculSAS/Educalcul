import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import CourseDetailClient from "@/components/child/CourseDetailClient";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;

  // Le mode preview (ouvert depuis l'admin) charge son contenu depuis le
  // localStorage du navigateur : rien à prérécupérer côté serveur.
  if (courseId === "preview") {
    return <CourseDetailClient courseId={courseId} initialCourse={null} />;
  }

  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: courseData, error } = await supabaseAdmin
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  const course = error || !courseData ? null : courseData;

  return <CourseDetailClient courseId={courseId} initialCourse={course} />;
}
