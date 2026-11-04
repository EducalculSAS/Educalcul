import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isAdminIpAllowed } from "@/lib/adminIpAllowlist";
import { getClientIp } from "@/lib/ipGeo";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/impersonationCookie";
import AdminShell from "@/components/admin/AdminShell";

// Espace connecté : jamais indexé (le contenu est privé).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};


/** Vérifie identité + rôle admin + statut banni côté serveur, avant même que
 * la première page admin ne s'exécute — remplace l'ancien check client (dans
 * AdminLayout) qui laissait toutes les pages admin se monter avant de
 * rediriger. La 2FA est également validée ici, côté serveur, avant tout rendu.
 * AdminShell répète cette vérification côté client en défense en profondeur
 * et gère le premier setup TOTP lorsqu'aucune configuration n'est confirmée. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) redirect("/auth/connexion");

  const { data: userData, error } = await supabaseAdmin
    .from("users")
    .select("id, role, status, ban_reason, admin_level")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  // Une vraie erreur réseau/DB ne veut RIEN dire sur le rôle — la traiter
  // comme "pas admin" renvoyait vers /dashboard qui, lui, réussissait
  // généralement sa propre vérification (moins d'appels réseau) et
  // renvoyait ici, créant une boucle infinie /dashboard ↔ /admin/dashboard
  // dès qu'une seule requête Supabase timait out ou échouait transitoirement
  // (observé en pratique : cette page enchaîne beaucoup plus d'appels réseau
  // que /dashboard, donc statistiquement plus souvent touchée en premier).
  if (error) {
    console.error("[admin/layout] users lookup failed:", error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--greek-cream)] px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--greek-blue)] mb-2">
            Connexion instable
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Impossible de vérifier ton compte pour le moment. Réessaie dans quelques secondes.
          </p>
          <a href="/admin/dashboard" className="text-sm font-medium underline" style={{ color: "var(--greek-blue)" }}>
            Réessayer
          </a>
        </div>
      </div>
    );
  }
  if (!userData || userData.role !== "admin") redirect("/dashboard");
  if (userData.status === "inactive" || userData.ban_reason) redirect("/auth/banned");

  // Une vraie page admin ne se rend jamais tant qu'on impersonne encore (la
  // session active serait alors celle de la cible, qui échouerait le check
  // de rôle ci-dessus) — si ce cookie traîne ici, c'est qu'une impersonation
  // n'a jamais été proprement terminée (ex: l'admin s'est reconnecté
  // manuellement pendant qu'il impersonnait, invalidant le refresh_token
  // d'origine stocké et cassant "Quitter"). On la nettoie pour éviter que la
  // bannière reste bloquée affichée à tort.
  const cookieStore = await cookies();
  const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (impersonationCookie) {
    cookieStore.delete(IMPERSONATION_COOKIE_NAME);
    await supabaseAdmin.from("impersonation_sessions").delete().eq("id", impersonationCookie);
  }

  // Session 2FA valide exigée AVANT de rendre la moindre page admin, que le
  // TOTP soit configuré ou non (sans TOTP : code e-mail, puis AdminShell fait
  // configurer l'application). Le proxy applique la même règle à chaque
  // requête, y compris aux navigations qui ne ré-exécutent pas ce layout.
  // Le TOTP est-il déjà configuré ? Lu ici, en même temps que la session 2FA, pour que la coquille s'affiche
  // directement (avant, elle attendait trois appels réseau derrière un écran de chargement).
  let needsTotpSetup = false;
  {
    const twoFactorToken = await getTwoFactorCookie();
    const [{ data: totp }, { data: twoFactorSession }] = await Promise.all([
      supabaseAdmin.from("two_factor_totp").select("confirmed_at").eq("user_id", userData.id).maybeSingle(),
      twoFactorToken
        ? supabaseAdmin
            .from("two_factor_sessions")
            .select("expires_at")
            .eq("user_id", userData.id)
            .eq("token_hash", hashTwoFactorValue(twoFactorToken))
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    needsTotpSetup = !totp?.confirmed_at;
    const validTwoFactorSession =
      !!twoFactorSession && new Date(twoFactorSession.expires_at) > new Date();
    if (!validTwoFactorSession) {
      // Chemin réellement demandé (posé par proxy.ts) plutôt qu'un
      // /admin/dashboard fixe — sinon revenir de /auth/2fa-verify après une
      // impersonation (returnTo = /admin/users/[id], par ex.) renvoyait
      // systématiquement au dashboard au lieu de la page d'origine.
      const currentPath = (await headers()).get("x-pathname") || "/admin/dashboard";
      redirect(`/auth/2fa-verify?redirect=${encodeURIComponent(currentPath)}`);
    }
  }

  // Même garde IP que proxy.ts pour les routes /api/admin/* — ici pour que
  // les PAGES admin refusent aussi de s'afficher (sinon elles se chargeraient
  // sans données, tous leurs appels /api/admin/* étant rejetés en silence).
  const reqHeaders = await headers();
  const ip = getClientIp({ headers: reqHeaders });
  if (!(await isAdminIpAllowed(ip))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--greek-cream)] px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--greek-blue)] mb-2">
            Accès admin refusé
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Votre adresse IP n&apos;est pas autorisée à accéder à l&apos;administration. Contactez un autre admin si besoin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell adminLevel={userData.admin_level || "super"} needsTotpSetup={needsTotpSetup}>
      {children}
    </AdminShell>
  );
}
