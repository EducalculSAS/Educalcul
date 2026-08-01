import { supabaseAdmin } from "@/lib/supabaseClient";

/** Liste des plans avec nombre + liste d'abonnés par plan (vue admin). */
export async function fetchAdminSubscriptionPlans() {
  const { data: plans, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const plansWithCount = await Promise.all(
    (plans || []).map(async (plan) => {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, status, current_period_end")
        .eq("plan_id", plan.id.toString())
        .eq("status", "active");

      const subscribers = await Promise.all(
        (subs || []).map(async (s) => {
          const { data: u } = await supabaseAdmin
            .from("users")
            .select("first_name, last_name, email, avatar")
            .eq("auth_id", s.user_id)
            .maybeSingle();
          return { ...s, user: u };
        })
      );

      return { ...plan, subscriber_count: subscribers.length, subscribers };
    })
  );

  return plansWithCount;
}
