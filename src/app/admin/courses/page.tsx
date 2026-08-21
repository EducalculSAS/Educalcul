import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCoursesClient from "@/components/admin/AdminCoursesClient";

export default async function AdminCoursesPage() {
  const [{ data: rootFolders }, { data: courses }, { data: allFolders }] = await Promise.all([
    supabaseAdmin.from("course_folders").select("*").is("parent_id", null).order("display_order").order("name"),
    // Pas de content_json (volumineux) dans la liste : rechargé à la demande
    // (édition/aperçu/export) via getFullCourse côté client.
    supabaseAdmin
      .from("courses")
      .select("id, title, description, subject, level, thumbnail_url, status, folder_id, estimated_time, created_at, updated_at")
      .order("created_at", { ascending: false }),
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
