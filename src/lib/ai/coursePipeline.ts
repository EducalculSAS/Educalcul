import {
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseLesson,
} from "@/lib/ai/structuredContent";

export type CourseVisualFocus =
  | "graph"
  | "variation_table"
  | "sign_table"
  | "table"
  | "figure"
  | "none";

export type CourseBlueprintLesson = {
  title: string;
  objective: string;
  scope: string;
  coreConcepts: string[];
  prerequisiteRecall: string[];
  requiredSections: string[];
  exerciseSkills: string[];
  forbiddenConcepts: string[];
  visualFocus: CourseVisualFocus;
  complexity: 1 | 2 | 3;
};

export type CourseBlueprintChapter = {
  title: string;
  scope: string;
  lessons: CourseBlueprintLesson[];
};

export type CourseBlueprint = {
  title: string;
  description: string;
  chapters: CourseBlueprintChapter[];
};

export type LessonBoundaryContext = {
  ownedConcepts: string[];
  allowedRecall: string[];
  forbiddenDevelopments: string[];
};

export type LessonContentBudget = {
  hardMinWords: number;
  targetMinWords: number;
  targetMaxWords: number;
  targetMinChars: number;
  targetMaxChars: number;
  maxOutputTokens: number;
};

export type LessonJob = {
  chapterIndex: number;
  lessonIndex: number;
  chapter: CourseBlueprintChapter;
  lesson: CourseBlueprintLesson;
  boundaries: LessonBoundaryContext;
  budget: LessonContentBudget;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function cleanPlain(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : fallback;
}

function cleanStringArray(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    const text = cleanPlain(item);
    const key = canonical(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= maximum) break;
  }
  return output;
}

function visualFocus(value: unknown, fallback: CourseVisualFocus): CourseVisualFocus {
  return value === "graph" ||
    value === "variation_table" ||
    value === "sign_table" ||
    value === "table" ||
    value === "figure" ||
    value === "none"
    ? value
    : fallback;
}

function complexity(value: unknown): 1 | 2 | 3 {
  const parsed = Number(value);
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
}

