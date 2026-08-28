import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

/**
 * État d'abonnement de l'utilisateur connecté (plan, features, conso IA du
 * jour). Remplace les 5 `supabase.from(...)` du hook client useSubscription
 * (users, subscriptions, subscription_plans, user_ai_interactions) — ces
 * tables ne sont plus lisibles depuis le navigateur.
 */
const FREE_FEATURES = {
  ai_access: "none",
  ai_daily_limit: 0,
  max_children: 1,
  detailed_reports: false,
  priority_support: false,
  offline_access: false,
  custom_avatars: false,
  access_level_exercises: "basic",
};

const ADMIN_FEATURES = {
  ai_access: "unlimited",
  ai_daily_limit: -1,
  max_children: 99,
  detailed_reports: true,
  priority_support: true,
  offline_access: true,
  custom_avatars: true,
  access_level_exercises: "all",
};

export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (me.role === "admin") {
      return NextResponse.json({
        plan_id: null,
        plan_name: "Admin",
        status: "active",
        features: ADMIN_FEATURES,
        ai_uses_today: 0,
      });
    }

    // L'enfant hérite de l'abonnement du parent.
    let subUserAuthId = me.authId;
    if (me.role === "child" && me.parent_id) {
      const { data: parent } = await supabaseAdmin
        .from("users")
        .select("auth_id")
        .eq("id", me.parent_id)
        .maybeSingle();
      if (parent?.auth_id) subUserAuthId = parent.auth_id;
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status")
      .eq("user_id", subUserAuthId)
      .eq("status", "active")
      .maybeSingle();

    let plan_id: number | null = null;
    let plan_name = "Découverte";
    let features: Record<string, unknown> = FREE_FEATURES;

    if (sub?.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("subscription_plans")
        .select("id, name, features")
        .eq("id", Number(sub.plan_id))
        .maybeSingle();
      if (plan) {
        plan_id = plan.id;
        plan_name = plan.name;
        features = { ...FREE_FEATURES, ...(plan.features as object) };
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("user_ai_interactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", me.id)
      .eq("feature_type", "ai_tutor")
      .gte("created_at", todayStart.toISOString());

    return NextResponse.json({
      plan_id,
      plan_name,
      status: sub?.status || "none",
      features,
      ai_uses_today: count ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
