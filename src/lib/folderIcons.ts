import {
  Folder,
  BookOpen,
  Calculator,
  Brain,
  Trophy,
  Star,
  Pencil,
  Ruler,
  FlaskConical,
  Shapes,
  Pi,
  Puzzle,
  type LucideIcon,
} from "lucide-react";

export const FOLDER_ICONS: { name: string; Icon: LucideIcon }[] = [
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
];

export const getFolderIcon = (iconName?: string | null): LucideIcon => {
  const found = FOLDER_ICONS.find((i) => i.name === iconName);
  return found ? found.Icon : Folder;
};
