import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isAdminIpAllowed } from "@/lib/adminIpAllowlist";
import { getClientIp } from "@/lib/ipGeo";
import AdminShell from "@/components/admin/AdminShell";

/** Vérifie identité + rôle admin + statut banni côté serveur, avant même que
 * la première page admin ne s'exécute — remplace l'ancien check client (dans
 * AdminLayout) qui laissait toutes les pages admin se monter avant de
 * rediriger. Le seul contrôle qui reste client (AdminShell) est la 2FA
 * "vérifiée sur cet appareil" : ce token vit en localStorage, illisible côté
 * serveur. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/connexion");

  const { data: userData, error } = await supabaseAdmin
    .from("users")
    .select("role, status, ban_reason, admin_level")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  if (error || !userData || userData.role !== "admin") redirect("/dashboard");
  if (userData.status === "inactive" || userData.ban_reason) redirect("/auth/banned");

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
