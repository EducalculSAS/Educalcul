import { one } from "@/lib/relations";
import { supabaseAdmin } from "@/lib/supabaseClient";
import type { ComponentProps } from "react";
import AdminQuizzesClient from "@/components/admin/AdminQuizzesClient";
import { loadFoldersWithCounts } from "@/lib/contentFolders";
import { readFolderCookie } from "@/lib/adminFolderPage";
import { selectAllPages } from "@/lib/selectAllPages";

const LIST_COLUMNS = `
  id, title, description, course_id, folder_id,
  time_limit_minutes, min_score_percent, status, type,
  difficulty_level, level, max_attempts, grading_type,
  thumbnail_filename, estimated_time, created_at, updated_at, display_order,
  courses (title),
  quiz_folders (name, color)
`;

export default async function AdminQuizzesPage() {
  const folderId = await readFolderCookie("admin_quizzes_folder");

  const [items, allFolders, courses] = await Promise.all([
    selectAllPages((from, to) => {
      const q = supabaseAdmin.from("quizzes").select(LIST_COLUMNS).order("created_at", { ascending: false }).range(from, to);
      return folderId === null ? q.is("folder_id", null) : q.eq("folder_id", folderId);
    }),
    loadFoldersWithCounts("quiz"),
    selectAllPages((from, to) => supabaseAdmin.from("courses").select("id, title, level").order("title").range(from, to)),
  ]);

  return (
    <AdminQuizzesClient
      initialFolderId={folderId}
      initialItems={items.map((q) => ({ ...q, content_json: null, courses: one(q.courses), quiz_folders: one(q.quiz_folders) }))}
      initialAllFolders={allFolders}
      initialCourses={courses as ComponentProps<typeof AdminQuizzesClient>["initialCourses"]}
    />
  );
}
