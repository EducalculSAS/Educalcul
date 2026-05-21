/**
 * Récupère la localisation via les headers Vercel (côté serveur).
 * Silencieux — aucun popup de permission, aucun service tiers.
 * Retourne null en développement local (headers absents).
 */
export async function getServerGeo(): Promise<{
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
} | null> {
  try {
    const res = await fetch("/api/geo", { cache: "no-store" });
    const data = await res.json();
    if (!data.available) return null;
    return {
      latitude:  data.latitude,
      longitude: data.longitude,
      city:      data.city,
      country:   data.country,
    };
  } catch {
    return null;
  }
}
