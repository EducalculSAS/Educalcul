// cspell:disable
import { Page, Block } from "@/components/admin/ExerciseBuilder";
import { Question } from "@/components/admin/QuizBuilder";
import { SCHOOL_LEVELS } from "@/lib/constants";

// Helper for unique IDs without relying on crypto.randomUUID (compatibility)
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

interface GenerationParams {
  topic: string;
  difficulty: string;
  level: string;
  instructions?: string;
  count?: number;
}

interface AIResponse<T> {
  content: T;
  metadata: {
    title: string;
    description: string;
    difficulty_level: "easy" | "medium" | "hard";
    time_limit: number;
    max_attempts: number;
    type?: string;
    level?: string;
    grading_type?: string;
    tags?: string[];
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  reply: string;
  action?: "generate";
  params?: GenerationParams;
}

// --- CONSTANTS ---
const MATH_TOPICS = [
  "Addition",
  "Soustraction",
  "Multiplication",
  "Division",
  "Calcul mental",
  "Fractions",
  "Nombres Décimaux",
  "Problèmes de logique",
];

const FRENCH_DATA = [
  {
    q: "Quel est le pluriel de 'cheval' ?",
    a: "chevaux",
    o: ["chevals", "chevaux", "chevales", "chevaus"],
  },
  {
    q: "Complétez : Je ___ à l'école.",
    a: "vais",
    o: ["va", "vais", "vas", "vont"],
  },
  {
    q: "Quel est le synonyme de 'rapide' ?",
    a: "vite",
    o: ["lent", "vite", "grand", "petit"],
  },
  {
    q: "Conjuguez 'manger' au présent (tu) :",
    a: "manges",
    o: ["mange", "manges", "mangez", "mangent"],
  },
  {
    q: "Quel est l'antonyme de 'chaud' ?",
    a: "froid",
    o: ["tiède", "brûlant", "froid", "glacé"],
  },
];

const HISTORY_DATA = [
  {
    q: "Qui était Napoléon ?",
    a: "Un empereur",
    o: ["Un roi", "Un empereur", "Un président", "Un ministre"],
  },
  {
    q: "En quelle année a eu lieu la Révolution française ?",
    a: "1789",
    o: ["1789", "1800", "1492", "1945"],
  },
  {
    q: "Qui a découvert l'Amérique ?",
    a: "Christophe Colomb",
    o: ["Louis XIV", "Christophe Colomb", "Jules César", "Vercingétorix"],
  },
  {
    q: "Quelle guerre a eu lieu entre 1914 et 1918 ?",
    a: "Première Guerre mondiale",
    o: [
      "Seconde Guerre mondiale",
      "Guerre de Cent Ans",
      "Première Guerre mondiale",
      "Guerre froide",
    ],
  },
];

const GEO_DATA = [
  {
    q: "Quelle est la capitale de la France ?",
    a: "Paris",
    o: ["Lyon", "Marseille", "Paris", "Bordeaux"],
  },
  {
    q: "Quel fleuve traverse Paris ?",
    a: "La Seine",
    o: ["La Loire", "Le Rhône", "La Seine", "La Garonne"],
  },
  {
    q: "Quel est le plus haut sommet d'Europe ?",
    a: "Le Mont Blanc",
    o: ["L'Everest", "Le Mont Blanc", "Le Kilimandjaro", "L'Etna"],
  },
];

const SCIENCE_DATA = [
  {
    q: "À quelle température l'eau bout-elle ?",
    a: "100°C",
    o: ["90°C", "100°C", "110°C", "0°C"],
  },
  {
    q: "Quelle planète est surnommée la planète rouge ?",
    a: "Mars",
    o: ["Vénus", "Mars", "Jupiter", "Saturne"],
  },
  {
    q: "De quoi les plantes ont-elles besoin pour pousser ?",
    a: "Lumière et eau",
    o: ["Lumière et eau", "Sucre", "Sel", "Feu"],
  },
];

// --- GENERATORS ---

const generateTopicQuestions = (
  topic: string,
  // level param removed as it was unused
  count: number = 3,
  blockType: "single_choice" | "text_input" = "single_choice"
): Block[] => {
  const blocks: Block[] = [];
  let dataset = FRENCH_DATA;
  if (topic.includes("Histoire")) dataset = HISTORY_DATA;
  if (topic.includes("Géo")) dataset = GEO_DATA;
  if (topic.includes("Science")) dataset = SCIENCE_DATA;

  for (let i = 0; i < count; i++) {
    const data = dataset[Math.floor(Math.random() * dataset.length)];
    blocks.push({
      id: generateId(),
      type: blockType,
      title: `Question ${i + 1}`,
      content: data.q,
      points: 2,
      options:
        blockType === "single_choice"
          ? data.o.sort(() => Math.random() - 0.5)
          : undefined,
      correctAnswer: data.a,
      explanation: "Réponse correcte.",
    });
  }
  return blocks;
};

const generateMathQuestions = (
  topic: string,
  level: string,
  count: number = 3,
  blockType: "single_choice" | "text_input" = "single_choice"
): Block[] => {
  const blocks: Block[] = [];
  const topicLower = topic.toLowerCase();

  // Level Logic
  const isCP = level.includes("cp");
  const isCE = level.includes("ce1") || level.includes("ce2");
  const isCM = level.includes("cm1") || level.includes("cm2");
  const isCollege =
    level.includes("6eme") ||
    level.includes("5eme") ||
    level.includes("4eme") ||
    level.includes("3eme");
  const isLycee =
    level.includes("2nde") ||
    level.includes("1ere") ||
    level.includes("terminale");

  // Complexity configuration
  let maxNum = 20; // CP Base
  if (isCE) maxNum = 100;
  if (isCM) maxNum = 1000;
  if (isCollege) maxNum = 10000;
  if (isLycee) maxNum = 100000;

  const latexMode = true; // Always on as requested

  // Topic Mode Detection
  let mode = "arithmetic"; // default

  if (
    topicLower.includes("algèbre") ||
    topicLower.includes("littéral") ||
    topicLower.includes("développement") ||
    topicLower.includes("factorisation") ||
    topicLower.includes("identité")
  )
    mode = "algebra";
  else if (
    topicLower.includes("pourcentage") ||
    topicLower.includes("%") ||
    topicLower.includes("proportion")
  )
    mode = "percent";
  else if (topicLower.includes("inéquation")) mode = "inequation";
  else if (
    topicLower.includes("géométrie") ||
    topicLower.includes("aire") ||
    topicLower.includes("périmètre") ||
    topicLower.includes("volume") ||
    topicLower.includes("angle") ||
    topicLower.includes("triangle") ||
    topicLower.includes("carré") ||
    topicLower.includes("rectangle") ||
    topicLower.includes("cercle") ||
    topicLower.includes("pythagore") ||
    topicLower.includes("thalès") ||
    topicLower.includes("trigonométrie") ||
    topicLower.includes("cosinus") ||
    topicLower.includes("sinus") ||
    topicLower.includes("tangente")
  )
    mode = "geometry";
  else if (
    topicLower.includes("probabilité") ||
    topicLower.includes("statistique") ||
    topicLower.includes("moyenne")
  )
    mode = "proba";
  else if (
    topicLower.includes("puissance") ||
    topicLower.includes("exposant") ||
    topicLower.includes("racine")
  )
    mode = "powers";
  else if (
    topicLower.includes("fonction") ||
    topicLower.includes("dérivée") ||
    topicLower.includes("limite") ||
    topicLower.includes("affine")
  )
    mode = "functions";
  else if (topicLower.includes("complexe") || topicLower.includes("imaginaire"))
    mode = "complex";
  else if (topicLower.includes("équation") || topicLower.includes("inconnue"))
    mode = "equations";
  else if (topicLower.includes("fraction")) mode = "fractions";
  else if (topicLower.includes("décimal") || topicLower.includes("decimal"))
    mode = "decimals";
  else if (topicLower.includes("problème") || topicLower.includes("logique"))
    mode = "logic";
  else if (
    topicLower.includes("suite") ||
    topicLower.includes("arithmétique") ||
    topicLower.includes("géométrique") ||
    topicLower.includes("récurrence")
  )
    mode = "sequences";
  else if (
    topicLower.includes("logarithme") ||
    topicLower.includes("ln") ||
    topicLower.includes("exponentielle") ||
    topicLower.includes("exp")
  )
    mode = "log_exp";
  else if (
    topicLower.includes("addition") ||
    topicLower.includes("somme") ||
    topicLower.includes("soustraction") ||
    topicLower.includes("différence") ||
    topicLower.includes("multiplication") ||
    topicLower.includes("produit") ||
    topicLower.includes("division") ||
    topicLower.includes("quotient") ||
    topicLower.includes("vecteur")
  )
    mode = "arithmetic";
  else mode = "global"; // Global mode if no specific topic found

  // Refinement flags (still needed for specific behaviors within modes)
  const isAddition =
    topicLower.includes("addition") || topicLower.includes("somme");
  const isSubtraction =
    topicLower.includes("soustraction") || topicLower.includes("différence");
  const isMultiplication =
    topicLower.includes("multiplication") || topicLower.includes("produit");
  const isDivision =
    topicLower.includes("division") || topicLower.includes("quotient");
  const isSimplification = topicLower.includes("simplif");
  const isVector = topicLower.includes("vecteur");

  // SPECIAL MODE: Structured "Bac-style" Exercise for Lycée with Free Text
  if (
    isLycee &&
    blockType === "text_input" &&
    (mode === "functions" || mode === "algebra")
  ) {
    // Generate a coherent problem
    const blocks: Block[] = [];

    // Define function f(x) = ax^3 + bx^2 + cx + d
    const a = Math.floor(Math.random() * 3) + 1; // 1 to 3
    const b = Math.floor(Math.random() * 6) - 3; // -3 to 3
    const c = Math.floor(Math.random() * 10) - 5; // -5 to 5
    const d = Math.floor(Math.random() * 10) - 5;

    const funcStr = `f(x) = ${a === 1 ? "" : a}x^3 ${b >= 0 ? "+" : ""}${
      b === 0 ? "" : b + "x^2"
    } ${c >= 0 ? "+" : ""}${c === 0 ? "" : c + "x"} ${d >= 0 ? "+" : ""}${d}`;
    const derivStr = `f'(x) = ${3 * a}x^2 ${2 * b >= 0 ? "+" : ""}${2 * b}x ${
      c >= 0 ? "+" : ""
    }${c}`;

    // Block 1: The Statement (Enoncé)
    blocks.push({
      id: generateId(),
      type: "text", // Display only block
      title: "Énoncé de l'exercice",
      content: `
         <div class="p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-900 rounded-r">
           <h3 class="font-bold text-lg mb-2">Étude de fonction</h3>
           <p class="mb-2">Soit $f$ la fonction définie sur $\\mathbb{R}$ par :</p>
           <p class="text-xl text-center font-serif my-4">$$ ${funcStr} $$</p>
           <p>On note $\\mathcal{C}_f$ sa courbe représentative dans un repère orthonormé.</p>
         </div>
       `,
      points: 0,
    });

    // Question 1: Derivative
    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "1. Calcul de la dérivée",
      content: "Déterminer l'expression de la fonction dérivée $f'$.",
      points: 2,
      correctAnswer: derivStr, // This is for auto-check reference, but AI will grade strictly
      explanation: `La dérivée est $$ ${derivStr} $$`,
    });

