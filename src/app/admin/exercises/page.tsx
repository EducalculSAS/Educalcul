import { supabaseAdmin } from "@/lib/supabaseClient";
import { fillEmptyContentJson } from "@/lib/exerciseContent";
import AdminExercisesClient from "@/components/admin/AdminExercisesClient";

export default async function AdminExercisesPage() {
  const [{ data: rootFolders }, { data: exercisesData }, { data: allFolders }, { data: courses }] = await Promise.all([
    supabaseAdmin.from("exercise_folders").select("*").is("parent_id", null).order("name"),
    supabaseAdmin
      .from("exercises")
      .select(`
        id, title, description, question,
        difficulty_level, type, level, status,
        folder_id, course_id, content_json,
        points_reward, max_attempts, time_limit,
        created_at, updated_at,
        courses (title, subject, level),
        exercise_folders (name, color)
      `)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("exercise_folders").select("id, parent_id"),
    supabaseAdmin.from("courses").select("id, title").order("title"),
  ]);

  const allExercises = (exercisesData || []).map(fillEmptyContentJson);

  return (
    <AdminExercisesClient
      initialFolders={rootFolders || []}
      initialAllExercises={allExercises as any}
      initialAllFolderCounts={allFolders || []}
      initialCourses={courses || []}
    />
  );
}
