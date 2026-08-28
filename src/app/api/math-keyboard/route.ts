import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

const DEFAULT_LEVEL = "6eme";

/** Config du clavier mathématique virtuel pour un niveau scolaire (repli sur
 * le niveau par défaut si non configuré). Lu par MathInput — avant, requête
 * `math_keyboards` directe depuis le navigateur. Cache HTTP court : c'est du
 * contenu de référence qui change rarement. */
export async function GET(req: Request) {
  try {
    const level = new URL(req.url).searchParams.get("level") || DEFAULT_LEVEL;

    let { data } = await supabaseAdmin
      .from("math_keyboards")
      .select("config")
      .eq("level", level)
      .maybeSingle();

    if (!data?.config && level !== DEFAULT_LEVEL) {
      ({ data } = await supabaseAdmin
        .from("math_keyboards")
        .select("config")
        .eq("level", DEFAULT_LEVEL)
        .maybeSingle());
    }

    return NextResponse.json(
      { config: data?.config ?? null },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
