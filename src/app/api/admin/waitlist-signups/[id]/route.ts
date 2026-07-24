import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

// Protégé par le proxy /api/admin/* (rôle admin requis).

// PATCH — éditer le nom affiché et/ou ajuster le nombre de filleuls.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pid = Number(id);
    if (!Number.isInteger(pid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const updates: Record<string, any> = {};
    if (typeof body.display_name === "string") updates.display_name = body.display_name.trim().slice(0, 60);
    if (body.referral_count !== undefined) {
      const n = Number(body.referral_count);
      if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Invalid referral_count" }, { status: 400 });
      updates.referral_count = n;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("waitlist_signups")
      .update(updates)
      .eq("id", pid)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

// DELETE — retirer une inscription de la waitlist.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(_req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pid = Number(id);
    if (!Number.isInteger(pid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { error } = await supabaseAdmin.from("waitlist_signups").delete().eq("id", pid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
