import { NextResponse } from "next/server";
import { getDisabledFeatures } from "@/lib/featureFlags";

/** Fonctionnalités coupées (clés seulement) : sert à masquer les liens et
 * boutons correspondants, et à recharger les pages « indisponible » dès la
 * réactivation. Public : aucune donnée personnelle. */
export async function GET() {
  const disabled = await getDisabledFeatures();
  return NextResponse.json(
    { disabled: [...disabled.keys()] },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=60" } },
  );
}
