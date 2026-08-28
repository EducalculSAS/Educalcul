import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import AddChildForm from "@/components/parent/AddChildForm";

export default async function AddChildPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  return <AddChildForm />;
}
