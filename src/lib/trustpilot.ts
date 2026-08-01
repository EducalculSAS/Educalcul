export interface TrustpilotReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  is_verified: boolean;
  published_at: string;
  name: string;
  country: string;
  total_reviews: number;
}

interface RawTrustpilotReview {
  review_id: string;
  title: string;
  text: string;
  rating: number;
  is_verified: boolean;
  published_at_date: string;
  reviewer?: {
    name?: string;
    country_code?: string;
    total_reviews?: number;
  };
}

// Note minimale affichée sur la landing (avis mis en avant).
const MIN_RATING = 4;

/**
 * Appel direct à l'API Trustpilot, partagé entre la route /api/trustpilot-reviews
 * (utilisée par d'éventuels appels client) et la page d'accueil (rendu serveur).
 * Le cache 6h porte sur l'appel amont (fetch Next), jamais sur un échec.
 */
export async function fetchTrustpilotReviews(): Promise<TrustpilotReview[]> {
  const apiKey = process.env.TRUSTPILOT_SCRAPER_API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") return [];

  try {
    const res = await fetch(
      "https://trustpilot-scraper-api.omkar.cloud/trustpilot/companies/reviews?domain=educalcul.com&locale=fr-FR&sort_by=most_recent&page=1",
      {
        headers: { "API-Key": apiKey },
        next: { revalidate: 21600 },
      }
    );
    if (!res.ok) {
      console.error("[trustpilot-reviews] API error:", res.status);
      return [];
    }

    const data: unknown = await res.json();
    const rawReviews: RawTrustpilotReview[] = Array.isArray(data)
      ? (data as RawTrustpilotReview[])
      : Array.isArray((data as { reviews?: RawTrustpilotReview[] })?.reviews)
        ? (data as { reviews: RawTrustpilotReview[] }).reviews
        : [];

    return rawReviews
      .filter((r) => Number(r.rating) >= MIN_RATING)
      .slice(0, 8)
      .map((r) => ({
        id: r.review_id,
        title: r.title,
        text: r.text,
        rating: r.rating,
        is_verified: r.is_verified,
        published_at: r.published_at_date,
        name: r.reviewer?.name ?? "Anonyme",
        country: r.reviewer?.country_code ?? "",
        total_reviews: r.reviewer?.total_reviews ?? 1,
      }));
  } catch (err) {
    console.error("[trustpilot-reviews] fetch error:", err);
    return [];
  }
}
