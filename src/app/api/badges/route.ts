import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { badgeTiers } from "@/lib/badgeTiers";

/** Métadonnées d'affichage d'un ou plusieurs badges : de quoi dessiner le même emblème que sur la page des trophées
 * (icône, catégorie et rang dans la catégorie, qui donne le métal). Référentiel public — lu par BadgeMinis. */
export async function GET(req: Request) {
  try {
    const idsParam = new URL(req.url).searchParams.get("ids") || "";
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) return NextResponse.json([]);

    // Le rang se calcule sur toute la catégorie : on lit le référentiel entier (quelques dizaines de lignes).
    const { data, error } = await supabaseAdmin
      .from("badges")
      .select("id, name, icon, requirement_type, requirement_value")
      .eq("is_active", true);
    if (error) throw error;
    const tiers = badgeTiers(data ?? []);
    const wanted = new Set(ids.slice(0, 100));
    const badges = (data ?? [])
      .filter((b) => wanted.has(b.id))
      .map((b) => ({ id: b.id, name: b.name, icon: b.icon, requirement_type: b.requirement_type, tier: tiers[b.id] ?? 0 }));

    return NextResponse.json(badges, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
