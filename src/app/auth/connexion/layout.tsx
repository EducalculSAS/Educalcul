import type { Metadata } from "next";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte Educalcul pour accéder à vos cours, exercices et suivi de progression.",
  alternates: { canonical: `${BASE}/auth/connexion` },
  robots: { index: false, follow: true },
};

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
