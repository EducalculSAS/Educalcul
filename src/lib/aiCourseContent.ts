import { repairLatex, stripFigureNumberPrefix } from "@/lib/latexRepair";

const EXERCISE_PLACEHOLDER_RE =
  /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*>\s*<\/div>/i;
const LEAD_BLOCK_RE = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table|figure)\b/i;

export const AI_COURSE_FORMAT_RULES = `═══ FORMAT HTML + LATEX ═══
• HTML autorisé : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>, <figure>, <svg>.
• LaTeX obligatoire pour toute formule : inline $...$, bloc $$...$$. Aucune commande commençant par un antislash (\\frac, \\sqrt, \\vec, \\begin, \\left...) ne doit JAMAIS apparaître hors d'un bloc $...$/$$...$$.
• Un système d'équations ou une matrice s'écrit avec \\begin{cases}/\\begin{array} et reste TOUJOURS entièrement à l'intérieur d'un seul bloc $$...$$.
• Ne mélange jamais du HTML à l'intérieur d'une formule, et n'entoure jamais un bloc $.../$$...$$ d'une balise de style.
• Dans le JSON, échappe les backslashes deux fois (\\\\frac{a}{b}) pour que le rendu final affiche du LaTeX classique (\\frac{a}{b}).
• N'utilise que des commandes LaTeX standards en lettres latines — jamais de symboles Unicode (², ³, √, ±, ×, ÷, ≠) à la place d'une commande LaTeX.
• Rédige uniquement en français correct.
• Classes disponibles pour la mise en forme (jamais d'attribut style inline) :
  - <blockquote class="course-callout course-callout-note"> pour une définition/remarque importante.
  - <blockquote class="course-callout course-callout-warning"> pour une mise en garde.
  - <span class="course-emphasis"> pour un mot-clé important (hors formule).
  - <table class="math-table math-table-sign|math-table-variation|math-table-value"> pour un tableau de signes/variations/valeurs.
  - <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div> pour la courbe d'une fonction.
  - Si la leçon porte sur une famille de fonctions dépendant d'un paramètre (ex. $y = mx + p$, $y = ax^2$...), rends le graphique manipulable en ajoutant data-param="m" data-param-min="-3" data-param-max="3" data-param-default="1" sur le même <div class="math-graph-placeholder"> (le paramètre doit apparaître comme variable dans data-function, ex. data-function="m*x + 2") : l'élève fait alors varier m avec un curseur et voit la courbe bouger en direct — utilise-le dès que la notion s'y prête, c'est un vrai atout pédagogique.
  - <figure class="course-figure"> avec un <svg> inline sobre pour un schéma (fractions, aires, décomposition, géométrie).
  - <div class="course-steps"><div class="course-step">...</div><div class="course-step">...</div>...</div> pour une démonstration/preuve à plusieurs étapes : chaque <div class="course-step"> est une étape (avec son texte et ses formules), et l'élève les révèle une par une avec un bouton "Étape suivante" au lieu de tout voir d'un coup. Utilise-le pour TOUTE démonstration de 3 étapes ou plus.
  - <div class="course-interactive-vectors" data-ox="150" data-oy="150" data-ux="220" data-uy="80" data-vx="260" data-vy="150" data-ulabel="u" data-vlabel="v" data-show-projection="true" data-caption="Fais glisser u et v et observe le produit scalaire."></div> pour un schéma à deux vecteurs $\\vec{u}$, $\\vec{v}$ que l'élève peut glisser à la souris : le produit scalaire, les normes et l'angle se recalculent en direct sous le schéma (et la projection de u sur v si data-show-projection="true"). Coordonnées dans un repère 0–300×0–200, origine au centre environ.
• ⚠️ RÈGLE GÉNÉRALE OBLIGATOIRE (quel que soit le thème du cours) : le cours ENTIER doit contenir AU MOINS un élément visuel non-textuel parmi ceux listés ci-dessus (tableau, graphique, figure SVG, schéma vectoriel interactif) — jamais un cours composé uniquement de texte/formules/callouts/étapes. Avant de finaliser, identifie la notion la plus centrale du cours et demande-toi quel outil de cette liste la rend concrète — il y en a toujours un qui convient. Un cours sans aucun de ces éléments est un cours raté, même si le texte et les formules sont corrects.
• Utilise un de ces outils visuels dans CHAQUE leçon dès que la notion s'y prête (étude de fonction → graphique, signe/variation → tableau, fraction/aire/géométrie → figure SVG) : ce sont des atouts pédagogiques forts, pas des options à éviter.
• La courbe d'une fonction (parabole, droite affine, exponentielle...) passe TOUJOURS par <div class="math-graph-placeholder">, JAMAIS par un <svg> dessiné à la main : c'est le seul moyen qu'elle ait le même rendu (axes, graduations, grille) que partout ailleurs dans le cours.
• Sur l'ensemble d'un chapitre, varie réellement les outils visuels (tableau, graphique, figure SVG, schéma vectoriel interactif, callout) au lieu de répéter le même — un chapitre qui n'utilise qu'un seul type d'élément (par exemple uniquement des figures et des schémas interactifs, sans jamais de tableau) manque de diversité pédagogique, même si chaque élément pris isolément est correct. Réserve les callouts aux points vraiment importants (définition clé, mise en garde) : ne mets pas systématiquement chaque remarque dans un callout.
• Chaque outil visuel doit rester UTILE, jamais systématique : n'en ajoute pas juste pour "cocher la case diversité". Un tableau de signes n'a de sens que s'il y a effectivement un signe à étudier ; un schéma vectoriel interactif n'a de sens que pour manipuler des vecteurs. Pose-toi la question à chaque fois : "cet outil aide-t-il vraiment à comprendre CETTE notion précise ?" — sinon, du texte et une formule suffisent.
• Le schéma vectoriel interactif (course-interactive-vectors) et les démonstrations à révélation (course-steps) sont volontairement immersifs : n'en mets pas plus d'un ou deux par chapitre au total (pas un par leçon). Au-delà, l'élève passe plus de temps à cliquer/glisser qu'à apprendre — réserve-les au(x) moment(s) clé(s) du chapitre.

═══ SCHÉMAS SVG (règles strictes) ═══
• Format EXACT à respecter :
  <figure class="course-figure"><svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img"><!-- formes --></svg><figcaption>Description courte de ce que montre le schéma</figcaption></figure>
• L'attribut viewBox est OBLIGATOIRE (par ex. "0 0 200 160") et toutes les coordonnées doivent rester à l'intérieur. N'écris JAMAIS d'attribut width/height en pixels sur le <svg> : sans viewBox, le schéma s'étire et occupe toute la page.
• Une <figcaption> est OBLIGATOIRE et décrit ce que la figure montre.
• N'écris JAMAIS le numéro de la figure dans la légende ("Figure 1 —") : la numérotation est ajoutée automatiquement et se met à jour toute seule.
• Garde le trait fin (stroke-width entre 1 et 2), 2 à 4 couleurs sobres, et des étiquettes lisibles (font-size ≈ 10 à 14 dans le repère du viewBox).
• Dans un <text> du SVG, écris les étiquettes en LaTeX normal ($\\vec{v}$, $D_1$...) comme partout ailleurs : elles sont automatiquement converties en texte lisible à l'affichage (un <text> SVG ne peut pas afficher la mise en forme HTML d'une formule).
• Flèche de vecteur : recopie EXACTEMENT ce marker (ne change que markerWidth/markerHeight si besoin d'une flèche plus petite, jamais la valeur de markerUnits) :
  <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="CURRENT_COLOR"/></marker>
  Sans markerUnits="userSpaceOnUse", la flèche grossit avec le stroke-width de la ligne et devient un énorme triangle disproportionné — c'est l'erreur la plus fréquente, ne l'omets jamais.
• Étiquettes (texte) : place-les TOUJOURS à côté d'un élément, jamais dessus. Décale un label d'au moins 10 à 15 unités perpendiculairement à la ligne/l'arc qu'il désigne (jamais sur le trait, jamais dans l'arc d'un angle). Avant de finaliser le schéma, vérifie mentalement qu'aucune étiquette ne chevauche une ligne, une autre étiquette ou l'arc d'un angle — un schéma surchargé où deux textes se superposent est un schéma raté.
• Reste sobre : 3 à 5 éléments étiquetés maximum par schéma (deux vecteurs + leurs normes + l'angle, par exemple). Un schéma qui essaie de tout montrer à la fois (vecteurs + normes + angle + projection + légendes multiples) devient illisible : préfère plusieurs schémas simples à un seul schéma surchargé.`;

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
      .map((id) => `<div class="lesson-exercise" data-exercise-id="${id}"></div>`)
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
          ? normalizeCourseLessonContent(stripFigureNumberPrefix(repairLatex(lesson.content)))
          : lesson.content,
    })),
  };
}
