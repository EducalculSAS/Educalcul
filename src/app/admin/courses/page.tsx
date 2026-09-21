import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCoursesClient from "@/components/admin/AdminCoursesClient";

// Même plafond par défaut de 1000 lignes que sur exercises/quizzes (voir
// src/app/admin/exercises/page.tsx) — courses est encore sous ce seuil
// aujourd'hui (~757 lignes), mais on pagine par précaution pour ne pas
// reproduire le bug le jour où elle le dépasse.
async function fetchAllCoursesForAdmin() {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("id, title, description, subject, level, thumbnail_url, status, folder_id, estimated_time, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export default async function AdminCoursesPage() {
  const [{ data: rootFolders }, courses, { data: allFolders }] = await Promise.all([
    supabaseAdmin.from("course_folders").select("*").is("parent_id", null).order("display_order").order("name"),
    // Pas de content_json (volumineux) dans la liste : rechargé à la demande
    // (édition/aperçu/export) via getFullCourse côté client.
    fetchAllCoursesForAdmin(),
    supabaseAdmin.from("course_folders").select("id, parent_id"),
  ]);

  const coursesWithoutContent = (courses || []).map((c) => ({ ...c, content_json: null }));

  return (
    <AdminCoursesClient
      initialFolders={rootFolders || []}
      initialAllCourses={coursesWithoutContent}
      initialAllFolderCounts={allFolders || []}
    />
  );
}
