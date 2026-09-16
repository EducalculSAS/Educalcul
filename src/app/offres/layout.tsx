import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nos offres — Cours, Exercices & IA pédagogique",
  description: "Explorez toutes les fonctionnalités d'Educalcul : cours alignés sur le programme, exercices corrigés par IA, gamification et suivi parental en temps réel.",
  alternates: { canonical: "https://educalcul.com/offres" },
  openGraph: {
    title: "Offres Educalcul — Ce que la plateforme vous apporte",
    description: "Cours, exercices, IA pédagogique, gamification et suivi parental pour le CP à la Terminale.",
    url: "https://educalcul.com/offres",
  },
};

export default function OffresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
