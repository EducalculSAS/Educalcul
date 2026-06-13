import type { Exercise, Lesson } from "@/components/admin/CourseBuilder";

export interface LessonBlock {
  id: string;
  type: "text" | "table" | "graph" | "image" | "exercise";
  content?: string; // text / table / graph: HTML
  image_url?: string; // image
  exercise?: Exercise; // exercise
}

export function migrateLessonToBlocks(lesson: Lesson): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const exercises = [...(lesson.exercises || [])];
  const usedExerciseIds = new Set<string>();

  if (lesson.content && lesson.content.trim()) {
    const regex = /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*data-exercise-id="([^"]*)"[^>]*>\s*<\/div>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lesson.content)) !== null) {
      const before = lesson.content.slice(lastIndex, match.index);
      if (before.trim()) blocks.push({ id: crypto.randomUUID(), type: "text", content: before });
      const ex = exercises.find((e) => e.id === match![1]);
      if (ex) {
        blocks.push({ id: crypto.randomUUID(), type: "exercise", exercise: ex });
        usedExerciseIds.add(ex.id);
      }
      lastIndex = match.index + match[0].length;
    }
    const after = lesson.content.slice(lastIndex);
    if (after.trim()) blocks.push({ id: crypto.randomUUID(), type: "text", content: after });
  }
  if (lesson.image_url) {
    blocks.push({ id: crypto.randomUUID(), type: "image", image_url: lesson.image_url });
  }
  exercises.forEach((ex) => {
    if (!usedExerciseIds.has(ex.id)) {
      blocks.push({ id: crypto.randomUUID(), type: "exercise", exercise: ex });
    }
  });
  if (blocks.length === 0) {
    blocks.push({ id: crypto.randomUUID(), type: "text", content: "" });
  }
  return blocks;
}

export function deriveLegacyFields(blocks: LessonBlock[]): Pick<Lesson, "content" | "image_url" | "exercises"> {
  const content = blocks
    .map((b) => {
      if (b.type === "text" || b.type === "table" || b.type === "graph") return b.content || "";
      if (b.type === "exercise" && b.exercise) {
        return `<div class="lesson-exercise" data-exercise-id="${b.exercise.id}"></div>`;
      }
      return "";
    })
    .join("\n");
  const image_url = blocks.find((b) => b.type === "image")?.image_url || "";
  const exercises = blocks
    .filter((b) => b.type === "exercise" && b.exercise)
    .map((b) => b.exercise as Exercise);
  return { content, image_url, exercises };
}
