import { NextResponse } from "next/server";

// On ne fige plus la réponse 6h au niveau du route handler : sinon un échec
// transitoire de l'API (ou une clé momentanément absente) masque les avis
// pendant 6h. On contrôle nous-mêmes la mise en cache de l'appel amont, et on
// ne met en cache QUE les réponses réussies.
export const dynamic = "force-dynamic";

interface TrustpilotReview {
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

export async function GET() {
  const apiKey = process.env.TRUSTPILOT_SCRAPER_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    return NextResponse.json({ reviews: [], _debug: "missing_api_key" }, { status: 200 });
  }

  try {
    // On ne filtre plus la note via l'URL (le paramètre rating_is de l'API
    // scraper est capricieux et renvoyait parfois 0 résultat) : on récupère les
    // avis les plus récents et on filtre la note côté serveur.
    const res = await fetch(
      "https://trustpilot-scraper-api.omkar.cloud/trustpilot/companies/reviews?domain=educalcul.com&locale=fr-FR&sort_by=most_recent&page=1",
      {
        headers: { "API-Key": apiKey },
        // Cache 6h uniquement en cas de succès (voir gestion ci-dessous via revalidate).
        next: { revalidate: 21600 },
      }
    );

    if (!res.ok) {
      console.error("[trustpilot-reviews] API error:", res.status);
      return NextResponse.json(
        { reviews: [], _debug: `api_status_${res.status}` },
        { status: 200 }
      );
    }

    const data: unknown = await res.json();
    // Parsing défensif : l'API peut renvoyer { reviews: [...] } ou directement
    // un tableau selon les versions.
    const rawReviews: TrustpilotReview[] = Array.isArray(data)
      ? (data as TrustpilotReview[])
      : Array.isArray((data as { reviews?: TrustpilotReview[] })?.reviews)
        ? (data as { reviews: TrustpilotReview[] }).reviews
        : [];

    const reviews = rawReviews
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

    return NextResponse.json({
      reviews,
      _debug: { fetched: rawReviews.length, after_filter: reviews.length },
    });
  } catch (err) {
    console.error("[trustpilot-reviews] fetch error:", err);
    return NextResponse.json({ reviews: [], _debug: "fetch_exception" }, { status: 200 });
  }
}
