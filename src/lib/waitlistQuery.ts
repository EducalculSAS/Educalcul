import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";

export async function fetchWaitlistSignups() {
  // Paginé : la liste d'attente dépasse 1000 inscrits (au-delà, les suivants
  // n'apparaissaient pas et les positions/statistiques étaient fausses).
  const rows = await selectAllPages<{
    id: number; email: string; display_name: string | null; referral_code: string; referred_by: string | null;
    referral_count: number; signup_ip: string | null; created_at: string;
  }>((from, to) =>
    supabaseAdmin
      .from("waitlist_signups")
      .select("id, email, display_name, referral_code, referred_by, referral_count, signup_ip, created_at")
      .order("id", { ascending: true })
      .range(from, to),
  );
  const entries = rows.map((r, i) => ({ ...r, position: i + 1 }));
  const totalReferrals = rows.reduce((s, r) => s + (r.referral_count || 0), 0);
  const topReferrer = rows.reduce(
    (best, r) => ((r.referral_count || 0) > (best?.referral_count || 0) ? r : best),
    null as (typeof rows)[number] | null
  );

  return {
    entries,
    stats: {
      total: rows.length,
      totalReferrals,
      topReferrer: topReferrer
        ? { name: topReferrer.display_name, count: topReferrer.referral_count }
        : null,
    },
  };
}
