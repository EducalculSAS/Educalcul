import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Mentions Légales",
  description: "Mentions légales d'Educalcul : éditeur du site, hébergement, propriété intellectuelle et données personnelles.",
  alternates: { canonical: `${BASE}/mentions-legales` },
  ...socialMeta({ title: "Mentions légales Educalcul", description: "Informations légales sur l'éditeur et l'hébergement de la plateforme Educalcul.", path: "/mentions-legales" }),
};

export default function MentionsLegalesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
