"use client";

import { useState } from "react";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { supabase } from "@/lib/supabaseClient";

interface AllowlistEntry {
  id: string;
  cidr: string;
  label: string | null;
  created_at: string;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

/** Liste blanche IP admin — désactivée tant qu'elle est vide (aucun risque de
 * verrouillage au premier ajout). Dès la première entrée, TOUS les comptes
 * admin sont restreints aux IP listées ici, pages ET API. */
export default function AdminSecurityClient({ initialEntries }: { initialEntries: AllowlistEntry[] }) {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<AllowlistEntry[]>(initialEntries);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const addEntry = async () => {
    if (!cidr.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ip-allowlist", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ cidr: cidr.trim(), label: label.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'ajout.");
        return;
      }
      setEntries((prev) => [data.entry, ...prev]);
      setCidr("");
      setLabel("");
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (entry: AllowlistEntry) => {
    const willDisableFully = entries.length === 1;
    const ok = await confirm(
      willDisableFully
        ? `Supprimer "${entry.label || entry.cidr}" désactivera complètement la liste blanche : l'accès admin ne sera plus restreint par IP.`
        : `Supprimer "${entry.label || entry.cidr}" de la liste blanche ?`,
      { danger: true, confirmLabel: "Supprimer" },
    );
    if (!ok) return;
    await fetch(`/api/admin/ip-allowlist/${entry.id}`, { method: "DELETE", headers: await authHeaders() });
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Sécurité"
        subtitle="Liste blanche d'IP pour l'accès admin — vide par défaut (pas de restriction). Dès une entrée ajoutée, seules les IP listées peuvent accéder à l'administration, pour tous les comptes admin."
      />

      {entries.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Liste vide — aucune restriction d&apos;IP n&apos;est appliquée actuellement. Dès que tu ajoutes une entrée, l&apos;accès admin sera limité aux IP listées.
        </div>
      )}

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 space-y-4">
        <h2 className="text-sm font-bold text-[var(--greek-blue)] uppercase tracking-wide">Ajouter une IP</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="203.0.113.4 ou 203.0.113.0/24"
            className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (ex: Bureau Paris)"
            className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white"
          />
          <GlassButton size="sm" variant="navy" onClick={addEntry} disabled={adding || !cidr.trim()}>
            <Plus className="w-4 h-4" /> Ajouter
          </GlassButton>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">IP / Plage</th>
              <th className="text-left px-4 py-3">Label</th>
              <th className="text-left px-4 py-3">Ajoutée le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-[var(--greek-blue)]">{e.cidr}</td>
                <td className="px-4 py-3 text-gray-700">{e.label || "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => removeEntry(e)} aria-label="Supprimer" />
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucune restriction — accès ouvert à toute IP.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
