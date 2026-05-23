import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET — liste les notifications de l'utilisateur connecté
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return NextResponse.json([], { status: 401 });
  const token = authHeader.slice(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json([], { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data || []);
}

// PATCH — marquer comme lues
export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const token = authHeader.slice(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Session invalide" }, { status: 401 });

  const { ids } = await req.json(); // ids = null → marque tout

  let query = supabaseAdmin
    .from("user_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id);

  if (ids?.length) query = query.in("id", ids);

  await query;
  return NextResponse.json({ success: true });
}
