import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { normalizePricingConfig } from "@/lib/pricingConfig";

// GET (admin) — config actuelle (identique à la version publique mais réservée
// à l'admin pour peupler le formulaire d'édition).
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
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
  const admin = await requireRole(req, ["admin"]);
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
  return NextResponse.json(clean);
}
