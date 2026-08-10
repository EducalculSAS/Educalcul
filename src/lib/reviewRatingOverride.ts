import { supabaseAdmin } from "@/lib/supabaseClient";

export interface ReviewRatingOverride {
  enabled: boolean;
  rating: number;
  count: number;
}

const DEFAULT_OVERRIDE: ReviewRatingOverride = { enabled: false, rating: 5, count: 0 };
const SETTINGS_KEY = "review_rating_override";

function normalize(raw: unknown): ReviewRatingOverride {
  if (!raw || typeof raw !== "object") return DEFAULT_OVERRIDE;
  const r = raw as Record<string, unknown>;
  const rating = Number(r.rating);
  const count = Number(r.count);
  return {
    enabled: r.enabled === true,
    rating: Number.isFinite(rating) ? Math.min(5, Math.max(0, Math.round(rating * 10) / 10)) : DEFAULT_OVERRIDE.rating,
    count: Number.isFinite(count) && count >= 0 ? Math.trunc(count) : DEFAULT_OVERRIDE.count,
  };
}

export async function fetchReviewRatingOverride(): Promise<ReviewRatingOverride> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return normalize(data?.value);
}

export async function saveReviewRatingOverride(raw: unknown): Promise<ReviewRatingOverride> {
  const clean = normalize(raw);
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return clean;
}
