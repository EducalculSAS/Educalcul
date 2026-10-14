import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { parseCategoryBody, parseId } from "@/lib/forum";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

    const { error } = await supabaseAdmin.from("forum_categories").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

    // Avant, les champs absents du corps étaient écrits à null.
    const parsed = parseCategoryBody(await req.json().catch(() => ({})));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (Object.keys(parsed.patch).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .update(parsed.patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
