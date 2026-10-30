import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { normalizeSubjectAreas, SUBJECT_AREAS_KEY } from "@/lib/subjectAreas";

// GET (admin) : liste des domaines (défauts si rien d'enregistré).
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", SUBJECT_AREAS_KEY).maybeSingle();
  return NextResponse.json({ areas: normalizeSubjectAreas(data?.value) });
}

// PUT (admin) : enregistre la liste. Toujours re-normalisée côté serveur.
export async function PUT(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const areas = normalizeSubjectAreas((body as { areas?: unknown } | null)?.areas);

  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: SUBJECT_AREAS_KEY, value: areas, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ areas });
}
