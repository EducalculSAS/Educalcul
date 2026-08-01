import { supabaseAdmin } from "@/lib/supabaseClient";
import { normalizePricingConfig } from "@/lib/pricingConfig";
import { fetchAdminSubscriptionPlans } from "@/lib/adminSubscriptionPlans";
import AdminSubscriptionsClient from "@/components/admin/AdminSubscriptionsClient";

export default async function AdminSubscriptionsPage() {
  const [plans, { data: codes }, { data: pricingRow }] = await Promise.all([
    fetchAdminSubscriptionPlans(),
    supabaseAdmin
      .from("referral_codes")
      .select(`
        *,
        owner:owner_user_id ( id, first_name, last_name, email ),
        referral_uses ( id, used_at, used_by_user_id )
      `)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("value").eq("key", "pricing_config").maybeSingle(),
  ]);

  return (
    <AdminSubscriptionsClient
      initialPlans={plans}
      initialCodes={codes || []}
      initialPricingConfig={normalizePricingConfig(pricingRow?.value)}
    />
  );
}
