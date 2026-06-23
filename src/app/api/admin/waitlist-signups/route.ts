import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET — liste complète de la waitlist (table waitlist_signups) + stats.
// Protégé par le proxy /api/admin/* (rôle admin requis). Lecture en service-role
// car la RLS de waitlist_signups bloque anon/authenticated.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("waitlist_signups")
      .select("id, email, display_name, referral_code, referred_by, referral_count, signup_ip, created_at")
      .order("id", { ascending: true });

    if (error) throw error;

    const rows = data || [];
    const entries = rows.map((r, i) => ({ ...r, position: i + 1 }));
    const totalReferrals = rows.reduce((s, r) => s + (r.referral_count || 0), 0);
    const topReferrer = rows.reduce(
      (best, r) => ((r.referral_count || 0) > (best?.referral_count || 0) ? r : best),
      null as (typeof rows)[number] | null
    );

    return NextResponse.json({
      entries,
      stats: {
        total: rows.length,
        totalReferrals,
        topReferrer: topReferrer
          ? { name: topReferrer.display_name, count: topReferrer.referral_count }
          : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
