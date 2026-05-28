import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programmes officiels — CP à Terminale | Educalcul",
  description: "Tous les programmes officiels de mathématiques de l'Éducation Nationale, du CP à la Terminale. Toutes filières lycée incluses (Générale, STI2D, STMG, ST2S…).",
  openGraph: {
    title: "Programmes officiels maths — Educalcul",
    description: "Programmes de maths du CP à la Terminale, alignés sur le référentiel de l'Éducation Nationale.",
    url: "https://educalcul.com/programmes",
  },
};

export default function ProgrammesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