function canonical(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackFocus(_index: number, requireGraph: boolean): CourseVisualFocus {
  if (requireGraph && _index === 0) return "graph";
  return "none";
}

function containsAny(text: string, fragments: string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

/**
 * Le planificateur reste libre de proposer un visuel, mais le serveur refuse
 * les associations absurdes (par exemple un tableau de signes pour une leçon
 * sur les limites). Cette passe est locale, instantanée et déterministe.
 */
export function resolveSemanticVisualFocus(
  requested: CourseVisualFocus,
  lesson: Pick<
    CourseBlueprintLesson,
    "title" | "objective" | "scope" | "coreConcepts"
  >,
  options: { requireGraph: boolean; lessonIndex: number },
): CourseVisualFocus {
  const text = canonical(
    [lesson.title, lesson.objective, lesson.scope, ...lesson.coreConcepts].join(" "),
  );

  const signCompatible = containsAny(text, [
    "signe",
    "tableau de signes",
    "racine",
    "factorisation",
    "inequation",
    "produit",
    "quotient",
    "trinome",
    "polynome",
    "zero d une expression",
  ]);
  const variationCompatible = containsAny(text, [
    "variation",
    "monoton",
    "croissant",
    "decroissant",
    "derivee",
    "extremum",
    "minimum",
    "maximum",
  ]);
  const graphCompatible = containsAny(text, [
    "courbe",
    "graph",
    "fonction",
    "limite",
    "asymptote",
    "convex",
    "croissance comparee",
    "logarithme",
    "exponentielle",
    "fonction reciproque",
    "image",
  ]);
  const tableCompatible = containsAny(text, [
    "propriete",
    "formule",
    "valeur",
    "comparaison",
    "recapitulatif",
    "identite",
    "methode",
    "lien avec",
  ]);
  const figureCompatible = containsAny(text, [
    "schema",
    "diagramme",
    "camembert",
    "geometr",
    "construction",
    "processus",
    "frise",
    "probabilite",
    "statistique",
  ]);

  if (requested === "sign_table" && signCompatible) return requested;
  if (requested === "variation_table" && variationCompatible) return requested;
  if (requested === "graph" && graphCompatible) return requested;
  if (requested === "table" && tableCompatible) return requested;
  if (requested === "figure" && figureCompatible) return requested;
  if (requested === "none") {
    if (options.requireGraph && options.lessonIndex === 0) return "graph";
    return "none";
  }

  // Remplacement sémantique d'un choix inadapté. Les limites, la convexité et
  // le lien exp/ln gagnent davantage à être visualisés par une courbe; les
  // propriétés algébriques et comparaisons utilisent plutôt un tableau.
  if (graphCompatible) return "graph";
  if (variationCompatible) return "variation_table";
  if (signCompatible) return "sign_table";
  if (tableCompatible) return "table";
  if (figureCompatible) return "figure";
  if (options.requireGraph && options.lessonIndex === 0) return "graph";
  return "none";
}

export function normalizeCourseBlueprint(
  raw: unknown,
  options: {
    subject: string;
    chapterCount: number;
    lessonsPerChapter: number;
    chapterRequiresGraph: (chapterTitle: string, chapterScope: string) => boolean;
  },
): CourseBlueprint {
  const root = asRecord(raw);
  const rawChapters = Array.isArray(root?.chapters) ? root.chapters : [];
  const chapters: CourseBlueprintChapter[] = [];

  for (let chapterIndex = 0; chapterIndex < options.chapterCount; chapterIndex += 1) {
    const rawChapter = asRecord(rawChapters[chapterIndex]);
    const title = cleanPlain(
      rawChapter?.title,
      `${options.subject} — partie ${chapterIndex + 1}`,
    );
    const scope = cleanPlain(rawChapter?.scope, title);
    const requireGraph = options.chapterRequiresGraph(title, scope);
    const rawLessons = Array.isArray(rawChapter?.lessons) ? rawChapter.lessons : [];
    const lessons: CourseBlueprintLesson[] = [];

    for (let lessonIndex = 0; lessonIndex < options.lessonsPerChapter; lessonIndex += 1) {
      const rawLesson = asRecord(rawLessons[lessonIndex]);
      const lessonTitle = cleanPlain(
        rawLesson?.title,
        `${title} — leçon ${lessonIndex + 1}`,
      );
      const lessonScope = cleanPlain(
        rawLesson?.scope,
        `${scope}. Partie ${lessonIndex + 1}/${options.lessonsPerChapter}.`,
      );
      const concepts = cleanStringArray(rawLesson?.core_concepts, 7);
      const draftLesson: CourseBlueprintLesson = {
        title: lessonTitle,
        objective: cleanPlain(
          rawLesson?.objective,
          `Comprendre et utiliser les notions essentielles de « ${lessonTitle} ».`,
        ),
        scope: lessonScope,
        coreConcepts:
          concepts.length > 0
            ? concepts
            : [lessonTitle, lessonScope].filter(Boolean).slice(0, 2),
        prerequisiteRecall: cleanStringArray(rawLesson?.prerequisite_recall, 4),
        requiredSections: cleanStringArray(rawLesson?.required_sections, 7),
        exerciseSkills: cleanStringArray(rawLesson?.exercise_skills, 4),
        forbiddenConcepts: cleanStringArray(rawLesson?.forbidden_concepts, 12),
        visualFocus: visualFocus(
          rawLesson?.visual_focus,
          fallbackFocus(lessonIndex, requireGraph),
        ),
        complexity: complexity(rawLesson?.complexity),
      };
      if (draftLesson.requiredSections.length < 3) {
        draftLesson.requiredSections = uniqueConcepts([
          `Définition et cadre de ${lessonTitle}`,
          ...draftLesson.coreConcepts.map((concept) => `Comprendre ${concept}`),
          `Méthode et application de ${lessonTitle}`,
        ]).slice(0, 5);
      }
      if (draftLesson.exerciseSkills.length < 3) {
        draftLesson.exerciseSkills = uniqueConcepts([
          `Reconnaître et expliquer ${draftLesson.coreConcepts[0] || lessonTitle}`,
          `Appliquer une méthode liée à ${draftLesson.coreConcepts[1] || lessonTitle}`,
          `Résoudre un problème mobilisant ${lessonTitle}`,
        ]).slice(0, 3);
      }
      draftLesson.visualFocus = resolveSemanticVisualFocus(
        draftLesson.visualFocus,
        draftLesson,
        { requireGraph, lessonIndex },
      );
      lessons.push(draftLesson);
    }

    if (requireGraph && !lessons.some((lesson) => lesson.visualFocus === "graph")) {
      const first = lessons[0];
      if (first) first.visualFocus = "graph";
    }
    chapters.push({ title, scope, lessons });
  }

  // Le modèle propose la répartition, puis le serveur impose une propriété
  // exclusive : une notion principale ne peut appartenir qu'à une leçon.
  // Une répétition tardive devient au mieux un rappel de prérequis.
  const conceptOwners = new Set<string>();
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      const owned: string[] = [];
      const repeated: string[] = [];
      for (const concept of lesson.coreConcepts) {
        const key = canonical(concept);
        if (!key) continue;
        if (conceptOwners.has(key)) repeated.push(concept);
        else {
          conceptOwners.add(key);
          owned.push(concept);
        }
      }
      if (owned.length === 0) {
        const fallback = lesson.title || lesson.scope;
        let candidate = fallback;
        let suffix = 2;
        while (conceptOwners.has(canonical(candidate))) {
          candidate = `${fallback} — approfondissement ${suffix}`;
          suffix += 1;
        }
        conceptOwners.add(canonical(candidate));
        owned.push(candidate);
      }
      lesson.coreConcepts = owned.slice(0, 7);
      lesson.prerequisiteRecall = uniqueConcepts([
        ...lesson.prerequisiteRecall,
        ...repeated,
      ]).slice(0, 4);
      const ownKeys = new Set(lesson.coreConcepts.map(canonical));
      lesson.forbiddenConcepts = uniqueConcepts(lesson.forbiddenConcepts)
        .filter((concept) => !ownKeys.has(canonical(concept)))
        .slice(0, 12);
      lesson.requiredSections = uniqueConcepts(lesson.requiredSections).slice(0, 7);
      lesson.exerciseSkills = uniqueConcepts(lesson.exerciseSkills).slice(0, 4);
    }
  }

  return {
    title: cleanPlain(root?.title, `Cours : ${options.subject}`),
    description: cleanPlain(
      root?.description,
      `Cours complet sur ${options.subject}.`,
    ),
    chapters,
  };
}

