/**
 * Programmes nationaux de mathématiques — Éducation nationale française
 * Sources : eduscol.education.gouv.fr — Voie générale & technologique (GT)
 * Utilisé pour biaiser la génération IA vers les notions officielles du programme.
 */

export interface ProgrammeEntry {
  level: string;
  label: string;
  themes: {
    titre: string;
    notions: string[];
  }[];
}

export const PROGRAMMES_NATIONAUX: ProgrammeEntry[] = [
  // ────────── PRIMAIRE ──────────
  {
    level: "cp",
    label: "CP",
    themes: [
      { titre: "Nombres et calculs", notions: ["Nombres jusqu'à 100", "Écriture des nombres en chiffres et en lettres", "Addition et soustraction", "Tables de 2 et 5", "Décompositions additives"] },
      { titre: "Grandeurs et mesures", notions: ["Mesure de longueurs (cm, m)", "Monnaie euro", "Heures et minutes", "Calendrier"] },
      { titre: "Espace et géométrie", notions: ["Repérage dans l'espace", "Formes géométriques simples", "Symétrie axiale"] },
    ],
  },
  {
    level: "ce1",
    label: "CE1",
    themes: [
      { titre: "Nombres et calculs", notions: ["Nombres jusqu'à 1000", "Addition et soustraction posées", "Multiplication (tables)", "Approche de la division"] },
      { titre: "Grandeurs et mesures", notions: ["km, m, cm, mm", "kg, g", "L, cL", "Durées"] },
      { titre: "Espace et géométrie", notions: ["Droites, demi-droites, segments", "Angles", "Quadrilatères, triangles, cercles"] },
    ],
  },
  {
    level: "ce2",
    label: "CE2",
    themes: [
      { titre: "Nombres et calculs", notions: ["Nombres jusqu'à 10 000", "Multiplication posée", "Division euclidienne", "Fractions simples (1/2, 1/4)"] },
      { titre: "Grandeurs et mesures", notions: ["Périmètre", "Aires simples", "Volumes (introduction)"] },
      { titre: "Espace et géométrie", notions: ["Quadrilatères particuliers", "Cercle et disque", "Axes de symétrie"] },
    ],
  },
  {
    level: "cm1",
    label: "CM1",
    themes: [
      { titre: "Nombres et calculs", notions: ["Nombres jusqu'à 1 000 000", "Fractions", "Décimaux (dixièmes, centièmes)", "Multiplication et division posées", "Priorités opératoires"] },
      { titre: "Grandeurs et mesures", notions: ["Calcul d'aires (rectangle, triangle)", "Volumes (cm³)", "Angle (degrés)"] },
      { titre: "Espace et géométrie", notions: ["Parallèles et perpendiculaires", "Triangles (isocèle, équilatéral, rectangle)", "Cercle : rayon, diamètre, corde"] },
    ],
  },
  {
    level: "cm2",
    label: "CM2",
    themes: [
      { titre: "Nombres et calculs", notions: ["Grands nombres", "Fractions (addition, comparaison)", "Nombres décimaux : opérations", "Proportionnalité simple", "Pourcentages simples"] },
      { titre: "Grandeurs et mesures", notions: ["Aires composées", "Volume du pavé droit", "Conversions (longueurs, masses, durées)"] },
      { titre: "Espace et géométrie", notions: ["Droites : parallèles, perpendiculaires", "Quadrilatères (carré, rectangle, losange, parallélogramme, trapèze)", "Cercle, disque : longueur, aire"] },
      { titre: "Traitement de données", notions: ["Tableaux, diagrammes en barres, diagrammes circulaires"] },
    ],
  },

  // ────────── COLLÈGE ──────────
  {
    level: "6eme",
    label: "6ème",
    themes: [
      { titre: "Nombres et calculs", notions: ["Entiers naturels et décimaux", "Fractions : écriture, comparaison, addition, soustraction", "Multiples et diviseurs", "Critères de divisibilité", "Priorités opératoires"] },
      { titre: "Géométrie", notions: ["Droites sécantes, parallèles, perpendiculaires", "Triangles : construction, propriétés", "Quadrilatères", "Cercle", "Médiatrice"] },
      { titre: "Grandeurs et mesures", notions: ["Périmètre et aire", "Volume du cube et du pavé droit", "Conversions d'unités"] },
      { titre: "Proportionnalité", notions: ["Tableau de proportionnalité", "Règle de trois", "Echelles et plans"] },
      { titre: "Statistiques", notions: ["Lecture et construction de tableaux et graphiques"] },
    ],
  },
  {
    level: "5eme",
    label: "5ème",
    themes: [
      { titre: "Nombres et calculs", notions: ["Fractions : multiplication, division", "Nombres relatifs : addition, soustraction", "Opérations sur les relatifs", "Puissances de 10", "Calcul littéral : expressions, distributivité simple"] },
      { titre: "Géométrie", notions: ["Triangles : inégalité triangulaire, cas de congruence", "Symétrie centrale", "Théorème de Pythagore (introduction)", "Aires et volumes (prisme, cylindre)"] },
      { titre: "Proportionnalité", notions: ["Pourcentages", "Vitesse, distance, durée"] },
      { titre: "Statistiques et probabilités", notions: ["Notion de probabilité", "Fréquences relatives"] },
    ],
  },
  {
    level: "4eme",
    label: "4ème",
    themes: [
      { titre: "Nombres et calculs", notions: ["Fractions : toutes opérations", "Nombres relatifs : multiplication, division", "Puissances entières (exposants positifs et négatifs)", "Notation scientifique", "Calcul littéral : développement, factorisation", "Identités remarquables simples"] },
      { titre: "Équations", notions: ["Équations du premier degré à une inconnue", "Systèmes d'équations (introduction)"] },
      { titre: "Géométrie", notions: ["Théorème de Pythagore et sa réciproque", "Théorème de Thalès", "Rapports trigonométriques dans le triangle rectangle (sin, cos, tan)"] },
      { titre: "Statistiques et probabilités", notions: ["Calcul de probabilités", "Arbre des probabilités"] },
    ],
  },
  {
    level: "3eme",
    label: "3ème",
    themes: [
      { titre: "Nombres et calculs", notions: ["Racines carrées", "Puissances", "Calcul littéral : développement, factorisation avancée", "Identités remarquables (a+b)², (a-b)², (a+b)(a-b)"] },
      { titre: "Équations et inéquations", notions: ["Équations du second degré (factorisées)", "Systèmes d'équations à deux inconnues", "Inéquations du premier degré"] },
      { titre: "Fonctions", notions: ["Notion de fonction", "Fonctions linéaires et affines", "Représentation graphique", "Tableau de valeurs"] },
      { titre: "Géométrie", notions: ["Théorème de Thalès et réciproque", "Trigonométrie dans le triangle rectangle", "Cercle : angles inscrit et central"] },
      { titre: "Statistiques et probabilités", notions: ["Médiane, quartiles", "Diagramme en boîte", "Probabilités : loi des grands nombres"] },
    ],
  },

  // ────────── LYCÉE GÉNÉRAL & TECHNO ──────────
  {
    level: "2nde",
    label: "Seconde (Générale & Techno)",
    themes: [
      {
        titre: "Nombres et calculs",
        notions: [
          "Ensembles de nombres : $\\mathbb{N}$, $\\mathbb{Z}$, $\\mathbb{D}$, $\\mathbb{Q}$, $\\mathbb{R}$",
          "Nombres irrationnels (ex : $\\sqrt{2}$, $\\pi$)",
          "Intervalles de $\\mathbb{R}$, valeur absolue $|x|$",
          "Multiples, diviseurs, nombres premiers",
          "Calcul littéral : développement, factorisation",
          "Identités remarquables : $(a+b)^2$, $(a-b)^2$, $(a+b)(a-b)$",
          "Puissances : $a^n$ et racines carrées $\\sqrt{a}$",
          "Équations et inéquations du $1^{er}$ degré",
          "Équations du $2^{nd}$ degré (factorisées)",
          "Systèmes de deux équations linéaires à 2 inconnues",
        ],
      },
      {
        titre: "Géométrie",
        notions: [
          "Repère du plan : coordonnées, distance, milieu",
          "Vecteurs : définition, opérations, colinéarité",
          "Droite : équation cartésienne, équation réduite, pente",
          "Parallélisme et perpendicularité via les vecteurs",
          "Cercle et équation cartésienne",
          "Géométrie repérée",
        ],
      },
      {
        titre: "Fonctions",
        notions: [
          "Notion de fonction, domaine de définition",
          "Image, antécédent",
          "Représentation graphique",
          "Fonctions de référence : carré, inverse, racine carrée, valeur absolue",
          "Variations, extremum, tableau de variation",
          "Parité, sens de variation",
          "Fonctions affines et linéaires",
        ],
      },
      {
        titre: "Statistiques et probabilités",
        notions: [
          "Statistiques descriptives : moyenne, médiane, quartiles, étendue",
          "Diagramme en boîte",
          "Échantillonnage",
          "Expériences aléatoires, événements",
          "Probabilité d'un événement, complémentaire",
          "Règles d'addition et de multiplication (indépendance)",
          "Fluctuation d'échantillonnage",
        ],
      },
      {
        titre: "Algorithmique et programmation",
        notions: [
          "Variables, affectation",
          "Instructions conditionnelles",
          "Boucles (for, while)",
          "Fonctions en Python",
          "Algorithmes classiques (tri, recherche, calcul de sommes)",
        ],
      },
    ],
  },
  {
    level: "1ere-generale-maths",
    label: "Première Générale (spé maths)",
    themes: [
      {
        titre: "Algèbre",
        notions: [
          "Polynômes du second degré : forme développée, factorisée, canonique",
          "Discriminant, racines",
          "Trinôme et signe",
          "Suites numériques : définition, termes, suites arithmétiques et géométriques",
          "Raisonnement par récurrence",
        ],
      },
      {
        titre: "Analyse",
        notions: [
          "Dérivation : définition, nombre dérivé, fonction dérivée",
          "Règles de dérivation (somme, produit, composée)",
          "Dérivées des fonctions usuelles",
          "Variations et dérivée (signe de f')",
          "Extrema d'une fonction",
          "Étude de fonctions",
        ],
      },
      {
        titre: "Géométrie",
        notions: [
          "Produit scalaire dans le plan : définition, propriétés, applications",
          "Vecteurs dans le plan : base orthonormée",
          "Cercle et perpendiculaire au milieu",
          "Trigonométrie : cercle trigonométrique, cos, sin, tan",
          "Valeurs remarquables, formules d'addition",
          "Équations trigonométriques",
        ],
      },
      {
        titre: "Statistiques et probabilités",
        notions: [
          "Probabilités conditionnelles, indépendance",
          "Formule des probabilités totales",
          "Variable aléatoire discrète",
          "Loi de Bernoulli, schéma de Bernoulli, loi binomiale",
          "Espérance et variance",
        ],
      },
      {
        titre: "Algorithmique",
        notions: [
          "Algorithmes sur les suites",
          "Algorithmes de tri et de recherche",
          "Simulation de loi binomiale",
        ],
      },
    ],
  },
  {
    level: "1ere-generale",
    label: "Première Générale (sans spé maths)",
    themes: [
      {
        titre: "Mathématiques — Tronc commun",
        notions: [
          "Statistiques descriptives avancées",
          "Probabilités (rappel Seconde)",
          "Fonctions de base et leurs représentations",
          "Notions de base d'algorithmique",
        ],
      },
    ],
  },
  // ────────── TERMINALE ──────────
  {
    level: "terminale-generale-maths",
    label: "Terminale Générale (spé maths)",
    themes: [
      {
        titre: "Analyse",
        notions: [
          "Limites de fonctions et de suites",
          "Continuité, théorème des valeurs intermédiaires",
          "Dérivation avancée : règles, applications",
          "Convexité, inflexion",
          "Intégration : $\\int_a^b f(x)\\,dx$, aire sous courbe",
          "Primitives des fonctions usuelles",
          "Fonction exponentielle : $e^x$, propriétés, dérivée",
          "Fonctions logarithmiques : $\\ln(x)$, propriétés, dérivée",
          "Équations différentielles $y' = ay + b$",
        ],
      },
      {
        titre: "Algèbre et géométrie",
        notions: [
          "Géométrie dans l'espace : vecteurs, droites, plans",
          "Produit scalaire et vectoriel dans l'espace",
          "Matrices : opérations, inverse, systèmes",
          "Nombres complexes : forme algébrique, module, argument, forme trigonométrique",
          "Racines nième, équations dans ℂ",
        ],
      },
      {
        titre: "Probabilités et statistiques",
        notions: [
          "Loi des grands nombres",
          "Variable aléatoire continue",
          "Loi normale, loi exponentielle",
          "Espérance, variance, écart-type",
          "Intervalles de fluctuation, estimation",
          "Tests d'hypothèses (introduction)",
          "Loi de Poisson (introduction)",
        ],
      },
      {
        titre: "Algorithmique",
        notions: ["Récursivité", "Méthode des rectangles (intégration numérique)", "Simulation Monte-Carlo"],
      },
    ],
  },
  {
    level: "terminale-generale-expertes",
    label: "Terminale Générale (maths expertes)",
    themes: [
      {
        titre: "Algèbre avancée",
        notions: [
          "Arithmétique : division euclidienne, PGCD, PPCM, algorithme d'Euclide",
          "Congruences, théorème de Bézout, théorème de Gauss",
          "Résolution d'équations dans ℤ",
          "Matrices : valeurs propres, vecteurs propres (introduction)",
        ],
      },
      {
        titre: "Analyse avancée",
        notions: [
          "Suites récurrentes, convergence",
          "Développements limités (introduction)",
          "Intégration par parties",
          "Séries entières (introduction)",
        ],
      },
      {
        titre: "Géométrie complexe",
        notions: [
          "Nombres complexes : transformations du plan",
          "Similitudes directes et indirectes",
          "Courbes paramétriques (introduction)",
        ],
      },
    ],
  },
  {
    level: "terminale-generale-complementaires",
    label: "Terminale Générale (maths complémentaires)",
    themes: [
      {
        titre: "Mathématiques pour les autres spécialités",
        notions: [
          "Statistiques et probabilités appliquées",
          "Suites numériques simples",
          "Fonctions de base et modélisation",
          "Algorithmique appliquée",
        ],
      },
    ],
  },
  {
    level: "terminale-generale",
    label: "Terminale Générale (sans maths)",
    themes: [
      {
        titre: "Culture mathématique générale",
        notions: ["Lecture de données statistiques", "Raisonnement logique", "Algorithmique basique"],
      },
    ],
  },
];

/**
 * Retourne le programme officiel pour un niveau donné.
 * Utilisé dans les prompts IA pour biaiser la génération vers le curriculum national.
 */
export function getProgrammeForLevel(level: string): ProgrammeEntry | undefined {
  return PROGRAMMES_NATIONAUX.find((p) => p.level === level);
}

/**
 * Génère le bloc textuel d'instructions à insérer dans un prompt IA.
 */
export function getProgrammePromptBlock(level: string): string {
  const prog = getProgrammeForLevel(level);
  if (!prog) return "";

  const lines: string[] = [
    `═══ PROGRAMME OFFICIEL — ${prog.label.toUpperCase()} ═══`,
    `Le contenu généré DOIT être aligné sur le programme national français pour ce niveau.`,
    `Notions et thèmes à privilégier :`,
  ];

  for (const theme of prog.themes) {
    lines.push(`\n• ${theme.titre} :`);
    for (const notion of theme.notions) {
      lines.push(`  - ${notion}`);
    }
  }

  lines.push(`\nReste dans le cadre de ces notions. Ne dépasse pas le niveau défini.`);
  return lines.join("\n");
}
