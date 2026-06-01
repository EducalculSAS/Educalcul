import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ count: totalUsers }, { data: recentAvatars }] = await Promise.all([
      supabaseAdmin.from("users").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("users")
        .select("id, first_name, avatar")
        .not("avatar", "is", null)
        .neq("avatar", "")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return NextResponse.json({
      total: totalUsers ?? 0,
      avatars: (recentAvatars ?? []).map((u) => ({
        id: u.id,
        initial: (u.first_name as string)?.[0]?.toUpperCase() ?? "?",
        avatar: u.avatar as string | null,
      })),
    });
  } catch {
    return NextResponse.json({ total: 0, avatars: [] });
  }
}
