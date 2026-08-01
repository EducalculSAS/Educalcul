import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";

// Purement un redirect selon le rôle : plus besoin d'un aller-retour client
// (getSession + requête users + redirect) pour ça maintenant que le rôle est
// lisible côté serveur — redirect() renvoie une réponse HTTP directement, la
// page ne s'affiche jamais.
export default async function DashboardRedirect() {
  const user = await getServerUser();

  if (!user) redirect("/auth/connexion");

  if (user.role === "parent") redirect("/parent/dashboard");
  if (user.role === "child") redirect("/child/dashboard");
  if (user.role === "admin") redirect("/admin/dashboard");

  redirect("/auth/connexion");
}
