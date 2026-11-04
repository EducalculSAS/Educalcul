/** État du flux d'inscription multi-étapes (profil, mode google/email, plan
 * choisi, id auth en attente...), gardé côté serveur (table pending_signups)
 * et référencé par un cookie httpOnly — jamais dans sessionStorage. Le mot de
 * passe choisi ne transite jamais ici : voir pendingSignupPassword.ts. */

import type { ChooserPlan } from "@/components/PlanChooser";
import type { CustomPlanConfig } from "@/lib/customPlanPricing";
import { z } from "zod";
import { isRecord } from "@/lib/validate";

/** Saisies du parent (ou du compte Google) pendant l'inscription. */
export interface SignupData {
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  referralCode?: string | null;
  password?: string;
  [key: string]: unknown;
}

/** Forfait sur-mesure choisi : sa configuration (nombre d'enfants, niveau d'IA, options cochées). */
export interface CustomPlanSelection {
  custom: true;
  config: CustomPlanConfig;
}

/** Plan choisi : un plan du catalogue, ou un forfait sur-mesure. */
export type SelectedPlan = (ChooserPlan & { custom?: false }) | CustomPlanSelection;

/** État du flux d'inscription tel que stocké côté serveur. */
export interface SignupSession {
  mode?: string | null;
  pendingRole?: string | null;
  authIntent?: string | null;
  pendingAuthId?: string | null;
  data?: SignupData | null;
  selectedPlan?: SelectedPlan | null;
}
const str = z.string().nullish().catch(undefined);
/** Forme minimale attendue de la réponse du serveur ; une valeur de mauvais type est ignorée plutôt que propagée. */
const signupSessionSchema = z.looseObject({
  mode: str, pendingRole: str, authIntent: str, pendingAuthId: str,
  data: z.custom<SignupData>(isRecord).nullish().catch(undefined),
  selectedPlan: z.custom<SelectedPlan>((v) => isRecord(v) && (v.custom === true ? isRecord(v.config) : typeof v.name === "string" && (typeof v.id === "number" || typeof v.id === "string") && typeof v.price === "number")).nullish().catch(undefined),
});

function readSession(raw: unknown): SignupSession {
  const r = signupSessionSchema.safeParse(raw);
  return r.success ? r.data : {};
}

export async function getSignupSession(): Promise<SignupSession> {
  try {
    const res = await fetch("/api/auth/signup-session");
    if (!res.ok) return {};
    return readSession(await res.json());
  } catch {
    return {};
  }
}

export async function patchSignupSession(patch: Partial<SignupSession>): Promise<SignupSession> {
  try {
    const res = await fetch("/api/auth/signup-session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return {};
    return readSession(await res.json());
  } catch {
    return {};
  }
}

export async function clearSignupSession(): Promise<void> {
  try {
    await fetch("/api/auth/signup-session", { method: "DELETE" });
  } catch {
    // ignore
  }
}