function uniqueConcepts(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = canonical(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}


export type CourseBlueprintAuditIssue = {
  code: string;
  location: string;
  message: string;
};

function isGenericPlannedTitle(title: string, subject: string): boolean {
  const key = canonical(title);
  const subjectKey = canonical(subject);
  if (!key) return true;
  if (/\b(partie|lecon|chapitre)\s+\d+\b/.test(key)) return true;
  if (key === subjectKey || key === `cours ${subjectKey}`) return true;
  if (/^(introduction|generalites|approfondissement|synthese)$/.test(key)) return true;
  return false;
}

function similarText(left: string, right: string): number {
  return jaccard(tokens(left), tokens(right));
}

/**
 * Contrôle local du plan AVANT le lancement des rédacteurs. Contrairement au
 * normaliseur, cet audit ne masque pas un plan incomplet avec des titres
 * génériques : il oblige le planificateur à fournir une vraie répartition.
 */
export function auditCourseBlueprint(
  blueprint: CourseBlueprint,
  options: { subject: string; includeExercises: boolean },
): CourseBlueprintAuditIssue[] {
  const issues: CourseBlueprintAuditIssue[] = [];
  const lessons = blueprint.chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, lessonIndex) => ({
      chapter,
      lesson,
      chapterIndex,
      lessonIndex,
      order: chapterIndex * 100 + lessonIndex,
    })),
  );
  const conceptOwner = new Map<string, { order: number; location: string }>();
  const objectives: Array<{ text: string; location: string }> = [];
  const skills: Array<{ text: string; location: string }> = [];
  const titles: Array<{ text: string; location: string }> = [];

  blueprint.chapters.forEach((chapter, chapterIndex) => {
    const chapterLocation = `chapters[${chapterIndex}]`;
    if (isGenericPlannedTitle(chapter.title, options.subject)) {
      issues.push({
        code: "generic_chapter_title",
        location: `${chapterLocation}.title`,
        message: `Le titre « ${chapter.title} » ne décrit aucune progression pédagogique précise.`,
      });
    }
    if (canonical(chapter.scope).split(" ").length < 7) {
      issues.push({
        code: "thin_chapter_scope",
        location: `${chapterLocation}.scope`,
        message: "Le périmètre du chapitre est trop vague pour coordonner plusieurs rédacteurs.",
      });
    }
  });

  for (const entry of lessons) {
    const { lesson, chapterIndex, lessonIndex, order } = entry;
    const location = `chapters[${chapterIndex}].lessons[${lessonIndex}]`;
    if (isGenericPlannedTitle(lesson.title, options.subject)) {
      issues.push({
        code: "generic_lesson_title",
        location: `${location}.title`,
        message: `Le titre « ${lesson.title} » doit nommer la notion ou la compétence propre à la leçon.`,
      });
    }
    for (const previous of titles) {
      if (similarText(previous.text, lesson.title) >= 0.78) {
        issues.push({
          code: "duplicate_lesson_title",
          location: `${location}.title`,
          message: `Titre trop proche de ${previous.location} : « ${previous.text} ».`,
        });
        break;
      }
    }
    titles.push({ text: lesson.title, location: `${location}.title` });

    if (canonical(lesson.objective).split(" ").length < 7) {
      issues.push({
        code: "thin_objective",
        location: `${location}.objective`,
        message: "L'objectif doit préciser ce que l'élève saura expliquer, calculer ou démontrer.",
      });
    }
    for (const previous of objectives) {
      if (similarText(previous.text, lesson.objective) >= 0.72) {
        issues.push({
          code: "duplicate_objective",
          location: `${location}.objective`,
          message: `Objectif trop proche de ${previous.location}.`,
        });
        break;
      }
    }
    objectives.push({ text: lesson.objective, location: `${location}.objective` });

    if (canonical(lesson.scope).split(" ").length < 10) {
      issues.push({
        code: "thin_lesson_scope",
        location: `${location}.scope`,
        message: "Le périmètre doit indiquer ce qui est développé et ce qui est volontairement exclu.",
      });
    }
    if (lesson.coreConcepts.length < 2) {
      issues.push({
        code: "missing_owned_concepts",
        location: `${location}.core_concepts`,
        message: "La leçon doit posséder au moins deux notions ou compétences clairement attribuées.",
      });
    }
    for (const concept of lesson.coreConcepts) {
      const key = canonical(concept);
      const previous = conceptOwner.get(key);
      if (previous) {
        issues.push({
          code: "duplicate_concept_owner",
          location: `${location}.core_concepts`,
          message: `La notion « ${concept} » appartient déjà à ${previous.location}.`,
        });
      } else if (key) {
        conceptOwner.set(key, { order, location: `${location}.core_concepts` });
      }
    }
    if (lesson.requiredSections.length < 3) {
      issues.push({
        code: "missing_required_sections",
        location: `${location}.required_sections`,
        message: "Le rédacteur a besoin d'au moins trois sections imposées et complémentaires.",
      });
    } else if (lesson.requiredSections.some((section) =>
      /^(Définition et cadre de|Comprendre |Méthode et application de)/i.test(section),
    )) {
      issues.push({
        code: "fallback_required_sections",
        location: `${location}.required_sections`,
        message: "Les sections semblent avoir été complétées automatiquement au lieu d'être réellement planifiées.",
      });
    }
    if (lesson.coreConcepts.some((concept) => /approfondissement\s+\d+$/i.test(concept))) {
      issues.push({
        code: "fallback_owned_concept",
        location: `${location}.core_concepts`,
        message: "Une notion propriétaire artificielle a été créée parce que le plan dupliquait toutes les notions.",
      });
    }
    if (options.includeExercises && lesson.exerciseSkills.length < 3) {
      issues.push({
        code: "missing_exercise_skills",
        location: `${location}.exercise_skills`,
        message: "Trois compétences d'exercice distinctes doivent être réservées à cette leçon.",
      });
    }
    if (options.includeExercises && lesson.exerciseSkills.some((skill) =>
      /^(Reconnaître et expliquer|Appliquer une méthode liée à|Résoudre un problème mobilisant)/i.test(skill),
    )) {
      issues.push({
        code: "fallback_exercise_skills",
        location: `${location}.exercise_skills`,
        message: "Les compétences d'exercice semblent avoir été complétées automatiquement au lieu d'être attribuées par le planificateur.",
      });
    }
    for (const skill of lesson.exerciseSkills) {
      for (const previous of skills) {
        if (similarText(previous.text, skill) >= 0.78) {
          issues.push({
            code: "duplicate_exercise_skill",
            location: `${location}.exercise_skills`,
            message: `Compétence d'exercice trop proche de ${previous.location} : « ${previous.text} ».`,
          });
          break;
        }
      }
      skills.push({ text: skill, location: `${location}.exercise_skills` });
    }
    const ownKeys = new Set(lesson.coreConcepts.map(canonical));
    for (const forbidden of lesson.forbiddenConcepts) {
      if (ownKeys.has(canonical(forbidden))) {
        issues.push({
          code: "owned_and_forbidden",
          location: `${location}.forbidden_concepts`,
          message: `La notion « ${forbidden} » est simultanément propriétaire et interdite.`,
        });
      }
    }
  }

  for (const entry of lessons) {
    const { lesson, chapterIndex, lessonIndex, order } = entry;
    const location = `chapters[${chapterIndex}].lessons[${lessonIndex}]`;
    for (const recall of lesson.prerequisiteRecall) {
      const owner = conceptOwner.get(canonical(recall));
      if (owner && owner.order >= order) {
        issues.push({
          code: "future_prerequisite",
          location: `${location}.prerequisite_recall`,
          message: `Le rappel « ${recall} » n'a pas encore été traité avant cette leçon.`,
        });
      }
    }
  }

  return issues.slice(0, 30);
}

