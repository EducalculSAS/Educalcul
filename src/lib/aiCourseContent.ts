import { repairLatex, stripFigureNumberPrefix } from "@/lib/latexRepair";

const EXERCISE_PLACEHOLDER_RE =
  /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*>\s*<\/div>/i;
const LEAD_BLOCK_RE = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table|figure)\b/i;

export const AI_COURSE_FORMAT_RULES = String.raw`═══ FORMAT HTML + LATEX — CONTRAT STRICT ═══
• Retourne uniquement le JSON conforme au schéma demandé. N'ajoute jamais de Markdown, de commentaire ni de texte avant ou après le JSON.
• HTML autorisé dans content : <h3>, <h4>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <span>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <figure>, <figcaption>, <svg>, <defs>, <marker>, <path>, <line>, <polyline>, <polygon>, <circle>, <rect>, <text>, <div>, <pre>, <code>.
• Ferme chaque balise HTML. N'ouvre jamais un nouveau <p> avant d'avoir fermé le précédent. N'écris jamais un </p> sans <p> correspondant.
• Ne mets jamais de balise HTML à l'intérieur d'une formule LaTeX.

═══ RÈGLE CRITIQUE : ANTISLASHS DANS LE JSON BRUT ═══
• Tu produis du JSON brut. Dans une CHAÎNE JSON, chaque antislash LaTeX logique doit obligatoirement être échappé par un second antislash.
• Exemple exact de JSON brut valide : "content":"<p>La norme est $\\sqrt{x^2+y^2}$.</p>"
• Après JSON.parse, l'application reçoit alors : <p>La norme est $\sqrt{x^2+y^2}$.</p>
• Dans le JSON brut, écris donc toujours \\frac, \\sqrt, \\vec, \\overrightarrow, \\cos, \\sin, \\text, \\begin, \\end, etc.
• N'écris JAMAIS un seul antislash brut devant une commande. Par exemple, \text devient une tabulation suivie de « ext », \frac devient un caractère de contrôle suivi de « rac », et \begin devient un caractère de contrôle suivi de « egin » après le décodage JSON.
• Ne sur-échappe pas non plus : dans le JSON brut, \\\\frac est interdit, car l'application recevrait deux antislashs réels avant frac.
• Exception pour un saut de ligne LaTeX logique dans aligned/cases/array/matrix : le LaTeX final doit contenir \\, donc le JSON brut doit contenir exactement \\\\.
• Exemple exact de JSON brut valide pour plusieurs lignes : "content":"<p>$$\\begin{aligned}A&=B+C\\\\&=D\\end{aligned}$$</p>"
• Avant de répondre, inspecte les chaînes JSON : aucune séquence LaTeX ne doit commencer par un antislash unique.

═══ DÉLIMITEURS MATHÉMATIQUES ═══
• Toute expression mathématique est délimitée par $...$ en ligne ou $$...$$ en bloc.
• Une formule commencée dans une balise HTML est fermée dans cette même balise. Aucun $ ou $$ ne traverse un </p>, </li>, </div>, </td>, </blockquote> ou une autre balise.
• Chaque formule possède exactement une paire de délimiteurs. N'écris jamais \\$, \\$$, $$$, un $ isolé, ni un $ à l'intérieur d'un bloc $$...$$.
• Une formule courte dans une phrase utilise $...$. Une formule longue utilise exactement <p>$$...$$</p>.
• N'écris jamais plusieurs blocs $$...$$ dans le même <p>, ni un bloc $$...$$ directement entre deux balises sans son propre <p>.

═══ PROSE HORS DES FORMULES ═══
• Les phrases françaises restent hors des délimiteurs mathématiques. Seules les expressions mathématiques sont entre dollars.
• MAUVAIS : <p>$Si x > 0, alors f est positive.$</p>
• CORRECT : <p>Si $x > 0$, alors $f$ est positive.</p>
• MAUVAIS : <blockquote>$La projection de \\vec{v} sur \\vec{u} est nulle.$</blockquote>
• CORRECT : <blockquote>La projection de $\\vec{v}$ sur $\\vec{u}$ est nulle.</blockquote>
• Dans une formule, \\text{...} est réservé à un connecteur très court comme \\text{donc}, \\text{soit} ou \\text{avec}. N'y place jamais une phrase entière.
• N'utilise jamais \\text{cos}, \\text{sin}, \\text{tan}, \\text{ln} ou \\text{π}. Utilise \\cos, \\sin, \\tan, \\ln et \\pi.
• Utilise le LaTeX pour les symboles : ^{2}, \\sqrt{}, \\pm, \\times, \\div, \\neq, \\leq, \\geq et ^{\\circ}. N'utilise pas ², √, ±, ×, ÷, ≠ ou le symbole degré brut dans une formule.
• ⚠️ AUCUNE notation mathématique en texte brut, même dans une formule qui semble « simple » : un exposant, un indice, une lettre grecque ou une fonction doivent TOUJOURS être dans $...$ avec la syntaxe LaTeX complète, jamais en caractères ASCII tels quels. MAUVAIS : e^-λt, T_env, T0, x^2. CORRECT : $e^{-\\lambda t}$, $T_{\\text{env}}$, $T_0$, $x^2$. Repère spécifiquement les symboles ^, _ et les lettres grecques (λ, π, θ, Δ...) écrits hors des délimiteurs $...$ : ils indiquent toujours une formule qui a échappé au LaTeX et doit être corrigée avant de répondre.

═══ CALCULS SUR PLUSIEURS LIGNES ═══
• Un système, une matrice ou un calcul développé reste entièrement dans un seul bloc $$...$$.
• Structure obligatoire, telle qu'elle doit apparaître APRÈS JSON.parse :
  <p>$$\begin{aligned}
  A &= B + C \\
  &= D + E \\
  &= F
  \end{aligned}$$</p>
• Dans le JSON brut, chaque commande ci-dessus utilise deux antislashs et chaque fin de ligne en utilise quatre.
• N'utilise jamais des barres verticales isolées sur plusieurs lignes. Une norme s'écrit dans une seule formule : \\left\\|\\overrightarrow{AB}\\right\\|.
• Aire d'un triangle : <p>$$\\mathcal{A}=\\frac{1}{2}\\left\\|\\overrightarrow{AB}\\right\\|\\left\\|\\overrightarrow{AC}\\right\\|\\sin(\\widehat{A})$$</p>.

═══ AUTOCONTRÔLE LATEX + HTML ═══
• Vérifie chaque content avant de répondre : toutes les balises sont équilibrées, chaque $/$$ est fermé localement et aucune formule ne traverse une balise.
• Vérifie qu'aucune commande \\frac, \\sqrt, \\vec, \\overrightarrow, \\cdot, \\cos, \\sin, \\tan, \\left, \\right, \\hat, \\widehat, \\text, \\begin ou \\end ne se trouve hors de $...$ ou $$...$$.
• Recherche et élimine obligatoirement les fragments cassés ext{, rac{, egin{, imes, heta et ight : ils indiquent un antislash JSON manquant.
• Si une formule est trop complexe, simplifie sa présentation au lieu de fragmenter les délimiteurs.

═══ EXACTITUDE DES EXERCICES ═══
• Résous chaque exercice deux fois indépendamment avant de remplir answer.
• answer doit être exactement compatible avec le dernier résultat de explanation et avec hint.
• Si answer contient des mathématiques, utilise du LaTeX délimité par $...$ et le même échappement JSON que dans content ; jamais de symbole mathématique Unicode brut.
• La dernière phrase de CHAQUE explanation doit avoir exactement la forme « Conclusion : <answer>. » et recopier le contenu de answer sans changer la valeur ni la notation. Exemple : answer = "$\\frac{1}{2}$" implique une fin « Conclusion : $\\frac{1}{2}$. ».
• Vérifie les signes, les normes, les racines, les coordonnées, les projections, les distances et les simplifications.
• Les mots « erreur », « recalculons », « correction », « en fait » et « réponse correcte » sont interdits dans une explication finale.
• Ne conserve jamais un premier calcul faux suivi d'une autocorrection. Réécris entièrement l'explication avec une seule solution propre.
• Pour une affirmation vrai/faux ou oui/non, le texte de answer doit correspondre sans ambiguïté à la phrase « Conclusion » de explanation.
• Avant de produire le JSON, compare mécaniquement chaque answer avec sa phrase « Conclusion » : elles doivent être identiques après suppression des seuls délimiteurs $ et de la ponctuation finale.

═══ MISE EN FORME PÉDAGOGIQUE ═══
• Rédige uniquement en français correct.
• Classes disponibles, sans attribut style inline :
  - <blockquote class="course-callout course-callout-note"> pour une définition ou remarque importante.
  - <blockquote class="course-callout course-callout-warning"> pour une mise en garde.
  - <span class="course-emphasis"> pour un mot-clé important hors formule.
  - <table class="math-table math-table-sign|math-table-variation|math-table-value"> pour un tableau mathématique.
  - <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5" data-caption="Parabole de f, sommet en x=1."></div> pour TOUTE courbe de fonction (tracé exact et interactif au survol).
  - Pour une famille paramétrée, ajoute data-param, data-param-min, data-param-max et data-param-default.
  - data-caption est recommandé sur math-graph-placeholder : une phrase courte décrivant ce que montre la courbe (numérotée automatiquement « Figure N — » comme les autres figures).
  - Pour superposer un ou plusieurs vecteurs sur CE graphique (utile dès qu'un vecteur, une tangente, un déplacement ou une force se lit sur un repère), ajoute data-vectors='[{"x":2,"y":3,"label":"$\\vec{u}$","color":"#e53e3e"}]' (JSON, une entrée par vecteur). x/y = composantes ; fromX/fromY = origine du vecteur (0,0 par défaut) ; label toujours en LaTeX ($...$) ; color une couleur différente par vecteur pour les distinguer. Le composant place déjà l'étiquette à côté de la flèche, jamais dessus : ne recalcule pas sa position toi-même.
  - <figure class="course-figure"> avec un <svg> inline sobre pour un schéma STATIQUE qui n'est PAS une courbe de fonction : diagramme circulaire/camembert (ex. proportions d'une fraction), figure géométrique (triangle, cercle, repère avec points), schéma d'énoncé.
  - ⚠️ Dès qu'il s'agit de tracer le graphe d'une fonction (droite, parabole, exponentielle, trigonométrique, tangente...), c'est TOUJOURS math-graph-placeholder, JAMAIS un <path>/<polyline> dessiné à la main : un tracé à la main est systématiquement imprécis ou visuellement faux. course-figure sert uniquement aux schémas qui ne sont pas une courbe.
  - <div class="course-steps"><div class="course-step">...</div></div> pour toute démonstration de trois étapes ou plus.
• Dans chaque <div class="course-step">, mets l'explication dans un <p> et chaque formule longue dans un autre <p> contenant un seul $$...$$.
• Le cours entier contient au moins un élément visuel utile parmi tableau, graphique, figure SVG ou schéma interactif — quel que soit le thème : choisis toujours l'outil adapté à LA notion réellement enseignée dans CE cours (une fraction se prête à un camembert, une étude de fonction à un math-graph-placeholder, une figure géométrique à un course-figure), jamais un outil arbitraire plaqué sans lien avec le contenu.
• Une famille de fonctions étudiée graphiquement contient au moins un math-graph-placeholder. Une courbe passe toujours par ce composant, jamais par un SVG dessiné à la main.
• Varie les outils visuels sans en ajouter artificiellement. Limite course-steps à un ou deux par chapitre.

═══ SCHÉMAS SVG — RÈGLES STRICTES ═══
• Format exact : <figure class="course-figure"><svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img"><!-- formes --></svg><figcaption>Description courte</figcaption></figure>.
• viewBox et figcaption sont obligatoires. N'ajoute jamais width ou height en pixels.
• Ne numérote jamais la légende : la numérotation est automatique.
• Utilise stroke-width entre 1 et 2, deux à quatre couleurs sobres et trois à cinq éléments étiquetés maximum.
• Dans un <text> SVG, les étiquettes mathématiques restent sous la forme $\\vec{v}$, $D_1$, etc.
• Marker exact : <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="CURRENT_COLOR"/></marker>.
• Place chaque étiquette à côté de l'élément, jamais sur un trait ou un arc.`;

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

