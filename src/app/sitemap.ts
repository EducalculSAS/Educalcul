import { MetadataRoute } from "next";
import { LEVEL_PAGES, LEVEL_PAGES_UPDATED } from "@/lib/seo/levels";

const BASE = "https://educalcul.com";

/**
 * Uniquement des pages publiques qui répondent 200. `lastModified` = date de la dernière vraie modification de la
 * page (à mettre à jour quand on la change) ; les pages légales, dont le texte vient de la base, n'en ont pas.
 */
const PAGES: { path: string; updated?: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "", updated: "2026-11-04", changeFrequency: "weekly", priority: 1.0 },
  { path: "/offres", updated: "2026-11-04", changeFrequency: "monthly", priority: 0.9 },
  { path: "/tarifs", updated: "2026-11-04", changeFrequency: "monthly", priority: 0.9 },
  { path: "/programmes", updated: LEVEL_PAGES_UPDATED, changeFrequency: "monthly", priority: 0.9 },
  { path: "/calia-tuteur-ia-maths", updated: "2026-11-04", changeFrequency: "monthly", priority: 0.8 },
  { path: "/auth/inscription", updated: "2026-11-04", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", updated: "2026-11-04", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", updated: "2026-11-04", changeFrequency: "yearly", priority: 0.5 },
  { path: "/auth/connexion", updated: "2026-11-02", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.2 },
  { path: "/politique-confidentialite", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cgu", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cgv", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((p) => ({
      url: `${BASE}${p.path}`,
      ...(p.updated ? { lastModified: new Date(`${p.updated}T00:00:00Z`) } : {}),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...LEVEL_PAGES.map((l) => ({
      url: `${BASE}/programmes/${l.slug}`,
      lastModified: new Date(`${LEVEL_PAGES_UPDATED}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
