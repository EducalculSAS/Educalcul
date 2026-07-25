const EXERCISE_PLACEHOLDER_RE =
  /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*>\s*<\/div>/i;
const LEAD_BLOCK_RE = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table|figure)\b/i;

export const AI_COURSE_FORMAT_RULES = `═══ FORMAT HTML + LATEX ═══
• HTML autorisé pour le contenu : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>, <figure>, <svg>.
• LaTeX obligatoire pour toutes les formules : inline $...$, bloc $$...$$.
• N'écris JAMAIS de formule hors de $...$ ou $$...$$, et ne mélange JAMAIS du HTML à l'intérieur d'une formule.
• Toute commande LaTeX commençant par un antislash (\\frac, \\sqrt, \\vec, \\cos, \\sin, \\begin, \\end, \\left, \\right, etc.) doit être strictement à l'intérieur de $...$ ou $$...$$.
• Si tu dois écrire un système, une matrice ou un environnement \\\\begin/\\\\end, enveloppe-le toujours dans $$...$$ et garde-le seul dans son bloc.
• Ne laisse jamais une formule “nue” dans un paragraphe : une équation, une matrice, une projection, une norme ou une décomposition se met dans un bloc de formule dédié.
• Pour une suite de calculs, sépare les étapes en plusieurs paragraphes ou listes avec une formule à chaque étape, au lieu d’un long bloc de prose.
• N'utilise JAMAIS de retour à la ligne littéral à l'intérieur des chaînes JSON.
• Dans le JSON, échappe les backslashes deux fois pour que le rendu final affiche correctement les formules : le contenu final doit rester du LaTeX classique comme \frac{a}{b}, \sqrt{x}, x^2, x_n.
• N'utilise QUE des commandes LaTeX standards (lettres latines a-z/A-Z).
• Pour une formule propre, utilise toujours du LaTeX standard : $\\frac{a}{b}$, $\\sqrt{x}$, $x^2$, $x_n$. N'utilise pas de symboles Unicode comme ², ³, √, ±, × ou ÷ dans une formule.
• Ne génère PAS d'attributs style inline ou de balises <span> contenant des styles. Utilise uniquement les classes du site Educalcul : course-callout, course-emphasis, math-table, course-figure, math-graph-placeholder.
• Rédige UNIQUEMENT en français correct.
• Pour mettre en valeur une définition, une mise en garde ou un résultat, utilise <blockquote class="course-callout course-callout-note">...</blockquote> ou <span class="course-emphasis">...</span> hors formule.
• Pour un avertissement, utilise <blockquote class="course-callout course-callout-warning">...</blockquote>.
• Pour un tableau de valeurs / signes / variations, utilise <table class="math-table math-table-sign|math-table-variation|math-table-value">...</table>.
• Pour un schéma coloré utile (fractions, aires, décomposition, comparaison), tu peux utiliser un <figure class="course-figure"> contenant un SVG inline simple avec quelques couleurs sobres.
• Pour un graphique mathématique utile, utilise un placeholder <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div> plutôt qu'une image ou un dessin texte.
• N'utilise de couleur que si elle clarifie réellement la notion.`;

export const AI_COURSE_PEDAGOGY_RULES = `═══ PÉDAGOGIE ═══
• Commence toujours par une définition claire, puis un exemple simple, puis un développement pas à pas.
• Avant le premier exercice, il doit toujours y avoir au moins une explication ou un exemple guidé.
• Ne place jamais un placeholder d'exercice au début d'une leçon.
• Les exercices doivent vérifier une notion déjà expliquée juste avant.
• Tu peux utiliser les outils visuels du cours : tableaux, graphiques, figures, encadrés et placeholders quand cela clarifie vraiment la notion. Fais-le avec sobriété mathématique.
• Les mêmes outils sont aussi utiles dans les exercices et les quiz : un tableau de signe dans l'énoncé, un graphique dans l'explication, une figure colorée pour une fraction.
• Une leçon incomplète ou vide est inacceptable : chaque leçon doit être complète avec titre, contenu et durée.
• N'utilise jamais d'exemples issus de la physique, de la chimie, de la biologie, de l'informatique ou d'autres matières, sauf demande explicite de l'enseignant.
• Privilégie des exemples purement mathématiques, concrets et adaptés au niveau.
• Pour les fractions, les aires, les proportions ou les décompositions, privilégie des représentations visuelles colorées et sobres plutôt que des analogies hors-mathématiques.
• Garde un ton scolaire, clair et rigoureux.`;

export function normalizeCourseLessonContent(html: string): string {
  if (!html) return html;
  const trimmed = html.trim();
  const firstExerciseIndex = trimmed.search(EXERCISE_PLACEHOLDER_RE);
  if (firstExerciseIndex === -1) return trimmed;

  const firstLeadIndex = trimmed.search(LEAD_BLOCK_RE);
  if (firstLeadIndex === -1 || firstExerciseIndex < firstLeadIndex) {
    return `<blockquote class="course-callout course-callout-note"><strong>Lecture guidée :</strong> on commence par une explication claire et un exemple avant le premier exercice.</blockquote>${trimmed}`;
  }

  return trimmed;
}

export function normalizeGeneratedCourseChapter<
  T extends { lessons?: Array<{ content?: string } & Record<string, unknown>> },
>(chapter: T): T {
  if (!chapter || !Array.isArray(chapter.lessons)) return chapter;
  return {
    ...chapter,
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      content:
        typeof lesson.content === "string"
          ? normalizeCourseLessonContent(lesson.content)
          : lesson.content,
    })),
  };
}
