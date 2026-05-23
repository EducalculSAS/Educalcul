import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://educalcul.fr";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/offres`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tarifs`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/auth/inscription`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/auth/connexion`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/mentions-legales`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/politique-confidentialite`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cgu`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
