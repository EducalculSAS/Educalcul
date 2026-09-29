import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminScannerClient from "@/components/admin/AdminScannerClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AdminScannerPage() {
  const { data: runs } = await supabaseAdmin
    .from("scan_runs")
    .select("id, category, status, progress, findings_count, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="scan-search"
        title="Scanner IA"
        subtitle="Audits automatisés du code source du site, style, sécurité, performance, accessibilité, SEO."
      />
      <AdminScannerClient initialRuns={runs || []} />
    </div>
  );
}
