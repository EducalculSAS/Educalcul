"use client";

import { useCallback, useEffect, useState } from "react";

export interface PlanFeatures {
  ai_access: "none" | "limited" | "unlimited";
  ai_daily_limit: number;          // -1 = unlimited
  max_children: number;
  detailed_reports: boolean;
  priority_support: boolean;
  offline_access: boolean;
  custom_avatars: boolean;
  access_level_exercises: "basic" | "intermediate" | "advanced" | "all";
  /** IA vocale "Calia en classe" (mode prof) — reservee au plan Family. */
  calia_classe: boolean;
}

export interface SubscriptionInfo {
  plan_id: number | null;
  plan_name: string;
  status: string;
  features: PlanFeatures;
  ai_uses_today: number;
  loading: boolean;
  /** Re-interroge /api/user/subscription-status (ex: après un message IA pour
   * rafraîchir le compteur du jour). */
  refresh: () => void;
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
  calia_classe: false,
};

const DEFAULT_INFO = {
  plan_id: null as number | null,
  plan_name: "Découverte",
  status: "active",
  features: FREE_FEATURES,
  ai_uses_today: 0,
  loading: true,
};

export function useSubscription(): SubscriptionInfo {
  const [info, setInfo] = useState(DEFAULT_INFO);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/subscription-status");
      if (!res.ok) { setInfo(i => ({ ...i, loading: false })); return; }
      const d = await res.json();
      setInfo({
        plan_id: d.plan_id ?? null,
        plan_name: d.plan_name ?? "Découverte",
        status: d.status ?? "none",
        features: { ...FREE_FEATURES, ...(d.features || {}) },
        ai_uses_today: d.ai_uses_today ?? 0,
        loading: false,
      });
    } catch {
      setInfo(i => ({ ...i, loading: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...info, refresh: load };
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
