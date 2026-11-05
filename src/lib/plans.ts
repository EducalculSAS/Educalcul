import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabaseClient";

export interface Plan {
  id: number;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: Record<string, boolean | number | string | null>;
}

/**
 * Partagé entre la route /api/plans (utilisée ailleurs pour du fetch client)
 * et la page /tarifs (rendu serveur) : évite le round-trip + le skeleton de
 * chargement pour la ressource la plus consultée avant un achat.
 */
export const fetchActivePlans = cache(async (): Promise<Plan[]> => {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, name, description, price, billing_interval, trial_days, promo_description, features")
    .eq("is_active", true)
    .order("sort_order")
    .order("id");
  if (error || !data) return [];
  return data as Plan[];
});
