import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminExercisesClient from "@/components/admin/AdminExercisesClient";
import { loadFoldersWithCounts } from "@/lib/contentFolders";
import { readFolderCookie, selectAllPages } from "@/lib/adminFolderPage";

// Mêmes colonnes que la liste de /api/admin/exercises : pas de content_json
// (volumineux), rechargé à la demande via getFullExercise côté client.
const LIST_COLUMNS = `
  id, title, description, question,
  difficulty_level, type, level, status,
  folder_id, course_id,
  points_reward, max_attempts, time_limit,
  created_at, updated_at,
  courses (title, subject, level),
  exercise_folders (name, color)
`;

export default async function AdminExercisesPage() {
  const folderId = await readFolderCookie("admin_exercises_folder");

  const [items, allFolders, courses] = await Promise.all([
    // Seul le dossier que l'admin va voir, plus tout le catalogue.
    selectAllPages((from, to) => {
      const q = supabaseAdmin.from("exercises").select(LIST_COLUMNS).order("created_at", { ascending: false }).range(from, to);
      return folderId === null ? q.is("folder_id", null) : q.eq("folder_id", folderId);
    }),
    loadFoldersWithCounts("exercise"),
    selectAllPages((from, to) => supabaseAdmin.from("courses").select("id, title").order("title").range(from, to)),
  ]);

  return (
    <AdminExercisesClient
      initialFolderId={folderId}
      initialItems={items.map((e: any) => ({ ...e, content_json: null }))}
      initialAllFolders={allFolders}
      initialCourses={courses as any[]}
    />
  );
}
