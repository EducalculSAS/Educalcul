import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminFeatureFlagsClient from "@/components/admin/AdminFeatureFlagsClient";

export default async function AdminFeatureFlagsPage() {
  const { data } = await supabaseAdmin
    .from("feature_flags")
    .select("id, key, enabled, description, updated_at")
    .order("key");

  return <AdminFeatureFlagsClient initialFlags={data || []} />;
}
