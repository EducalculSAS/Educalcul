"use client";

import { useEffect, useState } from "react";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { Mail, Users, Trash2, Download, RefreshCw, Search, Calendar } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

interface WaitlistEntry {
  id: number;
  email: string;
  created_at: string;
}

export default function AdminLandingPage() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [filtered, setFiltered] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchEntries(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? entries.filter(e => e.email.toLowerCase().includes(q)) : entries);
  }, [search, entries]);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) {
      setEntries(data || []);
      setFiltered(data || []);
    }
    setLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const deleteEntry = async (id: number) => {
    if (!(await confirm("Supprimer cet email de la waitlist ?"))) return;
    setDeleting(id);
    const { error } = await supabaseAdmin.from("waitlist").delete().eq("id", id);
    if (error) showToast("error", "Erreur lors de la suppression");
    else {
      showToast("success", "Email supprimé");
      setEntries(prev => prev.filter(e => e.id !== id));
    }
    setDeleting(null);
  };

  const exportCSV = () => {
    const csv = ["Email,Date inscription", ...filtered.map(e =>
      `${e.email},${new Date(e.created_at).toLocaleString("fr-FR")}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-white transition-all ${
          toast.type === "success" ? "bg-green-500" : "bg-red-500"
        }`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2 flex items-center gap-3">
          <Mail className="w-8 h-8 text-[var(--greek-gold)]" />
          Landing Page — Waitlist
        </h1>
        <p className="text-gray-500">Gérez les inscrits à la liste d'attente de la landing page.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-6 h-6 text-[var(--greek-blue)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--greek-blue)]">{entries.length}</p>
            <p className="text-sm text-gray-400">Total inscrits</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-[var(--greek-gold)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--greek-blue)]">
              {entries.filter(e => {
                const d = new Date(e.created_at);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}
            </p>
            <p className="text-sm text-gray-400">Ce mois-ci</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--greek-blue)]">
              {entries.filter(e => {
                const d = new Date(e.created_at);
                const now = new Date();
                const week = new Date(now.getTime() - 7 * 86400000);
                return d >= week;
              }).length}
            </p>
            <p className="text-sm text-gray-400">Cette semaine</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-[rgba(197,161,72,0.15)]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchEntries}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors"
            >
              <Download className="w-4 h-4" /> Exporter CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--greek-gold)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>{search ? "Aucun résultat pour cette recherche." : "Aucun inscrit pour l'instant."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(197,161,72,0.15)] bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-500">#</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-500">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-500">Date d'inscription</th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr key={entry.id} className="border-b border-[rgba(197,161,72,0.1)] hover:bg-[var(--greek-cream)] transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-[var(--greek-blue)]">{entry.email}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(entry.created_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting === entry.id
                          ? <RefreshCw className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 text-right p-3">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              {search ? ` pour "${search}"` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
