import StateScreen from "@/components/StateScreen";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import EditChildForm from "@/components/parent/EditChildForm";

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: childId } = await params;
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: childData } = await supabaseAdmin
    .from("users")
    .select(`${USER_SELECT_COLUMNS}, extra_levels`)
    .eq("id", childId)
    .eq("parent_id", authUser.id)
    .maybeSingle();

  if (!childData) {
    return (
      <StateScreen emblem="family" title="Enfant introuvable" actions={[{ label: "Mes enfants", href: "/parent/children" }]}>
        Ce compte n&apos;existe pas ou n&apos;est pas rattaché au vôtre.
      </StateScreen>
    );
  }

  return (
    <EditChildForm
      initial={{
        id: childId,
        parentId: authUser.id,
        firstName: childData.first_name,
        lastName: childData.last_name,
        email: childData.email || "",
        username: childData.child_username,
        gradeLevel: childData.grade_level || "CP",
        extraLevels: childData.extra_levels || [],
        avatar: childData.avatar || "avatar1.png",
        twoFactorEnabled: !!childData.two_factor_enabled,
      }}
    />
  );
}
