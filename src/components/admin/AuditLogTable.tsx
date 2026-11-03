"use client";

import type { AuditLogEntry } from "@/lib/auditLogQuery";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_DELETED: "Utilisateur supprimé",
  USER_BANNED: "Utilisateur banni",
  USER_UNBANNED: "Utilisateur réactivé",
  ADMIN_MESSAGE: "Message envoyé",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  SUBSCRIPTION_CHANGED: "Abonnement modifié",
  CONTENT_CREATED: "Contenu créé",
  CONTENT_UPDATED: "Contenu modifié",
  CONTENT_PUBLISHED: "Contenu publié",
  CONTENT_DELETED: "Contenu supprimé",
  FORUM_POST_DELETED: "Sujet forum supprimé",
  FORUM_COMMENT_DELETED: "Commentaire forum supprimé",
  REPORT_DISMISSED: "Signalement classé",
  EMAIL_TEMPLATE_UPDATED: "Modèle email modifié",
  REFERRAL_CODE_CREATED: "Code de parrainage créé",
  TWO_FACTOR_TOGGLED_BY_ADMIN: "2FA modifiée (par un admin)",
  LOGIN_SUCCESS: "Connexion réussie",
  LOGIN_FAILED: "Connexion échouée",
  TWO_FACTOR_CODE_SENT: "Code 2FA envoyé",
  TWO_FACTOR_VERIFIED: "2FA vérifiée",
  TWO_FACTOR_FAILED: "Code 2FA incorrect",
  ADMIN_IP_ALLOWLIST_ADDED: "IP ajoutée à la liste blanche",
  ADMIN_IP_ALLOWLIST_REMOVED: "IP retirée de la liste blanche",
  IMPERSONATION_STARTED: "Connexion en tant qu'utilisateur",
  IMPERSONATION_ENDED: "Fin de connexion en tant qu'utilisateur",
};

function userLabel(u: { first_name?: string | null; last_name?: string | null; email?: string | null } | null): string {
  if (!u) return "-";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || u.email || "-";
}

/** Table paginée : la page 1 arrive déjà chargée du serveur ; changer de
 * page reste un aller-retour client (comme avant). */
export default function AuditLogTable({
  initialEntries,
  initialTotal,
  pageSize,
}: {
  initialEntries: AuditLogEntry[];
  initialTotal: number;
  pageSize: number;
}) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/audit-log/export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const load = async (p: number) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/admin/audit-log?page=${p}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setEntries(data.entries);
      setTotal(data.total);
      setPage(p);
    }
    setLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
      <div className="flex justify-end px-4 pt-4">
        <GlassButton onClick={exportCsv} variant="outline" size="sm" disabled={exporting}>
          <Download className="w-4 h-4" />
          {exporting ? "Export en cours…" : "Exporter en CSV"}
        </GlassButton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Admin</th>
              <th className="text-left px-4 py-3">Cible</th>
              <th className="text-left px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-gray-100 ${loading ? "opacity-50" : ""}`}>
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3 font-medium text-[var(--greek-blue)]">
                  {ACTION_LABELS[e.action] || e.action}
                  {typeof e.details?.method === "string" && <span className="ml-1 font-normal text-gray-400">({e.details.method})</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{userLabel(e.admin)}</td>
                <td className="px-4 py-3 text-gray-700">{e.target ? userLabel(e.target) : (e.target_type || "-")}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{e.ip_address}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucune entrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">{total} entrée(s)</span>
        <div className="flex items-center gap-2">
          <GlassIconButton
            icon={ChevronLeft}
            color="navy"
            size="sm"
            onClick={() => load(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Page précédente"
          />
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <GlassIconButton
            icon={ChevronRight}
            color="navy"
            size="sm"
            onClick={() => load(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Page suivante"
          />
        </div>
      </div>
    </div>
  );
}
