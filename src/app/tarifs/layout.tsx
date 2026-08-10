import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";

const BASE = "https://educalcul.com";

const offersSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Formules Educalcul",
  url: `${BASE}/tarifs`,
  itemListElement: [
    { "@type": "ListItem", position: 1, item: { "@type": "Offer", name: "Plan Gratuit", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${BASE}/auth/inscription`, seller: { "@type": "Organization", name: "Educalcul" } } },
    { "@type": "ListItem", position: 2, item: { "@type": "Offer", name: "Plan Solo", description: "Accès complet CP à Terminale, IA 10/j, rapports, avatars.", price: "9.99", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${BASE}/auth/inscription`, seller: { "@type": "Organization", name: "Educalcul" } } },
    { "@type": "ListItem", position: 3, item: { "@type": "Offer", name: "Plan Family", description: "Jusqu'à 6 enfants, IA 20/j, support prioritaire.", price: "16.99", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${BASE}/auth/inscription`, seller: { "@type": "Organization", name: "Educalcul" } } },
  ],
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: "Tarifs", item: `${BASE}/tarifs` },
  ],
};

export const metadata: Metadata = {
  title: "Tarifs — Essai gratuit 7 jours sans engagement",
  description: "Formules Educalcul : Gratuit, Premium (9,99€/mois) et Famille (19,99€/mois). Essai 7 jours sans engagement, sans carte bancaire. Accès complet CP à Terminale.",
  keywords: ["tarif cours maths", "abonnement mathématiques enfant", "prix plateforme maths", "essai gratuit maths", "soutien scolaire prix"],
  alternates: { canonical: `${BASE}/tarifs` },
  openGraph: { title: "Tarifs Educalcul — Essai gratuit 7 jours", description: "Comparez nos formules et commencez gratuitement. Aucune carte bancaire requise.", url: `${BASE}/tarifs` },
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return (<><JsonLd data={offersSchema} /><JsonLd data={breadcrumb} />{children}</>);
}
