"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Eye } from "lucide-react";
import PlanChooser, { type ChooserPlan } from "@/components/PlanChooser";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricingConfig";

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

export default function PricingConfigEditor({ plans }: { plans: ChooserPlan[] }) {
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/pricing-config")
      .then(r => r.ok ? r.json() : DEFAULT_PRICING_CONFIG)
      .then((c) => setCfg(c))
      .catch(() => setCfg(DEFAULT_PRICING_CONFIG))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pricing-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (res.ok) {
        setCfg(data); // version re-normalisée par le serveur
        setMsg({ ok: true, text: "Configuration enregistrée. Elle s'applique immédiatement côté client." });
      } else {
        setMsg({ ok: false, text: data.error || "Échec de l'enregistrement." });
      }
    } catch {
      setMsg({ ok: false, text: "Une erreur est survenue." });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  if (loading || !cfg) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[var(--greek-blue)]" /></div>;
  }

  const setCustom = (patch: Partial<PricingConfig["custom"]>) => setCfg({ ...cfg, custom: { ...cfg.custom, ...patch } });
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="space-y-8">
      {/* ── Éditeur ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Libellés */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 space-y-5">
          <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Libellés des catégories</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Onglet « familles »</label>
              <input className={inputCls} value={cfg.tabs.familles} onChange={e => setCfg({ ...cfg, tabs: { ...cfg.tabs, familles: e.target.value } })} />
            </div>
            <div>
              <label className={labelCls}>Onglet « sur mesure »</label>
              <input className={inputCls} value={cfg.tabs.custom} onChange={e => setCfg({ ...cfg, tabs: { ...cfg.tabs, custom: e.target.value } })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Libellés des périodes</label>
            <div className="grid grid-cols-2 gap-3">
              {(["month", "quarter", "semester", "year"] as const).map(k => (
                <input key={k} className={inputCls} value={cfg.intervals[k]}
                  onChange={e => setCfg({ ...cfg, intervals: { ...cfg.intervals, [k]: e.target.value } })} />
              ))}
            </div>
          </div>
        </div>

        {/* Forfait sur-mesure */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 space-y-5">
          <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Forfait sur mesure</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Prix de base (€)</label>
              <input type="number" step="0.01" min="0" className={inputCls} value={cfg.custom.base_price}
                onChange={e => setCustom({ base_price: num(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Max enfants</label>
              <input type="number" min="1" className={inputCls} value={cfg.custom.max_children}
                onChange={e => setCustom({ max_children: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Paliers IA (libellé + prix de base €)</label>
            <div className="space-y-2">
              {cfg.custom.ai_options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400 w-10">{o.id}</span>
                  <input className={inputCls + " flex-1"} value={o.label}
                    onChange={e => {
                      const ai = [...cfg.custom.ai_options];
                      ai[i] = { ...ai[i], label: e.target.value };
                      setCustom({ ai_options: ai });
                    }} />
                  <input type="number" step="0.01" min="0" className={inputCls + " w-24"} value={o.basePrice}
                    onChange={e => {
                      const ai = [...cfg.custom.ai_options];
                      ai[i] = { ...ai[i], basePrice: num(e.target.value) };
                      setCustom({ ai_options: ai });
                    }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Prix des options (€)</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["reports", "Rapports"], ["quiz", "Quiz"], ["avatars", "Avatars"], ["support", "Support prio."],
              ] as const).map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-[11px] text-gray-500 mb-0.5">{lbl}</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={cfg.custom.toggles[k]}
                    onChange={e => setCustom({ toggles: { ...cfg.custom.toggles, [k]: num(e.target.value) } })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </button>
        {msg && <span className={`text-sm font-medium ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      {/* ── Aperçu live ── */}
      <div className="bg-[var(--greek-cream)] rounded-2xl border border-[rgba(197,161,72,0.25)] p-6">
        <div className="flex items-center gap-2 mb-6 text-[var(--greek-blue)]">
          <Eye className="w-5 h-5 text-[var(--greek-gold)]" />
          <h3 className="font-bold font-[family-name:var(--font-display)]">Aperçu (ce que voient les clients)</h3>
        </div>
        <PlanChooser
          plans={plans}
          onChoosePlan={() => {}}
          onChooseCustom={() => {}}
          planCta={() => "Choisir"}
          customCtaLabel="S'abonner"
          labels={cfg}
          customPricing={cfg.custom}
        />
      </div>
    </div>
  );
}
