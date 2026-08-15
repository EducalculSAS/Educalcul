import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import MathadorGame from "@/components/minigames/MathadorGame";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";

export default async function MathadorPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  return (
    <div className="pb-16">
      <MathadorGame />
      <div className="max-w-md mx-auto px-4 mt-4">
        <MinigamesLeaderboard gameType="mathador" />
      </div>
    </div>
  );
}