export type CourseCoordinationIssue = {
  code: "duplicate_exercise" | "duplicate_content" | "missing_owned_concept";
  first: string;
  second: string;
  message: string;
};

function lessonSearchText(lesson: StructuredCourseLesson): string {
  return [
    lesson.title,
    ...lesson.blocks.map(blockPlainText),
    ...lesson.exercises.flatMap((exercise) => [
      structuredRichTextToPlainText(exercise.question),
      structuredRichTextToPlainText(exercise.answer),
      structuredRichTextToPlainText(exercise.explanation),
    ]),
  ].join(" ");
}

/** Audit inter-leçons exécuté avant l'enregistrement. */
export function auditCourseCoordination(
  chapters: StructuredCourseChapter[],
  blueprint: CourseBlueprint,
): CourseCoordinationIssue[] {
  const issues: CourseCoordinationIssue[] = [];
  const lessons = chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, lessonIndex) => ({
      lesson,
      chapterIndex,
      lessonIndex,
      key: `c${chapterIndex + 1}-l${lessonIndex + 1}`,
    })),
  );
  const seenExercises: Array<{ key: string; text: string }> = [];
  const seenBlocks: Array<{ key: string; text: string }> = [];

  for (const entry of lessons) {
    const plan = blueprint.chapters[entry.chapterIndex]?.lessons[entry.lessonIndex];
    const lessonText = canonical(lessonSearchText(entry.lesson));
    for (const concept of plan?.coreConcepts ?? []) {
      const conceptTokens = tokens(concept);
      const overlap = [...conceptTokens].filter((token) => lessonText.includes(token)).length;
      if (conceptTokens.size >= 2 && overlap / conceptTokens.size < 0.5) {
        issues.push({
          code: "missing_owned_concept",
          first: entry.key,
          second: entry.key,
          message: `La notion propriétaire « ${concept} » est insuffisamment visible dans la leçon.`,
        });
      }
    }

    entry.lesson.exercises.forEach((exercise, exerciseIndex) => {
      const text = structuredRichTextToPlainText(exercise.question);
      const wordCount = canonical(text).split(" ").filter(Boolean).length;
      if (wordCount < 5) return;
      const duplicate = seenExercises.find(
        (previous) => similarText(previous.text, text) >= 0.78,
      );
      if (duplicate) {
        issues.push({
          code: "duplicate_exercise",
          first: duplicate.key,
          second: `${entry.key}-e${exerciseIndex + 1}`,
          message: "Deux exercices évaluent pratiquement le même énoncé ou la même opération.",
        });
      } else {
        seenExercises.push({ key: `${entry.key}-e${exerciseIndex + 1}`, text });
      }
    });

    entry.lesson.blocks.forEach((block, blockIndex) => {
      if (!canDeduplicate(block)) return;
      const text = blockPlainText(block).replace(/\s+/g, " ").trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount < 35) return;
      const duplicate = seenBlocks.find(
        (previous) => similarText(previous.text, text) >= 0.86,
      );
      if (duplicate) {
        issues.push({
          code: "duplicate_content",
          first: duplicate.key,
          second: `${entry.key}-b${blockIndex + 1}`,
          message: "Bloc développé très proche d'un bloc déjà présent dans une autre leçon.",
        });
      } else {
        seenBlocks.push({ key: `${entry.key}-b${blockIndex + 1}`, text });
      }
    });
  }

  return issues.slice(0, 40);
}

