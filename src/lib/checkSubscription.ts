import { supabaseAdmin } from "@/lib/supabaseClient";
import { getLiveSubscription } from "@/lib/subscriptionLive";
import { DifficultyLevel, normalizeDifficulty } from "@/lib/difficultyLevels";
import { isDifficultyAllowed } from "@/lib/difficultyAccess";

interface PlanFeatures {
  ai_access: "none" | "limited" | "unlimited";
  ai_daily_limit: number;
  max_children: number;
  detailed_reports: boolean;
  /** Palier de difficulté MAXIMUM accessible sur ce plan (facile/moyen/avance/
   * difficile — voir src/lib/difficultyLevels.ts). Remplace l'ancienne
   * sémantique "niveau scolaire" (basic/intermediate/advanced/all) qui n'était
   * de toute façon jamais comparée au bon champ (voir checkDifficultyAccess). */
  access_level_exercises: DifficultyLevel;
  /** Parties de mini-jeux (Mathador, calcul mental...) par jour. -1 = illimité. */
  minigames_daily_limit: number;
  /** Accès aux 5 questions/jour des mini-jeux à paliers (calcul mental,
   * énigmes, suites, langues) — false = seulement les 2 premières. Distinct
   * de minigames_daily_limit (le nombre total de PARTIES/jour, tous jeux
   * confondus) : ce flag contrôle le CONTENU d'une partie, pas son nombre. */
  minigames_premium_content: boolean;
  /** IA vocale "Calia en classe" (mode prof) — reservee au plan Family. */
  calia_classe: boolean;
  [key: string]: any;
}

const FREE_FEATURES: PlanFeatures = {
  ai_access: "none",
  ai_daily_limit: 0,
  max_children: 1,
  detailed_reports: false,
  access_level_exercises: "facile",
  minigames_daily_limit: 3,
  minigames_premium_content: false,
  calia_classe: false,
};

export async function getUserFeatures(
  authId: string,
  prefetchedUser?: { id?: number; role: string; parent_id: number | null } | null
): Promise<PlanFeatures> {
  // Check if this user is a child — if so, use parent's subscription.
  // Reuse the caller's already-fetched row when provided to save a round-trip.
  let userRow = prefetchedUser;
  if (userRow === undefined) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("role, parent_id")
      .eq("auth_id", authId)
      .maybeSingle();
    userRow = data;
  }

  let subscriptionUserId = authId;
  if (userRow?.role === "child" && userRow?.parent_id) {
    const { data: parentRow } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("id", userRow.parent_id)
      .maybeSingle();
    if (parentRow?.auth_id) subscriptionUserId = parentRow.auth_id;
  }

  const sub = await getLiveSubscription(subscriptionUserId);

  if (!sub?.plan_id) return FREE_FEATURES;

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("features")
    .eq("id", Number(sub.plan_id))
    .maybeSingle();

  if (!plan) return FREE_FEATURES;
  return { ...FREE_FEATURES, ...plan.features };
}

/** true si ce compte peut utiliser "Calia en classe" — admin (test/demo) ou
 * plan (le sien, ou celui de son parent si enfant) incluant calia_classe. */
export async function hasCaliaClasseAccess(authId: string): Promise<boolean> {
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!userRow) return false;
  if (userRow.role === "admin") return true;

  const features = await getUserFeatures(authId, userRow);
  return !!features.calia_classe;
}

export async function checkAIAccess(authId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  // Single users lookup, reused for the admin check, feature resolution and
  // usage counting below (was 3 separate round-trips).
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!userRow) return { allowed: false, reason: "Utilisateur introuvable", remaining: 0 };
  if (userRow.role === "admin") return { allowed: true, remaining: -1 };

  const features = await getUserFeatures(authId, userRow);

  if (features.ai_access === "none") {
    return { allowed: false, reason: "Votre plan Découverte n'inclut pas l'assistant IA. Passez à un plan payant.", remaining: 0 };
  }

  if (features.ai_access === "unlimited") {
    return { allowed: true, remaining: -1 };
  }

  // Count today's usage
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("user_ai_interactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userRow.id)
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

/** Même patron que checkAIAccess, pour les mini-jeux (Mathador, calcul
 * mental...) — un enfant sur plan gratuit a un nombre de parties/jour
 * limité, illimité sur les plans payants qui le prévoient (-1). */
export async function checkMinigamesAccess(authId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!userRow) return { allowed: false, reason: "Utilisateur introuvable", remaining: 0 };
  if (userRow.role === "admin") return { allowed: true, remaining: -1 };

  const features = await getUserFeatures(authId, userRow);
  const limit = features.minigames_daily_limit;
  if (limit === -1) return { allowed: true, remaining: -1 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("minigame_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userRow.id)
    .gte("created_at", todayStart.toISOString());

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return { allowed: false, reason: `Limite quotidienne atteinte (${limit} parties/jour). Revenez demain ou passez à un plan supérieur.`, remaining: 0 };
  }

  return { allowed: true, remaining };
}

/** Même patron que checkAIAccess/checkMinigamesAccess, pour verrouiller un
 * exercice/quiz par sa difficulté selon le plan de l'utilisateur (ou de son
 * parent, si enfant — déjà géré par getUserFeatures). C'est le SEUL endroit
 * qui doit décider l'accès côté serveur (page + route de correction) ; le
 * catalogue côté client (ExercisesCatalog/QuizCatalog) n'affiche qu'un reflet
 * cosmétique de la même règle via isDifficultyAllowed, jamais l'inverse. */
export async function checkDifficultyAccess(
  authId: string,
  difficulty: string | null | undefined
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!userRow) return { allowed: false, reason: "Utilisateur introuvable" };
  if (userRow.role === "admin") return { allowed: true };

  const features = await getUserFeatures(authId, userRow);
  const maxAllowed = normalizeDifficulty(features.access_level_exercises);
  if (isDifficultyAllowed(maxAllowed, difficulty)) return { allowed: true };

  return {
    allowed: false,
    reason: "Ce contenu est réservé aux plans payants. Passez à un plan supérieur pour y accéder.",
  };
}
