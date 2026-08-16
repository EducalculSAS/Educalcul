import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import MathadorGame from "@/components/minigames/MathadorGame";

export default async function MathadorPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  return (
    <div className="pb-16">
      <MathadorGame />
    </div>
  );
}
