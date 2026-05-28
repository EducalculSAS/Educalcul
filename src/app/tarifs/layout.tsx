import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs — Essai gratuit 7 jours | Educalcul",
  description: "Découvrez nos offres : formule Gratuite, Famille et Premium. Essai sans engagement, sans carte bancaire. Accès complet du CP à la Terminale.",
  openGraph: {
    title: "Tarifs Educalcul — Essai gratuit 7 jours",
    description: "Comparez nos formules et commencez gratuitement. Aucune carte bancaire requise.",
    url: "https://educalcul.com/tarifs",
  },
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
