import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description: "Politique de confidentialité d'Educalcul : données collectées, finalités, durées de conservation et droits RGPD.",
  alternates: { canonical: `${BASE}/politique-confidentialite` },
  ...socialMeta({ title: "Politique de confidentialité Educalcul", description: "Comment Educalcul protège les données personnelles de ses utilisateurs, conformément au RGPD.", path: "/politique-confidentialite" }),
};

export default function PolitiqueConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
