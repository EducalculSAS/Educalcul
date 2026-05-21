"use client";

import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, Copy, Check, Save, Loader2, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  const [groups, setGroups] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const saveKey = async (key: string, value: string) => {
    setSaving(key);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) {
      showToast("success", `${key} sauvegardé`);
      setEdited(e => { const n = { ...e }; delete n[key]; return n; });
      fetchSettings();
    } else {
      showToast("error", "Erreur lors de la sauvegarde");
    }
    setSaving(null);
  };

  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputCls = "flex-1 px-3 py-2 border border-[var(--greek-gold)]/25 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none bg-white";

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
              <Settings className="text-[var(--greek-gold)]" size={30} />
              Paramètres & Clés API
            </h1>
            <p className="text-[var(--greek-bronze)] mt-1">Variables d'environnement — dev uniquement</p>
          </div>
          <button onClick={fetchSettings} className="flex items-center gap-2 px-4 py-2 border border-[var(--greek-gold)]/20 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
          ⚠️ Ces clés sont sensibles. Cette page est réservée au développement — désactivez-la en production.
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>
      ) : (
        Object.entries(groups).map(([groupKey, group]) => (
          <div key={groupKey} className="bg-white rounded-2xl border border-[var(--greek-gold)]/15 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-[var(--greek-gold)]/15">
              <h2 className="font-bold text-[var(--greek-blue)] text-base">{group.label}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {group.keys.map((item: any) => {
                const currentVal = edited[item.key] ?? item.value;
                const isEdited = item.key in edited;
                const isVisible = visible[item.key];
                const displayVal = item.secret && !isVisible ? "•".repeat(Math.min(currentVal.length, 32)) : currentVal;
                return (
                  <div key={item.key} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                        <span className="ml-2 text-xs font-mono text-gray-400">{item.key}</span>
                      </div>
                      {isEdited && <span className="text-xs text-orange-500 font-bold">Modifié</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={item.secret && !isVisible ? "password" : "text"}
                        value={currentVal}
                        onChange={e => setEdited(prev => ({ ...prev, [item.key]: e.target.value }))}
                        className={inputCls}
                        placeholder={`${item.key}=...`}
                      />
                      {item.secret && (
                        <button onClick={() => setVisible(v => ({ ...v, [item.key]: !v[item.key] }))}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                      <button onClick={() => copyValue(item.key, currentVal)}
                        className="p-2 text-gray-400 hover:text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors">
                        {copied === item.key ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                      {isEdited && (
                        <button onClick={() => saveKey(item.key, edited[item.key])}
                          disabled={saving === item.key}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors disabled:opacity-50">
                          {saving === item.key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Sauver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      <p className="text-xs text-gray-400 text-center pb-4">Après modification, redémarre le serveur pour que les changements prennent effet.</p>
    </div>
  );
}
