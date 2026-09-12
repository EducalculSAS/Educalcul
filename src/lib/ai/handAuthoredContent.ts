/**
 * Compile un JSON écrit à la main (modèle téléchargé depuis "Importer un
 * fichier" en admin — ou rempli par une IA à partir de ce modèle) vers le
 * format EXACT stocké en base / rendu par le site — celui que produit
 * `compileStructuredCourseChapter` pour les cours (IA) et
 * `scripts/import-exercises-quizzes.ts` pour les exercices/quiz.
 *
 * Le format "à la main" (blocs déclaratifs : paragraph/shape/exercise/...,
 * texte brut avec $...$) est plus facile à écrire que le HTML déjà compilé,
 * mais CourseViewer/ExerciseViewer/QuizViewer ne savent lire QUE du HTML déjà
 * compilé. Ce module fait le pont, une seule fois, à l'import — jamais côté
 * lecture (le rendu du site ne change pas).
 *
 * Détection : un fichier porte `_format: "source"` pour dire "compile-moi".
 * Sans ce marqueur (ex: un export récupéré puis ré-importé tel quel), le
 * contenu est déjà au format base → passthrough intégral, comportement
 * inchangé.
 *
 * Un bloc mal formé (mauvais nom de champ, valeur hors format) n'est jamais
 * une erreur bloquante : `normalizeCourseBlock` le rejette silencieusement
 * (comportement voulu pour la génération IA, qui doit toujours produire un
 * cours). Pour un fichier écrit à la main — ou par une IA externe qui peut se
 * tromper sur un champ — ce silence cache le problème. Chaque fonction
 * renvoie donc aussi `warnings`: la liste de ce qui a été ignoré ou corrigé,
 * pour que l'admin sache exactement quoi relire avant d'enregistrer.
 */
import {
  normalizeCourseBlock,
  normalizeStructuredRichText,
  type StructuredCourseBlock,
} from "@/lib/ai/structuredContent";
import { compileCourseBlock, compileStructuredRichText } from "@/lib/ai/compiler";

export type CompileResult<T> = { content: T; warnings: string[] };

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texte brut avec `$...$` → HTML échappé, LaTeX conservé tel quel (KaTeX côté client). */
function plainTextToHtml(value: unknown): string {
  const raw = String(value ?? "");
  const parts = raw.split(/(\$[^$]*\$)/g);
  const html = parts
    .map((part) => (part.startsWith("$") && part.endsWith("$") ? part : escapeHtml(part)))
    .join("")
    .replace(/\n+/g, "<br>");
  return `<p>${html}</p>`;
}

function compileFigure(figure: unknown, where: string, warnings: string[]): string {
  if (figure === undefined || figure === null) return "";
  if (typeof figure !== "object") {
    warnings.push(`${where} : "figure" ignorée (ce n'est pas un objet).`);
    return "";
  }
  const normalized = normalizeCourseBlock(figure);
  if (!normalized) {
    const type = (figure as { type?: unknown }).type;
    warnings.push(`${where} : figure "${String(type ?? "?")}" ignorée — champs invalides ou manquants (voir _blocks_catalogue).`);
    return "";
  }
  try {
    return compileCourseBlock(normalized, [], new Set());
  } catch (err) {
    warnings.push(`${where} : figure non affichée (${(err as Error).message}).`);
    return "";
  }
}

function withFigure(html: string, figure: unknown, where: string, warnings: string[]): string {
  const figureHtml = compileFigure(figure, where, warnings);
  return figureHtml ? `${html}\n${figureHtml}` : html;
}

function isSourceFormat(raw: unknown): boolean {
  const rec = raw as { _format?: unknown } | null;
  return !!rec && typeof rec === "object" && rec._format === "source";
}

function isRichTextEmpty(value: unknown): boolean {
  return normalizeStructuredRichText(value).parts.length === 0;
}

/* ------------------------------------------------------------------ */
/*  Cours                                                              */
/* ------------------------------------------------------------------ */

