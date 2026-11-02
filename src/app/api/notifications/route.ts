import { readJsonBody } from "@/lib/apiJson";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

// GET — liste les notifications de l'utilisateur connecté
export async function GET(req: NextRequest) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json([], { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_notifications")
    .select("*")
    .eq("user_id", me.authId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data || []);
}

// PATCH — marquer comme lues
export async function PATCH(req: NextRequest) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { ids } = await readJsonBody(req); // ids = null → marque tout

  let query = supabaseAdmin
    .from("user_notifications")
    .update({ is_read: true })
    .eq("user_id", me.authId);

  if (ids?.length) query = query.in("id", ids);

  await query;
  return NextResponse.json({ success: true });
}
