import type { Metadata } from "next";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Mentions Légales",
  description: "Mentions légales d'Educalcul : éditeur du site, hébergement, propriété intellectuelle et données personnelles.",
  alternates: { canonical: `${BASE}/mentions-legales` },
  openGraph: {
    title: "Mentions légales Educalcul",
    description: "Informations légales sur l'éditeur et l'hébergement de la plateforme Educalcul.",
    url: `${BASE}/mentions-legales`,
  },
};

export default function MentionsLegalesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
