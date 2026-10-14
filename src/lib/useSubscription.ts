"use client";

import { useCallback, useEffect, useState } from "react";
import { DifficultyLevel } from "@/lib/difficultyLevels";

export interface PlanFeatures {
  ai_access: "none" | "limited" | "unlimited";
  ai_daily_limit: number;          // -1 = unlimited
  max_children: number;
  detailed_reports: boolean;
  priority_support: boolean;
  offline_access: boolean;
  custom_avatars: boolean;
  /** Palier de difficulté maximum accessible sur ce plan — voir
   * src/lib/difficultyLevels.ts et src/lib/difficultyAccess.ts. */
  access_level_exercises: DifficultyLevel;
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
  access_level_exercises: "facile",
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

// Plusieurs composants d'une page lisent l'abonnement (chat Calia,
// catalogues…) : une seule requête partagée, gardée quelques secondes.
// refresh() force une nouvelle lecture (ex. après une question à Calia).
const SUB_TTL_MS = 5_000;
let sharedSub: { at: number; promise: Promise<unknown | null> } | null = null;
function fetchSubscription(force: boolean): Promise<unknown | null> {
  if (force || !sharedSub || Date.now() - sharedSub.at > SUB_TTL_MS) {
    const promise = fetch("/api/user/subscription-status")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    sharedSub = { at: Date.now(), promise };
  }
  return sharedSub.promise;
}

export function useSubscription(): SubscriptionInfo {
  const [info, setInfo] = useState(DEFAULT_INFO);

  const apply = useCallback((d: any | null) => {
    if (!d) { setInfo(i => ({ ...i, loading: false })); return; }
    setInfo({
      plan_id: d.plan_id ?? null,
      plan_name: d.plan_name ?? "Découverte",
      status: d.status ?? "none",
      features: { ...FREE_FEATURES, ...(d.features || {}) },
      ai_uses_today: d.ai_uses_today ?? 0,
      loading: false,
    });
  }, []);

  const load = useCallback(() => fetchSubscription(true).then(apply), [apply]);
  useEffect(() => {
    let alive = true;
    fetchSubscription(false).then((d) => { if (alive) apply(d); });
    return () => { alive = false; };
  }, [apply]);

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
