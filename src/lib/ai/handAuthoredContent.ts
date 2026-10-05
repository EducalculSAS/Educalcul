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

// Les modèles IA respectent presque toujours le fond (la bonne réponse est
// identifiée) mais parfois pas la forme exacte demandée ("recopie EXACTEMENT
// une option") : préfixe "A) "/"A. " devant les options mais correctAnswer
// réduit à la seule lettre, espaces/casse différents, guillemets ajoutés...
// Un rejet strict sur ces cas perd une réponse par ailleurs correcte — on
// tente une résolution tolérante avant d'abandonner (jamais l'inverse : une
// correspondance exacte reste toujours prioritaire et inchangée).
function resolveOption(options: string[], answer: string): string | null {
  const exact = options.find((o) => o === answer);
  if (exact) return exact;

  const normalize = (s: string) => s.trim().toLowerCase().replace(/^["'“]|["'”]$/g, "");
  const stripPrefix = (s: string) => s.replace(/^[a-d][).:\-]\s*/i, "");
  const target = normalize(answer);

  // "A" / "A)" en réponse à des options préfixées "A) ...".
  const letterMatch = /^([a-d])[).:\-]?$/i.exec(answer.trim());
  if (letterMatch) {
    const idx = letterMatch[1].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
    if (options[idx]) return options[idx];
  }

  const byNormalized = options.find((o) => normalize(o) === target);
  if (byNormalized) return byNormalized;

  const byStrippedPrefix = options.find((o) => normalize(stripPrefix(o)) === normalize(stripPrefix(answer)));
  if (byStrippedPrefix) return byStrippedPrefix;

  return null;
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
    warnings.push(`${where} : figure "${String(type ?? "?")}" ignorée, champs invalides ou manquants (voir _blocks_catalogue).`);
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
            warnings.push(`${lessonLabel} : exercice ${i + 1}, "question" vide ou manquante.`);
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
                `${lessonLabel} : bloc ${blockIndex + 1} de type "${String(type ?? "?")}" ignoré, champs invalides ou manquants (voir _blocks_catalogue).`,
              );
            } else if (normalized.type === "exercise" && normalized.exerciseIndex > exerciseIds.length) {
              warnings.push(
                `${lessonLabel} : bloc ${blockIndex + 1} référence l'exercice n°${normalized.exerciseIndex}, mais "exercises" n'en a que ${exerciseIds.length}, cet emplacement restera vide.`,
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
            warnings.push(`${lessonLabel} : aucun bloc {"type":"exercise","exercise_index":${i + 1}} trouvé, l'exercice a été placé à la fin de la leçon.`);
          }
        });
        if (!content.trim()) {
          warnings.push(`${lessonLabel} : aucun bloc valide, la leçon est quasiment vide.`);
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
  "single_choice", "true_false", "qcm", "impossible_search",
  "categorize", "number_line_point", "click_error",
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
        if (blanks.length === 0) warnings.push(`${where} : "blanks" est vide, aucun trou à corriger.`);
        // Texte à trous sur une figure (pyramide, grille) : seules les cases VIDES ("") deviennent des trous.
        const spec = block?.figureSpec;
        const figureSpec =
          spec?.kind === "brick_pyramid" && Array.isArray(spec.levels)
            ? { kind: "brick_pyramid", levels: spec.levels.map((row: unknown[]) => row.map((c) => String(c ?? ""))) }
            : spec?.kind === "fill_grid" && Array.isArray(spec.cells)
              ? { kind: "fill_grid", cells: spec.cells.map((row: unknown[]) => row.map((c) => String(c ?? ""))) }
              : undefined;
        if (figureSpec) {
          const holes = JSON.stringify(figureSpec).split('""').length - 1;
          if (holes !== blanks.length) warnings.push(`${where} : ${holes} case(s) vide(s) dans la figure mais ${blanks.length} réponse(s) dans "blanks".`);
          return { ...base, blanks, figureSpec };
        }
        return { ...base, blanks };
      }
      if (type === "matching") {
        const pairs = Array.isArray(block?.pairs)
          ? block.pairs.map((p: any) => ({ left: escapeHtml(p?.left), right: String(p?.right ?? "") }))
          : [];
        if (pairs.length < 2) warnings.push(`${where} : moins de 2 "pairs", l'appariement n'a pas de sens.`);
        return { ...base, pairs };
      }
      if (type === "ordering") {
        const items = Array.isArray(block?.items) ? block.items.map((i: unknown) => escapeHtml(i)) : [];
        if (items.length < 2) warnings.push(`${where} : moins de 2 "items", rien à remettre en ordre.`);
        return { ...base, items };
      }
      if (type === "categorize") {
        const categories = Array.isArray(block?.categories) ? block.categories.map(String) : [];
        const categoryItems = Array.isArray(block?.categoryItems)
          ? block.categoryItems.map((it: any) => ({ text: escapeHtml(it?.text), category: String(it?.category ?? "") }))
          : [];
        if (categories.length < 2) warnings.push(`${where} : moins de 2 "categories", rien à catégoriser.`);
        if (categoryItems.some((it: any) => !categories.includes(it.category))) {
          warnings.push(`${where} : un élément de "categoryItems" référence une catégorie absente de "categories".`);
        }
        return { ...base, categories, categoryItems };
      }
      if (type === "number_line_point") {
        const min = typeof block?.numberLineMin === "number" ? block.numberLineMin : 0;
        const max = typeof block?.numberLineMax === "number" ? block.numberLineMax : 10;
        const step = typeof block?.numberLineStep === "number" && block.numberLineStep > 0 ? block.numberLineStep : 1;
        const correctAnswer = String(block?.correctAnswer ?? "");
        if (!correctAnswer.trim() || Number.isNaN(parseFloat(correctAnswer))) {
          warnings.push(`${where} : "correctAnswer" doit être une valeur numérique pour un point sur une droite graduée.`);
        }
        return { ...base, numberLineMin: min, numberLineMax: max, numberLineStep: step, correctAnswer };
      }
      if (type === "click_error") {
        const steps = Array.isArray(block?.steps) ? block.steps.map((s: unknown) => escapeHtml(s)) : [];
        const errorIndex = String(block?.correctAnswer ?? "");
        const idx = parseInt(errorIndex, 10);
        if (steps.length < 2) warnings.push(`${where} : moins de 2 "steps", rien où repérer une erreur.`);
        if (Number.isNaN(idx) || idx < 0 || idx >= steps.length) {
          warnings.push(`${where} : "correctAnswer" doit être l'index (0, 1, 2...) de l'étape fausse dans "steps".`);
        }
        return { ...base, steps, correctAnswer: errorIndex };
      }
      if (type === "single_choice" || type === "true_false") {
        const rawOptions = type === "true_false" && !Array.isArray(block?.options)
          ? ["Vrai", "Faux"]
          : Array.isArray(block?.options) ? block.options.map(String) : [];
        const resolved = resolveOption(rawOptions, String(block?.correctAnswer ?? ""));
        if (!resolved) {
          warnings.push(`${where} : "correctAnswer" ne correspond à aucune valeur de "options", vérifie l'orthographe exacte.`);
        }
        return { ...base, options: rawOptions.map(escapeHtml), correctAnswer: escapeHtml(resolved ?? block?.correctAnswer) };
      }
      if (type === "qcm") {
        const rawOptions = Array.isArray(block?.options) ? block.options.map(String) : [];
        const rawCorrect: unknown[] = Array.isArray(block?.correctAnswer) ? block.correctAnswer : [block?.correctAnswer];
        const resolved = rawCorrect.map((c) => resolveOption(rawOptions, String(c ?? ""))).filter((v): v is string => !!v);
        if (resolved.length === 0) {
          warnings.push(`${where} : aucune valeur de "correctAnswer" ne correspond aux "options".`);
        }
        return { ...base, options: rawOptions.map(escapeHtml), correctAnswer: resolved.map(escapeHtml) };
      }
      // text_input / coding / impossible_search (réponse ou justification libre, notée par IA)
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

