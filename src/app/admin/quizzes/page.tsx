import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminQuizzesClient from "@/components/admin/AdminQuizzesClient";

export default async function AdminQuizzesPage() {
  const [{ data: rootFolders }, { data: quizzes }, { data: allFolders }, { data: courses }] = await Promise.all([
    supabaseAdmin.from("quiz_folders").select("*").is("parent_id", null).order("display_order").order("name"),
    // Pas de content_json (volumineux) dans la liste : rechargé à la demande
    // (édition/aperçu/export) via getFullQuiz côté client.
    supabaseAdmin
      .from("quizzes")
      .select(`
        id, title, description, course_id, folder_id,
        time_limit_minutes, min_score_percent, status, type,
        difficulty_level, level, max_attempts, grading_type,
        thumbnail_filename, estimated_time, created_at, updated_at,
        courses (title),
        quiz_folders (name, color)
      `)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("quiz_folders").select("id, parent_id"),
    supabaseAdmin.from("courses").select("id, title").order("title"),
  ]);

  const quizzesWithoutContent = (quizzes || []).map((q: any) => ({ ...q, content_json: null }));

  return (
    <AdminQuizzesClient
      initialFolders={rootFolders || []}
      initialAllQuizzes={quizzesWithoutContent}
      initialAllFolderCounts={allFolders || []}
      initialCourses={courses || []}
    />
  );
}
