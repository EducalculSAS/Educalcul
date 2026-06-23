import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// Protégé par le proxy /api/admin/* (rôle admin requis).

// PATCH — éditer le nom affiché et/ou ajuster le nombre de filleuls.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — retirer une inscription de la waitlist.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pid = Number(id);
    if (!Number.isInteger(pid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { error } = await supabaseAdmin.from("waitlist_signups").delete().eq("id", pid);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