const QUIZ_QUESTION_TYPES = new Set(["single_choice", "multiple_choice", "true_false", "text_input", "impossible_search"]);

export function compileHandAuthoredQuiz(raw: any): CompileResult<any[]> {
  const questions = Array.isArray(raw?.content_json) ? raw.content_json : [];
  const warnings: string[] = [];
  if (!isSourceFormat(raw)) return { content: questions, warnings };

  const content = questions.map((q: any, index: number) => {
    const where = `Question ${index + 1}`;
    const requestedType = String(q?.type ?? "single_choice");
    // Par défaut "single_choice" (comportement historique, seul type géré
    // avant) — les nouveaux types (vrai_faux, recherche impossible...) ne
    // sont acceptés que si explicitement demandés et reconnus.
    const type = QUIZ_QUESTION_TYPES.has(requestedType) ? requestedType : "single_choice";
    if (requestedType && type !== requestedType) {
      warnings.push(`${where} : type "${requestedType}" inconnu, remplacé par "single_choice".`);
    }

    const base = {
      id: String(q?.id || `q-${index + 1}`),
      text: withFigure(plainTextToHtml(q?.text), q?.figure, where, warnings),
      type,
      points: typeof q?.points === "number" ? q.points : 1,
      explanation: plainTextToHtml(q?.explanation),
      ...(q?.group_id ? { group_id: String(q.group_id) } : {}),
      ...(q?.group_intro ? { group_intro: plainTextToHtml(q.group_intro) } : {}),
    };

    // text_input / impossible_search : notées par IA, pas d'options à valider.
    if (type === "text_input" || type === "impossible_search") {
      if (!String(q?.correctAnswer ?? "").trim()) {
        warnings.push(`${where} : "correctAnswer" (réponse ou justification attendue) est vide.`);
      }
      return { ...base, correctAnswer: String(q?.correctAnswer ?? "") };
    }

    if (type === "true_false") {
      const correct = String(q?.correctAnswer ?? "");
      if (correct !== "Vrai" && correct !== "Faux" && correct !== "true" && correct !== "false") {
        warnings.push(`${where} : "correctAnswer" doit valoir "Vrai" ou "Faux".`);
      }
      return { ...base, options: ["Vrai", "Faux"], correctAnswer: correct === "true" ? "Vrai" : correct === "false" ? "Faux" : correct };
    }

    // single_choice / multiple_choice
    const rawOptions = (Array.isArray(q?.options) ? q.options : []).map(String);
    if (type === "single_choice" && rawOptions.length !== 4) {
      warnings.push(`${where} : ${rawOptions.length} option(s) au lieu de 4.`);
    }
    const options = rawOptions.map(escapeHtml);
    if (type === "multiple_choice") {
      const rawCorrect: unknown[] = Array.isArray(q?.correctAnswer) ? q.correctAnswer : [q?.correctAnswer];
      const resolved = rawCorrect.map((c) => resolveOption(rawOptions, String(c ?? ""))).filter((v): v is string => !!v);
      if (resolved.length === 0) {
        warnings.push(`${where} : aucune valeur de "correctAnswer" ne correspond aux "options".`);
      }
      return { ...base, options, correctAnswer: resolved.map(escapeHtml) };
    }
    const resolved = resolveOption(rawOptions, String(q?.correctAnswer ?? ""));
    if (!resolved) {
      warnings.push(
        `${where} : "correctAnswer" ("${String(q?.correctAnswer ?? "")}") ne correspond à aucune "options", ` +
        `la 1ʳᵉ option a été prise par défaut, vérifie et corrige avant de publier.`,
      );
    }
    return { ...base, options, correctAnswer: escapeHtml(resolved ?? rawOptions[0] ?? q?.correctAnswer) };
  });

  return { content, warnings };
}