export function buildLessonBoundaries(
  blueprint: CourseBlueprint,
  chapterIndex: number,
  lessonIndex: number,
): LessonBoundaryContext {
  const lesson = blueprint.chapters[chapterIndex]?.lessons[lessonIndex];
  if (!lesson) {
    return { ownedConcepts: [], allowedRecall: [], forbiddenDevelopments: [] };
  }

  const ownKeys = new Set(
    [...lesson.coreConcepts, ...lesson.prerequisiteRecall].map(canonical),
  );
  const sameChapter = blueprint.chapters[chapterIndex]?.lessons ?? [];
  const nearbyConcepts = sameChapter.flatMap((candidate, index) =>
    index === lessonIndex ? [] : candidate.coreConcepts,
  );
  const otherChapterConcepts = blueprint.chapters.flatMap((chapter, index) =>
    index === chapterIndex
      ? []
      : chapter.lessons.flatMap((candidate) => candidate.coreConcepts),
  );
  const forbidden = uniqueConcepts([
    ...lesson.forbiddenConcepts,
    ...nearbyConcepts,
    ...otherChapterConcepts,
  ])
    .filter((concept) => !ownKeys.has(canonical(concept)))
    .slice(0, 32);

  return {
    ownedConcepts: uniqueConcepts(lesson.coreConcepts).slice(0, 7),
    allowedRecall: uniqueConcepts(lesson.prerequisiteRecall).slice(0, 4),
    forbiddenDevelopments: forbidden,
  };
}

