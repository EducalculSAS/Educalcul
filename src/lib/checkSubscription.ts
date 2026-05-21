import { supabaseAdmin } from "@/lib/supabaseClient";

interface PlanFeatures {
  ai_access: "none" | "limited" | "unlimited";
  ai_daily_limit: number;
  max_children: number;
  detailed_reports: boolean;
  access_level_exercises: "basic" | "intermediate" | "advanced" | "all";
  [key: string]: any;
}

const FREE_FEATURES: PlanFeatures = {
  ai_access: "none",
  ai_daily_limit: 0,
  max_children: 1,
  detailed_reports: false,
  access_level_exercises: "basic",
};

export async function getUserFeatures(authId: string): Promise<PlanFeatures> {
  // Check if this user is a child — if so, use parent's subscription
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();

  let subscriptionUserId = authId;
  if (userRow?.role === "child" && userRow?.parent_id) {
    const { data: parentRow } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("id", userRow.parent_id)
      .maybeSingle();
    if (parentRow?.auth_id) subscriptionUserId = parentRow.auth_id;
  }

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", subscriptionUserId)
    .eq("status", "active")
    .maybeSingle();

  if (!sub?.plan_id) return FREE_FEATURES;

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("features")
    .eq("id", Number(sub.plan_id))
    .maybeSingle();

  if (!plan) return FREE_FEATURES;
  return { ...FREE_FEATURES, ...plan.features };
}

export async function checkAIAccess(authId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  // Admins → toujours illimité
  const { data: roleRow } = await supabaseAdmin.from("users").select("role").eq("auth_id", authId).maybeSingle();
  if (roleRow?.role === "admin") return { allowed: true, remaining: -1 };

  const features = await getUserFeatures(authId);

  if (features.ai_access === "none") {
    return { allowed: false, reason: "Votre plan Découverte n'inclut pas l'assistant IA. Passez à un plan payant.", remaining: 0 };
  }

  if (features.ai_access === "unlimited") {
    return { allowed: true, remaining: -1 };
  }

  // Count today's usage
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get user DB id from auth_id
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!userData) return { allowed: false, reason: "Utilisateur introuvable", remaining: 0 };

  const { count } = await supabaseAdmin
    .from("user_ai_interactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userData.id)
    .eq("feature_type", "ai_tutor")
    .gte("created_at", todayStart.toISOString());

  const used = count ?? 0;
  const limit = features.ai_daily_limit;
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return { allowed: false, reason: `Limite quotidienne atteinte (${limit} messages/jour). Revenez demain ou passez à Annuel Pro.`, remaining: 0 };
  }

  return { allowed: true, remaining };
}
