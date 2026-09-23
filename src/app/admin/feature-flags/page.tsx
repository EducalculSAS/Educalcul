import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminFeatureFlagsClient from "@/components/admin/AdminFeatureFlagsClient";

export default async function AdminFeatureFlagsPage() {
  const { data } = await supabaseAdmin.from("feature_flags").select("key, enabled, message, updated_at");
  return <AdminFeatureFlagsClient initialStates={data || []} />;
}