export function compileHandAuthoredCourse(raw: any): CompileResult<any[]> {
  const chapters = Array.isArray(raw?.content_json) ? raw.content_json : [];
  const warnings: string[] = [];
  if (!isSourceFormat(raw)) return { content: chapters, warnings }; // déjà compilé (export ré-importé) : inchangé

  const content = chapters.map((chapter: any, chapterIndex: number) => {
    const chapterLabel = `Chapitre ${chapterIndex + 1} (« ${chapter?.title || "?"} »)`;
    let exerciseCounter = 1;
    const lessons = (Array.isArray(chapter?.lessons) ? chapter.lessons : []).map(
      (lesson: any, lessonIndex: number) => {
        const lessonLabel = `${chapterLabel} → leçon ${lessonIndex + 1} (« ${lesson?.title || "?"} »)`;
        const rawExercises = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
        const exerciseIds = rawExercises.map(() => `c${chapterIndex + 1}-ex-${exerciseCounter++}`);
        const compiledExercises = rawExercises.map((ex: any, i: number) => {
          if (isRichTextEmpty(ex?.question)) {
            warnings.push(`${lessonLabel} : exercice ${i + 1} — "question" vide ou manquante.`);
          }
          return {
            id: exerciseIds[i],
            type: "short_answer" as const,
            question: compileStructuredRichText(normalizeStructuredRichText(ex?.question)),
            answer: compileStructuredRichText(normalizeStructuredRichText(ex?.answer)),
            hint: compileStructuredRichText(normalizeStructuredRichText(ex?.hint)),
            explanation: compileStructuredRichText(normalizeStructuredRichText(ex?.explanation)),
          };
        });

        const rawBlocks = Array.isArray(lesson?.blocks)
          ? lesson.blocks
          : typeof lesson?.content === "string"
            ? [{ type: "paragraph", content: lesson.content }]
            : [];
        const usedExerciseIndexes = new Set<number>();
        let content = rawBlocks
          .map((block: unknown, blockIndex: number) => {
            const normalized = normalizeCourseBlock(block);
            if (!normalized) {
              const type = (block as { type?: unknown } | null)?.type;
              warnings.push(
                `${lessonLabel} : bloc ${blockIndex + 1} de type "${String(type ?? "?")}" ignoré — champs invalides ou manquants (voir _blocks_catalogue).`,
              );
            } else if (normalized.type === "exercise" && normalized.exerciseIndex > exerciseIds.length) {
              warnings.push(
                `${lessonLabel} : bloc ${blockIndex + 1} référence l'exercice n°${normalized.exerciseIndex}, mais "exercises" n'en a que ${exerciseIds.length} — cet emplacement restera vide.`,
              );
            }
            return normalized;
          })
          .filter((block: StructuredCourseBlock | null): block is StructuredCourseBlock => block !== null)
          .map((block: StructuredCourseBlock) => compileCourseBlock(block, exerciseIds, usedExerciseIndexes))
          .join("\n");

        // Un emplacement d'exercice oublié dans "blocks" est ajouté à la fin
        // plutôt que de perdre l'exercice (même règle que la génération IA).
        exerciseIds.forEach((id: string, i: number) => {
          if (!usedExerciseIndexes.has(i)) {
            content += `\n<div class="lesson-exercise" data-exercise-id="${escapeHtml(id)}"></div>`;
            warnings.push(`${lessonLabel} : aucun bloc {"type":"exercise","exercise_index":${i + 1}} trouvé — l'exercice a été placé à la fin de la leçon.`);
          }
        });
        if (!content.trim()) {
          warnings.push(`${lessonLabel} : aucun bloc valide — la leçon est quasiment vide.`);
          content = `<p>${escapeHtml(lesson?.title)}</p>`;
        }

        return {
          id: `c${chapterIndex + 1}-lesson-${lessonIndex + 1}`,
          type: "text" as const,
          title: String(lesson?.title || "Leçon"),
          content,
          duration: Number(lesson?.duration) > 0 ? Math.round(Number(lesson.duration)) : 15,
          exercises: compiledExercises,
        };
      },
    );
    return { id: `chapter-${chapterIndex + 1}`, title: String(chapter?.title || "Chapitre"), lessons };
  });

  return { content, warnings };
}

/* ------------------------------------------------------------------ */
/*  Exercice                                                           */
/* ------------------------------------------------------------------ */

const EXERCISE_BLOCK_TYPES = new Set([
  "text_input", "fill_in_the_blank", "matching", "ordering", "coding",
  "single_choice", "true_false",
]);

