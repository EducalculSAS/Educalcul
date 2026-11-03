import { FileText, Image as ImageIcon, CheckSquare, List, ArrowRightLeft, ArrowUpDown, AlignLeft, Code2, ToggleLeft, Type, AlertTriangle, LayoutGrid, Ruler, SearchX } from "lucide-react";
import type { Block, BlockType } from "@/components/admin/ExerciseBuilder";

// Métadonnées et valeurs par défaut des types de blocs de l'éditeur d'exercices.
export const BLOCK_TYPE_META: Partial<Record<BlockType, { label: string; icon: typeof FileText; description: string }>> = {
  text: { label: "Texte", icon: AlignLeft, description: "Paragraphe explicatif, sans question" },
  image: { label: "Média (image / vidéo / audio)", icon: ImageIcon, description: "Fichier à téléverser ou glisser" },
  text_input: { label: "Réponse libre", icon: Type, description: "Calcul / réponse courte, corrigée par IA" },
  qcm: { label: "QCM", icon: CheckSquare, description: "Une ou plusieurs bonnes réponses, cochées dans les options" },
  true_false: { label: "Vrai / Faux", icon: ToggleLeft, description: "Affirmation à valider" },
  fill_in_the_blank: { label: "Texte à trous", icon: List, description: "Compléter un texte avec des mots manquants" },
  matching: { label: "Association", icon: ArrowRightLeft, description: "Relier des éléments entre eux" },
  ordering: { label: "Mise en ordre", icon: ArrowUpDown, description: "Remettre des éléments dans le bon ordre" },
  coding: { label: "Code / Algo", icon: Code2, description: "Écrire un algorithme ou du code, corrigé par IA" },
  impossible_search: { label: "Recherche impossible", icon: AlertTriangle, description: "L'énoncé n'a pas de solution, l'élève doit le justifier, corrigé par IA" },
  categorize: { label: "Catégoriser", icon: LayoutGrid, description: "Trier des éléments dans plusieurs catégories (glisser-déposer)" },
  number_line_point: { label: "Point sur une droite graduée", icon: Ruler, description: "Placer un point à la bonne valeur sur une droite graduée" },
  click_error: { label: "Repérer l'erreur", icon: SearchX, description: "Cliquer sur l'étape incorrecte d'un calcul ou d'un raisonnement" },
};

// Liste type-safe des types proposés à la création (pickers), dans l'ordre
// d'affichage — dérivée des clés réellement présentes dans BLOCK_TYPE_META.
export const CREATABLE_BLOCK_TYPES = Object.keys(BLOCK_TYPE_META) as BlockType[];

// Libellés pour les anciens types qui peuvent encore exister en base (contenu
// déjà publié) mais qu'on ne propose plus à la création.
export const LEGACY_BLOCK_LABELS: Partial<Record<BlockType, string>> = {
  single_choice: "QCM (ancien format, choix unique)",
  multiple_choice: "QCM (ancien format, choix multiple)",
};

// Normalise correctAnswer en tableau, que le bloc soit "qcm" (toujours un
// tableau) ou un ancien "single_choice" (chaîne unique historique).
export function correctAnswersArray(block: Block): string[] {
  return Array.isArray(block.correctAnswer)
    ? block.correctAnswer
    : block.correctAnswer
    ? [block.correctAnswer]
    : [];
}

// Défauts sensés par type — utilisés à la création d'un bloc pour que l'admin
// n'ait jamais à reconfigurer un bloc vide avant de pouvoir travailler dessus.
export function defaultBlockFields(type: BlockType): Partial<Block> {
  switch (type) {
    case "qcm":
    case "single_choice":
    case "multiple_choice":
      return { content: "", options: ["Option 1", "Option 2"], correctAnswer: ["Option 1"] };
    case "true_false":
      return { content: "", correctAnswer: "true" };
    case "text_input":
      return { content: "", correctAnswer: "" };
    case "fill_in_the_blank":
      return { content: "Complète : 3 + 5 = {{1}}", blanks: ["8"] };
    case "matching":
      return {
        content: "",
        pairs: [
          { left: "Élément 1", right: "Correspondance 1" },
          { left: "Élément 2", right: "Correspondance 2" },
        ],
      };
    case "ordering":
      return { content: "", items: ["Étape 1", "Étape 2", "Étape 3"] };
    case "coding":
      return { content: "", correctAnswer: "" };
    case "impossible_search":
      return { content: "", correctAnswer: "" };
    case "categorize":
      return {
        content: "",
        categories: ["Catégorie A", "Catégorie B"],
        categoryItems: [
          { text: "Élément 1", category: "Catégorie A" },
          { text: "Élément 2", category: "Catégorie B" },
        ],
      };
    case "number_line_point":
      return { content: "", numberLineMin: 0, numberLineMax: 10, numberLineStep: 1, correctAnswer: "5" };
    case "click_error":
      return { content: "", steps: ["Étape 1", "Étape 2 (fausse)", "Étape 3"], correctAnswer: "1" };
    case "image":
      return { content: "" };
    default:
      return { content: "" };
  }
}

