import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCoursesClient from "@/components/admin/AdminCoursesClient";
import { loadFoldersWithCounts } from "@/lib/contentFolders";
import { readFolderCookie } from "@/lib/adminFolderPage";
import { selectAllPages } from "@/lib/selectAllPages";

const LIST_COLUMNS =
  "id, title, description, subject, level, thumbnail_url, status, folder_id, estimated_time, chapter_order, created_at, updated_at";

export default async function AdminCoursesPage() {
  const folderId = await readFolderCookie("admin_courses_folder");

  const [items, allFolders] = await Promise.all([
    selectAllPages((from, to) => {
      const q = supabaseAdmin.from("courses").select(LIST_COLUMNS).order("created_at", { ascending: false }).range(from, to);
      return folderId === null ? q.is("folder_id", null) : q.eq("folder_id", folderId);
    }),
    loadFoldersWithCounts("course"),
  ]);

  return (
    <AdminCoursesClient
      initialFolderId={folderId}
      initialItems={items.map((c: any) => ({ ...c, content_json: null }))}
      initialAllFolders={allFolders}
    />
  );
}
