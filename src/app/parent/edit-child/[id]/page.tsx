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

  const { data: childData }: { data: any } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("id", childId)
    .eq("parent_id", authUser.id)
    .maybeSingle();

  if (!childData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center border border-red-200">
          Enfant introuvable ou non autorisé.
        </div>
      </div>
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
        avatar: childData.avatar || "avatar1.png",
        twoFactorEnabled: !!childData.two_factor_enabled,
      }}
    />
  );
}
