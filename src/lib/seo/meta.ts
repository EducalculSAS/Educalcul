import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo/site";

/** Image d'aperçu (réseaux sociaux, messageries, assistants IA) : fichier fixe de public/, 1200 × 630. */
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Educalcul : cours de maths, exercices et tuteur IA du CP à la Terminale" };

/**
 * Balises de partage d'une page (Open Graph + Twitter) : titre, description, adresse ET image. Une page qui définit son
 * propre `openGraph` remplace celui du site entier : sans cette fonction, elle perdait l'image d'aperçu et gardait le
 * titre d'accueil dans les balises Twitter.
 */
export function socialMeta({ title, description, path, type = "website" }: { title: string; description: string; path: string; type?: "website" | "article" }): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { title, description, url: `${SITE_URL}${path === "/" ? "" : path}`, siteName: "Educalcul", locale: "fr_FR", type, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}
