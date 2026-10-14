import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .select("*")
    .order("level");
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Upload d'un PDF de programme : le fichier arrive en multipart, l'upload vers
 * le bucket Storage `programmes` + l'insert se font ici (service_role). Avant,
 * le navigateur poussait directement dans le bucket via le client anon. */
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const level = String(form.get("level") || "");
    const level_label = String(form.get("level_label") || "");

    if (!level) return NextResponse.json({ error: "level requis" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 415 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF trop volumineux (max 25 Mo)" }, { status: 413 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${level}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("programmes")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (upErr) return NextResponse.json({ error: sanitizeErrorMessage(upErr.message) }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from("programmes").getPublicUrl(path);

    const { data, error } = await supabaseAdmin
      .from("programme_pdfs")
      .upsert(
        { level, level_label, file_url: pub.publicUrl, file_name: file.name },
        { onConflict: "level" },
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur upload") }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, level_label, file_name } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .update({ level_label, file_name })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { level } = await req.json();
  const { error } = await supabaseAdmin.from("programme_pdfs").delete().eq("level", level);
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ success: true });
}
