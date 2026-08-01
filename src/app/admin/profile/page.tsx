import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import AdminProfileClient from "@/components/admin/AdminProfileClient";

const ADMIN_AVATAR = "/logo.png";

export default async function AdminProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data }: { data: any } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("auth_id", session?.user.id)
    .maybeSingle();

  return (
    <AdminProfileClient
      initialFormData={{
        first_name: data?.first_name || "",
        last_name: data?.last_name || "",
        child_username: data?.child_username || "",
        email: data?.email || session?.user.email || "",
        avatar: ADMIN_AVATAR,
        name_animation: data?.name_animation || "text-admin",
        avatar_border: data?.avatar_border || "border-admin",
      }}
    />
  );
}
