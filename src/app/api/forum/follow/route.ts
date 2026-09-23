import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { loadVisiblePost, parseId } from "@/lib/forum";

/** Suivre / ne plus suivre un sujet (notification à chaque nouvelle réponse). */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const cfg = RATE_LIMITS["forum:like"];
    const rl = await rateLimitWithBackoff(`forum:follow:${me.id}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Doucement !" }, { status: 429 });

    const postId = parseId((await req.json().catch(() => ({}))).postId);
    if (!postId || !(await loadVisiblePost(me, postId))) {
      return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });
    }

    const { data: removed, error } = await supabaseAdmin
      .from("forum_follows")
      .delete()
      .eq("user_id", me.id)
      .eq("post_id", postId)
      .select("post_id");
    if (error) throw error;
    if (removed?.length) return NextResponse.json({ following: false });

    const { error: insError } = await supabaseAdmin.from("forum_follows").insert({ user_id: me.id, post_id: postId });
    if (insError && insError.code !== "23505") throw insError;
    return NextResponse.json({ following: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
