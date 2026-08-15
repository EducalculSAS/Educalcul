import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMinigamesClient from "@/components/admin/AdminMinigamesClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AdminMinigamesPage() {
  const [{ data: generations }, { data: sessions }] = await Promise.all([
    supabaseAdmin
      .from("minigame_generations")
      .select("id, game_type, status, progress, params, error, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("minigame_sessions")
      .select("game_type, status, score")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

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
        subtitle="Génère des fiches de calcul mental par niveau, publie-les, et suis l'activité des joueurs."
      />
      <AdminMinigamesClient initialGenerations={generations || []} stats={statsByType} />
    </div>
  );
}
