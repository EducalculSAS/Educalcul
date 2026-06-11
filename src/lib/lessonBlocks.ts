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
  if (lesson.content && lesson.content.trim()) {
    blocks.push({ id: crypto.randomUUID(), type: "text", content: lesson.content });
  }
  if (lesson.image_url) {
    blocks.push({ id: crypto.randomUUID(), type: "image", image_url: lesson.image_url });
  }
  (lesson.exercises || []).forEach((ex) => {
    blocks.push({ id: crypto.randomUUID(), type: "exercise", exercise: ex });
  });
  if (blocks.length === 0) {
    blocks.push({ id: crypto.randomUUID(), type: "text", content: "" });
  }
  return blocks;
}

export function deriveLegacyFields(blocks: LessonBlock[]): Pick<Lesson, "content" | "image_url" | "exercises"> {
  const content = blocks
    .filter((b) => b.type === "text" || b.type === "table" || b.type === "graph")
    .map((b) => b.content || "")
    .join("\n");
  const image_url = blocks.find((b) => b.type === "image")?.image_url || "";
  const exercises = blocks
    .filter((b) => b.type === "exercise" && b.exercise)
    .map((b) => b.exercise as Exercise);
  return { content, image_url, exercises };
}
