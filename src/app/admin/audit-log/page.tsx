import { History } from "lucide-react";
import { fetchAuditLogPage } from "@/lib/auditLogQuery";
import AuditLogTable from "@/components/admin/AuditLogTable";

export default async function AuditLogPage() {
  const { entries, total, pageSize } = await fetchAuditLogPage(1);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <History className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal d&apos;audit</h1>
          <p className="text-sm text-muted-foreground">
            Historique des actions administrateur
          </p>
        </div>
      </header>
      <AuditLogTable
        initialEntries={entries}
        initialTotal={total}
        pageSize={pageSize}
      />
    </div>
  );
}
