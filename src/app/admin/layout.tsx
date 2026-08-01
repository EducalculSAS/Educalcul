import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
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
    .select("role, status, ban_reason")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  if (error || !userData || userData.role !== "admin") redirect("/dashboard");
  if (userData.status === "inactive" || userData.ban_reason) redirect("/auth/banned");

  return <AdminShell>{children}</AdminShell>;
}
