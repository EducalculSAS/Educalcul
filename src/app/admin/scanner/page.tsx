import { ScanSearch } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminScannerClient from "@/components/admin/AdminScannerClient";

export default async function AdminScannerPage() {
  const { data: runs } = await supabaseAdmin
    .from("scan_runs")
    .select("id, category, status, progress, findings_count, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <ScanSearch className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scanner IA</h1>
          <p className="text-sm text-muted-foreground">
            Audits automatisés du code source du site — style, sécurité, performance, accessibilité, SEO.
          </p>
        </div>
      </header>
      <AdminScannerClient initialRuns={runs || []} />
    </div>
  );
}
