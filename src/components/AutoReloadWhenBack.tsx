"use client";

import { useCallback } from "react";
import { useVisiblePolling } from "@/lib/useVisiblePolling";

/** Recharge la page quand la fonctionnalité coupée redevient disponible
 * (vérification toutes les 30 s, onglet visible uniquement). */
export default function AutoReloadWhenBack({ featureKey }: { featureKey?: string }) {
  const check = useCallback(async () => {
    if (!featureKey) return;
    try {
      const res = await fetch("/api/features", { cache: "no-store" });
      const { disabled } = (await res.json()) as { disabled: string[] };
      if (!disabled.includes(featureKey)) window.location.reload();
    } catch {
      /* réessai au prochain tour */
    }
  }, [featureKey]);
  useVisiblePolling(check, 30000);
  return null;
}
