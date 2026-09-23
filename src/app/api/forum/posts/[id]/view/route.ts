import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { loadVisiblePost, parseId } from "@/lib/forum";

/** Compte une vue : au plus une par personne et par sujet toutes les 6 h. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const id = parseId((await params).id);
  if (!id || !(await loadVisiblePost(me, id))) return NextResponse.json({ counted: false });

  const cfg = RATE_LIMITS["forum:view"];
  const rl = await rateLimitWithBackoff(`forum:view:${me.id}:${id}`, cfg.maxAttempts, cfg.windowMs);
  if (!rl.allowed) return NextResponse.json({ counted: false });

  await supabaseAdmin.rpc("forum_increment_view", { p_post_id: id });
  return NextResponse.json({ counted: true });
}
