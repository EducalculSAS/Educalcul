import { redirect } from "next/navigation";
import { getServerUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { normalizePricingConfig, DEFAULT_PRICING_CONFIG } from "@/lib/pricingConfig";
import SubscriptionClient from "@/components/parent/SubscriptionClient";

function generateReferralCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const isNewSignup = sp?.new === "true";

  // Le flow "nouvelle inscription" lit ses données depuis le sessionStorage
  // du navigateur (saisies avant paiement) : rien à prérécupérer côté serveur.
  if (isNewSignup) {
    return (
      <SubscriptionClient
        authId={null}
        authEmail={null}
        initialPlans={[]}
        initialPricingConfig={DEFAULT_PRICING_CONFIG}
        initialReferralCode={null}
        initialPendingDiscount={0}
      />
    );
  }

  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const authEmail = session?.user?.email ?? null;

  const [{ data: plansData }, { data: pricingRow }, { data: userRow }] = await Promise.all([
    supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "pricing_config")
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, pending_discount_percent")
      .eq("id", authUser.id)
      .maybeSingle(),
  ]);
  const plans = (plansData || []).filter((p: any) => p.is_active);
  const pricingConfig = pricingRow?.value ? normalizePricingConfig(pricingRow.value) : DEFAULT_PRICING_CONFIG;

  let referralCode: any = null;
  if (userRow) {
    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("*")
      .eq("owner_user_id", userRow.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      const { data: uses } = await supabaseAdmin
        .from("referral_uses")
        .select("id, used_at, used_by_user_id, users:used_by_user_id(first_name, last_name, email)")
        .eq("referral_code_id", existing.id)
        .order("used_at", { ascending: false });
      referralCode = { ...existing, uses: uses || [] };
    } else {
      const name = [userRow.first_name, userRow.last_name].filter(Boolean).join("").toUpperCase().replace(/\s/g, "").slice(0, 5);
      const suffix = generateReferralCode(4);
      const code = name ? `${name}${suffix}` : generateReferralCode(8);
      const { data: created } = await supabaseAdmin
        .from("referral_codes")
        .insert({
          code,
          owner_user_id: userRow.id,
          discount_type: "percent",
          discount_value: 10,
          is_active: true,
          description: `Code parrainage de ${userRow.first_name || "utilisateur"}`,
        })
        .select()
        .single();
      referralCode = created ? { ...created, uses: [] } : null;
    }
  }

  return (
    <SubscriptionClient
      authId={authUser.authId}
      authEmail={authEmail}
      initialPlans={plans}
      initialPricingConfig={pricingConfig}
      initialReferralCode={referralCode}
      initialPendingDiscount={userRow?.pending_discount_percent || 0}
    />
  );
}
