import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminQuizzesClient from "@/components/admin/AdminQuizzesClient";

// Même plafond par défaut de 1000 lignes que pour exercises (voir
// src/app/admin/exercises/page.tsx) — la table quizzes est encore sous ce
// seuil aujourd'hui, mais on pagine par précaution pour ne pas reproduire le
// bug le jour où elle le dépasse.
async function fetchAllQuizzesForAdmin() {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select(`
        id, title, description, course_id, folder_id,
        time_limit_minutes, min_score_percent, status, type,
        difficulty_level, level, max_attempts, grading_type,
        thumbnail_filename, estimated_time, created_at, updated_at,
        courses (title),
        quiz_folders (name, color)
      `)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export default async function AdminQuizzesPage() {
  const [{ data: rootFolders }, quizzes, { data: allFolders }, { data: courses }] = await Promise.all([
    supabaseAdmin.from("quiz_folders").select("*").is("parent_id", null).order("display_order").order("name"),
    // Pas de content_json (volumineux) dans la liste : rechargé à la demande
    // (édition/aperçu/export) via getFullQuiz côté client.
    fetchAllQuizzesForAdmin(),
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
