import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

export const metadata: Metadata = {
  title: { absolute: "Cours, exercices et tuteur IA de maths | Educalcul" },
  description: "Explorez toutes les fonctionnalités d'Educalcul : cours alignés sur le programme, exercices corrigés, tuteur IA Calia, trophées et suivi pour les parents.",
  alternates: { canonical: "https://educalcul.com/offres" },
  ...socialMeta({ title: "Offres Educalcul : Ce que la plateforme vous apporte", description: "Cours, exercices corrigés, tuteur IA et suivi pour les parents, du CP à la Terminale.", path: "/offres" }),
};

export default function OffresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
