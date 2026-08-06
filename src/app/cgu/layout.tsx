import type { Metadata } from "next";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions générales d'utilisation de la plateforme Educalcul : compte, abonnements, contenu pédagogique et droits des utilisateurs.",
  alternates: { canonical: `${BASE}/cgu` },
  openGraph: {
    title: "CGU Educalcul",
    description: "Conditions générales d'utilisation de la plateforme Educalcul.",
    url: `${BASE}/cgu`,
  },
};

export default function CguLayout({ children }: { children: React.ReactNode }) {
  return children;
}
