import { Folder, BookOpen, Calculator, Brain, Trophy, Star, Pencil, Ruler, FlaskConical, Shapes, Pi, Puzzle, LineChart, Hash, Table2, Superscript } from "lucide-react";

// Couleurs et icônes proposées pour les dossiers de l'admin (exercices, quiz, cours).
export const FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#1e3a8a", // Bleu marine
  "#84cc16", // Lime
  "#166534", // Vert foncé
  "#78350f", // Marron
  "#06b6d4", // Cyan
  "#d946ef", // Fuchsia
  "#0ea5e9", // Sky
  "#f43f5e", // Rose
];

export const COURSE_FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow/Gold
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#1e3a8a", // Bleu marine
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#64748b", // Slate
  "#166534", // Vert foncé
  "#78350f", // Marron
  "#06b6d4", // Cyan
  "#d946ef", // Fuchsia
  "#0ea5e9", // Sky
  "#f43f5e", // Rose
];

export function Num123Icon({ size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...props}
    >
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor" fillOpacity="1" stroke="none">
        123
      </text>
    </svg>
  );
}

export const FOLDER_ICONS = [
  { name: "folder", Icon: Folder },
  { name: "book", Icon: BookOpen },
  { name: "calculator", Icon: Calculator },
  { name: "brain", Icon: Brain },
  { name: "trophy", Icon: Trophy },
  { name: "star", Icon: Star },
  { name: "pencil", Icon: Pencil },
  { name: "ruler", Icon: Ruler },
  { name: "flask", Icon: FlaskConical },
  { name: "shapes", Icon: Shapes },
  { name: "pi", Icon: Pi },
  { name: "puzzle", Icon: Puzzle },
  { name: "chart", Icon: LineChart },
  { name: "numbers", Icon: Hash },
  { name: "table", Icon: Table2 },
  { name: "exponent", Icon: Superscript },
  { name: "123", Icon: Num123Icon },
];

export const getFolderIcon = (iconName?: string | null) => {
  const found = FOLDER_ICONS.find((i) => i.name === iconName);
  return found ? found.Icon : Folder;
};
