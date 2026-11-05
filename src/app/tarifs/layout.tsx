import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";

const BASE = "https://educalcul.com";

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: "Tarifs", item: `${BASE}/tarifs` },
  ],
};

export const metadata: Metadata = {
  title: { absolute: "Tarifs Educalcul : cours de maths et IA pédagogique" },
  keywords: ["tarif cours maths", "abonnement mathématiques enfant", "prix plateforme maths", "essai gratuit maths", "soutien scolaire prix"],
  alternates: { canonical: `${BASE}/tarifs` },
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return (<><JsonLd data={breadcrumb} />{children}</>);
}
