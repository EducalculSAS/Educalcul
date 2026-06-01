import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";

const BASE = "https://educalcul.com";

const programsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Programmes officiels de mathématiques",
  description: "Tous les programmes officiels de mathématiques de l'Éducation Nationale, du CP à la Terminale.",
  url: `${BASE}/programmes`,
  numberOfItems: 26,
  itemListElement: [
    { "@type": "ListItem", position: 1,  name: "Programme maths CP",               url: `${BASE}/programmes/cp` },
    { "@type": "ListItem", position: 2,  name: "Programme maths CE1",              url: `${BASE}/programmes/ce1` },
    { "@type": "ListItem", position: 3,  name: "Programme maths CE2",              url: `${BASE}/programmes/ce2` },
    { "@type": "ListItem", position: 4,  name: "Programme maths CM1",              url: `${BASE}/programmes/cm1` },
    { "@type": "ListItem", position: 5,  name: "Programme maths CM2",              url: `${BASE}/programmes/cm2` },
    { "@type": "ListItem", position: 6,  name: "Programme maths 6ème",             url: `${BASE}/programmes/6eme` },
    { "@type": "ListItem", position: 7,  name: "Programme maths 5ème",             url: `${BASE}/programmes/5eme` },
    { "@type": "ListItem", position: 8,  name: "Programme maths 4ème",             url: `${BASE}/programmes/4eme` },
    { "@type": "ListItem", position: 9,  name: "Programme maths 3ème",             url: `${BASE}/programmes/3eme` },
    { "@type": "ListItem", position: 10, name: "Programme maths Seconde",          url: `${BASE}/programmes/2nde` },
    { "@type": "ListItem", position: 11, name: "Programme maths Première Générale",url: `${BASE}/programmes/1ere-generale` },
    { "@type": "ListItem", position: 12, name: "Programme maths Spé Première",     url: `${BASE}/programmes/1ere-generale-maths` },
    { "@type": "ListItem", position: 13, name: "Programme maths Terminale Générale",url:`${BASE}/programmes/terminale-generale` },
    { "@type": "ListItem", position: 14, name: "Programme maths Spé Terminale",    url: `${BASE}/programmes/terminale-generale-maths` },
    { "@type": "ListItem", position: 15, name: "Programme Maths Expertes",         url: `${BASE}/programmes/terminale-generale-expertes` },
  ],
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
