import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminQuizzesClient from "@/components/admin/AdminQuizzesClient";

export default async function AdminQuizzesPage() {
  const [{ data: rootFolders }, { data: quizzes }, { data: allFolders }, { data: courses }] = await Promise.all([
    supabaseAdmin.from("quiz_folders").select("*").is("parent_id", null).order("name"),
    supabaseAdmin
      .from("quizzes")
      .select(`*, courses (title), quiz_folders (name, color)`)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("quiz_folders").select("id, parent_id"),
    supabaseAdmin.from("courses").select("id, title").order("title"),
  ]);

  return (
    <AdminQuizzesClient
      initialFolders={rootFolders || []}
      initialAllQuizzes={quizzes || []}
      initialAllFolderCounts={allFolders || []}
      initialCourses={courses || []}
    />
  );
}
