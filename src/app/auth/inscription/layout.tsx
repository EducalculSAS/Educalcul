import type { Metadata } from "next";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Inscription : Essai gratuit 7 jours",
  description: "Créez votre compte Educalcul gratuitement et démarrez l'essai de 7 jours, sans carte bancaire requise.",
  alternates: { canonical: `${BASE}/auth/inscription` },
  openGraph: {
    title: "Inscription Educalcul : Essai gratuit 7 jours",
    description: "Créez votre compte et démarrez gratuitement, sans carte bancaire.",
    url: `${BASE}/auth/inscription`,
  },
};

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
