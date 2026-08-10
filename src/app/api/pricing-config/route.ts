import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { normalizePricingConfig, DEFAULT_PRICING_CONFIG } from "@/lib/pricingConfig";

// Lecture publique de la config d'affichage des tarifs (libellés + forfait
// sur-mesure). Toujours normalisée → l'appelant reçoit une config complète même
// si la ligne DB est absente.
export const revalidate = 3600;

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "pricing_config")
      .maybeSingle();

    const config = data?.value ? normalizePricingConfig(data.value) : DEFAULT_PRICING_CONFIG;
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(DEFAULT_PRICING_CONFIG);
  }
}
