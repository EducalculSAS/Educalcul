import { fetchManualReviews } from "@/lib/manualReviews";
import { fetchReviewRatingOverride } from "@/lib/reviewRatingOverride";
import AdminReviewsClient from "@/components/admin/AdminReviewsClient";

export default async function AdminReviewsPage() {
  const [reviews, ratingOverride] = await Promise.all([
    fetchManualReviews(),
    fetchReviewRatingOverride(),
  ]);
  return <AdminReviewsClient initialReviews={reviews} initialRatingOverride={ratingOverride} />;
}
