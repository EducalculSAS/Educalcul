"use client";

import { useState } from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { supabase } from "@/lib/supabaseClient";

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

/** Kill-switch pour désactiver une fonctionnalité cassée en prod sans
 * redéploiement. Créer un flag ne coupe rien tout seul — c'est au code de
 * vérifier `await isFeatureEnabled("ma-cle")` (src/lib/featureFlags.ts) là où
 * ça compte. Un flag inexistant est considéré activé par défaut. */
export default function AdminFeatureFlagsClient({ initialFlags }: { initialFlags: FeatureFlag[] }) {
  const confirm = useConfirm();
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const addFlag = async () => {
    if (!key.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ key: key.trim(), description: description.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la création.");
        return;
      }
      setFlags((prev) => [...prev, data.flag].sort((a, b) => a.key.localeCompare(b.key)));
      setKey("");
      setDescription("");
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (flag: FeatureFlag) => {
    setToggling(flag.id);
    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      if (res.ok) setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f)));
    } finally {
      setToggling(null);
    }
  };

  const removeFlag = async (flag: FeatureFlag) => {
    const ok = await confirm(`Supprimer le flag "${flag.key}" ? La fonctionnalité associée redeviendra active par défaut (un flag absent = activé).`, { danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    await fetch(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE", headers: await authHeaders() });
    setFlags((prev) => prev.filter((f) => f.id !== flag.id));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Flag}
        title="Fonctionnalités"
        subtitle="Active/désactive des fonctionnalités sans redéployer. Créer un flag ici ne fait rien tout seul : le code doit vérifier isFeatureEnabled(clé) à l'endroit concerné."
      />

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 space-y-4">
        <h2 className="text-sm font-bold text-[var(--greek-blue)] uppercase tracking-wide">Nouveau flag</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="cle-du-flag"
            className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white font-mono"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="À quoi ça sert (optionnel)"
            className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white"
          />
          <GlassButton size="sm" variant="navy" onClick={addFlag} disabled={adding || !key.trim()}>
            <Plus className="w-4 h-4" /> Créer
          </GlassButton>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Clé</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Modifié le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {flags.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-[var(--greek-blue)]">{f.key}</td>
                <td className="px-4 py-3 text-gray-700">{f.description || "—"}</td>
                <td className="px-4 py-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={f.enabled}
                      disabled={toggling === f.id}
                      onChange={() => toggle(f)}
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                  </label>
                  <span className={`ml-2 text-xs font-semibold ${f.enabled ? "text-green-600" : "text-red-600"}`}>
                    {f.enabled ? "Activé" : "Désactivé"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(f.updated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <GlassIconButton
                    icon={Trash2}
                    onClick={() => removeFlag(f)}
                    color="red"
                    size="sm"
                    aria-label="Supprimer"
                  />
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun flag — tout est activé par défaut.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