export function compileHandAuthoredExercise(raw: any): CompileResult<any[]> {
  const pages = Array.isArray(raw?.content_json) ? raw.content_json : [];
  const warnings: string[] = [];
  if (!isSourceFormat(raw)) return { content: pages, warnings };

  const content = pages.map((page: any) => ({
    id: String(page?.id || "page-1"),
    title: String(page?.title || "Questions"),
    blocks: (Array.isArray(page?.blocks) ? page.blocks : []).map((block: any, index: number) => {
      const where = `Question ${index + 1}`;
      const requestedType = String(block?.type ?? "");
      const type = EXERCISE_BLOCK_TYPES.has(requestedType) ? requestedType : "text_input";
      if (requestedType && type !== requestedType) {
        warnings.push(`${where} : type "${requestedType}" inconnu, remplacé par "text_input".`);
      }
      if (!String(block?.content ?? "").trim()) {
        warnings.push(`${where} : "content" (l'énoncé) est vide.`);
      }
      const base = {
        id: String(block?.id || `block-${index + 1}`),
        type,
        title: String(block?.title || `Question ${index + 1}`),
        content: withFigure(plainTextToHtml(block?.content), block?.figure, where, warnings),
        points: typeof block?.points === "number" ? block.points : 2,
        explanation: plainTextToHtml(block?.explanation),
      };
      if (type === "fill_in_the_blank") {
        const blanks = Array.isArray(block?.blanks) ? block.blanks.map(String) : [];
        if (blanks.length === 0) warnings.push(`${where} : "blanks" est vide — aucun trou à corriger.`);
        return { ...base, blanks };
      }
      if (type === "matching") {
        const pairs = Array.isArray(block?.pairs)
          ? block.pairs.map((p: any) => ({ left: escapeHtml(p?.left), right: String(p?.right ?? "") }))
          : [];
        if (pairs.length < 2) warnings.push(`${where} : moins de 2 "pairs" — l'appariement n'a pas de sens.`);
        return { ...base, pairs };
      }
      if (type === "ordering") {
        const items = Array.isArray(block?.items) ? block.items.map((i: unknown) => escapeHtml(i)) : [];
        if (items.length < 2) warnings.push(`${where} : moins de 2 "items" — rien à remettre en ordre.`);
        return { ...base, items };
      }
      if (type === "single_choice" || type === "true_false") {
        const options = Array.isArray(block?.options) ? block.options.map((o: unknown) => escapeHtml(o)) : [];
        const correctAnswer = escapeHtml(block?.correctAnswer);
        if (!options.includes(correctAnswer)) {
          warnings.push(`${where} : "correctAnswer" ne correspond à aucune valeur de "options" — vérifie l'orthographe exacte.`);
        }
        return { ...base, options, correctAnswer };
      }
      // text_input / coding
      if (!String(block?.correctAnswer ?? "").trim()) {
        warnings.push(`${where} : "correctAnswer" est vide.`);
      }
      return { ...base, correctAnswer: String(block?.correctAnswer ?? "") };
    }),
  }));

  return { content, warnings };
}

/* ------------------------------------------------------------------ */
/*  Quiz                                                               */
/* ------------------------------------------------------------------ */

export function compileHandAuthoredQuiz(raw: any): CompileResult<any[]> {
  const questions = Array.isArray(raw?.content_json) ? raw.content_json : [];
  const warnings: string[] = [];
  if (!isSourceFormat(raw)) return { content: questions, warnings };

  const content = questions.map((q: any, index: number) => {
    const where = `Question ${index + 1}`;
    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    if (rawOptions.length !== 4) {
      warnings.push(`${where} : ${rawOptions.length} option(s) au lieu de 4.`);
    }
    const options = rawOptions.map((o: unknown) => escapeHtml(o));
    const correctRaw = String(q?.correctAnswer ?? "");
    const matchIndex = rawOptions.findIndex((o: unknown) => String(o) === correctRaw);
    if (matchIndex < 0) {
      warnings.push(
        `${where} : "correctAnswer" ("${correctRaw}") ne correspond EXACTEMENT à aucune "options" — ` +
        `la 1ʳᵉ option a été prise par défaut, vérifie et corrige avant de publier.`,
      );
    }
    return {
      id: String(q?.id || `q-${index + 1}`),
      text: withFigure(plainTextToHtml(q?.text), q?.figure, where, warnings),
      type: "single_choice" as const,
      points: typeof q?.points === "number" ? q.points : 1,
      options,
      correctAnswer: matchIndex >= 0 ? options[matchIndex] : options[0] || escapeHtml(correctRaw),
      explanation: plainTextToHtml(q?.explanation),
    };
  });

  return { content, warnings };
}
