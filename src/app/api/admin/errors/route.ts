import { readJsonBody } from "@/lib/apiJson";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

const COLUMNS = "id, source, message, stack, url, user_agent, user_id, count, first_seen, last_seen, resolved";

/** GET ?count=1 : nombre d'erreurs à traiter (pastille du menu). Sinon : les 200 plus récentes. */
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get("count")) {
    const { count } = await supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).eq("resolved", false);
    return NextResponse.json({ open: count ?? 0 });
  }
  const showResolved = url.searchParams.get("resolved") === "1";
  const { data, error } = await supabaseAdmin
    .from("error_logs")
    .select(COLUMNS)
    .eq("resolved", showResolved)
    .order("last_seen", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ errors: data ?? [] });
}

/** PATCH { id } ou { all: true } : marquer résolu. { id, resolved: false } : rouvrir. */
export async function PATCH(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonBody(req);
  const resolved = body.resolved !== false;
  let q = supabaseAdmin.from("error_logs").update({ resolved });
  if (body.all === true) q = q.eq("resolved", !resolved);
  else if (Number.isInteger(Number(body.id))) q = q.eq("id", Number(body.id));
  else return NextResponse.json({ error: "id manquant" }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
