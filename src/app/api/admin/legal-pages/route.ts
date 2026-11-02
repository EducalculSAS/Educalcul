import { readJsonBody } from "@/lib/apiJson";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

export async function GET(req: Request) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("legal_pages")
    .select("*")
    .order("slug");
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function PUT(req: Request) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonBody(req);
  const { slug, title, subtitle, sections } = body;

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("legal_pages")
    .update({ title, subtitle, sections, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  // La page publique est servie depuis le HTML généré (régénéré toutes les 24 h) : on la régénère tout de suite.
  revalidatePath(`/${slug}`);
  return NextResponse.json(data);
}
