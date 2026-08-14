import { fetchAuditLogPage } from "@/lib/auditLogQuery";
import AuditLogTable from "@/components/admin/AuditLogTable";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AuditLogPage() {
  const { entries, total, pageSize } = await fetchAuditLogPage(1);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="history"
        title="Journal d'audit"
        subtitle="Historique des actions administrateur"
      />
      <AuditLogTable
        initialEntries={entries}
        initialTotal={total}
        pageSize={pageSize}
      />
    </div>
  );
}
