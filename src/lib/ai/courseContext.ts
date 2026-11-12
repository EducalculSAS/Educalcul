/**
 * Résumé d'un cours pour la génération d'exercices « au niveau du cours » : plan, définitions et propriétés encadrées,
 * exemples, et les exercices du cours eux-mêmes comme étalon de difficulté. Texte brut (aucun HTML), borné en taille.
 * Le cours n'est jamais modifié : on ne fait que le lire.
 */

interface CourseExercise { question?: unknown; answer?: unknown }
interface CourseLesson { title?: unknown; content?: unknown; exercises?: unknown }
interface CourseChapter { title?: unknown; lessons?: unknown }

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** HTML → texte : garde les formules ($…$) et une ligne par paragraphe ou encadré. */
export function htmlToPlain(html: string): string {
  return decode(
    html
      .replace(/<figure[\s\S]*?<\/figure>/g, " [figure] ")
      .replace(/<div class="lesson-exercise"[^>]*><\/div>/g, "")
      .replace(/<\/(p|li|blockquote|h[1-6]|tr)>/g, "\n")
      .replace(/<strong>([\s\S]*?)<\/strong>/g, "$1 : ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").replace(/ : :/g, " :").trim())
    .filter(Boolean)
    .join("\n");
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function buildCourseLevelContext(title: string, contentJson: unknown, maxChars = 5000): string {
  const chapters = Array.isArray(contentJson) ? (contentJson as CourseChapter[]) : [];
  const plan: string[] = [];
  const notions: string[] = [];
  const examples: string[] = [];
  for (const ch of chapters) {
    const lessons = Array.isArray(ch.lessons) ? (ch.lessons as CourseLesson[]) : [];
    for (const lesson of lessons) {
      if (str(lesson.title)) plan.push(`- ${str(lesson.title)}`);
      const text = htmlToPlain(str(lesson.content));
      if (text) notions.push(`## ${str(lesson.title)}\n${text}`);
      const exercises = Array.isArray(lesson.exercises) ? (lesson.exercises as CourseExercise[]) : [];
      for (const ex of exercises) {
        const q = htmlToPlain(str(ex.question));
        if (q) examples.push(`- ${q}${str(ex.answer) ? ` (réponse : ${htmlToPlain(str(ex.answer))})` : ""}`);
      }
    }
  }
  const head = `Cours « ${title} »\nPlan :\n${plan.join("\n") || "(non structuré)"}`;
  const tail = examples.length
    ? `\nExercices du cours (ÉTALON DE NIVEAU : les nouveaux exercices doivent être de ce niveau, en plus variés et plus riches, sans les recopier) :\n${examples.slice(0, 14).join("\n")}`
    : "";
  const budget = Math.max(800, maxChars - head.length - tail.length);
  let body = notions.join("\n\n");
  if (body.length > budget) body = `${body.slice(0, budget)}…`;
  return `${head}\n\nNotions, définitions et méthodes du cours :\n${body}${tail}`;
}