type GeneratedExerciseLike = Record<string, unknown> & {
  id?: unknown;
  question?: unknown;
  hint?: unknown;
  answer?: unknown;
  explanation?: unknown;
};

type GeneratedLessonLike = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  duration?: unknown;
  exercises?: GeneratedExerciseLike[];
};

type GeneratedChapterLike = Record<string, unknown> & {
  id?: unknown;
  title?: unknown;
  lessons?: GeneratedLessonLike[];
};

function repairGeneratedString(value: unknown): unknown {
  return typeof value === "string" ? repairLatex(value) : value;
}

/**
 * Nettoie le contenu généré AVANT stockage : contenu principal, champs des
 * exercices et placeholders. La même réparation reste appliquée à
 * l'affichage par katexLoader.ts pour les anciens cours.
 */
export function normalizeGeneratedCourseChapter<T extends GeneratedChapterLike>(
  chapter: T,
): T {
  if (!chapter || !Array.isArray(chapter.lessons)) return chapter;

  const normalizedLessons = chapter.lessons.map((lesson) => {
    const exercises = Array.isArray(lesson.exercises)
      ? lesson.exercises.map((exercise) => ({
          ...exercise,
          question: repairGeneratedString(exercise.question),
          hint: repairGeneratedString(exercise.hint),
          answer: repairGeneratedString(exercise.answer),
          explanation: repairGeneratedString(exercise.explanation),
        }))
      : lesson.exercises;

    let content =
      typeof lesson.content === "string"
        ? normalizeCourseLessonContent(
            stripFigureNumberPrefix(repairLatex(lesson.content)),
          )
        : lesson.content;

    if (typeof content === "string" && Array.isArray(exercises)) {
      const exerciseIds = exercises
        .map((exercise) => exercise.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      content = repairLessonExercisePlaceholders(content, exerciseIds);
    }

    return {
      ...lesson,
      content,
      exercises,
    };
  });

  return {
    ...chapter,
    lessons: normalizedLessons,
  } as T;
}

export type CourseQualityIssueSeverity = "error" | "warning";

export type CourseQualityIssueCode =
  | "missing_lesson_field"
  | "missing_exercise_field"
  | "duplicate_exercise_id"
  | "self_correction"
  | "broken_json_latex_escape"
  | "control_character"
  | "missing_answer_conclusion"
  | "answer_conclusion_mismatch"
  | "likely_semantic_contradiction"
  | "latex_required_repair"
  | "unwrapped_math_notation"
  | "hand_drawn_curve_svg"
  | "glued_text_word_boundary"
  | "raw_unicode_math_symbol";

export type CourseQualityIssue = {
  severity: CourseQualityIssueSeverity;
  code: CourseQualityIssueCode;
  path: string;
  message: string;
  excerpt?: string;
};

const SELF_CORRECTION_RE =
  /\b(?:erreur|recalculons|recalcul|correction|en fait|réponse correcte)\b/i;
const BROKEN_JSON_LATEX_RE =
  /(^|[^A-Za-z\\])(?:ext|rac|egin|imes|heta|ight)\s*\{/i;
const CONTROL_CHARACTER_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Détecte une notation mathématique (exposant/indice ASCII ou lettre grecque
// suivie d'une variable) écrite hors de tout délimiteur $...$/$$...$$ — signe
// qu'une formule a échappé au LaTeX (ex: "e^-λt", "T_env"), quel que soit le
// thème du cours (règle générale, pas liée à une notion précise).
const UNWRAPPED_MATH_RE =
  /[A-Za-z][\^_]-?[A-Za-z0-9]|[αβγδεζηθικλμνξπρστφχψωΓΔΘΛΞΠΣΦΨΩ][A-Za-z0-9(]/;

// Détecte un connecteur français collé sans espace à un chiffre ou une
// variable (ex: "0pour0", "pourx") — signe qu'une formule mal délimitée a
// fusionné avec la prose environnante. Vérifie l'orthographe/l'espacement du
// français, pas une notion mathématique précise : s'applique à tout thème.
const GLUED_FRENCH_CONNECTOR_RE =
  /[0-9](?:pour|donc|soit|avec|alors)|(?:pour|donc|soit|avec|alors)[0-9]|(?:pour|donc|soit|avec|alors)[a-z]\b/i;

// Symboles mathématiques Unicode littéraux, explicitement interdits par la
// règle du prompt ("N'utilise pas ², √, ±, ×, ÷, ≠...") mais jamais vérifiés
// jusqu'ici côté code : signe qu'une formule (souvent une fin de $...$ fermée
// trop tôt) a laissé du LaTeX non converti derrière elle, quel que soit le
// thème du cours.
const RAW_UNICODE_MATH_SYMBOL_RE =
  /[²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉₊₋⁺⁻√±×÷≠]/;

function textOutsideMathAndTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\r\n]*?\$/g, " ");
}

// Un SVG dessiné à la main (course-figure) qui trace une courbe lisse (2+
// segments de courbe de Bézier Q/C dans un même <path>) est presque toujours
// une tentative de tracer une fonction à la main — imprécis et interdit par
// la règle du prompt, qui impose math-graph-placeholder pour toute courbe.
// Détection structurelle (nombre de commandes de courbe), pas liée à une
// fonction ou un thème précis.
const COURSE_FIGURE_RE = /<figure\s+class="course-figure"[\s\S]*?<\/figure>/g;
const SVG_PATH_D_RE = /<path\b[^>]*\bd="([^"]*)"/g;

