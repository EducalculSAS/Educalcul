import { MetadataRoute } from "next";

const BASE = "https://educalcul.com";

const LEVELS = [
  "cp","ce1","ce2","cm1","cm2",
  "6eme","5eme","4eme","3eme",
  "2nde",
  "1ere-generale","1ere-generale-maths","1ere-sti2d","1ere-stmg",
  "1ere-st2s","1ere-stl","1ere-std2a","1ere-sthr",
  "terminale-generale","terminale-generale-maths","terminale-generale-expertes",
  "terminale-generale-complementaires","terminale-sti2d","terminale-stmg",
  "terminale-st2s","terminale-stl",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
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

  // 26 programme level pages — high SEO value
  const levelRoutes: MetadataRoute.Sitemap = LEVELS.map(level => ({
    url: `${BASE}/programmes/${level}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticRoutes, ...levelRoutes];
}
