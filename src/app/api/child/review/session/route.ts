import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { buildReviewSession } from "@/lib/reviewSession";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Séance « à revoir » du jour : les questions ratées dont le tour est venu, sans leur réponse. */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "child") return NextResponse.json({ error: "Réservé aux élèves." }, { status: 403 });
    const { data: user } = await supabaseAdmin.from("users").select("grade_level").eq("id", me.id).maybeSingle();
    const session = await buildReviewSession(me, user?.grade_level ?? null, 8);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
