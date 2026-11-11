import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMinigamesClient from "@/components/admin/AdminMinigamesClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { loadAdminMinigamesToday } from "@/lib/minigames/adminStats";

export default async function AdminMinigamesPage() {
  const [{ data }, today] = await Promise.all([
    // Agrégat sur TOUTES les parties (avant : les 1000 dernières seulement).
    supabaseAdmin.rpc("admin_minigame_stats"),
    loadAdminMinigamesToday(),
  ]);
  const statsByType = (data ?? {}) as Record<string, { plays: number; completed: number; totalScore: number }>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="gamepad-2"
        title="Mini-jeux"
        subtitle="Fréquentation du jour, fiches générées chaque nuit par palier, et parties jouées par les élèves."
      />
      <AdminMinigamesClient stats={statsByType} today={today} />
    </div>
  );
}
