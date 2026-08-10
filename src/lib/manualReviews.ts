import { supabaseAdmin } from "@/lib/supabaseClient";

export interface ReviewCardData {
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

export interface ManualReview {
  id: string;
  name: string;
  title: string | null;
  review_text: string;
  rating: number;
  is_verified: boolean;
  country: string | null;
  published_at: string | null;
  total_reviews: number;
  display_order: number;
}

export async function fetchManualReviews(): Promise<ManualReview[]> {
  const { data, error } = await supabaseAdmin
    .from("manual_reviews")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchReviewsForHomepage(): Promise<ReviewCardData[]> {
  const reviews = await fetchManualReviews();
  return reviews.map((r) => ({
    id: r.id,
    title: r.title || "",
    text: r.review_text,
    rating: r.rating,
    is_verified: r.is_verified,
    published_at: r.published_at || "",
    name: r.name,
    country: r.country || "",
    total_reviews: r.total_reviews,
  }));
}
