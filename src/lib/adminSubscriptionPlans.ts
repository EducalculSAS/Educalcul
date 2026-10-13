import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";

type Sub = { user_id: string; plan_id: string; status: string; current_period_end: string | null };
type SubUser = { auth_id: string; first_name: string | null; last_name: string | null; email: string | null; avatar: string | null };

/**
 * Liste des plans avec nombre + liste d'abonnés par plan (vue admin).
 *
 * Trois requêtes au total, quel que soit le nombre d'abonnés : avant, UNE
 * requête par abonné (N+1) et une liste d'abonnés plafonnée à 1000 par plan.
 */
export async function fetchAdminSubscriptionPlans() {
  const [{ data: plans, error }, subs] = await Promise.all([
    supabaseAdmin.from("subscription_plans").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }),
    selectAllPages<Sub>((from, to) =>
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan_id, status, current_period_end")
        .eq("status", "active")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (error) throw error;

  const authIds = [...new Set(subs.map((s) => s.user_id).filter(Boolean))];
  const users = new Map<string, SubUser>();
  for (let i = 0; i < authIds.length; i += 300) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("auth_id, first_name, last_name, email, avatar")
      .in("auth_id", authIds.slice(i, i + 300));
    (data ?? []).forEach((u) => users.set(u.auth_id, u));
  }

  return (plans || []).map((plan) => {
    const subscribers = subs
      .filter((s) => String(s.plan_id) === String(plan.id))
      .map(({ user_id, status, current_period_end }) => {
        const u = users.get(user_id);
        return {
          user_id,
          status,
          current_period_end,
          user: u ? { first_name: u.first_name, last_name: u.last_name, email: u.email, avatar: u.avatar } : null,
        };
      });
    return { ...plan, subscriber_count: subscribers.length, subscribers };
  });
}
