import type { PlanFeatures } from "@/lib/checkSubscription";

/** Contenu de la colonne `features` d'un plan d'abonnement (JSON, parfois reçu sous forme de texte) : droits du plan + réglages d'affichage. */
export type PlanFeatureValues = Partial<PlanFeatures> & {
  priority_support?: boolean;
  custom_avatars?: boolean;
  popular?: boolean;
  cosmetic_borders?: string[];
  cosmetic_colors?: string[];
};

/** Lit `features` quelle que soit sa forme (objet, texte JSON ou vide). */
export function parsePlanFeatures(raw: unknown): PlanFeatureValues {
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as PlanFeatureValues; } catch { return {}; }
  }
  return raw && typeof raw === "object" ? (raw as PlanFeatureValues) : {};
}
