"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import PageLoader from "@/components/PageLoader";
import { History, ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_DELETED: "Utilisateur supprimé",
  USER_BANNED: "Utilisateur banni",
  USER_UNBANNED: "Utilisateur réactivé",
  ADMIN_MESSAGE: "Message envoyé",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  SUBSCRIPTION_CHANGED: "Abonnement modifié",
  CONTENT_PUBLISHED: "Contenu publié",
  CONTENT_DELETED: "Contenu supprimé",
  FORUM_POST_DELETED: "Sujet forum supprimé",
  FORUM_COMMENT_DELETED: "Commentaire forum supprimé",
  REPORT_DISMISSED: "Signalement classé",
  EMAIL_TEMPLATE_UPDATED: "Modèle email modifié",
  REFERRAL_CODE_CREATED: "Code de parrainage créé",
  TWO_FACTOR_TOGGLED_BY_ADMIN: "2FA modifiée (par un admin)",
};

function userLabel(u: { first_name?: string; last_name?: string; email?: string } | null): string {
  if (!u) return "—";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || u.email || "—";
}

export default function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

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
    }
    setLoading(false);
  };

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading && entries.length === 0) return <PageLoader className="h-64" />;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={History} title="Journal d'audit" subtitle="Historique des actions administrateur" />

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
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
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--greek-blue)]">{ACTION_LABELS[e.action] || e.action}</td>
                  <td className="px-4 py-3 text-gray-700">{userLabel(e.admin)}</td>
                  <td className="px-4 py-3 text-gray-700">{e.target ? userLabel(e.target) : (e.target_type || "—")}</td>
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
