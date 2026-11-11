import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import MathadorGame from "@/components/minigames/MathadorGame";
import StateScreen from "@/components/StateScreen";
import { loadGameEntry, sheetDay } from "@/lib/minigames/hub";

export default async function MathadorPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { streak, available, result } = await loadGameEntry(authUser.id, "mathador");
  if (!available) {
    return (
      <StateScreen emblem="gamepad" title="Pas encore pour ta classe" actions={[{ label: "Voir les autres jeux", href: "/child/minigames" }]}>
        Ce mini-jeu commence un peu plus tard dans le programme. Tu le retrouveras quand tu changeras de classe.
      </StateScreen>
    );
  }
  return <MathadorGame day={sheetDay()} initialStreak={streak} initialResult={result?.kind === "mathador" ? result : null} />;
}
