import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isAdminIpAllowed } from "@/lib/adminIpAllowlist";
import { getClientIp } from "@/lib/ipGeo";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import AdminShell from "@/components/admin/AdminShell";

/** Vérifie identité + rôle admin + statut banni côté serveur, avant même que
 * la première page admin ne s'exécute — remplace l'ancien check client (dans
 * AdminLayout) qui laissait toutes les pages admin se monter avant de
 * rediriger. La 2FA d'un admin déjà configuré est également validée ici,
 * côté serveur, avant tout rendu. AdminShell répète ensuite cette vérification
 * côté client en défense en profondeur et gère uniquement le premier setup
 * TOTP lorsqu'aucune configuration n'a encore été confirmée. */
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

  if (error || !userData || userData.role !== "admin") redirect("/dashboard");
  if (userData.status === "inactive" || userData.ban_reason) redirect("/auth/banned");

  // Une configuration TOTP confirmée exige aussi une session 2FA valide AVANT
  // de rendre la moindre page admin. AdminShell garde le contrôle client en
  // défense en profondeur et gère le tout premier setup TOTP.
  const { data: totp } = await supabaseAdmin
    .from("two_factor_totp")
    .select("confirmed_at")
    .eq("user_id", userData.id)
    .maybeSingle();

  if (totp?.confirmed_at) {
    const twoFactorToken = await getTwoFactorCookie();
    let validTwoFactorSession = false;
    if (twoFactorToken) {
      const { data: twoFactorSession } = await supabaseAdmin
        .from("two_factor_sessions")
        .select("expires_at")
        .eq("user_id", userData.id)
        .eq("token_hash", hashTwoFactorValue(twoFactorToken))
        .maybeSingle();
      validTwoFactorSession =
        !!twoFactorSession && new Date(twoFactorSession.expires_at) > new Date();
    }
    if (!validTwoFactorSession) {
      redirect("/auth/2fa-verify?redirect=%2Fadmin%2Fdashboard");
    }
  }

  // Même garde IP que proxy.ts pour les routes /api/admin/* — ici pour que
  // les PAGES admin refusent aussi de s'afficher (sinon elles se chargeraient
  // sans données, tous leurs appels /api/admin/* étant rejetés en silence).
  const reqHeaders = await headers();
  const ip = getClientIp({ headers: reqHeaders } as unknown as Request);
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

  return <AdminShell adminLevel={userData.admin_level || "super"}>{children}</AdminShell>;
}
