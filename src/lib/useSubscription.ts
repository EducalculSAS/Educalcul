"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface PlanFeatures {
  ai_access: "none" | "limited" | "unlimited";
  ai_daily_limit: number;          // -1 = unlimited
  max_children: number;
  detailed_reports: boolean;
  priority_support: boolean;
  offline_access: boolean;
  custom_avatars: boolean;
  access_level_exercises: "basic" | "intermediate" | "advanced" | "all";
}

export interface SubscriptionInfo {
  plan_id: number | null;
  plan_name: string;
  status: string;
  features: PlanFeatures;
  ai_uses_today: number;
  loading: boolean;
}

const FREE_FEATURES: PlanFeatures = {
  ai_access: "none",
  ai_daily_limit: 0,
  max_children: 1,
  detailed_reports: false,
  priority_support: false,
  offline_access: false,
  custom_avatars: false,
  access_level_exercises: "basic",
};

export function useSubscription(): SubscriptionInfo {
  const [info, setInfo] = useState<SubscriptionInfo>({
    plan_id: null,
    plan_name: "Découverte",
    status: "active",
    features: FREE_FEATURES,
    ai_uses_today: 0,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInfo(i => ({ ...i, loading: false })); return; }

        // Get user role + parent_id
        const { data: userRow } = await supabase
          .from("users")
          .select("id, role, parent_id")
          .eq("auth_id", user.id)
          .maybeSingle();

        // Admins → accès illimité sans vérification d'abonnement
        if (userRow?.role === "admin") {
          const ADMIN_FEATURES: PlanFeatures = {
            ai_access: "unlimited", ai_daily_limit: -1, max_children: 99,
            detailed_reports: true, priority_support: true,
            offline_access: true, custom_avatars: true, access_level_exercises: "all",
          };
          setInfo({ plan_id: null, plan_name: "Admin", status: "active", features: ADMIN_FEATURES, ai_uses_today: 0, loading: false });
          return;
        }

        // Determine which auth_id to check subscription for
        // Children inherit from parent
        let subscriptionUserId = user.id;
        if (userRow?.role === "child" && userRow?.parent_id) {
          const { data: parentRow } = await supabase
            .from("users")
            .select("auth_id")
            .eq("id", userRow.parent_id)
            .maybeSingle();
          if (parentRow?.auth_id) subscriptionUserId = parentRow.auth_id;
        }

        // Get subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("user_id", subscriptionUserId)
          .eq("status", "active")
          .maybeSingle();

        let features = FREE_FEATURES;
        let plan_name = "Découverte";
        let plan_id = null;

        if (sub?.plan_id) {
          const { data: plan } = await supabase
            .from("subscription_plans")
            .select("id, name, features")
            .eq("id", Number(sub.plan_id))
            .maybeSingle();

          if (plan) {
            plan_id = plan.id;
            plan_name = plan.name;
            features = { ...FREE_FEATURES, ...plan.features };
          }
        }

        // Count AI uses today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: ai_uses_today } = await supabase
          .from("user_ai_interactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userRow?.id)
          .eq("feature_type", "ai_tutor")
          .gte("created_at", todayStart.toISOString());

        setInfo({ plan_id, plan_name, status: sub?.status || "none", features, ai_uses_today: ai_uses_today ?? 0, loading: false });
      } catch {
        setInfo(i => ({ ...i, loading: false }));
      }
    })();
  }, []);

  return info;
}

/** Returns true if user can use AI right now */
export function canUseAI(sub: SubscriptionInfo): boolean {
  if (sub.loading) return false;
  if (sub.features.ai_access === "none") return false;
  if (sub.features.ai_access === "unlimited") return true;
  return sub.ai_uses_today < sub.features.ai_daily_limit;
}

/** Returns remaining AI uses (-1 = unlimited) */
export function aiRemaining(sub: SubscriptionInfo): number {
  if (sub.features.ai_access === "unlimited") return -1;
  return Math.max(0, sub.features.ai_daily_limit - sub.ai_uses_today);
}
