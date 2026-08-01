import { supabaseAdmin } from "@/lib/supabaseClient";

export async function fetchWaitlistSignups() {
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
