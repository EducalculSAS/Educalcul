import { repairLatex, stripFigureNumberPrefix } from "@/lib/latexRepair";

const EXERCISE_PLACEHOLDER_RE =
  /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*>\s*<\/div>/i;
const LEAD_BLOCK_RE = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table|figure)\b/i;

export const AI_COURSE_FORMAT_RULES = `═══ FORMAT HTML + LATEX — CONTRAT STRICT ═══
• Retourne uniquement les champs JSON demandés par le schéma. N'ajoute jamais de bloc Markdown autour du JSON.
• HTML autorisé dans content : <h3>, <h4>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <span>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <figure>, <figcaption>, <svg>, <defs>, <marker>, <path>, <line>, <polyline>, <polygon>, <circle>, <rect>, <text>, <div>.
• Chaque balise HTML ouverte doit être fermée. Il est interdit d'ouvrir un nouveau <p> avant d'avoir fermé le précédent.
• Ne mets jamais de HTML à l'intérieur d'une formule LaTeX.

═══ DÉLIMITEURS MATHÉMATIQUES ═══
• Toute expression mathématique est obligatoirement délimitée : $...$ en ligne ou $$...$$ en bloc.
• Une formule commencée dans une balise HTML doit être fermée dans cette même balise. Aucun $ ou $$ ne traverse un </p>, </li>, </div>, </td>, </blockquote> ou toute autre balise.
• Chaque formule possède exactement une paire de délimiteurs. N'écris jamais \\$, \\$$, $$$, $= isolé, =$ isolé, ni un $ à l'intérieur d'un bloc $$...$$.
• Une formule courte dans une phrase utilise $...$. Une formule longue ou un calcul utilise un <p> séparé contenant un unique bloc $$...$$.
• N'écris jamais plusieurs blocs $$...$$ dans le même <p>.

═══ ANTISLASHS ET JSON ═══
• Écris une seule commande LaTeX logique : \\frac{a}{b}, \\sqrt{x}, \\vec{u}, \\overrightarrow{AB}, \\cos(x), \\begin{aligned}.
• Le sérialiseur JSON gère l'échappement technique. Ne double jamais volontairement une commande et ne produis jamais \\\\frac, \\\\vec, \\\\overrightarrow, \\\\cos, \\\\left, \\\\text, \\\\begin ou \\\\end.
• Les seuls doubles antislashs logiques autorisés sont les fins de ligne \\\\ à l'intérieur d'un environnement aligned, cases, array ou matrix.
• N'utilise jamais \\text{cos}, \\text{sin}, \\text{tan}, \\text{ln}, \\text{π}. Utilise exclusivement \\cos, \\sin, \\tan, \\ln et \\pi.
• N'utilise pas de symboles mathématiques Unicode à la place du LaTeX : écris ^{2}, \\sqrt{}, \\pm, \\times, \\div, \\neq, \\leq, \\geq.

═══ CALCULS SUR PLUSIEURS LIGNES ═══
• Un système, une matrice ou un calcul de plusieurs lignes reste entièrement dans un seul bloc $$...$$.
• Format obligatoire pour un calcul développé :
  <p>$$\\begin{aligned}
  A &= B + C \\\\
  &= D + E \\\\
  &= F
  \\end{aligned}$$</p>
• N'utilise jamais des barres verticales seules sur des lignes différentes. Pour une norme, écris \\left\\|\\overrightarrow{AB}\\right\\| dans la même formule.
• Pour une aire de triangle, forme recommandée : $$\\mathcal{A}=\\frac{1}{2}\\left\\|\\overrightarrow{AB}\\right\\|\\left\\|\\overrightarrow{AC}\\right\\|\\sin(\\widehat{A})$$.

═══ AUTOCONTRÔLE AVANT LA RÉPONSE ═══
• Vérifie chaque content caractère par caractère avant de répondre.
• Vérifie que le nombre de $ simples hors blocs $$ est pair.
• Vérifie que le nombre de $$ est pair.
• Vérifie qu'aucune commande \\frac, \\sqrt, \\vec, \\overrightarrow, \\cdot, \\cos, \\sin, \\tan, \\left, \\right, \\hat, \\widehat, \\text, \\begin ou \\end n'apparaît hors de $...$ ou $$...$$.
• Vérifie qu'aucune formule ne contient de délimiteur $ interne.
• Vérifie que chaque réponse d'exercice correspond exactement au calcul de l'explication.
• Si une formule est trop complexe pour être écrite sans ambiguïté, simplifie sa présentation au lieu de fragmenter ses délimiteurs.

═══ MISE EN FORME PÉDAGOGIQUE ═══
• Rédige uniquement en français correct.
• Classes disponibles, sans attribut style inline :
  - <blockquote class="course-callout course-callout-note"> pour une définition ou remarque importante.
  - <blockquote class="course-callout course-callout-warning"> pour une mise en garde.
  - <span class="course-emphasis"> pour un mot-clé important hors formule.
  - <table class="math-table math-table-sign|math-table-variation|math-table-value"> pour un tableau mathématique.
  - <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div> pour une courbe.
  - Pour une famille paramétrée, ajoute data-param, data-param-min, data-param-max et data-param-default.
  - <figure class="course-figure"> avec un <svg> inline sobre pour un schéma géométrique.
  - <div class="course-steps"><div class="course-step">...</div></div> pour toute démonstration de trois étapes ou plus.
• Dans chaque <div class="course-step">, mets l'explication dans un <p> et chaque formule longue dans un autre <p> contenant un seul $$...$$.
• <div class="course-interactive-vectors" data-ox="150" data-oy="150" data-ux="220" data-uy="80" data-vx="260" data-vy="150" data-ulabel="u" data-vlabel="v" data-show-projection="true" data-caption="Fais glisser u et v et observe le produit scalaire."></div> permet un schéma vectoriel interactif.
• Le cours entier contient au moins un élément visuel utile parmi tableau, graphique, figure SVG ou schéma interactif.
• Une famille de fonctions étudiée graphiquement doit contenir au moins un math-graph-placeholder.
• Une courbe de fonction passe toujours par math-graph-placeholder, jamais par un SVG dessiné à la main.
• Varie les outils visuels sans en ajouter artificiellement. Limite course-interactive-vectors et course-steps à un ou deux par chapitre.

═══ SCHÉMAS SVG — RÈGLES STRICTES ═══
• Format exact : <figure class="course-figure"><svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img"><!-- formes --></svg><figcaption>Description courte</figcaption></figure>.
• viewBox et figcaption sont obligatoires. N'ajoute jamais width ou height en pixels.
• Ne numérote jamais la légende : la numérotation est automatique.
• Utilise stroke-width entre 1 et 2, deux à quatre couleurs sobres et des étiquettes lisibles.
• Dans un <text> SVG, les étiquettes mathématiques restent sous la forme $\\vec{v}$, $D_1$, etc.
• Marker de flèche exact : <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="CURRENT_COLOR"/></marker>.
• Place chaque étiquette à côté de l'élément, jamais sur un trait ou un arc. Garde trois à cinq éléments étiquetés maximum par schéma.`;

