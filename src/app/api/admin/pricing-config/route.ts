import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { normalizePricingConfig } from "@/lib/pricingConfig";

// GET (admin) — config actuelle (identique à la version publique mais réservée
// à l'admin pour peupler le formulaire d'édition).
export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "pricing_config")
    .maybeSingle();

  return NextResponse.json(normalizePricingConfig(data?.value));
}

// PUT (admin) — enregistre la config. La valeur est TOUJOURS re-normalisée côté
// serveur : impossible d'injecter des champs arbitraires ou des prix invalides.
export async function PUT(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clean = normalizePricingConfig(body);

  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "pricing_config", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  // Les onglets de périodes de /tarifs viennent de cette config : on invalide la page publique tout de suite.
  revalidatePath("/tarifs");
  revalidatePath("/api/pricing-config");
  return NextResponse.json(clean);
}
