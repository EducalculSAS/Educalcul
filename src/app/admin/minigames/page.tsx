import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMinigamesClient from "@/components/admin/AdminMinigamesClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AdminMinigamesPage() {
  const { data: sessions } = await supabaseAdmin
    .from("minigame_sessions")
    .select("game_type, status, score")
    .order("created_at", { ascending: false })
    .limit(1000);

  const statsByType: Record<string, { plays: number; completed: number; totalScore: number }> = {};
  for (const s of sessions || []) {
    const t = (statsByType[s.game_type] ||= { plays: 0, completed: 0, totalScore: 0 });
    t.plays++;
    if (s.status === "completed") {
      t.completed++;
      t.totalScore += s.score || 0;
    }
  }

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
