import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

// Ne passe pas par getAuthenticatedUser (pas besoin d'une session 2FA valide
// pour simplement consulter/révoquer ses propres sessions).
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data: sessions } = await supabaseAdmin
      .from("two_factor_sessions")
      .select("id, created_at, expires_at, user_agent")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    return NextResponse.json({ sessions: sessions || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("two_factor_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // ne peut révoquer que ses propres sessions

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
