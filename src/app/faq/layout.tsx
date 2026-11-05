import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

export const metadata: Metadata = {
  title: { absolute: "Questions fréquentes sur Educalcul" },
  description: "Toutes les réponses à vos questions sur Educalcul : fonctionnement, niveaux, abonnements, IA pédagogique et programme officiel du CP à la Terminale.",
  alternates: { canonical: "https://educalcul.com/faq" },
  ...socialMeta({ title: "FAQ Educalcul : Questions fréquentes", description: "Trouvez toutes les réponses sur la plateforme de maths Educalcul.", path: "/faq" }),
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
