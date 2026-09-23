import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMinigamesClient from "@/components/admin/AdminMinigamesClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AdminMinigamesPage() {
  // Agrégat sur TOUTES les parties (avant : les 1000 dernières seulement).
  const { data } = await supabaseAdmin.rpc("admin_minigame_stats");
  const statsByType = (data ?? {}) as Record<string, { plays: number; completed: number; totalScore: number }>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="gamepad-2"
        title="Mini-jeux"
        subtitle="Mathador et calcul mental — le calcul mental se génère automatiquement chaque nuit, par palier."
      />
      <AdminMinigamesClient stats={statsByType} />
    </div>
  );
}
