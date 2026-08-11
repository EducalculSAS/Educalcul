import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/impersonationCookie";

/** Lu par ImpersonationBanner sur chaque page pour savoir s'il faut
 * s'afficher — le cookie httpOnly n'étant pas lisible en JS, c'est cette
 * route qui traduit sa présence en état affichable. */
export async function GET() {
  try {
    const store = await cookies();
    const id = store.get(IMPERSONATION_COOKIE_NAME)?.value;
    if (!id) return Response.json({ active: false });

    const { data } = await supabaseAdmin
      .from("impersonation_sessions")
      .select("target_id, target_name, return_to")
      .eq("id", id)
      .maybeSingle();

    if (!data) return Response.json({ active: false });

    return Response.json({
      active: true,
      targetId: data.target_id,
      targetName: data.target_name,
      returnTo: data.return_to,
    });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
