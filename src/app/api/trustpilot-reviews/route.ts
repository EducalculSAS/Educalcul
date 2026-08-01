import { NextResponse } from "next/server";
import { fetchTrustpilotReviews } from "@/lib/trustpilot";

// On ne fige plus la réponse 6h au niveau du route handler : sinon un échec
// transitoire de l'API (ou une clé momentanément absente) masque les avis
// pendant 6h. On contrôle nous-mêmes la mise en cache de l'appel amont, et on
// ne met en cache QUE les réponses réussies (voir fetchTrustpilotReviews).
export const dynamic = "force-dynamic";

export async function GET() {
  const reviews = await fetchTrustpilotReviews();
  return NextResponse.json({ reviews });
}
