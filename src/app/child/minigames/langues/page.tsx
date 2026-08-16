import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import DailyMinigameGame from "@/components/minigames/DailyMinigameGame";

export default async function LanguesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  return (
    <div className="pb-16">
      <DailyMinigameGame gameType="langues" />
    </div>
  );
}
