"use client";

import { useMemo, useState } from "react";
import { Trophy, Users, Gift, Trash2, Download, RefreshCw, Search, Crown, Check, X, Pencil } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";

interface Entry {
  id: number;
  position: number;
  email: string;
  display_name: string | null;
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  signup_ip: string | null;
  created_at: string;
}
interface Stats {
  total: number;
  totalReferrals: number;
  topReferrer: { name: string | null; count: number } | null;
}

/** Classement de la waitlist : la liste + stats initiales arrivent déjà
 * chargées du serveur ; le bouton "Actualiser" et les mutations (édition,
 * suppression) restent des allers-retours client, comme avant. */
export default function AdminLandingClient({
  initialEntries,
  initialStats,
}: {
  initialEntries: Entry[];
  initialStats: Stats;
}) {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"position" | "referrals">("position");
  const [busy, setBusy] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRefs, setEditRefs] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist-signups");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries || []);
      setStats(data.stats || { total: 0, totalReferrals: 0, topReferrer: null });
    } catch {
      showToast("error", "Erreur de chargement");
    }
    setLoading(false);
  };

  // IP apparaissant plusieurs fois = cluster potentiellement frauduleux.
  const dupIps = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => { if (e.signup_ip) counts[e.signup_ip] = (counts[e.signup_ip] || 0) + 1; });
    return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([ip]) => ip));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? entries.filter(e =>
          e.email.toLowerCase().includes(q) ||
          (e.display_name || "").toLowerCase().includes(q) ||
          e.referral_code.toLowerCase().includes(q))
      : [...entries];
    if (sortBy === "referrals") list.sort((a, b) => b.referral_count - a.referral_count || a.position - b.position);
    else list.sort((a, b) => a.position - b.position);
    return list;
  }, [entries, search, sortBy]);

  const startEdit = (e: Entry) => {
    setEditId(e.id);
    setEditName(e.display_name || "");
    setEditRefs(String(e.referral_count));
  };

  const saveEdit = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/waitlist-signups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: editName, referral_count: Number(editRefs) }),
      });
      if (!res.ok) throw new Error();
      setEntries(prev => prev.map(e => e.id === id ? { ...e, display_name: editName, referral_count: Number(editRefs) } : e));
      showToast("success", "Modifié");
      setEditId(null);
    } catch {
      showToast("error", "Erreur");
    }
    setBusy(null);
  };

  const deleteEntry = async (id: number) => {
    if (!(await confirm("Retirer cette personne de la liste d'attente ?"))) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/waitlist-signups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEntries(prev => prev.filter(e => e.id !== id).map((e, i) => ({ ...e, position: i + 1 })));
      showToast("success", "Supprimé");
    } catch {
      showToast("error", "Erreur");
    }
    setBusy(null);
  };

  const exportCSV = () => {
    const csv = ["Position,Nom,Email,Code,Filleuls,Parraine par,Date", ...filtered.map(e =>
      `${e.position},"${e.display_name || ""}",${e.email},${e.referral_code},${e.referral_count},${e.referred_by || ""},${new Date(e.created_at).toLocaleString("fr-FR")}`
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
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-white ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {toast.text}
        </div>
      )}

      <div className="mb-8">
        <AdminPageHeader
          icon={Trophy}
          title="Liste d'attente : Classement"
          subtitle="Gérez les inscrits, le parrainage et le classement du site de lancement."
          actions={
            <>
              <GlassButton size="sm" variant="outline" onClick={fetchEntries}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
              </GlassButton>
              <GlassButton size="sm" variant="navy" onClick={exportCSV}>
                <Download className="w-4 h-4" /> CSV
              </GlassButton>
            </>
          }
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Users className="w-6 h-6 text-[var(--greek-blue)]" /></div>
          <div><p className="text-2xl font-bold text-[var(--greek-blue)]">{stats.total}</p><p className="text-sm text-gray-400">Total inscrits</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center"><Gift className="w-6 h-6 text-[var(--greek-gold)]" /></div>
          <div><p className="text-2xl font-bold text-[var(--greek-blue)]">{stats.totalReferrals}</p><p className="text-sm text-gray-400">Parrainages</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center"><Crown className="w-6 h-6 text-[var(--greek-bronze)]" /></div>
          <div>
            <p className="text-lg font-bold text-[var(--greek-blue)] truncate max-w-[160px]">{stats.topReferrer?.name || "-"}</p>
            <p className="text-sm text-gray-400">Top parrain {stats.topReferrer ? `(${stats.topReferrer.count})` : ""}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-[rgba(197,161,72,0.15)]">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input type="text" placeholder="Rechercher nom, email, code..." value={search} onChange={e => setSearch(e.target.value)}
              aria-label="Rechercher"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
          </div>
          <GlassSegmentedControl
            size="sm"
            options={[
              { id: "position", label: "Par position" },
              { id: "referrals", label: "Par filleuls" },
            ]}
            value={sortBy}
            onChange={(v) => setSortBy(v as "position" | "referrals")}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-[rgba(197,161,72,0.12)]">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Filleuls</th>
                <th className="px-4 py-3 font-semibold">Parrainé par</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Aucun inscrit.</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-b border-[rgba(197,161,72,0.08)] hover:bg-[var(--greek-cream)]/40">
                  <td className="px-4 py-3 font-bold text-[var(--greek-blue)]">{e.position}</td>
                  <td className="px-4 py-3">
                    {editId === e.id ? (
                      <input value={editName} onChange={ev => setEditName(ev.target.value)} aria-label="Nom" className="w-28 px-2 py-1 border border-gray-200 rounded-lg" />
                    ) : (e.display_name || <span className="text-gray-300">-</span>)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.email}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md bg-[var(--greek-cream)] text-[var(--greek-bronze)] font-mono text-xs font-bold">{e.referral_code}</span></td>
                  <td className="px-4 py-3">
                    {editId === e.id ? (
                      <input type="number" min={0} value={editRefs} onChange={ev => setEditRefs(ev.target.value)} aria-label="Nombre de filleuls" className="w-16 px-2 py-1 border border-gray-200 rounded-lg" />
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--greek-blue)]"><Users className="w-3.5 h-3.5" aria-hidden="true" />{e.referral_count}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.referred_by || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.signup_ip ? (
                      <span className={dupIps.has(e.signup_ip) ? "px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold" : "text-gray-400"} title={dupIps.has(e.signup_ip) ? "IP partagée par plusieurs comptes" : ""}>
                        {e.signup_ip}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {editId === e.id ? (
                        <>
                          <GlassIconButton icon={Check} onClick={() => saveEdit(e.id)} disabled={busy === e.id} color="green" size="sm" aria-label="Enregistrer" />
                          <GlassIconButton icon={X} onClick={() => setEditId(null)} color="gray" size="sm" aria-label="Annuler" />
                        </>
                      ) : (
                        <>
                          <GlassIconButton icon={Pencil} onClick={() => startEdit(e)} color="navy" size="sm" aria-label="Modifier" />
                          <GlassIconButton icon={Trash2} onClick={() => deleteEntry(e.id)} disabled={busy === e.id} color="red" size="sm" aria-label="Supprimer" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
