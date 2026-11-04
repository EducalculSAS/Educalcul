import type { Metadata } from "next";

const BASE = "https://educalcul.com";

// Métadonnées du hub /programmes. Les pages de niveau (/programmes/[niveau]) définissent les leurs ;
// les données structurées sont posées par chaque page (pas ici, sinon elles se répéteraient sur les niveaux).
export const metadata: Metadata = {
  title: { absolute: "Programmes de maths du CP à la Terminale | Educalcul" },
  description: "Le programme de mathématiques de chaque niveau, du CP à la Terminale : notions au programme, compétences, exercice d'essai et accompagnement Educalcul. Textes officiels Éduscol.",
  keywords: ["programme maths CP", "programme maths 6e", "programme maths 3e", "programme maths seconde", "programme maths terminale", "programme officiel mathématiques"],
  alternates: { canonical: `${BASE}/programmes` },
  openGraph: { title: "Programmes de maths du CP à la Terminale | Educalcul", description: "Le programme de maths de chaque niveau, expliqué simplement, avec un exercice à essayer.", url: `${BASE}/programmes` },
};

export default function ProgrammesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
