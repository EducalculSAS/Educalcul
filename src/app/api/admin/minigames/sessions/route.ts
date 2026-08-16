import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";

const PAGE_SIZE = 30;

export const dynamic = "force-dynamic";

/** Vue admin de toutes les parties jouées (Mathador et Calcul mental) — pour
 * voir ce que jouent réellement les enfants et pouvoir modérer/gérer, pas
 * seulement les fiches générées par IA. */
export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const gameType = url.searchParams.get("gameType") || "mathador";
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const { data: sessions, error, count } = await supabaseAdmin
    .from("minigame_sessions")
    .select("id, user_id, game_type, grade_level, content_json, answer_json, score, max_score, duration_seconds, status, created_at, completed_at", { count: "exact" })
    .eq("game_type", gameType)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  const userIds = [...new Set((sessions || []).map((s) => s.user_id))];
  const { data: users } = userIds.length
    ? await supabaseAdmin.from("users").select("id, first_name, last_name, child_username").in("id", userIds)
    : { data: [] };
  const usersById = new Map((users || []).map((u) => [u.id, u]));

  const enriched = (sessions || []).map((s) => {
    const u = usersById.get(s.user_id);
    return {
      ...s,
      childName: u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.child_username || `#${s.user_id}` : `#${s.user_id}`,
    };
  });

  return Response.json({ sessions: enriched, total: count || 0, offset, pageSize: PAGE_SIZE });
}
