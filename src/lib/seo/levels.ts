/**
 * Pages publiques « programme de maths par niveau » (/programmes/[niveau]).
 *
 * Le contenu décrit le PROGRAMME OFFICIEL (notions publiées sur Éduscol) et la façon dont on le travaille sur
 * Educalcul. Aucun volume de contenu n'est annoncé ici : les chiffres affichés sur le site doivent rester vrais.
 */

export type Cycle = "primaire" | "college" | "lycee";

export interface LevelDomain {
  name: string;
  chapters: string[];
}

export interface LevelExercise {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
}

export interface LevelPage {
  /** Segment d'URL : /programmes/{slug}. */
  slug: string;
  /** Clé de niveau utilisée dans l'application (grade_level). */
  appLevel: string;
  short: string;
  name: string;
  cycle: Cycle;
  cycleLabel: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Une phrase pour la carte du hub. */
  card: string;
  domains: LevelDomain[];
  skills: string[];
  exercise: LevelExercise;
  faq: { q: string; a: string }[];
}

export const CYCLE_LABEL: Record<Cycle, string> = { primaire: "Primaire", college: "Collège", lycee: "Lycée" };

export const LEVEL_PAGES: LevelPage[] = [
  {
    slug: "cp", appLevel: "cp", short: "CP", name: "CP", cycle: "primaire", cycleLabel: "Cycle 2",
    title: "Programme de maths CP : nombres et calcul | Educalcul",
    description: "Le programme de mathématiques du CP expliqué aux parents : nombres jusqu'à 100, addition, soustraction, problèmes, mesures et géométrie. Exercices et aide de Calia.",
    h1: "Programme de maths en CP",
    intro: "Le CP pose les fondations : comprendre ce qu'est un nombre, compter, calculer mentalement et résoudre ses premiers problèmes. Tout se construit avec du concret (objets, monnaie, longueurs) avant de passer à l'écrit.",
    card: "Nombres jusqu'à 100, premiers calculs et premiers problèmes.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Compter, lire et écrire les nombres jusqu'à 100", "Dizaines et unités", "Comparer et ranger des nombres", "Addition et soustraction", "Calcul mental : compléments à 10, doubles et moitiés", "Résoudre des problèmes simples"] },
      { name: "Grandeurs et mesures", chapters: ["Comparer et mesurer des longueurs", "La monnaie : euros et centimes", "Se repérer dans le temps : jours, mois, heures"] },
      { name: "Espace et géométrie", chapters: ["Se repérer dans l'espace et sur un quadrillage", "Reconnaître carré, rectangle, triangle et cercle"] },
    ],
    skills: ["Dénombrer une collection en faisant des groupes de 10", "Calculer mentalement des sommes simples", "Choisir l'opération qui répond à un problème", "Utiliser la règle pour tracer et mesurer"],
    exercise: { question: "Léo a 8 billes. Il en gagne 5. Combien de billes a-t-il maintenant ?", choices: ["12", "13", "3", "85"], answer: "13", explanation: "Il gagne des billes, donc on ajoute : 8 + 5 = 13. Astuce : 8 + 2 = 10, puis 10 + 3 = 13." },
    faq: [
      { q: "Que doit savoir faire un enfant en maths à la fin du CP ?", a: "Lire, écrire et comparer les nombres jusqu'à 100, calculer des additions et soustractions simples (mentalement et en ligne), résoudre des petits problèmes et se repérer dans l'espace." },
      { q: "Mon enfant peut-il utiliser Educalcul seul en CP ?", a: "Oui, les consignes sont courtes et l'interface est pensée pour les plus jeunes, mais nous conseillons quelques séances accompagnées au début. Le parent suit ensuite les progrès depuis son espace." },
      { q: "Combien de temps par jour en CP ?", a: "Dix à quinze minutes régulières valent mieux qu'une longue séance. La série de jours (la flamme) encourage justement cette régularité." },
    ],
  },
  {
    slug: "ce1", appLevel: "ce1", short: "CE1", name: "CE1", cycle: "primaire", cycleLabel: "Cycle 2",
    title: "Programme de maths CE1 : nombres à 1 000 | Educalcul",
    description: "Programme de maths du CE1 : nombres jusqu'à 1 000, addition et soustraction posées, tables de multiplication, mesures et géométrie. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en CE1",
    intro: "En CE1, l'élève passe aux nombres jusqu'à 1 000, pose ses premières opérations et découvre la multiplication. La résolution de problèmes reste au cœur de l'année.",
    card: "Nombres jusqu'à 1 000, opérations posées et tables.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Nombres jusqu'à 1 000 : centaines, dizaines, unités", "Addition et soustraction posées", "Sens de la multiplication et premières tables", "Calcul mental", "Problèmes à une ou deux étapes"] },
      { name: "Grandeurs et mesures", chapters: ["Longueurs : m, cm, km", "Masses et contenances", "Lire l'heure et calculer des durées"] },
      { name: "Espace et géométrie", chapters: ["Angle droit, carré, rectangle", "Symétrie axiale sur quadrillage", "Solides : cube et pavé"] },
    ],
    skills: ["Décomposer un nombre en centaines, dizaines et unités", "Poser une addition avec retenue", "Mémoriser les tables de 2, 3, 4 et 5", "Reproduire une figure sur quadrillage"],
    exercise: { question: "Combien vaut 4 × 5 ?", choices: ["9", "20", "45", "25"], answer: "20", explanation: "4 × 5, c'est 5 + 5 + 5 + 5 = 20." },
    faq: [
      { q: "Quand apprend-on les tables de multiplication ?", a: "Le sens de la multiplication arrive en CE1 avec les premières tables ; leur mémorisation se poursuit en CE2 et doit être solide avant le CM1." },
      { q: "Les exercices sont-ils corrigés ?", a: "Oui, chaque réponse est corrigée immédiatement, avec une explication. Calia peut aider l'élève à comprendre son erreur sans lui donner la réponse." },
      { q: "Le programme suivi est-il officiel ?", a: "Oui, les notions suivent les programmes de l'Éducation nationale publiés sur Éduscol." },
    ],
  },
  {
    slug: "ce2", appLevel: "ce2", short: "CE2", name: "CE2", cycle: "primaire", cycleLabel: "Cycle 2",
    title: "Programme de maths CE2 : multiplication | Educalcul",
    description: "Programme de maths du CE2 : nombres jusqu'à 10 000, multiplication posée, division, premières fractions, mesures et géométrie. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en CE2",
    intro: "Le CE2 clôt le cycle 2 : les tables de multiplication doivent être connues, la multiplication se pose, la division apparaît et l'élève découvre les premières fractions.",
    card: "Tables, multiplication posée, division et fractions simples.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Nombres jusqu'à 10 000", "Tables de multiplication", "Multiplication posée", "Sens de la division et partages", "Premières fractions : demi, tiers, quart", "Problèmes à plusieurs étapes"] },
      { name: "Grandeurs et mesures", chapters: ["Conversions de longueurs, masses et contenances", "Durées et calendrier", "Périmètre d'une figure"] },
      { name: "Espace et géométrie", chapters: ["Quadrilatères et triangles", "Cercle : centre et rayon", "Symétrie axiale"] },
    ],
    skills: ["Restituer rapidement les tables", "Poser une multiplication à un chiffre", "Partager équitablement une quantité", "Calculer le périmètre d'un polygone"],
    exercise: { question: "On partage 24 bonbons entre 4 enfants. Combien chacun en reçoit-il ?", choices: ["6", "8", "20", "28"], answer: "6", explanation: "Partager en 4 parts égales : 24 ÷ 4 = 6, car 4 × 6 = 24." },
    faq: [
      { q: "Que faut-il maîtriser avant d'entrer au CM1 ?", a: "Les tables de multiplication, l'addition, la soustraction et la multiplication posées, le sens de la division et la lecture de fractions simples." },
      { q: "Educalcul propose-t-il des révisions ?", a: "Oui, des quiz courts permettent de revoir les notions, et le parent voit les points à retravailler." },
      { q: "Peut-on essayer avant de s'abonner ?", a: "Oui, l'essai est gratuit pendant 7 jours, sans engagement." },
    ],
  },
  {
    slug: "cm1", appLevel: "cm1", short: "CM1", name: "CM1", cycle: "primaire", cycleLabel: "Cycle 3",
    title: "Programme de maths CM1 : fractions, décimaux | Educalcul",
    description: "Programme de maths du CM1 : grands nombres, fractions, nombres décimaux, multiplication et division posées, aires et géométrie. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en CM1",
    intro: "Le CM1 ouvre le cycle 3 : fractions et nombres décimaux deviennent centraux, la division se pose et la géométrie gagne en précision avec l'équerre et le compas.",
    card: "Fractions, nombres décimaux et division posée.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Grands nombres jusqu'au million", "Fractions simples et décimales", "Nombres décimaux : dixièmes et centièmes", "Multiplication et division posées", "Problèmes et proportionnalité simple"] },
      { name: "Grandeurs et mesures", chapters: ["Périmètres", "Aires par comptage et comparaison", "Angles : comparer et reproduire", "Durées"] },
      { name: "Espace et géométrie", chapters: ["Droites parallèles et perpendiculaires", "Triangles et quadrilatères particuliers", "Cercle et programmes de construction"] },
    ],
    skills: ["Placer une fraction sur une demi-droite graduée", "Passer d'une fraction décimale à l'écriture à virgule", "Poser une division euclidienne", "Construire une figure avec équerre et compas"],
    exercise: { question: "Quelle écriture est égale à 7/10 ?", choices: ["7,10", "0,7", "0,07", "70"], answer: "0,7", explanation: "7/10 se lit « sept dixièmes » : le 7 est au rang des dixièmes, donc 0,7." },
    faq: [
      { q: "Pourquoi les fractions posent-elles souvent problème ?", a: "Parce qu'une fraction est à la fois un partage et un nombre. Les exercices avec droites graduées et représentations visuelles aident à faire le lien." },
      { q: "Educalcul suit-il le cycle 3 ?", a: "Oui, CM1, CM2 et 6e forment le cycle 3 et les notions s'enchaînent d'une année à l'autre." },
      { q: "Le parent voit-il les résultats ?", a: "Oui, l'espace parent montre l'activité, les scores et les notions à retravailler." },
    ],
  },
  {
    slug: "cm2", appLevel: "cm2", short: "CM2", name: "CM2", cycle: "primaire", cycleLabel: "Cycle 3",
    title: "Programme de maths CM2 : proportionnalité | Educalcul",
    description: "Programme de maths du CM2 pour préparer la 6e : fractions, nombres décimaux, proportionnalité, pourcentages, aires, volumes et géométrie. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en CM2",
    intro: "Dernière année de primaire, le CM2 consolide fractions et décimaux, installe la proportionnalité et prépare l'entrée au collège. C'est l'année où l'on vérifie que les bases sont solides.",
    card: "Décimaux, proportionnalité et préparation à la 6e.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Grands nombres jusqu'au milliard", "Fractions : comparer, encadrer, additionner", "Nombres décimaux : comparer et calculer", "Multiplication et division de décimaux par un entier", "Proportionnalité et pourcentages simples", "Problèmes à plusieurs étapes"] },
      { name: "Grandeurs et mesures", chapters: ["Aires du rectangle et du carré", "Volume du pavé droit", "Conversions d'unités", "Angles et rapporteur"] },
      { name: "Espace et géométrie", chapters: ["Figures et programmes de construction", "Symétrie axiale", "Solides et patrons"] },
    ],
    skills: ["Comparer et ranger des nombres décimaux", "Reconnaître une situation de proportionnalité", "Calculer l'aire d'une figure simple", "Suivre un programme de construction"],
    exercise: { question: "3 cahiers coûtent 6 €. Combien coûtent 9 cahiers ?", choices: ["12 €", "15 €", "18 €", "54 €"], answer: "18 €", explanation: "9 cahiers, c'est 3 fois plus que 3 cahiers : 6 € × 3 = 18 €." },
    faq: [
      { q: "Comment bien préparer l'entrée en 6e ?", a: "En consolidant les fractions, les nombres décimaux, les quatre opérations et la proportionnalité. Ce sont les notions sur lesquelles le programme de 6e s'appuie dès la rentrée." },
      { q: "Calia fait-elle les exercices à la place de l'élève ?", a: "Non. Calia pose des questions et donne des indices pour que l'élève trouve lui-même ; elle ne donne pas la réponse." },
      { q: "Combien coûte Educalcul ?", a: "Les formules sont détaillées sur la page Tarifs, avec un essai gratuit de 7 jours." },
    ],
  },
  {
    slug: "6eme", appLevel: "6eme", short: "6e", name: "6e", cycle: "college", cycleLabel: "Cycle 3",
    title: "Programme de maths 6e : cours et exercices | Educalcul",
    description: "Le programme de maths de 6e : nombres décimaux, fractions, proportionnalité, géométrie, aires et périmètres. Exercices corrigés, quiz et tuteur IA Calia.",
    h1: "Programme de maths en 6e",
    intro: "La 6e termine le cycle 3 au collège : on approfondit décimaux et fractions, on découvre la notion d'équation sous forme de « nombre manquant », et la géométrie devient plus rigoureuse avec le vocabulaire et les propriétés.",
    card: "Décimaux, fractions, proportionnalité et géométrie.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Nombres entiers et décimaux", "Comparer, encadrer, arrondir", "Opérations sur les décimaux", "Fractions : sens, égalité, quotient", "Divisibilité et division euclidienne", "Calcul mental et ordre de grandeur"] },
      { name: "Organisation et gestion de données", chapters: ["Proportionnalité", "Pourcentages", "Tableaux et diagrammes"] },
      { name: "Grandeurs et mesures", chapters: ["Périmètres et aires", "Volumes", "Angles"] },
      { name: "Espace et géométrie", chapters: ["Droites, segments, cercles", "Symétrie axiale", "Triangles et quadrilatères"] },
    ],
    skills: ["Calculer avec des nombres décimaux", "Utiliser une fraction comme quotient", "Résoudre un problème de proportionnalité", "Utiliser le rapporteur et le compas", "Rédiger une réponse en justifiant"],
    exercise: { question: "Quelle fraction est égale à 3/4 ?", choices: ["6/8", "4/3", "3/8", "7/8"], answer: "6/8", explanation: "On multiplie le numérateur et le dénominateur par 2 : 3/4 = 6/8." },
    faq: [
      { q: "Qu'est-ce qui change en maths entre le CM2 et la 6e ?", a: "Les notions sont proches (même cycle 3), mais on attend plus de rigueur : vocabulaire précis, justification des réponses et calculs posés proprement." },
      { q: "Educalcul aide-t-il à faire les devoirs de 6e ?", a: "Calia aide à comprendre une notion ou une méthode en guidant l'élève par questions, sans faire le devoir à sa place." },
      { q: "Peut-on essayer gratuitement ?", a: "Oui, 7 jours d'essai gratuit, sans engagement." },
    ],
  },
  {
    slug: "5eme", appLevel: "5eme", short: "5e", name: "5e", cycle: "college", cycleLabel: "Cycle 4",
    title: "Programme de maths 5e : nombres relatifs | Educalcul",
    description: "Programme de maths de 5e : nombres relatifs, fractions, calcul littéral, proportionnalité, triangles, parallélogrammes et statistiques. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en 5e",
    intro: "La 5e ouvre le cycle 4 : les nombres relatifs font leur entrée, les lettres apparaissent dans le calcul et la géométrie s'appuie sur des propriétés à démontrer.",
    card: "Relatifs, calcul littéral et premières démonstrations.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Nombres relatifs : repérage et addition", "Fractions : comparer, additionner", "Priorités opératoires", "Introduction au calcul littéral", "Nombres premiers et divisibilité"] },
      { name: "Organisation et gestion de données", chapters: ["Proportionnalité", "Statistiques : moyenne, effectifs, fréquences", "Premières probabilités"] },
      { name: "Grandeurs et mesures", chapters: ["Aires du triangle, du parallélogramme et du disque", "Volumes du prisme et du cylindre"] },
      { name: "Espace et géométrie", chapters: ["Triangles : inégalité triangulaire, somme des angles", "Parallélogrammes", "Symétrie centrale", "Angles et parallélisme"] },
    ],
    skills: ["Additionner et soustraire des relatifs", "Appliquer les priorités opératoires", "Tester une égalité avec une lettre", "Justifier une propriété géométrique"],
    exercise: { question: "Combien vaut (−7) + 4 ?", choices: ["−11", "−3", "3", "11"], answer: "−3", explanation: "Signes contraires : on fait 7 − 4 = 3 et on garde le signe du nombre le plus éloigné de zéro, ici −7. Résultat : −3." },
    faq: [
      { q: "Pourquoi les nombres relatifs sont-ils importants en 5e ?", a: "Ils sont utilisés ensuite partout : équations, fonctions, repérage. Bien les maîtriser en 5e simplifie toute la suite du collège." },
      { q: "Les contenus suivent-ils le programme de 5e ?", a: "Oui, ils sont classés par niveau et par notion du programme officiel." },
      { q: "Comment le parent suit-il ?", a: "L'espace parent affiche l'activité, les scores et l'évolution, avec des alertes en cas de difficulté." },
    ],
  },
  {
    slug: "4eme", appLevel: "4eme", short: "4e", name: "4e", cycle: "college", cycleLabel: "Cycle 4",
    title: "Programme de maths 4e : Pythagore, équations | Educalcul",
    description: "Programme de maths de 4e : théorème de Pythagore, puissances, calcul littéral, équations, proportionnalité et statistiques. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en 4e",
    intro: "En 4e, le calcul littéral se développe (développer, factoriser, résoudre une équation) et l'élève découvre le théorème de Pythagore, l'un des grands classiques du collège.",
    card: "Pythagore, puissances, équations et calcul littéral.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Multiplication et division de relatifs", "Fractions : multiplier et diviser", "Puissances", "Développer et réduire une expression", "Équations du premier degré"] },
      { name: "Organisation et gestion de données", chapters: ["Proportionnalité et pourcentages", "Statistiques : médiane", "Probabilités"] },
      { name: "Grandeurs et mesures", chapters: ["Vitesse et grandeurs quotients", "Volumes de la pyramide et du cône"] },
      { name: "Espace et géométrie", chapters: ["Théorème de Pythagore et réciproque", "Cosinus dans le triangle rectangle", "Translations", "Triangles semblables"] },
    ],
    skills: ["Calculer une longueur avec Pythagore", "Résoudre une équation du premier degré", "Calculer avec des puissances", "Développer une expression"],
    exercise: { question: "Un triangle rectangle a des côtés de l'angle droit de 3 cm et 4 cm. Combien mesure l'hypoténuse ?", choices: ["5 cm", "7 cm", "12 cm", "25 cm"], answer: "5 cm", explanation: "Pythagore : 3² + 4² = 9 + 16 = 25, donc l'hypoténuse mesure √25 = 5 cm." },
    faq: [
      { q: "Quand étudie-t-on le théorème de Pythagore ?", a: "En 4e. Il sert ensuite en 3e, au brevet et au lycée." },
      { q: "Calia peut-elle expliquer une équation ?", a: "Oui, Calia guide la résolution étape par étape en posant des questions, sans donner directement la solution." },
      { q: "Educalcul convient-il à un élève en difficulté ?", a: "Oui, les exercices sont classés par difficulté et chaque erreur est expliquée." },
    ],
  },
  {
    slug: "3eme", appLevel: "3eme", short: "3e", name: "3e", cycle: "college", cycleLabel: "Cycle 4",
    title: "Programme de maths 3e et révisions du brevet | Educalcul",
    description: "Programme de maths de 3e pour préparer le brevet : Thalès, trigonométrie, fonctions, équations, probabilités, statistiques et arithmétique. Exercices corrigés et tuteur IA.",
    h1: "Programme de maths en 3e",
    intro: "La 3e conclut le collège et prépare l'épreuve de mathématiques du brevet. On y découvre les fonctions, le théorème de Thalès et la trigonométrie, et on consolide tout le calcul littéral.",
    card: "Fonctions, Thalès, trigonométrie et préparation du brevet.",
    domains: [
      { name: "Nombres et calcul", chapters: ["Arithmétique : nombres premiers, PGCD", "Calcul littéral : identités remarquables, factorisation", "Équations et inéquations", "Équations produit nul"] },
      { name: "Fonctions", chapters: ["Notion de fonction", "Fonctions linéaires et affines", "Lire et tracer une représentation graphique"] },
      { name: "Organisation et gestion de données", chapters: ["Statistiques : étendue, médiane, moyenne", "Probabilités"] },
      { name: "Espace et géométrie", chapters: ["Théorème de Thalès et réciproque", "Trigonométrie : cosinus, sinus, tangente", "Homothéties et rotations", "Sphère et sections de solides"] },
    ],
    skills: ["Factoriser une expression", "Lire l'image d'un nombre par une fonction", "Calculer une longueur avec Thalès ou la trigonométrie", "Calculer une probabilité simple", "Rédiger une démonstration courte"],
    exercise: { question: "Quelle est la solution de l'équation 3x + 5 = 20 ?", choices: ["x = 3", "x = 5", "x = 15", "x = 25/3"], answer: "x = 5", explanation: "On retire 5 : 3x = 15, puis on divise par 3 : x = 5. Vérification : 3 × 5 + 5 = 20." },
    faq: [
      { q: "Comment réviser le brevet de maths avec Educalcul ?", a: "En travaillant chaque chapitre de 3e avec des exercices corrigés et des quiz, et en demandant de l'aide à Calia sur les méthodes qui bloquent." },
      { q: "Quelles notions tombent souvent au brevet ?", a: "Calcul littéral, fonctions, Thalès, Pythagore, trigonométrie, probabilités et statistiques reviennent très régulièrement." },
      { q: "Le parent voit-il la préparation ?", a: "Oui, il suit l'activité et les scores par notion depuis son espace." },
    ],
  },
  {
    slug: "seconde", appLevel: "2nde", short: "2nde", name: "Seconde", cycle: "lycee", cycleLabel: "Seconde générale et technologique",
    title: "Programme de maths de Seconde : fonctions | Educalcul",
    description: "Programme de maths de Seconde générale et technologique : nombres et calculs, fonctions, vecteurs, géométrie repérée, statistiques, probabilités et algorithmique.",
    h1: "Programme de maths en Seconde",
    intro: "La Seconde fait le lien entre le collège et la spécialité maths. L'élève consolide le calcul, approfondit les fonctions, découvre les vecteurs et pratique l'algorithmique en Python.",
    card: "Fonctions, vecteurs, probabilités et Python.",
    domains: [
      { name: "Nombres et calculs", chapters: ["Ensembles de nombres et intervalles", "Puissances et racines carrées", "Calcul littéral et identités remarquables", "Équations et inéquations"] },
      { name: "Fonctions", chapters: ["Notion de fonction et représentation", "Variations et extremums", "Fonctions de référence : carré, inverse, racine, cube", "Fonctions affines et signe"] },
      { name: "Géométrie", chapters: ["Vecteurs", "Géométrie repérée : milieu, distance", "Équations de droites"] },
      { name: "Statistiques et probabilités", chapters: ["Statistiques descriptives", "Probabilités sur un ensemble fini", "Échantillonnage"] },
      { name: "Algorithmique et programmation", chapters: ["Variables, boucles et fonctions en Python"] },
    ],
    skills: ["Résoudre une inéquation", "Étudier les variations d'une fonction", "Calculer avec des vecteurs", "Écrire un petit programme Python"],
    exercise: { question: "Quel est le coefficient directeur de la droite d'équation y = −2x + 3 ?", choices: ["3", "−2", "2", "−3"], answer: "−2", explanation: "Pour y = mx + p, le coefficient directeur est m. Ici m = −2 : la droite descend." },
    faq: [
      { q: "La Seconde est-elle importante pour choisir la spécialité maths ?", a: "Oui. Les notions de Seconde (calcul, fonctions, vecteurs) sont la base de la spécialité maths de Première." },
      { q: "Calia peut-elle aider en Python ?", a: "Oui, Calia peut expliquer pas à pas ce que fait un petit programme, comme pour toute autre notion du programme." },
      { q: "Peut-on essayer sans engagement ?", a: "Oui, l'essai gratuit dure 7 jours et se résilie à tout moment." },
    ],
  },
  {
    slug: "premiere-specialite-maths", appLevel: "1ere-generale-maths", short: "1re spé", name: "Première spécialité maths", cycle: "lycee", cycleLabel: "Voie générale",
    title: "Programme de maths 1re spé : dérivation, suites | Educalcul",
    description: "Programme de la spécialité mathématiques en Première : second degré, suites, dérivation, exponentielle, trigonométrie, produit scalaire et probabilités conditionnelles.",
    h1: "Programme de spécialité maths en Première",
    intro: "La spécialité maths de Première introduit les grands outils de l'analyse : suites, dérivation et fonction exponentielle, avec le second degré, le produit scalaire et les probabilités conditionnelles.",
    card: "Second degré, suites, dérivation et exponentielle.",
    domains: [
      { name: "Algèbre", chapters: ["Suites numériques", "Suites arithmétiques et géométriques", "Second degré"] },
      { name: "Analyse", chapters: ["Dérivation : nombre dérivé et tangente", "Fonction dérivée et variations", "Fonction exponentielle", "Fonctions trigonométriques"] },
      { name: "Géométrie", chapters: ["Produit scalaire", "Géométrie repérée : cercles et droites"] },
      { name: "Probabilités et statistiques", chapters: ["Probabilités conditionnelles et indépendance", "Variables aléatoires réelles"] },
    ],
    skills: ["Étudier le signe d'un trinôme", "Calculer une dérivée et en déduire les variations", "Reconnaître une suite géométrique", "Utiliser un arbre de probabilités"],
    exercise: { question: "Quelle est la dérivée de f(x) = x² + 3x ?", choices: ["2x + 3", "x + 3", "2x", "x² + 3"], answer: "2x + 3", explanation: "La dérivée de x² est 2x et celle de 3x est 3, donc f'(x) = 2x + 3." },
    faq: [
      { q: "Et sans la spécialité maths ?", a: "La Première générale hors spécialité est un niveau à part entière sur Educalcul : le niveau exact est choisi à la création du compte de l'élève, qui voit ensuite les contenus qui lui correspondent." },
      { q: "La dérivation est-elle expliquée pas à pas ?", a: "Oui, et Calia peut reprendre une méthode avec l'élève en posant des questions adaptées à son erreur." },
      { q: "Le suivi parent fonctionne-t-il au lycée ?", a: "Oui, le parent voit l'activité et les résultats quel que soit le niveau." },
    ],
  },
  {
    slug: "terminale-specialite-maths", appLevel: "terminale-generale-maths", short: "Tle spé", name: "Terminale spécialité maths", cycle: "lycee", cycleLabel: "Voie générale",
    title: "Programme de maths Tle spé et révisions du bac | Educalcul",
    description: "Programme de la spécialité maths en Terminale : limites, continuité, logarithme, intégrales, suites, géométrie dans l'espace, probabilités et loi binomiale.",
    h1: "Programme de spécialité maths en Terminale",
    intro: "En Terminale, la spécialité maths approfondit l'analyse (limites, continuité, logarithme, intégration), étudie la géométrie dans l'espace et les lois de probabilité, en vue de l'épreuve du baccalauréat.",
    card: "Limites, logarithme, intégrales et préparation au bac.",
    domains: [
      { name: "Algèbre et géométrie", chapters: ["Combinatoire et dénombrement", "Vecteurs, droites et plans de l'espace", "Orthogonalité et distances dans l'espace"] },
      { name: "Analyse", chapters: ["Suites : limites et récurrence", "Limites de fonctions", "Continuité et théorème des valeurs intermédiaires", "Convexité", "Fonction logarithme népérien", "Primitives et équations différentielles", "Calcul intégral"] },
      { name: "Probabilités", chapters: ["Loi binomiale", "Sommes de variables aléatoires", "Concentration et loi des grands nombres"] },
    ],
    skills: ["Démontrer par récurrence", "Calculer une limite", "Calculer une intégrale", "Utiliser la loi binomiale", "Étudier une position relative dans l'espace"],
    exercise: { question: "Combien vaut ln(e³) ?", choices: ["e³", "3", "3e", "1/3"], answer: "3", explanation: "Le logarithme népérien est la fonction réciproque de l'exponentielle : ln(eˣ) = x, donc ln(e³) = 3." },
    faq: [
      { q: "Et les maths expertes ou complémentaires ?", a: "Ce sont des niveaux distincts sur Educalcul : l'option exacte est choisie pour le compte de l'élève, qui voit ensuite les contenus qui lui correspondent." },
      { q: "Comment réviser le bac de maths ?", a: "En reprenant chaque chapitre avec des exercices corrigés et des quiz, et en travaillant les méthodes qui bloquent avec Calia." },
      { q: "Calia donne-t-elle les réponses des exercices du bac ?", a: "Non, Calia guide le raisonnement par questions et indices : l'objectif est de savoir refaire seul le jour de l'épreuve." },
    ],
  },
];

export const LEVEL_BY_SLUG: Record<string, LevelPage> = Object.fromEntries(LEVEL_PAGES.map((l) => [l.slug, l]));

export function levelsOfCycle(cycle: Cycle): LevelPage[] {
  return LEVEL_PAGES.filter((l) => l.cycle === cycle);
}

export function chapterCount(level: LevelPage): number {
  return level.domains.reduce((n, d) => n + d.chapters.length, 0);
}

/** Niveaux voisins (précédent / suivant) pour le maillage interne. */
export function neighbours(slug: string): { prev?: LevelPage; next?: LevelPage } {
  const i = LEVEL_PAGES.findIndex((l) => l.slug === slug);
  return { prev: i > 0 ? LEVEL_PAGES[i - 1] : undefined, next: i >= 0 && i < LEVEL_PAGES.length - 1 ? LEVEL_PAGES[i + 1] : undefined };
}

/** Date de dernière mise à jour réelle des pages publiques de contenu (sitemap). */
export const LEVEL_PAGES_UPDATED = "2026-11-04";
