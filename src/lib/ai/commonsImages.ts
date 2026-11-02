// Recherche d'images sous licence libre via l'API publique de Wikimedia
// Commons — aucune clé requise, et toute image hébergée là-bas est par
// politique de la plateforme sous licence libre ou dans le domaine public
// (Creative Commons, CC0...), donc utilisable sans risque de droit d'auteur.
import type { Loose } from "@/types/loose";
const USER_AGENT = "Educalcul/1.0 (https://educalcul.com; contact via site)";

export type CommonsImage = {
  url: string;
  attribution: string;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

export async function searchCommonsImage(query: string): Promise<CommonsImage | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery,
    )}&srnamespace=6&format=json&srlimit=6`;
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results: Array<{ title: string }> = searchData?.query?.search || [];
    const candidate = results.find((r) => /\.(jpe?g|png|webp)$/i.test(r.title));
    if (!candidate) return null;

    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      candidate.title,
    )}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json`;
    const infoRes = await fetch(infoUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const pages = infoData?.query?.pages || {};
    const page = Object.values(pages)[0] as
      | { imageinfo?: Array<Record<string, Loose>> }
      | undefined;
    const info = page?.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (!url) return null;

    const license = stripHtml(info?.extmetadata?.LicenseShortName?.value || "");
    const artist = stripHtml(info?.extmetadata?.Artist?.value || "");
    const attribution = [artist, license ? `(${license}, Wikimedia Commons)` : "(Wikimedia Commons)"]
      .filter(Boolean)
      .join(" ");

    return { url, attribution };
  } catch {
    return null;
  }
}
