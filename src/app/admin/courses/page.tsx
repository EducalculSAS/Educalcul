import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCoursesClient from "@/components/admin/AdminCoursesClient";

export default async function AdminCoursesPage() {
  const [{ data: rootFolders }, { data: courses }, { data: allFolders }] = await Promise.all([
    supabaseAdmin.from("course_folders").select("*").is("parent_id", null).order("name"),
    supabaseAdmin.from("courses").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("course_folders").select("id, parent_id"),
  ]);

  return (
    <AdminCoursesClient
      initialFolders={rootFolders || []}
      initialAllCourses={courses || []}
      initialAllFolderCounts={allFolders || []}
    />
  );
}
