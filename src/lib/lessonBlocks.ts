import type { EduFig } from "@/lib/figures/types";
import { EDUFIG_RE, decodeFigAttr } from "@/lib/figures/render";
import type { Exercise, Lesson } from "@/components/admin/CourseBuilder";

export interface LessonBlock {
  id: string;
  type: "text" | "table" | "graph" | "image" | "exercise" | "special" | "figure";
  content?: string; // text / table / graph / special: HTML
  image_url?: string; // image
  exercise?: Exercise; // exercise
  specialType?: string; // special: le "type" du StructuredCourseBlock (ex: "clock", "fraction")
  specialData?: Record<string, unknown>; // special: donnees brutes reeditables
  fig?: EduFig; // figure: description EduFig (le HTML est dans content)
}

/** Un morceau de texte de leçon, découpé autour de ses figures EduFig (chacune devient un bloc « Figure » modifiable). */
function pushText(blocks: LessonBlock[], html: string) {
  let last = 0;
  for (const m of html.matchAll(EDUFIG_RE)) {
    const before = html.slice(last, m.index);
    if (before.trim()) blocks.push({ id: crypto.randomUUID(), type: "text", content: before });
    const fig = decodeFigAttr(m[1]);
    blocks.push(fig ? { id: crypto.randomUUID(), type: "figure", content: m[0], fig } : { id: crypto.randomUUID(), type: "text", content: m[0] });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = html.slice(last);
  if (rest.trim()) blocks.push({ id: crypto.randomUUID(), type: "text", content: rest });
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
      if (before.trim()) pushText(blocks, before);
      const ex = exercises.find((e) => e.id === match![1]);
      if (ex) {
        blocks.push({ id: crypto.randomUUID(), type: "exercise", exercise: ex });
        usedExerciseIds.add(ex.id);
      }
      lastIndex = match.index + match[0].length;
    }
    const after = lesson.content.slice(lastIndex);
    if (after.trim()) pushText(blocks, after);
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
      if (b.type === "text" || b.type === "table" || b.type === "graph" || b.type === "special" || b.type === "figure") return b.content || "";
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
