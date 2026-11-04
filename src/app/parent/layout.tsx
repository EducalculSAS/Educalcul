import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { hasActiveSubscription } from "@/lib/subscriptionGate";
import ParentShell from "@/components/parent/ParentShell";
import ParentGuest from "@/components/parent/ParentGuest";

// Espace connecté : un titre d'onglet à son nom, et jamais indexé (le contenu est privé).
export const metadata: Metadata = {
  title: { default: "Espace parent | Educalcul", template: "%s | Espace parent" },
  robots: { index: false, follow: false },
};


/**
 * Espace parent : identité, rôle, statut banni et abonnement sont vérifiés ICI, côté serveur, avant le premier octet
 * de HTML. Avant, tout se faisait dans le navigateur (session, profil, état d'abonnement : trois appels l'un après
 * l'autre derrière un écran de chargement), d'où l'attente puis le clignotement au chargement de chaque page parent.
 */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  // Pas de compte connecté (ou compte banni/inactif, que getServerUser écarte) : ParentGuest laisse passer le tunnel
  // d'inscription (/parent/subscription?new=true) et renvoie les autres vers la connexion.
  if (!user) return <ParentGuest>{children}</ParentGuest>;
  if (user.role !== "parent") redirect("/dashboard");

  const [{ data: profile }, subscriptionOk] = await Promise.all([
    supabaseAdmin.from("users").select("first_name, onboarding_completed").eq("id", user.id).maybeSingle(),
    // Un compte peut exister sans être passé par Stripe (liste d'attente) ; seul un compte « jamais abonné » (plan
    // gratuit) ou à l'abonnement actif passe, comme dans /api/user/subscription-status.
    hasActiveSubscription(user.authId),
  ]);

  return (
    <ParentShell
      authId={user.authId}
      firstName={profile?.first_name || ""}
      showOnboarding={!profile?.onboarding_completed}
      subscriptionOk={subscriptionOk}
    >
      {children}
    </ParentShell>
  );
}
