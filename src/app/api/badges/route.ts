import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/** Métadonnées d'affichage d'un ou plusieurs badges (id, name, icon, color).
 * Référentiel public — lu par BadgeMinis. Avant : `supabase.from("badges")`
 * direct depuis le navigateur. */
export async function GET(req: Request) {
  try {
    const idsParam = new URL(req.url).searchParams.get("ids") || "";
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) return NextResponse.json([]);

    const { data, error } = await supabaseAdmin
      .from("badges")
      .select("id, name, icon, color")
      .in("id", ids.slice(0, 100));
    if (error) throw error;

    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
