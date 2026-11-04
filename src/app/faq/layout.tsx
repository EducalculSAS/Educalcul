import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Questions fréquentes sur Educalcul" },
  description: "Toutes les réponses à vos questions sur Educalcul : fonctionnement, niveaux, abonnements, IA pédagogique et programme officiel du CP à la Terminale.",
  alternates: { canonical: "https://educalcul.com/faq" },
  openGraph: {
    title: "FAQ Educalcul : Questions fréquentes",
    description: "Trouvez toutes les réponses sur la plateforme de maths Educalcul.",
    url: "https://educalcul.com/faq",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