function containsHandDrawnCurveFigure(html: string): boolean {
  const figures = html.match(COURSE_FIGURE_RE) || [];
  for (const figure of figures) {
    let pathMatch: RegExpExecArray | null;
    SVG_PATH_D_RE.lastIndex = 0;
    while ((pathMatch = SVG_PATH_D_RE.exec(figure))) {
      const curveSegments = (pathMatch[1].match(/[QqCc]/g) || []).length;
      if (curveSegments >= 2) return true;
    }
  }
  return false;
}

function issueExcerpt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217)}...`;
}

function stripComparableMarkup(value: string): string {
  return repairLatex(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\$+/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\dfrac\b|\\tfrac\b/g, "\\frac")
    .replace(/[\s\u00A0]+/g, "")
    .replace(/[.!?;:]+$/g, "")
    .toLowerCase();
}

function extractConclusion(explanation: string): string | null {
  const match = explanation.match(
    /(?:^|[.!?]\s*|<p[^>]*>\s*)Conclusion\s*:\s*([\s\S]*?)(?:<\/p>|\s*$)/i,
  );
  return match?.[1]?.trim() || null;
}

function inspectGeneratedString(
  value: unknown,
  path: string,
  issues: CourseQualityIssue[],
): void {
  if (typeof value !== "string") return;
  if (CONTROL_CHARACTER_RE.test(value)) {
    issues.push({
      severity: "error",
      code: "control_character",
      path,
      message:
        "La chaîne contient un caractère de contrôle issu d'un antislash JSON non échappé.",
      excerpt: issueExcerpt(value),
    });
  }
  if (BROKEN_JSON_LATEX_RE.test(value)) {
    issues.push({
      severity: "error",
      code: "broken_json_latex_escape",
      path,
      message:
        "La chaîne contient un fragment de commande LaTeX cassé (ext/rac/egin/imes/heta/ight).",
      excerpt: issueExcerpt(value),
    });
  }
  if (SELF_CORRECTION_RE.test(value)) {
    issues.push({
      severity: "error",
      code: "self_correction",
      path,
      message:
        "La réponse contient une autocorrection ; elle doit être régénérée proprement.",
      excerpt: issueExcerpt(value),
    });
  }
  if (repairLatex(value) !== value) {
    issues.push({
      severity: "warning",
      code: "latex_required_repair",
      path,
      message: "Le réparateur a dû modifier cette chaîne LaTeX/HTML.",
      excerpt: issueExcerpt(value),
    });
  }
  if (UNWRAPPED_MATH_RE.test(textOutsideMathAndTags(value))) {
    issues.push({
      severity: "error",
      code: "unwrapped_math_notation",
      path,
      message:
        "Une notation mathématique (exposant/indice/lettre grecque) apparaît hors d'un délimiteur $...$.",
      excerpt: issueExcerpt(value),
    });
  }
  if (GLUED_FRENCH_CONNECTOR_RE.test(value)) {
    issues.push({
      severity: "error",
      code: "glued_text_word_boundary",
      path,
      message:
        "Un connecteur français est collé sans espace à un chiffre ou une variable (formule mal délimitée fusionnée avec la prose).",
      excerpt: issueExcerpt(value),
    });
  }
  if (RAW_UNICODE_MATH_SYMBOL_RE.test(value)) {
    issues.push({
      severity: "error",
      code: "raw_unicode_math_symbol",
      path,
      message:
        "Un symbole mathématique Unicode littéral (², √, ±, ×, ÷, ≠, exposant/indice Unicode...) apparaît au lieu du LaTeX attendu.",
      excerpt: issueExcerpt(value),
    });
  }
}

/**
 * Audit déterministe avant insertion en base. Il ne prétend pas démontrer la
 * justesse mathématique d'un raisonnement arbitraire ; il bloque en revanche
 * les familles d'erreurs observées : antislash JSON cassé, autocorrection,
 * champs absents, conclusions différentes de answer et contradictions
 * oui/non ou nul/non-nul très explicites.
 */
export function auditGeneratedCourseChapter(
  chapter: GeneratedChapterLike,
): CourseQualityIssue[] {
  const issues: CourseQualityIssue[] = [];
  if (!chapter || !Array.isArray(chapter.lessons)) {
    return [
      {
        severity: "error",
        code: "missing_lesson_field",
        path: "chapter.lessons",
        message: "Le chapitre ne contient pas de tableau lessons.",
      },
    ];
  }

  const seenExerciseIds = new Set<string>();

  chapter.lessons.forEach((lesson, lessonIndex) => {
    const lessonPath = `lessons[${lessonIndex}]`;
    for (const [field, value] of [
      ["title", lesson.title],
      ["content", lesson.content],
      ["duration", lesson.duration],
    ] as const) {
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim())
      ) {
        issues.push({
          severity: "error",
          code: "missing_lesson_field",
          path: `${lessonPath}.${field}`,
          message: `Le champ ${field} de la leçon est manquant ou vide.`,
        });
      }
    }
    inspectGeneratedString(lesson.content, `${lessonPath}.content`, issues);
    if (
      typeof lesson.content === "string" &&
      containsHandDrawnCurveFigure(lesson.content)
    ) {
      issues.push({
        severity: "error",
        code: "hand_drawn_curve_svg",
        path: `${lessonPath}.content`,
        message:
          "Un course-figure dessine une courbe lisse à la main (SVG) au lieu d'utiliser math-graph-placeholder.",
      });
    }

    if (!Array.isArray(lesson.exercises)) return;
    lesson.exercises.forEach((exercise, exerciseIndex) => {
      const exercisePath = `${lessonPath}.exercises[${exerciseIndex}]`;
      const id = typeof exercise.id === "string" ? exercise.id.trim() : "";
      if (!id) {
        issues.push({
          severity: "error",
          code: "missing_exercise_field",
          path: `${exercisePath}.id`,
          message: "L'exercice n'a pas d'identifiant.",
        });
      } else if (seenExerciseIds.has(id)) {
        issues.push({
          severity: "error",
          code: "duplicate_exercise_id",
          path: `${exercisePath}.id`,
          message: `L'identifiant ${id} est dupliqué dans le chapitre.`,
        });
      } else {
        seenExerciseIds.add(id);
      }

      for (const field of ["question", "answer", "explanation"] as const) {
        const value = exercise[field];
        if (typeof value !== "string" || !value.trim()) {
          issues.push({
            severity: "error",
            code: "missing_exercise_field",
            path: `${exercisePath}.${field}`,
            message: `Le champ ${field} de l'exercice est manquant ou vide.`,
          });
        }
      }

      for (const field of [
        "question",
        "hint",
        "answer",
        "explanation",
      ] as const) {
        inspectGeneratedString(
          exercise[field],
          `${exercisePath}.${field}`,
          issues,
        );
      }

      if (
        typeof exercise.answer === "string" &&
        typeof exercise.explanation === "string"
      ) {
        const conclusion = extractConclusion(exercise.explanation);
        if (!conclusion) {
          issues.push({
            severity: "error",
            code: "missing_answer_conclusion",
            path: `${exercisePath}.explanation`,
            message:
              "L'explication doit finir par « Conclusion : <answer>. » pour permettre un contrôle déterministe.",
            excerpt: issueExcerpt(exercise.explanation),
          });
        } else if (
          stripComparableMarkup(conclusion) !==
          stripComparableMarkup(exercise.answer)
        ) {
          issues.push({
            severity: "error",
            code: "answer_conclusion_mismatch",
            path: exercisePath,
            message:
              "La conclusion de l'explication ne correspond pas exactement à answer.",
            excerpt: `answer=${issueExcerpt(exercise.answer)} ; conclusion=${issueExcerpt(conclusion)}`,
          });
        }

        const answer = stripComparableMarkup(exercise.answer);
        const explanation = stripComparableMarkup(exercise.explanation);
        const answerSaysZeroOrOrthogonal =
          /(?:^|[^a-z])(?:0|nul|orthogonal)/.test(answer);
        const explanationSaysNonZero =
          /(?:neq0|≠0|estpositif|estnégatif|nonorthogonal|nesontpasorthogonaux)/.test(
            explanation,
          );
        const answerSaysYes = /^(?:oui|vrai)/.test(answer);
        const answerSaysNo = /^(?:non|faux)/.test(answer);
        const explanationSaysNo =
          /(?:conclusion:)?(?:non|faux)|nesontpas|n'estpas/.test(explanation);
        const explanationSaysYes =
          /(?:conclusion:)?(?:oui|vrai)|sontorthogonaux|estvérifiée/.test(
            explanation,
          );

        if (
          (answerSaysZeroOrOrthogonal && explanationSaysNonZero) ||
          (answerSaysYes && explanationSaysNo) ||
          (answerSaysNo && explanationSaysYes)
        ) {
          issues.push({
            severity: "error",
            code: "likely_semantic_contradiction",
            path: exercisePath,
            message:
              "answer et explanation semblent se contredire explicitement.",
            excerpt: `answer=${issueExcerpt(exercise.answer)} ; explanation=${issueExcerpt(exercise.explanation)}`,
          });
        }
      }
    });
  });

  return issues;
}

export function assertGeneratedCourseChapterQuality(
  chapter: GeneratedChapterLike,
): void {
  const errors = auditGeneratedCourseChapter(chapter).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length === 0) return;

  const summary = errors
    .slice(0, 12)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Cours IA refusé : ${errors.length} erreur(s) de qualité détectée(s).\n${summary}`,
  );
}