function durationBase(duration: number): Omit<LessonContentBudget, "maxOutputTokens"> {
  if (duration <= 20) {
    return {
      hardMinWords: 280,
      targetMinWords: 470,
      targetMaxWords: 680,
      targetMinChars: 3_400,
      targetMaxChars: 5_100,
    };
  }
  if (duration <= 30) {
    return {
      hardMinWords: 360,
      targetMinWords: 650,
      targetMaxWords: 920,
      targetMinChars: 5_000,
      targetMaxChars: 7_400,
    };
  }
  if (duration <= 45) {
    return {
      hardMinWords: 480,
      targetMinWords: 900,
      targetMaxWords: 1_260,
      targetMinChars: 7_000,
      targetMaxChars: 10_200,
    };
  }
  return {
    hardMinWords: 620,
    targetMinWords: 1_150,
    targetMaxWords: 1_600,
    targetMinChars: 9_000,
    targetMaxChars: 13_000,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createLessonJobs(
  blueprint: CourseBlueprint,
  options: {
    durationPerLesson: number;
    includeExercises: boolean;
    maxCourseCharacters: number;
  },
): LessonJob[] {
  const lessons = blueprint.chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, lessonIndex) => ({
      chapterIndex,
      lessonIndex,
      chapter,
      lesson,
    })),
  );
  const base = durationBase(options.durationPerLesson);
  const weights = lessons.map(({ lesson }) => 1 + (lesson.complexity - 1) * 0.22);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const naturalTotal = lessons.length * base.targetMaxChars;
  const effectiveTotal = Math.min(options.maxCourseCharacters, naturalTotal);

  return lessons.map((entry, index) => {
    const weightedMax = Math.floor((effectiveTotal * (weights[index] ?? 1)) / totalWeight);
    const averageBudget = Math.floor(effectiveTotal / Math.max(1, lessons.length));
    const dynamicFloor = Math.min(
      base.targetMinChars,
      Math.max(2_200, Math.floor(averageBudget * 0.8)),
    );
    const targetMaxChars = clamp(
      weightedMax,
      dynamicFloor,
      Math.ceil(base.targetMaxChars * 1.12),
    );
    const targetMinChars = Math.min(
      targetMaxChars - 300,
      Math.max(2_400, Math.floor(targetMaxChars * 0.72)),
    );
    const charRatio = targetMaxChars / base.targetMaxChars;
    const targetMinWords = Math.max(
      base.hardMinWords,
      Math.floor(base.targetMinWords * Math.min(1.08, charRatio)),
    );
    const targetMaxWords = Math.max(
      targetMinWords + 80,
      Math.floor(base.targetMaxWords * Math.min(1.08, charRatio)),
    );
    const maxOutputTokens = clamp(
      Math.ceil(targetMaxChars / 2.45) + (options.includeExercises ? 2_100 : 900),
      5_500,
      10_500,
    );

    return {
      ...entry,
      boundaries: buildLessonBoundaries(
        blueprint,
        entry.chapterIndex,
        entry.lessonIndex,
      ),
      budget: {
        hardMinWords: base.hardMinWords,
        targetMinWords,
        targetMaxWords,
        targetMinChars,
        targetMaxChars,
        maxOutputTokens,
      },
    };
  });
}