    // Question 2: Tangent at x=0
    // Tangent eq: y = f'(a)(x-a) + f(a)
    // At 0: y = f'(0)(x) + f(0) = c*x + d
    const tangentEq = `y = ${c}x ${d >= 0 ? "+" : ""}${d}`;
    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "2. Équation de la tangente",
      content:
        "Déterminer l'équation réduite de la tangente $T$ à la courbe $\\mathcal{C}_f$ au point d'abscisse 0.",
      points: 3,
      correctAnswer: tangentEq,
      explanation: `L'équation est $y = f'(0)(x-0) + f(0)$. Ici $f'(0)=${c}$ et $f(0)=${d}$, donc $y = ${c}x + ${d}$.`,
    });

    // Question 3: Variations (Open ended)
    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "3. Variations",
      content:
        "Étudier le signe de $f'(x)$ et en déduire les variations de $f$ sur $\\mathbb{R}$.",
      points: 5,
      correctAnswer: "Voir correction détaillée", // AI will judge
      explanation:
        "Il faut étudier le signe du polynôme du second degré $f'(x)$.",
    });

    return blocks;
  }

  // SPECIAL MODE: Structured "Brevet-style" Exercise for Collège
  if (isCollege && blockType === "text_input") {
    const blocks: Block[] = [];

    // Scenario: Programme de calcul vs Geometry
    const scenario = Math.random() > 0.5 ? "programme" : "geometry";

    if (scenario === "programme") {
      const startNum = Math.floor(Math.random() * 10);
      const mul = Math.floor(Math.random() * 5) + 2;
      const add = Math.floor(Math.random() * 10) + 1;

      blocks.push({
        id: generateId(),
        type: "text",
        title: "Énoncé : Programme de calcul",
        content: `
           <div class="p-4 bg-orange-50 border-l-4 border-orange-500 text-orange-900 rounded-r">
             <p class="font-bold mb-2">Voici un programme de calcul :</p>
             <ul class="list-disc ml-5 space-y-1">
               <li>Choisir un nombre</li>
               <li>Multiplier ce nombre par ${mul}</li>
               <li>Ajouter ${add} au résultat</li>
             </ul>
           </div>
         `,
        points: 0,
      });

      // Q1
      const res1 = startNum * mul + add;
      blocks.push({
        id: generateId(),
        type: "text_input",
        title: "1. Essai avec un nombre",
        content: `Montrer que si l'on choisit le nombre ${startNum}, le résultat obtenu est ${res1}.`,
        points: 2,
        correctAnswer: res1.toString(),
        explanation: `${startNum} x ${mul} + ${add} = ${res1}`,
      });

      // Q2
      blocks.push({
        id: generateId(),
        type: "text_input",
        title: "2. Expression littérale",
        content:
          "On note $x$ le nombre choisi au départ. Exprimer le résultat final en fonction de $x$.",
        points: 3,
        correctAnswer: `${mul}x + ${add}`,
        explanation: `On multiplie x par ${mul} puis on ajoute ${add}, donc ${mul}x + ${add}.`,
      });
    } else {
      // Geometry (Pythagore Triangle)
      // Generate a Pythagorean triple k*(3,4,5)
      const k = Math.floor(Math.random() * 3) + 1;
      const sideA = 3 * k;
      const sideB = 4 * k;
      const sideC = 5 * k;

      blocks.push({
        id: generateId(),
        type: "text",
        title: "Énoncé : Géométrie",
        content: `
           <div class="p-4 bg-green-50 border-l-4 border-green-500 text-green-900 rounded-r">
             <p class="font-bold mb-2">Configuration géométrique :</p>
             <p>On considère un triangle ABC rectangle en B tel que :</p>
             <ul class="list-disc ml-5">
               <li>AB = ${sideA} cm</li>
               <li>BC = ${sideB} cm</li>
             </ul>
           </div>
         `,
        points: 0,
      });

      blocks.push({
        id: generateId(),
        type: "text_input",
        title: "1. Calcul de longueur",
        content: "Calculer la longueur du côté AC. Justifier la réponse.",
        points: 3,
        correctAnswer: `${sideC}`,
        explanation: `Théorème de Pythagore : $$ AC^2 = AB^2 + BC^2 = ${sideA}^2 + ${sideB}^2 = ${
          sideA * sideA + sideB * sideB
        } $$. Donc $$ AC = \\sqrt{${sideC * sideC}} = ${sideC} $$.`,
      });

      blocks.push({
        id: generateId(),
        type: "text_input",
        title: "2. Calcul d'aire",
        content: "Calculer l'aire du triangle ABC.",
        points: 2,
        correctAnswer: `${(sideA * sideB) / 2}`,
        explanation: `Aire = (Base x Hauteur) / 2 = (${sideA} x ${sideB}) / 2 = ${
          (sideA * sideB) / 2
        }.`,
      });
    }

    return blocks;
  }

  // SPECIAL MODE: Structured "Problème" for Primaire
  if ((isCM || isCE) && blockType === "text_input") {
    const blocks: Block[] = [];

    // Market Scenario
    const item1 = "pommes";
    const price1 = Math.floor(Math.random() * 3) + 2; // 2-4
    const qty1 = Math.floor(Math.random() * 3) + 2; // 2-4

    const item2 = "gâteaux";
    const price2 = Math.floor(Math.random() * 4) + 3; // 3-6
    const qty2 = Math.floor(Math.random() * 2) + 1; // 1-2

    const total = price1 * qty1 + price2 * qty2;
    const billet = Math.ceil(total / 10) * 10 + (Math.random() > 0.5 ? 0 : 10);

    blocks.push({
      id: generateId(),
      type: "text",
      title: "Énoncé du problème",
      content: `
        <div class="p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900 rounded-r">
          <h3 class="font-bold text-lg mb-2">Au marché</h3>
          <p>Léo va au marché. Il achète :</p>
          <ul class="list-disc ml-5 mb-2">
            <li>${qty1} kg de ${item1} à ${price1}€ le kg.</li>
            <li>${qty2} ${item2} à ${price2}€ l'unité.</li>
          </ul>
          <p>Il paie avec un billet de ${billet}€.</p>
        </div>
      `,
      points: 0,
    });

    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "1. Coût des pommes",
      content: `Combien coûtent les ${item1} au total ?`,
      points: 2,
      correctAnswer: (price1 * qty1).toString(),
      explanation: `${qty1} x ${price1} = ${price1 * qty1}€`,
    });

    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "2. Coût total",
      content: "Quel est le montant total des achats ?",
      points: 2,
      correctAnswer: total.toString(),
      explanation: `${price1 * qty1} + ${price2 * qty2} = ${total}€`,
    });

    blocks.push({
      id: generateId(),
      type: "text_input",
      title: "3. La monnaie",
      content: "Combien le marchand doit-il rendre à Léo ?",
      points: 2,
      correctAnswer: (billet - total).toString(),
      explanation: `${billet} - ${total} = ${billet - total}€`,
    });

    return blocks;
  }

  for (let i = 0; i < count; i++) {
    let qText = "";
    let correct = "";
    let options: string[] = [];
    let explanation = "";

    // Determine effective mode for this question
    let effectiveMode = mode;
    if (mode === "global") {
      const availableModes = [];
      if (isLycee) {
        availableModes.push(
          "algebra",
          "inequation",
          "geometry",
          "proba",
          "powers",
          "functions",
          "complex",
          "equations",
          "fractions",
          "arithmetic",
          "sequences",
          "log_exp"
        );
      } else if (isCollege) {
        availableModes.push(
          "algebra",
          "inequation",
          "geometry",
          "proba",
          "powers",
          "functions",
          "equations",
          "fractions",
          "arithmetic",
          "percent"
        );
      } else if (isCM) {
        availableModes.push(
          "geometry",
          "fractions",
          "decimals",
          "logic",
          "arithmetic",
          "percent"
        );
      } else {
        // CP / CE
        availableModes.push("geometry", "logic", "arithmetic");
      }
      effectiveMode =
        availableModes[Math.floor(Math.random() * availableModes.length)];
    }

    // --- ALGEBRA / LITERAL CALC ---
    if (effectiveMode === "algebra" && (isCollege || isLycee)) {
      if (
        (isLycee && Math.random() > 0.5) ||
        topicLower.includes("identité") ||
        topicLower.includes("factorisation")
      ) {
        // Identities a^2 - b^2
        const a = Math.floor(Math.random() * 5) + 2;
        const b = Math.floor(Math.random() * 5) + 2;
        qText = `Factoriser $$ ${a * a}x^2 - ${b * b} $$`;
        correct = `$$ (${a}x - ${b})(${a}x + ${b}) $$`;
        options = [
          correct,
          `$$ (${a}x - ${b})^2 $$`,
          `$$ (${a}x + ${b})^2 $$`,
          `$$ ${a}x^2 - ${b} $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = `Identité remarquable : $$ a^2 - b^2 = (a-b)(a+b) $$`;
      } else {
        // Distributivity k(ax+b)
        const k = Math.floor(Math.random() * 5) + 2;
        const a = Math.floor(Math.random() * 4) + 2;
        const b = Math.floor(Math.random() * 5) + 1;
        qText = `Développer $$ ${k}(${a}x + ${b}) $$`;
        correct = `$$ ${k * a}x + ${k * b} $$`;
        options = [
          correct,
          `$$ ${k * a}x + ${b} $$`,
          `$$ ${k}x + ${k * b} $$`,
          `$$ ${k + a}x + ${k + b} $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = "Distributivité simple : k(a+b) = ka + kb.";
      }
    }
    // --- PERCENTAGES ---
    else if (effectiveMode === "percent") {
      const total = Math.floor(Math.random() * 20) * 10; // 10, 20... 200
      const pct = [10, 20, 25, 50, 75][Math.floor(Math.random() * 5)];
      qText = `Calculer ${pct}% de ${total}.`;
      correct = ((total * pct) / 100).toString();
      options = [
        correct,
        ((total * pct) / 100 + 10).toString(),
        ((total * pct) / 100 - 5).toString(),
        (total / 2).toString(),
      ].sort(() => Math.random() - 0.5);
      explanation = `${pct}% revient à multiplier par ${pct}/100.`;
    }
    // --- INEQUATIONS ---
    else if (effectiveMode === "inequation" && (isCollege || isLycee)) {
      const a2 = Math.floor(Math.random() * 4) + 2;
      const res = Math.floor(Math.random() * 5) + 1;
      const c2 = a2 * res;

      qText = `Résoudre $$ ${a2}x < ${c2} $$`;
      correct = `$$ x < ${res} $$`;
      options = [
        correct,
        `$$ x > ${res} $$`,
        `$$ x \\leq ${res} $$`,
        `$$ x = ${res} $$`,
      ].sort(() => Math.random() - 0.5);
      explanation = `On divise par ${a2} (positif), donc le sens ne change pas.`;
    }
    // --- GEOMETRY / PYTHAGORE / THALES ---
    else if (effectiveMode === "geometry") {
      // Determine sub-mode if not specific
      const subIsPythagore =
        topicLower.includes("pythagore") ||
        (effectiveMode === "geometry" &&
          (isCollege || isLycee) &&
          Math.random() > 0.7);
      const subIsTrig =
        topicLower.includes("trigo") ||
        topicLower.includes("cos") ||
        (effectiveMode === "geometry" &&
          (isCollege || isLycee) &&
          Math.random() > 0.8);

      if (subIsPythagore && (isCollege || isLycee)) {
        const a = Math.floor(Math.random() * 5) + 3;
        const b = Math.floor(Math.random() * 5) + 3;
        // Search for hypotenuse
        qText = `Dans un triangle rectangle, les côtés de l'angle droit mesurent ${a} cm et ${b} cm. Calculer l'hypoténuse (arrondie à 0.1 près).`;
        const hyp = Math.sqrt(a * a + b * b);
        correct = hyp.toFixed(1).replace(".0", "");
        options = [
          correct,
          (hyp + 1).toFixed(1).replace(".0", ""),
          (hyp - 0.5).toFixed(1).replace(".0", ""),
          (a + b).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `Théorème de Pythagore : $$ c = \\sqrt{a^2 + b^2} $$`;
      } else if (subIsTrig && isLycee) {
        // Radians/Degrees or simple values
        const angles = [30, 45, 60];
        const angle = angles[Math.floor(Math.random() * angles.length)];
        const func = Math.random() > 0.5 ? "cos" : "sin";
        qText = `Quelle est la valeur exacte de $$ \\${func}(${angle}^\\circ) $$ ?`;

        if (func === "cos") {
          if (angle === 60) correct = "1/2";
          else if (angle === 45) correct = "$$ \\frac{\\sqrt{2}}{2} $$";
          else correct = "$$ \\frac{\\sqrt{3}}{2} $$";
        } else {
          if (angle === 30) correct = "1/2";
          else if (angle === 45) correct = "$$ \\frac{\\sqrt{2}}{2} $$";
          else correct = "$$ \\frac{\\sqrt{3}}{2} $$";
        }
        options = [correct, "1", "0", "$$ \\frac{\\sqrt{2}}{3} $$"].sort(
          () => Math.random() - 0.5
        );
        explanation = "Valeurs remarquables du cercle trigonométrique.";
      } else if (subIsTrig && isCollege) {
        // Basic Cos/Sin/Tan relations
        qText =
          "Dans un triangle rectangle, quel rapport correspond au cosinus d'un angle ?";
        correct = "Côté adjacent / Hypoténuse";
        options = [
          correct,
          "Côté opposé / Hypoténuse",
          "Côté opposé / Côté adjacent",
          "Hypoténuse / Côté adjacent",
        ].sort(() => Math.random() - 0.5);
        explanation = "Moyen mnémotechnique : SOH CAH TOA.";
      } else if (isCP || isCE) {
        // Simple Perimeter
        const c = Math.floor(Math.random() * 10) + 2;
        qText = `Un carré a un côté de ${c} cm. Quel est son périmètre ?`;
        correct = (c * 4).toString();
        options = [
          correct,
          (c * 2).toString(),
          (c * c).toString(),
          (c + 4).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = "Périmètre du carré = 4 x côté.";
      } else if (isCM) {
        // Area Rectangle
        const L = Math.floor(Math.random() * 10) + 5;
        const l = Math.floor(Math.random() * 5) + 2;
        qText = `Un rectangle mesure ${L} cm de longueur et ${l} cm de largeur. Quelle est son aire ?`;
        correct = (L * l).toString();
        options = [
          correct,
          (L + l).toString(),
          ((L + l) * 2).toString(),
          (L * l + 10).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = "Aire = Longueur x largeur.";
      } else {
        // Default Geometry (College/Lycee) - Volume or Angle
        const r = Math.floor(Math.random() * 5) + 2;
        qText = `Quelle est l'aire d'un disque de rayon ${r} cm (prendre $$ \\pi \\approx 3 $$) ?`;
        correct = (r * r * 3).toString();
        options = [
          correct,
          (r * 3 * 2).toString(),
          (r * r).toString(),
          (r * 10).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = "Aire = $$ \\pi \\times R^2 $$.";
      }
    }
    // --- PROBABILITY / STATISTICS ---
    else if (effectiveMode === "proba") {
      if (isLycee) {
        // Binomial / Combi
        qText =
          "On lance une pièce équilibrée 3 fois de suite. Quelle est la probabilité d'avoir exactement 3 Piles ?";
        correct = "1/8";
        options = ["1/8", "1/6", "1/2", "3/8"].sort(() => Math.random() - 0.5);
        explanation =
          "Chaque lancer a 1/2 chance. Donc (1/2) * (1/2) * (1/2) = 1/8.";
      } else {
        // Mean (College/CM)
        const v1 = Math.floor(Math.random() * 20);
        const v2 = Math.floor(Math.random() * 20);
        const v3 = Math.floor(Math.random() * 20);
        qText = `Quelle est la moyenne de la série : ${v1}, ${v2}, ${v3} ?`;
        const m = ((v1 + v2 + v3) / 3).toFixed(1).replace(".0", "");
        correct = m;
        options = [
          correct,
          (parseFloat(m) + 1).toFixed(1).replace(".0", ""),
          (parseFloat(m) - 1).toFixed(1).replace(".0", ""),
          Math.max(v1, v2, v3).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = "Somme des valeurs divisée par le nombre de valeurs.";
      }
    }
    // --- POWERS / ROOTS ---
    else if (effectiveMode === "powers") {
      const isRoots =
        topicLower.includes("racine") ||
        (effectiveMode === "powers" && Math.random() > 0.5);

      if (isRoots) {
        // Square Roots
        const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
        const val = squares[Math.floor(Math.random() * squares.length)];
        qText = `Calculer $$ \\sqrt{${val}} $$`;
        correct = Math.sqrt(val).toString();
        options = [
          correct,
          (Math.sqrt(val) + 1).toString(),
          (val / 2).toString(),
          (val - 10).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `Car $$ ${correct}^2 = ${val} $$.`;
      } else {
        // Powers of 10 or simple powers
        const p = Math.floor(Math.random() * 4) + 2;
        const n = Math.floor(Math.random() * 5) + 2;
        qText = `Calculer $$ ${n}^${p} $$`;
        correct = Math.pow(n, p).toString();
        options = [
          correct,
          (n * p).toString(),
          Math.pow(n, p - 1).toString(),
          (Math.pow(n, p) + 10).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `C'est ${n} multiplié par lui-même ${p} fois.`;
      }
    }
    // --- FUNCTIONS (College + Lycee) ---
    else if (effectiveMode === "functions" && (isCollege || isLycee)) {
      if (
        isLycee &&
        (topicLower.includes("dérivée") ||
          (!topicLower.includes("affine") && Math.random() > 0.5))
      ) {
        // Derivatives (Lycee Only)
        const a = Math.floor(Math.random() * 5) + 1;
        const n = Math.floor(Math.random() * 3) + 2; // Power 2 to 4
        const b = Math.floor(Math.random() * 10) + 1;

        qText = `Quelle est la dérivée de la fonction $$ f(x) = ${a}x^${n} + ${b}x $$ ?`;
        const resA = a * n;
        correct = `$$ f'(x) = ${resA}x^${n - 1} + ${b} $$`;

        options = [
          correct,
          `$$ f'(x) = ${a}x^${n - 1} + ${b} $$`,
          `$$ f'(x) = ${resA}x^${n} + ${b} $$`,
          `$$ f'(x) = ${a}x^${n + 1} + ${b} $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = `La dérivée de $$ x^n $$ est $$ nx^{n-1} $$.`;
      } else {
        // Affine Function f(x) = ax + b (College + Lycee)
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * 5) + 1;
        const x = Math.floor(Math.random() * 5);
        qText = `Soit $$ f(x) = ${a}x + ${b} $$. Calculer $$ f(${x}) $$`;
        correct = (a * x + b).toString();
        options = [
          correct,
          (a * x - b).toString(),
          (a + x + b).toString(),
          (a * x).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `On remplace x par ${x} : ${a}*${x} + ${b}.`;
      }
    }
    // --- COMPLEX NUMBERS ---
    else if (effectiveMode === "complex" && isLycee) {
      // Complex Numbers Addition/Mult
      const r1 = Math.floor(Math.random() * 5) + 1;
      const i1 = Math.floor(Math.random() * 5) + 1;
      const r2 = Math.floor(Math.random() * 5) + 1;
      const i2 = Math.floor(Math.random() * 5) + 1;

      if (Math.random() > 0.5) {
        qText = `Soit $$ z_1 = ${r1} + ${i1}i $$ et $$ z_2 = ${r2} + ${i2}i $$. Calculez $$ z_1 + z_2 $$.`;
        correct = `$$ ${r1 + r2} + ${i1 + i2}i $$`;
        options = [
          correct,
          `$$ ${r1 + r2} + ${i1 - i2}i $$`,
          `$$ ${r1 - r2} + ${i1 + i2}i $$`,
          `$$ ${r1 * r2} + ${i1 * i2}i $$`,
        ].sort(() => Math.random() - 0.5);
        explanation =
          "On additionne les parties réelles entre elles et les parties imaginaires entre elles.";
      } else {
        // Conjugate
        qText = `Quel est le conjugué de $$ z = ${r1} + ${i1}i $$ ?`;
        correct = `$$ \\bar{z} = ${r1} - ${i1}i $$`;
        options = [
          correct,
          `$$ \\bar{z} = ${-r1} + ${i1}i $$`,
          `$$ \\bar{z} = ${r1} + ${i1}i $$`,
          `$$ \\bar{z} = ${-r1} - ${i1}i $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = "Le conjugué de $$ a + bi $$ est $$ a - bi $$.";
      }
    }
    // --- EQUATIONS ---
    else if (effectiveMode === "equations" && (isCollege || isLycee)) {
      // Linear Equation ax + b = c
      const xVal = Math.floor(Math.random() * 10) - 5; // -5 to 5
      const a = Math.floor(Math.random() * 5) + 2;
      const b = Math.floor(Math.random() * 10) - 5;
      const c = a * xVal + b;

      qText = `Résoudre l'équation : $$ ${a}x ${
        b >= 0 ? "+" : ""
      }${b} = ${c} $$`;
      correct = `$$ x = ${xVal} $$`;
      options = [
        `$$ x = ${xVal} $$`,
        `$$ x = ${xVal + 1} $$`,
        `$$ x = ${-xVal} $$`,
        `$$ x = ${xVal - 1} $$`,
      ].sort(() => Math.random() - 0.5);
      explanation = `On isole x : $$ ${a}x = ${c - b} $$ d'où $$ x = ${
        c - b
      }/${a} = ${xVal} $$.`;
    }
    // --- FRACTIONS ---
    else if (effectiveMode === "fractions") {
      // Determine sub-mode: Addition, Multiplication, Division, Simplification
      let fMode = "addition";
      if (isSimplification) fMode = "simplification";
      else if (isMultiplication) fMode = "multiplication";
      else if (isDivision) fMode = "division";
      else if (isAddition) fMode = "addition";
      else {
        const rand = Math.random();
        if (rand < 0.25) fMode = "simplification";
        else if (rand < 0.5) fMode = "multiplication";
        else if (rand < 0.75) fMode = "division";
        else fMode = "addition";
      }

      const denom = Math.floor(Math.random() * 8) + 2;
      const num1 = Math.floor(Math.random() * 5) + 1;
      const num2 = Math.floor(Math.random() * 5) + 1;
      const denom2 = Math.floor(Math.random() * 8) + 2;

      if (fMode === "multiplication") {
        const qStr = latexMode
          ? `$$ \\frac{${num1}}{${denom}} \\times \\frac{${num2}}{${denom2}} $$`
          : `${num1}/${denom} x ${num2}/${denom2}`;

        const resNum = num1 * num2;
        const resDenom = denom * denom2;
        const resStr = latexMode
          ? `$$ \\frac{${resNum}}{${resDenom}} $$`
          : `${resNum}/${resDenom}`;

        qText = `Calculez : ${qStr}`;
        correct = resStr;
        options = [
          resStr,
          latexMode
            ? `$$ \\frac{${num1 + num2}}{${denom + denom2}} $$`
            : `${num1 + num2}/${denom + denom2}`,
          latexMode
            ? `$$ \\frac{${resNum + 1}}{${resDenom}} $$`
            : `${resNum + 1}/${resDenom}`,
          latexMode
            ? `$$ \\frac{${resNum}}{${resDenom + 1}} $$`
            : `${resNum}/${resDenom + 1}`,
        ].sort(() => Math.random() - 0.5);
        explanation =
          "Pour multiplier des fractions, on multiplie les numérateurs entre eux et les dénominateurs entre eux.";
      } else if (fMode === "division") {
        const qStr = latexMode
          ? `$$ \\frac{${num1}}{${denom}} \\div \\frac{${num2}}{${denom2}} $$`
          : `${num1}/${denom} : ${num2}/${denom2}`;

        // Division = Multiply by inverse
        const resNum = num1 * denom2;
        const resDenom = denom * num2;
        const resStr = latexMode
          ? `$$ \\frac{${resNum}}{${resDenom}} $$`
          : `${resNum}/${resDenom}`;

        qText = `Calculez : ${qStr}`;
        correct = resStr;
        options = [
          resStr,
          latexMode
            ? `$$ \\frac{${num1 * num2}}{${denom * denom2}} $$`
            : `${num1 * num2}/${denom * denom2}`,
          latexMode
            ? `$$ \\frac{${resNum + 1}}{${resDenom}} $$`
            : `${resNum + 1}/${resDenom}`,
          latexMode
            ? `$$ \\frac{${resNum}}{${resDenom + 1}} $$`
            : `${resNum}/${resDenom + 1}`,
        ].sort(() => Math.random() - 0.5);
        explanation =
          "Diviser par une fraction revient à multiplier par son inverse.";
      } else if (fMode === "addition") {
        // Addition (Simple case with same denominator for CE/CM, or diff for College)
        const useSameDenom = !isCollege && !isLycee;
        const d1 = denom;
        const d2 = useSameDenom ? denom : denom2;

        const qStr = latexMode
          ? `$$ \\frac{${num1}}{${d1}} + \\frac{${num2}}{${d2}} $$`
          : `${num1}/${d1} + ${num2}/${d2}`;

        // Result
        const finalNum = useSameDenom ? num1 + num2 : num1 * d2 + num2 * d1;
        const finalDenom = useSameDenom ? d1 : d1 * d2;

        const resStr = latexMode
          ? `$$ \\frac{${finalNum}}{${finalDenom}} $$`
          : `${finalNum}/${finalDenom}`;

        qText = `Calculez : ${qStr}`;
        correct = resStr;
        options = [
          resStr,
          latexMode
            ? `$$ \\frac{${num1 + num2}}{${d1 + d2}} $$`
            : `${num1 + num2}/${d1 + d2}`,
          latexMode
            ? `$$ \\frac{${finalNum + 1}}{${finalDenom}} $$`
            : `${finalNum + 1}/${finalDenom}`,
          latexMode
            ? `$$ \\frac{${finalNum}}{${finalDenom + 1}} $$`
            : `${finalNum}/${finalDenom + 1}`,
        ].sort(() => Math.random() - 0.5);
        explanation = useSameDenom
          ? "On additionne les numérateurs en gardant le dénominateur commun."
          : "On met au même dénominateur avant d'additionner.";
      } else {
        // Simplification
        const num = Math.floor(Math.random() * 5) + 1;
        const factor = 2;
        const bigNum = num * factor;
        const bigDenom = 2 * factor;

        qText = `Simplifier : ${
          latexMode
            ? `$$ \\frac{${bigNum}}{${bigDenom}} $$`
            : `${bigNum}/${bigDenom}`
        }`;
        correct = latexMode ? `$$ \\frac{${num}}{2} $$` : `${num}/2`;
        options = [
          correct,
          latexMode ? `$$ \\frac{${bigNum}}{2} $$` : `${bigNum}/2`,
          latexMode ? `$$ \\frac{${num}}{4} $$` : `${num}/4`,
          latexMode ? `$$ \\frac{${num + 1}}{2} $$` : `${num + 1}/2`,
        ].sort(() => Math.random() - 0.5);
        explanation = `On divise haut et bas par ${factor}.`;
      }
    }
    // --- DECIMALS ---
    else if (effectiveMode === "decimals") {
      const a = parseFloat((Math.random() * 100).toFixed(1));
      const b = parseFloat((Math.random() * 50).toFixed(1));

      if (Math.random() > 0.5) {
        qText = `Combien font ${a} + ${b} ?`;
        correct = (a + b).toFixed(1).replace(".0", "");
        explanation = "Attention à bien aligner la virgule pour l'addition.";
      } else {
        qText = `Combien font ${a} - ${b} ?`;
        correct = (a - b).toFixed(1).replace(".0", "");
        explanation = "Attention à la retenue et à la virgule.";
      }

      const corNum = parseFloat(correct);
      options = [
        correct,
        (corNum + 0.1).toFixed(1).replace(".0", ""),
        (corNum - 0.1).toFixed(1).replace(".0", ""),
        (corNum + 1).toFixed(1).replace(".0", ""),
      ].sort(() => Math.random() - 0.5);
    }
    // --- SEQUENCES (SUITES) ---
    else if (effectiveMode === "sequences" && isLycee) {
      const u0 = Math.floor(Math.random() * 10) + 1;
      const r = Math.floor(Math.random() * 5) + 2;
      const n = Math.floor(Math.random() * 10) + 5; // Rank to find

      if (Math.random() > 0.5) {
        // Arithmetic Sequence
        qText = `Soit $(u_n)$ une suite arithmétique de premier terme $u_0 = ${u0}$ et de raison $r = ${r}$. Calculer $u_{${n}}$.`;
        const val = u0 + n * r;
        correct = val.toString();
        options = [
          correct,
          (val + r).toString(),
          (val - r).toString(),
          (u0 * Math.pow(r, n)).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `Pour une suite arithmétique : $u_n = u_0 + n \\times r$.`;
      } else {
        // Geometric Sequence
        const q = Math.floor(Math.random() * 2) + 2; // Ratio 2 or 3 to keep numbers small
        const nGeo = Math.floor(Math.random() * 4) + 2; // Small rank
        qText = `Soit $(u_n)$ une suite géométrique de premier terme $u_0 = ${u0}$ et de raison $q = ${q}$. Calculer $u_{${nGeo}}$.`;
        const val = u0 * Math.pow(q, nGeo);
        correct = val.toString();
        options = [
          correct,
          (val * q).toString(),
          (u0 + nGeo * q).toString(),
          (val / q).toString(),
        ].sort(() => Math.random() - 0.5);
        explanation = `Pour une suite géométrique : $u_n = u_0 \\times q^n$.`;
      }
    }
    // --- LOGARITHM / EXPONENTIAL ---
    else if (effectiveMode === "log_exp" && isLycee) {
      if (Math.random() > 0.5) {
        // Logarithm properties
        const a = Math.floor(Math.random() * 5) + 2;
        const b = Math.floor(Math.random() * 5) + 2;
        qText = `Simplifier l'expression : $$ \\ln(${a}) + \\ln(${b}) $$`;
        correct = `$$ \\ln(${a * b}) $$`;
        options = [
          correct,
          `$$ \\ln(${a + b}) $$`,
          `$$ \\ln(${a}^${b}) $$`,
          `$$ ${a} \\ln(${b}) $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = `Propriété : $\\ln(a) + \\ln(b) = \\ln(a \\times b)$.`;
      } else {
        // Exponential simplification
        const n = Math.floor(Math.random() * 5) + 2;
        const m = Math.floor(Math.random() * 5) + 2;
        qText = `Simplifier : $$ e^{${n}x} \\times e^{${m}x} $$`;
        correct = `$$ e^{${n + m}x} $$`;
        options = [
          correct,
          `$$ e^{${n * m}x} $$`,
          `$$ e^{${n}x + ${m}} $$`,
          `$$ e^{${n - m}x} $$`,
        ].sort(() => Math.random() - 0.5);
        explanation = `Propriété : $e^a \\times e^b = e^{a+b}$.`;
      }
    }
    // --- LOGIC / PROBLEMS ---
    else if (effectiveMode === "logic") {
      const names = ["Léo", "Sarah", "Tom", "Léa", "Adam"];
      const name = names[Math.floor(Math.random() * names.length)];
      const items = ["pommes", "billes", "livres", "bonbons"];
      const item = items[Math.floor(Math.random() * items.length)];

      const start = Math.floor(Math.random() * 20) + 10;
      const change = Math.floor(Math.random() * 10) + 1;

      if (Math.random() > 0.5) {
        // Addition problem
        qText = `${name} a ${start} ${item}. Son ami lui en donne ${change}. Combien en a-t-il maintenant ?`;
        correct = (start + change).toString();
        explanation = `Il faut faire une addition : ${start} + ${change} = ${correct}.`;
      } else {
        // Subtraction problem
        qText = `${name} a ${start} ${item}. Il en perd ${change}. Combien lui en reste-t-il ?`;
        correct = (start - change).toString();
        explanation = `Il faut faire une soustraction : ${start} - ${change} = ${correct}.`;
      }

      const corNum = parseInt(correct);
      options = [
        correct,
        (corNum + 1).toString(),
        (corNum - 1).toString(),
        (corNum + 5).toString(),
      ].sort(() => Math.random() - 0.5);
    }
    // --- ARITHMETIC / DEFAULT ---
    else {
      // 1. LYCEE : Vectors or Polynomials for basic ops
      if (
        isLycee &&
        (isAddition ||
          isSubtraction ||
          isMultiplication ||
          isVector ||
          (effectiveMode === "arithmetic" && Math.random() > 0.5))
      ) {
        if (!isVector && Math.random() > 0.5) {
          // Polynomials
          const a1 = Math.floor(Math.random() * 5) + 1;
          const b1 = Math.floor(Math.random() * 10);
          const a2 = Math.floor(Math.random() * 5) + 1;
          const b2 = Math.floor(Math.random() * 10);

          if (isMultiplication) {
            qText = `Développer $$ (${a1}x + ${b1})(${a2}x + ${b2}) $$`;
            const c2 = a1 * a2;
            const c1 = a1 * b2 + b1 * a2;
            const c0 = b1 * b2;
            correct = `$$ ${c2}x^2 + ${c1}x + ${c0} $$`;
            options = [
              correct,
              `$$ ${c2}x^2 + ${c1 + 1}x + ${c0} $$`,
              `$$ ${c2}x^2 + ${c1}x + ${c0 + 1} $$`,
              `$$ ${a1 + a2}x^2 + ${b1 + b2}x $$`,
            ].sort(() => Math.random() - 0.5);
            explanation = "On utilise la double distributivité.";
          } else {
            // Addition/Sub
            const sign = isSubtraction ? "-" : "+";
            qText = `Simplifier $$ (${a1}x^2 + ${b1}x) ${sign} (${a2}x^2 + ${b2}x) $$`;
            const resA = isSubtraction ? a1 - a2 : a1 + a2;
            const resB = isSubtraction ? b1 - b2 : b1 + b2;
            correct = `$$ ${resA}x^2 + ${resB}x $$`;
            options = [
              correct,
              `$$ ${resA}x^2 + ${resB + 1}x $$`,
              `$$ ${resA + 1}x^2 + ${resB}x $$`,
              `$$ ${resA}x + ${resB} $$`,
            ].sort(() => Math.random() - 0.5);
            explanation = "On regroupe les termes de même degré.";
          }
        } else {
          // Vectors (2D)
          const u1 = Math.floor(Math.random() * 10) - 5;
          const u2 = Math.floor(Math.random() * 10) - 5;
          const v1 = Math.floor(Math.random() * 10) - 5;
          const v2 = Math.floor(Math.random() * 10) - 5;

          if (isMultiplication) {
            // Dot Product
            qText = `Calculer le produit scalaire de $$ \\vec{u}(${u1};${u2}) $$ et $$ \\vec{v}(${v1};${v2}) $$`;
            const dot = u1 * v1 + u2 * v2;
            correct = dot.toString();
            options = [
              correct,
              (dot + 1).toString(),
              (dot - 1).toString(),
              (dot * 2).toString(),
            ].sort(() => Math.random() - 0.5);
            explanation = `$$ \\vec{u} \\cdot \\vec{v} = xx' + yy' = (${u1})(${v1}) + (${u2})(${v2}) $$`;
          } else {
            // Addition
            const sign = isSubtraction ? "-" : "+";
            qText = `Soit $$ \\vec{u}(${u1};${u2}) $$ et $$ \\vec{v}(${v1};${v2}) $$. Calculer $$ \\vec{u} ${sign} \\vec{v} $$`;
            const resX = isSubtraction ? u1 - v1 : u1 + v1;
            const resY = isSubtraction ? u2 - v2 : u2 + v2;
            correct = `$$ (${resX};${resY}) $$`;
            options = [
              correct,
              `$$ (${resX + 1};${resY}) $$`,
              `$$ (${resX};${resY + 1}) $$`,
              `$$ (${resY};${resX}) $$`,
            ].sort(() => Math.random() - 0.5);
            explanation = "On opère coordonnée par coordonnée.";
          }
        }
      }
      // 2. COLLEGE : Relative numbers (Integers with signs)
      else if (isCollege && (isAddition || isSubtraction || isMultiplication)) {
        const a = Math.floor(Math.random() * 20) - 10; // -10 to 10
        const b = Math.floor(Math.random() * 20) - 10;

        if (isMultiplication) {
          qText = `Calculer : $$ (${a}) \\times (${b}) $$`;
          correct = (a * b).toString();
          explanation =
            "Attention à la règle des signes : (-) par (-) donne (+).";
        } else if (isSubtraction) {
          qText = `Calculer : $$ (${a}) - (${b}) $$`;
          correct = (a - b).toString();
          explanation = "Soustraire un nombre revient à ajouter son opposé.";
        } else {
          qText = `Calculer : $$ (${a}) + (${b}) $$`;
          correct = (a + b).toString();
          explanation = "On additionne les nombres relatifs.";
        }
        options = [
          correct,
          (parseInt(correct) + 1).toString(),
          (parseInt(correct) - 1).toString(),
          (-parseInt(correct)).toString(),
        ].sort(() => Math.random() - 0.5);
      }
      // 3. CM / CE / CP / DEFAULT : Standard Arithmetic
      else {
        if (
          isMultiplication ||
          (level.includes("cm") &&
            !isAddition &&
            !isSubtraction &&
            !isDivision &&
            Math.random() > 0.5)
        ) {
          // Multiplication
          const a = Math.floor(Math.random() * 10) + 2;
          const b = Math.floor(Math.random() * 10) + 2; // Tables up to 12
          qText = `Combien font ${a} x ${b} ?`;
          correct = (a * b).toString();
          options = [
            correct,
            (a * b + a).toString(),
            (a * b - b).toString(),
            (a * b + 1).toString(),
          ].sort(() => Math.random() - 0.5);
          explanation = `C'est une table de multiplication classique.`;
        } else if (isDivision) {
          // Division (exact)
          const b = Math.floor(Math.random() * 9) + 2;
          const res = Math.floor(Math.random() * 10) + 1;
          const a = b * res;
          qText = `Combien font $$ ${a} \\div ${b} $$ ?`;
          correct = res.toString();
          options = [
            res.toString(),
            (res + 1).toString(),
            (res - 1).toString(),
            (res * 2).toString(),
          ].sort(() => Math.random() - 0.5);
          explanation = `Car ${b} x ${res} = ${a}.`;
        } else if (isSubtraction) {
          const a = Math.floor(Math.random() * maxNum) + 5;
          const b = Math.floor(Math.random() * a);
          qText = `Combien font ${a} - ${b} ?`;
          correct = (a - b).toString();
          explanation = "Soustraction simple.";
          options = [
            correct,
            (a - b + 1).toString(),
            (a - b - 1).toString(),
            (a - b + 10).toString(),
          ].sort(() => Math.random() - 0.5);
        } else {
          // Addition (Default)
          const a = Math.floor(Math.random() * maxNum);
          const b = Math.floor(Math.random() * maxNum);
          qText = `Combien font $$ ${a} + ${b} $$ ?`;
          correct = (a + b).toString();
          explanation = "Addition simple.";
          options = [
            correct,
            (a + b + 1).toString(),
            (a + b + 10).toString(),
            (a + b - 1).toString(),
          ].sort(() => Math.random() - 0.5);
        }
      }
    }

    blocks.push({
      id: generateId(),
      type: blockType,
      title: `Question ${i + 1}`,
      content: qText,
      points: 2,
      options: blockType === "single_choice" ? options : undefined,
      correctAnswer: correct,
      explanation: explanation,
    });
  }

  return blocks;
};

export const AI = {
  async chatWithAgent(
    messages: ChatMessage[],
    type: "exercise" | "quiz" | "course",
    level?: string
  ): Promise<ChatResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const lastUserMessage = messages[messages.length - 1].content.toLowerCase();

    // --- 1. INTENT ANALYSIS ---

    // Check for "Math Focus"
    const mathKeywords = [
      "math",
      "calcul",
      "addition",
      "soustraction",
      "multiplication",
      "division",
      "nombre",
      "géométrie",
      "fraction",
      "problème",
      "logique",
      "équation",
      "algèbre",
      "trigonométrie",
      "pythagore",
      "thalès",
    ];
    const isMathRequest = mathKeywords.some((k) => lastUserMessage.includes(k));

    // Check for "Whatever/Random"
    const isRandomRequest =
      lastUserMessage.includes("peu importe") ||
      lastUserMessage.includes("comme tu veux") ||
      lastUserMessage.includes("décide") ||
      lastUserMessage.includes("aléatoire") ||
      lastUserMessage.includes("n'importe");

    // Check for Level
    let detectedLevel = "";
    const fullHistory = messages
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();

    // Helper to find level with priority to latest message
    const findLevel = (text: string) => {
      const lowerText = text.toLowerCase();
      for (const level of SCHOOL_LEVELS) {
        if (
          lowerText.includes(level.value) ||
          lowerText.includes(level.label.toLowerCase())
        ) {
          return level.value;
        }
      }
      return "";
    };

    // 1. Check passed level (highest priority)
    if (level) {
      detectedLevel = level.toLowerCase();
    } else {
      detectedLevel = findLevel(lastUserMessage);
    }

    // 2. If not found, check previous messages in reverse order
    if (!detectedLevel) {
      for (let i = messages.length - 2; i >= 0; i--) {
        const level = findLevel(messages[i].content.toLowerCase());
        if (level) {
          detectedLevel = level;
          break;
        }
      }
    }

    // Check if we have math context in history
    const isContextMath = mathKeywords.some((k) => fullHistory.includes(k));

    // --- 2. DECISION LOGIC ---

    // Case A: User asks for non-math topic explicitly
    // We check if it's NOT math, NOT random, but has some other topic
    const nonMathKeywords = [
      "histoire",
      "géo",
      "français",
      "anglais",
      "svt",
      "physique",
      "chimie",
      "espagnol",
      "allemand",
      "science",
    ];
    // Only flag as non-math if we don't have a math context or explicit math request
    const isNonMath =
      !isMathRequest &&
      !isContextMath &&
      nonMathKeywords.some((k) => lastUserMessage.includes(k));

    if (isNonMath) {
      // Allow generation of non-math content via dataset
      let topic = lastUserMessage;
      // Refine topic name
      if (topic.includes("histoire")) topic = "Histoire";
      else if (topic.includes("géo")) topic = "Géographie";
      else if (topic.includes("science")) topic = "Sciences";
      else if (topic.includes("français")) topic = "Français";

      return {
        reply: `D'accord, je génère un exercice de ${topic}.`,
        action: "generate",
        params: {
          topic: topic,
          level: detectedLevel || "cm1",
          difficulty: "medium",
          instructions: fullHistory,
        },
      };
    }

    // Case B: Random/Whatever request
    if (isRandomRequest) {
      // Pick a random math topic
      const randomTopic =
        MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)];
      const levelToUse = detectedLevel || "cm1"; // Default level

      return {
        reply: `D'accord, je choisis le sujet pour vous. Que diriez-vous d'un ${
          type === "exercise" ? "exercice" : type === "quiz" ? "quiz" : "cours"
        } sur : **${randomTopic}** (Niveau ${levelToUse.toUpperCase()}) ?`,
        action: "generate",
        params: {
          topic: randomTopic,
          level: levelToUse,
          difficulty: "medium",
          instructions: "Généré aléatoirement",
        },
      };
    }

    // Case C: Specific Math Request OR Continuation
    if (isMathRequest || (detectedLevel && isContextMath)) {
      // Extract topic
      let topic = lastUserMessage;

      // If current message is just a level (no math keywords), try to find topic in history
      if (!isMathRequest && isContextMath) {
        const lastMathMsg = [...messages]
          .reverse()
          .find(
            (m) =>
              m.role === "user" &&
              mathKeywords.some((k) => m.content.toLowerCase().includes(k))
          );
        if (lastMathMsg) {
          topic = lastMathMsg.content;
        }
      }

      // Check for broad topic refinement
      const topicLower = topic.toLowerCase();
      if (
        topicLower.includes("fraction") &&
        !topicLower.includes("addition") &&
        !topicLower.includes("simplif") &&
        !topicLower.includes("soustraction") &&
        !topicLower.includes("multiplication") &&
        !topicLower.includes("division")
      ) {
        // Check if user just replied with a refinement
        const isRefinement = [
          "addition",
          "simplification",
          "soustraction",
          "multiplication",
          "division",
          "tout",
          "mélange",
          "varié",
          "mixte",
          "global",
        ].some((k) => lastUserMessage.includes(k));

        if (!isRefinement) {
          return {
            reply:
              "Sur les fractions, voulez-vous travailler l'addition, la simplification, ou autre chose ?",
          };
        } else {
          // Merge topic
          if (
            lastUserMessage.includes("tout") ||
            lastUserMessage.includes("mélange") ||
            lastUserMessage.includes("varié")
          ) {
            topic = "Fractions (Mélange)";
          } else {
            topic = "Fractions " + lastUserMessage;
          }
        }
      }

      // Check for Functions refinement
      if (
        topicLower.includes("fonction") &&
        !topicLower.includes("dérivée") &&
        !topicLower.includes("limite") &&
        !topicLower.includes("affine")
      ) {
        const isRefinement = [
          "dérivée",
          "limite",
          "affine",
          "tracé",
          "variation",
          "tout",
          "mélange",
          "varié",
        ].some((k) => lastUserMessage.includes(k));
        if (!isRefinement) {
          return {
            reply:
              "Sur les fonctions, voulez-vous travailler les dérivées, les limites, ou les fonctions affines ?",
          };
        } else {
          if (
            lastUserMessage.includes("tout") ||
            lastUserMessage.includes("mélange") ||
            lastUserMessage.includes("varié")
          ) {
            topic = "Fonctions (Mélange)";
          } else {
            topic = "Fonctions " + lastUserMessage;
          }
        }
      }

      // Check for Geometry refinement
      if (
        topicLower.includes("géométrie") &&
        !topicLower.includes("aire") &&
        !topicLower.includes("périmètre") &&
        !topicLower.includes("volume") &&
        !topicLower.includes("angle") &&
        !topicLower.includes("pythagore") &&
        !topicLower.includes("thalès") &&
        !topicLower.includes("trigo")
      ) {
        const isRefinement = [
          "aire",
          "périmètre",
          "volume",
          "angle",
          "pythagore",
          "thalès",
          "trigo",
          "cercle",
          "triangle",
          "rectangle",
          "carré",
          "tout",
          "mélange",
          "varié",
        ].some((k) => lastUserMessage.includes(k));

        if (!isRefinement) {
          return {
            reply:
              "Sur la géométrie, voulez-vous travailler les aires, les périmètres, Pythagore, ou autre chose ?",
          };
        } else {
          if (
            lastUserMessage.includes("tout") ||
            lastUserMessage.includes("mélange") ||
            lastUserMessage.includes("varié")
          ) {
            topic = "Géométrie (Mélange)";
          } else {
            topic = "Géométrie " + lastUserMessage;
          }
        }
      }

      // Refine topic string for display if too long
      let displayTopic = topic;

      // Clean up topic string (remove "un exercice sur", "je veux", etc.)
      displayTopic = displayTopic
        .replace(/^(je veux|je voudrais|fais|crée|génère)\s+/i, "")
        .replace(
          /^(un|une|des)\s+(exercice|quiz|question|problème)s?\s+(sur|de|d')?\s*/i,
          ""
        )
        .replace(/^sur\s+/i, "")
        .trim();

      // Capitalize first letter
      displayTopic =
        displayTopic.charAt(0).toUpperCase() + displayTopic.slice(1);

      if (displayTopic.length > 30) displayTopic = "Mathématiques"; // Fallback if still too long

      if (!detectedLevel) {
        // Ask for level if missing
        return {
          reply:
            "C'est noté pour les maths. Pour quel niveau scolaire (CP, CE1, CM2, 6ème...) ?",
        };
      }

      return {
        reply: `Parfait ! Je génère un ${
          type === "exercise" ? "exercice" : type === "quiz" ? "quiz" : "cours"
        } de **${displayTopic}** pour le niveau ${detectedLevel.toUpperCase()}.`,
        action: "generate",
        params: {
          topic: displayTopic, // Use cleaned topic for generator too
          level: detectedLevel,
          difficulty: "medium",
          instructions: fullHistory,
        },
      };
    }

    // Case D: Vague/Unknown Request (e.g. "Bonjour", "Je veux travailler")
    // If it's the start of convo
    if (messages.length <= 2) {
      return {
        reply:
          "Bonjour ! Je suis votre assistant mathématique. Sur quel sujet de maths voulez-vous travailler aujourd'hui ? (Ex: Fractions, Géométrie, Calcul mental...)",
      };
    }

    // Fallback for unclear input in middle of convo
    return {
      reply:
        "Je ne suis pas sûr de comprendre. Voulez-vous faire des exercices de mathématiques ? Si oui, précisez le sujet (ex: Additions, Fractions).",
    };
  },

  async generateExercise(
    params: GenerationParams
  ): Promise<AIResponse<Page[]>> {
    console.log("Generating exercise with params:", params);

    // SIMULATION DELAY
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Determine difficulty level for metadata
    const diffMap: Record<string, "easy" | "medium" | "hard"> = {
      easy: "easy",
      medium: "medium",
      hard: "hard",
      facile: "easy",
      moyen: "medium",
      difficile: "hard",
    };
    const difficultyLevel =
      diffMap[params.difficulty.toLowerCase()] || "medium";

    let generatedBlocks: Block[] = [];
    const topicLower = params.topic.toLowerCase();

    // Check if non-math topic
    if (
      ["français", "histoire", "géo", "science", "svt"].some((k) =>
        topicLower.includes(k)
      )
    ) {
      generatedBlocks = generateTopicQuestions(params.topic, 5, "text_input");
    } else {
      // Math generation
      generatedBlocks = generateMathQuestions(
        params.topic,
        params.level,
        params.count || 5, // Use user requested count
        "text_input"
      );
    }

    // Generate content structure with a leading Consigne block
    const generatedPages: Page[] = [
      {
        id: generateId(),
        title: `Exercices : ${params.topic}`,
        blocks: [
          {
            id: generateId(),
            type: "text",
            title: "Énoncé",
            content: `<div class="p-4 bg-blue-50 border-l-4 border-[var(--greek-blue)] text-blue-900 rounded-r">
                <p class="font-bold mb-2">Consigne :</p>
                <p>Traitez les questions suivantes avec attention. Les exercices portent sur : <strong class="text-[var(--greek-blue)]">${params.topic}</strong> (Niveau: ${params.level}).</p>
                ${params.instructions ? `<p class="mt-2 text-sm italic">Note : ${params.instructions}</p>` : ""}
              </div>`,
          },
          ...generatedBlocks
        ],
      },
    ];

    return {
      content: generatedPages,
      metadata: {
        title: `Maths : ${params.topic}`,
        description: `Série d'exercices sur ${params.topic} (Niveau ${params.level}).`,
        difficulty_level: difficultyLevel,
        time_limit:
          difficultyLevel === "easy"
            ? 10
            : difficultyLevel === "medium"
            ? 20
            : 30,
        max_attempts: 2,
        type: "standard",
        grading_type: "ai",
        level: params.level, // IMPORTANT: bind the level
        tags: ["Mathématiques", params.topic, params.level],
      },
    };
  },

  async generateQuiz(
    params: GenerationParams
  ): Promise<AIResponse<Question[]>> {
    console.log("Generating quiz with params:", params);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const diffMap: Record<string, "easy" | "medium" | "hard"> = {
      easy: "easy",
      medium: "medium",
      hard: "hard",
      facile: "easy",
      moyen: "medium",
      difficile: "hard",
    };
    const difficultyLevel =
      diffMap[params.difficulty.toLowerCase()] || "medium";

    let generatedBlocks: Block[] = [];
    const topicLower = params.topic.toLowerCase();

    if (
      ["français", "histoire", "géo", "science", "svt"].some((k) =>
        topicLower.includes(k)
      )
    ) {
      generatedBlocks = generateTopicQuestions(params.topic, params.count || 5);
    } else {
      generatedBlocks = generateMathQuestions(
        params.topic,
        params.level,
        params.count || 5
      );
    }

    // Convert Blocks to Questions
    const questions: Question[] = generatedBlocks.map((block) => ({
      id: block.id,
      text: block.content || "",
      type: block.type as Question["type"],
      points: block.points || 1,
      options: block.options,
      correctAnswer: Array.isArray(block.correctAnswer)
        ? block.correctAnswer
        : block.correctAnswer?.toString(),
      explanation: block.explanation,
    }));

    return {
      content: questions,
      metadata: {
        title: `Quiz : ${params.topic}`,
        description: `Test de connaissances sur ${params.topic}`,
        difficulty_level: difficultyLevel,
        time_limit: 15,
        max_attempts: 1,
        type: "standard",
        grading_type: "auto",
        tags: ["Quiz", params.topic, params.level],
      },
    };
  },
};
