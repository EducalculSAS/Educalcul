import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    // L'identité provient TOUJOURS du JWT vérifié, jamais du corps de la requête.
    // Sans cela, n'importe qui pouvait gonfler `current_uses` (épuiser des codes)
    // et accorder des réductions à un parrain arbitraire.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Params manquants" }, { status: 400 });
    }

    // Resolve referral code, and check idempotence (un utilisateur ne peut
    // utiliser un code de parrainage qu'une fois) in parallel — the two
    // queries are independent of each other.
    const [{ data: refCode, error: refErr }, { data: alreadyUsed }] = await Promise.all([
      supabaseAdmin
        .from("referral_codes")
        .select("id, code, owner_user_id, is_active, valid_until, max_uses, current_uses")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .single(),
      supabaseAdmin
        .from("referral_uses")
        .select("id")
        .eq("used_by_user_id", me.id)
        .maybeSingle(),
    ]);

    if (refErr || !refCode) return NextResponse.json({ error: "Code invalide" }, { status: 404 });

    // Check limits
    if (refCode.valid_until && new Date(refCode.valid_until) < new Date())
      return NextResponse.json({ error: "Code expiré" }, { status: 400 });
    if (refCode.max_uses !== null && refCode.current_uses >= refCode.max_uses)
      return NextResponse.json({ error: "Code épuisé" }, { status: 400 });

    // On ne peut pas utiliser son propre code de parrainage.
    if (refCode.owner_user_id && refCode.owner_user_id === me.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas utiliser votre propre code" }, { status: 400 });
    }

    if (alreadyUsed) {
      return NextResponse.json({ error: "Vous avez déjà utilisé un code de parrainage" }, { status: 400 });
    }

    // Record use
    await supabaseAdmin.from("referral_uses").insert({
      referral_code_id: refCode.id,
      used_by_user_id: me.id,
    });

    // Increment current_uses
    await supabaseAdmin
      .from("referral_codes")
      .update({ current_uses: refCode.current_uses + 1 })
      .eq("id", refCode.id);

    // Reward the referrer: +10% on next subscription
    if (refCode.owner_user_id) {
      await supabaseAdmin
        .from("users")
        .update({ pending_discount_percent: 10 })
        .eq("id", refCode.owner_user_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
