import { supabaseAdmin } from "@/lib/supabaseClient";

// Copie locale des paliers de educalcul-waitlist/src/lib/rewards.ts — pas
// d'import cross-repo (deux déploiements Vercel distincts). Garder ces deux
// fichiers synchronisés si les paliers changent d'un côté.
const REWARD_TIERS = [
  { refs: 0, weeks: 1 },
  { refs: 1, weeks: 2 },
  { refs: 3, weeks: 4 },
  { refs: 5, weeks: 6 },
  { refs: 10, weeks: 12 },
  { refs: 25, weeks: 26 },
  { refs: 50, weeks: 52 },
];

function freeWeeksFor(refs: number): number {
  let weeks = REWARD_TIERS[0].weeks;
  for (const t of REWARD_TIERS) {
    if (refs >= t.refs) weeks = t.weeks;
  }
  return weeks;
}

const EARLY_PERKS = [
  { maxPosition: 50, bonusWeeks: 4 },
  { maxPosition: 200, bonusWeeks: 2 },
  { maxPosition: 1000, bonusWeeks: 0 },
];

function earlyBonusWeeksFor(position: number): number {
  for (const p of EARLY_PERKS) {
    if (position <= p.maxPosition) return p.bonusWeeks;
  }
  return 0;
}

/**
 * Convertit le parrainage waitlist d'un compte en jours d'essai Stripe, à
 * n'appeler qu'au moment d'un vrai checkout (create-checkout-session) — pas
 * avant. Ne compte que les filleuls dont le compte a REELLEMENT paye au
 * moins une fois (`subscriptions.has_paid = true`, pose par le webhook au
 * premier invoice.payment_succeeded a montant non nul) : un filleul qui
 * demarre un essai gratuit et annule avant d'avoir jamais paye ne rapporte
 * rien au parrain (anti-abus). Retourne 0 si ce compte n'est pas issu de la
 * liste d'attente.
 */
export async function computeWaitlistFreeTrialDays(authId: string): Promise<number> {
  const { data: me } = await supabaseAdmin
    .from("waitlist_signups")
    .select("id, referral_code")
    .eq("auth_id", authId)
    .maybeSingle();
  if (!me) return 0;

  const { data: referred } = await supabaseAdmin
    .from("waitlist_signups")
    .select("auth_id")
    .eq("referred_by", me.referral_code);

  let confirmed = 0;
  for (const r of referred ?? []) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", r.auth_id)
      .eq("has_paid", true)
      .maybeSingle();
    if (sub) confirmed++;
  }

  const { count: position } = await supabaseAdmin
    .from("waitlist_signups")
    .select("*", { count: "exact", head: true })
    .lte("id", me.id);

  const weeks = freeWeeksFor(confirmed) + earlyBonusWeeksFor(position ?? 0);
  return weeks * 7;
}
