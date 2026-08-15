import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import CalculMentalGame from "@/components/minigames/CalculMentalGame";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";

export default async function CalculMentalPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  return (
    <div className="pb-16">
      <CalculMentalGame />
      <div className="max-w-md mx-auto px-4 mt-4">
        <MinigamesLeaderboard gameType="calcul_mental" />
      </div>
    </div>
  );
}
