import { MetadataRoute } from "next";

const BASE = "https://educalcul.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: BASE,                              lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/auth/inscription`,        lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE}/offres`,                  lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/tarifs`,                  lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/programmes`,              lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/faq`,                     lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${BASE}/contact`,                 lastModified: now, changeFrequency: "yearly",  priority: 0.55 },
    { url: `${BASE}/auth/connexion`,          lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/mentions-legales`,        lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/politique-confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cgu`,                     lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];
}