function blockPlainText(block: StructuredCourseBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return structuredRichTextToPlainText(block.content);
    case "display_math":
      return block.latex;
    case "list":
      return block.items.map(structuredRichTextToPlainText).join(" ");
    case "callout":
      return [
        block.title ? structuredRichTextToPlainText(block.title) : "",
        ...block.paragraphs.map(structuredRichTextToPlainText),
      ].join(" ");
    case "table":
      return [
        ...block.headers.map(structuredRichTextToPlainText),
        ...block.rows.flat().map(structuredRichTextToPlainText),
      ].join(" ");
    case "sign_table":
      return [
        structuredRichTextToPlainText(block.expression),
        ...block.boundaries.map(structuredRichTextToPlainText),
      ].join(" ");
    case "variation_table":
      return [
        structuredRichTextToPlainText(block.variable),
        structuredRichTextToPlainText(block.functionName),
        ...block.points.map(structuredRichTextToPlainText),
        ...block.values.map(structuredRichTextToPlainText),
      ].join(" ");
    case "graph":
    case "figure":
      return block.caption;
    case "steps":
      return block.steps
        .flatMap((step) => [
          step.title ? structuredRichTextToPlainText(step.title) : "",
          ...step.blocks.map(blockPlainText),
        ])
        .join(" ");
    case "exercise":
      return "";
  }
}

