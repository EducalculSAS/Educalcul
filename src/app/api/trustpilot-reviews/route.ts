import { NextResponse } from "next/server";

export const revalidate = 21600; // cache 6h

interface TrustpilotReview {
  review_id: string;
  title: string;
  text: string;
  rating: number;
  is_verified: boolean;
  published_at_date: string;
  reviewer: {
    name: string;
    country_code: string;
    total_reviews: number;
  };
}

interface TrustpilotApiResponse {
  reviews: TrustpilotReview[];
}

export async function GET() {
  const apiKey = process.env.TRUSTPILOT_SCRAPER_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    return NextResponse.json({ reviews: [] }, { status: 200 });
  }

  try {
    const res = await fetch(
      "https://trustpilot-scraper-api.omkar.cloud/trustpilot/companies/reviews?domain=educalcul.com&rating_is=4,5&locale=fr-FR&sort_by=most_recent&page=1",
      {
        headers: { "API-Key": apiKey },
        next: { revalidate: 21600 },
      }
    );

    if (!res.ok) {
      console.error("[trustpilot-reviews] API error:", res.status);
      return NextResponse.json({ reviews: [] }, { status: 200 });
    }

    const data: TrustpilotApiResponse = await res.json();
    const reviews = (data.reviews ?? []).slice(0, 8).map((r) => ({
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

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[trustpilot-reviews] fetch error:", err);
    return NextResponse.json({ reviews: [] }, { status: 200 });
  }
}
