import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";

const BASE = "https://educalcul.com";

const programsSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Programmes officiels de mathématiques",
  description: "Tous les programmes officiels de mathématiques de l'Éducation Nationale, du CP à la Terminale.",
  url: `${BASE}/programmes`,
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: "Programmes officiels", item: `${BASE}/programmes` },
  ],
};

export const metadata: Metadata = {
  title: "Programmes officiels de maths — CP à Terminale",
  description: "Tous les programmes officiels de mathématiques de l'Éducation Nationale, du CP à la Terminale. Toutes filières lycée incluses. Référencés sur Éduscol.",
  keywords: ["programme maths CP", "programme maths collège", "programme maths lycée", "programme officiel mathématiques", "programme Éducation Nationale maths", "Éduscol mathématiques"],
  alternates: { canonical: `${BASE}/programmes` },
  openGraph: { title: "Programmes officiels maths — Educalcul", description: "Programmes de maths du CP à la Terminale, alignés sur le référentiel de l'Éducation Nationale.", url: `${BASE}/programmes` },
};

export default function ProgrammesLayout({ children }: { children: React.ReactNode }) {
  return (<><JsonLd data={programsSchema} /><JsonLd data={breadcrumb} />{children}</>);
}