export const AI_COURSE_PEDAGOGY_RULES = `═══ PÉDAGOGIE ═══
• Commence toujours par une définition claire, puis un exemple simple, puis un développement pas à pas.
• Avant le premier exercice, il doit toujours y avoir au moins une explication ou un exemple guidé — jamais de placeholder d'exercice en tout début de leçon.
• Chaque exercice vérifie une notion déjà expliquée juste avant lui.
• Une leçon incomplète ou vide est inacceptable : chaque leçon a un titre, un contenu et une durée.
• N'utilise jamais d'exemples issus de la physique, de la chimie, de la biologie ou de l'informatique, sauf demande explicite de l'enseignant : uniquement des exemples mathématiques concrets et adaptés au niveau.
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

// La réparation LaTeX vit dans latexRepair.ts : elle est partagée avec le
// rendu côté client (katexLoader.ts), pour que les cours déjà enregistrés
// avant ce correctif s'affichent proprement eux aussi.
export { repairLatex, stripFigureNumberPrefix };

// ═══ Réparation automatique des placeholders d'exercices ═══
// Au lieu de rejeter toute la leçon quand les placeholders "lesson-exercise"
// ne correspondent pas exactement aux exercices déclarés, on répare : les
// exercices sans placeholder en reçoivent un en fin de contenu, et les
// placeholders sans exercice correspondant sont retirés.
export function repairLessonExercisePlaceholders(
  content: string,
  exerciseIds: string[],
): string {
  if (typeof content !== "string") return content;
  const placeholderRe =
    /<div[^>]*class=(?:"[^"]*lesson-exercise[^"]*"|'[^']*lesson-exercise[^']*')[^>]*data-exercise-id=(?:"([^"]*)"|'([^']*)')[^>]*><\/div>/g;

  const foundIds = new Set<string>();
  let result = content.replace(placeholderRe, (match, id1, id2) => {
    const id = id1 || id2;
    if (!id || !exerciseIds.includes(id)) return ""; // placeholder orphelin : retiré
    foundIds.add(id);
    return match;
  });

  const missing = exerciseIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    result += missing
      .map(
        (id) => `<div class="lesson-exercise" data-exercise-id="${id}"></div>`,
      )
      .join("");
  }
  return result;
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
          ? normalizeCourseLessonContent(
              stripFigureNumberPrefix(repairLatex(lesson.content)),
            )
          : lesson.content,
    })),
  };
}
