import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions générales d'utilisation de la plateforme Educalcul : compte, abonnements, contenu pédagogique et droits des utilisateurs.",
  alternates: { canonical: `${BASE}/cgu` },
  ...socialMeta({ title: "CGU Educalcul", description: "Conditions générales d'utilisation de la plateforme Educalcul.", path: "/cgu" }),
};

export default function CguLayout({ children }: { children: React.ReactNode }) {
  return children;
}
