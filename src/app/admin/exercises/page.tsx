import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminExercisesClient from "@/components/admin/AdminExercisesClient";

// Supabase/PostgREST plafonne un .select() à 1000 lignes par défaut : la
// table exercises l'a dépassé (~6800 lignes), donc un simple .select() sans
// pagination ne renvoyait que les 1000 plus récentes et la majorité des
// dossiers apparaissaient vides ou incomplets dans l'admin (bug constaté et
// corrigé le 2026-09-21). Toujours paginer ici.
async function fetchAllExercisesForAdmin() {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("exercises")
      .select(`
        id, title, description, question,
        difficulty_level, type, level, status,
        folder_id, course_id,
        points_reward, max_attempts, time_limit,
        created_at, updated_at,
        courses (title, subject, level),
        exercise_folders (name, color)
      `)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export default async function AdminExercisesPage() {
  const [{ data: rootFolders }, exercisesData, { data: allFolders }, { data: courses }] = await Promise.all([
    supabaseAdmin.from("exercise_folders").select("*").is("parent_id", null).order("display_order").order("name"),
    // Pas de content_json (volumineux) dans la liste : rechargé à la demande
    // (édition/aperçu/export) via getFullExercise côté client.
    fetchAllExercisesForAdmin(),
    supabaseAdmin.from("exercise_folders").select("id, parent_id"),
    supabaseAdmin.from("courses").select("id, title").order("title"),
  ]);

  const exercisesWithoutContent = (exercisesData || []).map((e: any) => ({ ...e, content_json: null }));

  return (
    <AdminExercisesClient
      initialFolders={rootFolders || []}
      initialAllExercises={exercisesWithoutContent}
      initialAllFolderCounts={allFolders || []}
      initialCourses={courses || []}
    />
  );
}