function tokens(value: string): Set<string> {
  return new Set(canonical(value).split(" ").filter((token) => token.length > 2));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function canDeduplicate(block: StructuredCourseBlock): boolean {
  return block.type === "paragraph" || block.type === "callout" || block.type === "list";
}

/**
 * Supprime uniquement les blocs quasiment identiques entre leçons. Le seuil est
 * volontairement élevé : ce garde évite le copier-coller, pas les rappels utiles.
 */
export function deduplicateCourseChapters(
  chapters: StructuredCourseChapter[],
): { chapters: StructuredCourseChapter[]; removedBlocks: number } {
  const seen: Array<{ text: string; tokens: Set<string> }> = [];
  let removedBlocks = 0;
  const output = chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => {
      const blocks = lesson.blocks.filter((block) => {
        if (!canDeduplicate(block)) return true;
        const text = blockPlainText(block).replace(/\s+/g, " ").trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 28) return true;
        const currentTokens = tokens(text);
        const duplicate = seen.some(
          (entry) =>
            (canonical(entry.text) === canonical(text) && text.length > 120) ||
            (Math.min(entry.tokens.size, currentTokens.size) >= 20 &&
              jaccard(entry.tokens, currentTokens) >= 0.86),
        );
        if (duplicate) {
          removedBlocks += 1;
          return false;
        }
        seen.push({ text, tokens: currentTokens });
        return true;
      });
      return { ...lesson, blocks };
    }),
  }));
  return { chapters: output, removedBlocks };
}

export function lessonUsefulCharacterCount(lesson: StructuredCourseLesson): number {
  const blockChars = lesson.blocks.reduce(
    (sum, block) => sum + blockPlainText(block).length,
    0,
  );
  const exerciseChars = lesson.exercises.reduce(
    (sum, exercise) =>
      sum +
      structuredRichTextToPlainText(exercise.question).length +
      structuredRichTextToPlainText(exercise.answer).length +
      structuredRichTextToPlainText(exercise.hint).length +
      structuredRichTextToPlainText(exercise.explanation).length,
    0,
  );
  return blockChars + exerciseChars;
}

export class CourseGenerationTelemetry {
  private readonly startedAt = Date.now();
  private readonly active = new Map<string, number>();
  private readonly durations = new Map<string, number>();

  start(label: string): void {
    this.active.set(label, Date.now());
  }

  end(label: string, details = ""): number {
    const start = this.active.get(label) ?? Date.now();
    const duration = Date.now() - start;
    this.active.delete(label);
    this.durations.set(label, duration);
    console.info(
      `[course-ai][timing] ${label}: ${(duration / 1_000).toFixed(1)} s${details ? ` — ${details}` : ""}`,
    );
    return duration;
  }

  total(details = ""): number {
    const duration = Date.now() - this.startedAt;
    console.info(
      `[course-ai][timing] total: ${(duration / 1_000).toFixed(1)} s${details ? ` — ${details}` : ""}`,
    );
    return duration;
  }

  summary(): Record<string, number> {
    return Object.fromEntries(this.durations.entries());
  }
}
