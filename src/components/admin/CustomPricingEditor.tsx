"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { childrenCost, type PricingCustomConfig, type PricingOption } from "@/lib/customPlanPricing";

// Fonctionnalités qu'une option peut déverrouiller. Seules des fonctionnalités RÉELLEMENT applicables figurent ici —
// vérifiées contre le code (un verrou existe déjà, ou est prévu à court terme). Ne pas ajouter d'entrée sans un
// mécanisme d'application correspondant, sous peine de vendre une restriction qui ne fait rien.
export const FEATURE_CHOICES: { key: string; label: string }[] = [
  { key: "", label: "Aucun effet (prix seul)" },
  { key: "exercises_simple", label: "Exercices, niveau simple" },
  { key: "exercises_intermediaire", label: "Exercices, niveau intermédiaire" },
  { key: "exercises_avance", label: "Exercices, niveau avancé" },
  { key: "exercises_all_levels", label: "Exercices, tous les niveaux" },
  { key: "quiz_access", label: "Accès aux quiz" },
  { key: "detailed_reports", label: "Rapports hebdomadaires" },
  { key: "custom_avatars", label: "Avatars & cosmétiques" },
  { key: "priority_support", label: "Support prioritaire" },
];

const field = "w-full px-3 py-2 rounded-xl border border-[var(--greek-border)] bg-white text-sm text-[var(--greek-blue)] outline-none focus:border-[var(--greek-gold)]";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1";

/** Nombre saisi librement (« 0. », « 1,5 »…) : on garde le texte tant qu'on tape, et on ne remonte que les valeurs valides. */
function NumField({ value, onChange, step = "0.01", min = 0, max, suffix, ariaLabel }: {
  value: number; onChange: (n: number) => void; step?: string; min?: number; max?: number; suffix?: string; ariaLabel: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input
        type="text" inputMode="decimal" value={text} aria-label={ariaLabel} step={step}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(Math.round(n * 100) / 100);
        }}
        onBlur={() => setText(String(value))}
        className={field + (suffix ? " pr-9" : "")}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

/** Réglages complets du forfait « Sur mesure », sous forme de formulaire : prix de base, prix des enfants, paliers d'IA, options. */
export default function CustomPricingEditor({ pricing, onChange }: { pricing: PricingCustomConfig; onChange: (p: PricingCustomConfig) => void }) {
  const set = (patch: Partial<PricingCustomConfig>) => onChange({ ...pricing, ...patch });
  const setOption = (i: number, patch: Partial<PricingOption>) => set({ options: pricing.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const moveOption = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= pricing.options.length) return;
    const next = [...pricing.options];
    [next[i], next[j]] = [next[j], next[i]];
    set({ options: next });
  };
  const addOption = () => set({ options: [...pricing.options, { id: "opt_" + Math.random().toString(36).slice(2, 8), label: "Nouvelle option", sub: "", price: 0.99, feature: "" }] });
  const example = [1, 2, 3, 5].map((n) => `${n} enfant${n > 1 ? "s" : ""} : +${childrenCost(n, pricing).toFixed(2)} €`).join(" · ");

  return (
    <div className="mt-12 rounded-2xl border border-[var(--greek-border)] bg-white p-6 space-y-8">
      <div>
        <h3 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)]">Réglages du sur-mesure</h3>
        <p className="text-sm text-gray-500 mt-1">Chaque changement se voit tout de suite dans l&apos;aperçu ci-dessus ; il n&apos;est appliqué aux clients qu&apos;après « Sauvegarder ».</p>
      </div>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--greek-bronze)] mb-3">Prix de base et enfants</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={label}>Prix de base (€/mois)</label><NumField ariaLabel="Prix de base" value={pricing.base_price} onChange={(n) => set({ base_price: n })} suffix="€" /></div>
          <div><label className={label}>Enfants maximum</label><NumField ariaLabel="Nombre maximum d'enfants" step="1" min={1} max={999} value={pricing.max_children} onChange={(n) => set({ max_children: Math.floor(n) })} /></div>
          <div><label className={label}>Par enfant en plus</label><NumField ariaLabel="Prix linéaire par enfant en plus" value={pricing.child_linear} onChange={(n) => set({ child_linear: n })} suffix="€" /></div>
          <div><label className={label}>Croissance (x²)</label><NumField ariaLabel="Part quadratique du prix des enfants" value={pricing.child_quadratic} onChange={(n) => set({ child_quadratic: n })} suffix="€" /></div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Le 1er enfant est inclus. Coût des enfants en plus = « par enfant » × x + « croissance » × x² (x = enfants en plus). {example}</p>
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--greek-bronze)] mb-3">IA Calia</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><label className={label}>Hausse par enfant en plus</label><NumField ariaLabel="Hausse du prix de l'IA par enfant en plus" value={pricing.ai_child_factor} onChange={(n) => set({ ai_child_factor: n })} suffix="×" /></div>
          <div><label className={label}>Multiplicateur maximum</label><NumField ariaLabel="Multiplicateur maximum du prix de l'IA" min={1} value={pricing.ai_max_multiplier} onChange={(n) => set({ ai_max_multiplier: n })} suffix="×" /></div>
        </div>
        <div className="space-y-2">
          {pricing.ai_options.map((o, i) => (
            <div key={o.id} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5 md:col-span-4">
                {i === 0 && <label className={label}>Nom du palier</label>}
                <input value={o.label} maxLength={40} aria-label={`Nom du palier ${i + 1}`} onChange={(e) => set({ ai_options: pricing.ai_options.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} className={field} />
              </div>
              <div className="col-span-3 md:col-span-4">
                {i === 0 && <label className={label}>Questions / jour</label>}
                {o.id === "none" ? (
                  <div className={field + " bg-gray-50 text-gray-400"}>Aucune IA</div>
                ) : o.id === "unlim" ? (
                  <div className={field + " bg-gray-50 text-gray-400"}>Illimitée</div>
                ) : (
                  <NumField ariaLabel={`Questions par jour du palier ${i + 1}`} step="1" min={1} value={o.daily} onChange={(n) => set({ ai_options: pricing.ai_options.map((x, k) => (k === i ? { ...x, daily: Math.floor(n) } : x)) })} />
                )}
              </div>
              <div className="col-span-4">
                {i === 0 && <label className={label}>Prix (€)</label>}
                <NumField ariaLabel={`Prix du palier ${i + 1}`} value={o.basePrice} onChange={(n) => set({ ai_options: pricing.ai_options.map((x, k) => (k === i ? { ...x, basePrice: n } : x)) })} suffix="€" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--greek-bronze)] mb-3">Options à cocher</h4>
        <div className="space-y-3">
          {pricing.options.map((o, i) => (
            <div key={o.id} className="rounded-xl border border-[var(--greek-border)] p-4 bg-[var(--greek-cream)]/40">
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 md:col-span-4"><label className={label}>Nom</label><input value={o.label} maxLength={80} aria-label="Nom de l'option" onChange={(e) => setOption(i, { label: e.target.value })} className={field} /></div>
                <div className="col-span-12 md:col-span-4"><label className={label}>Description</label><input value={o.sub ?? ""} maxLength={120} aria-label="Description de l'option" onChange={(e) => setOption(i, { sub: e.target.value })} className={field} /></div>
                <div className="col-span-5 md:col-span-2"><label className={label}>Prix (€)</label><NumField ariaLabel="Prix de l'option" value={o.price} onChange={(n) => setOption(i, { price: n })} suffix="€" /></div>
                <div className="col-span-7 md:col-span-2 flex items-center justify-end gap-1">
                  <GlassIconButton icon={ChevronUp} color="gray" size="sm" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label="Monter l'option" />
                  <GlassIconButton icon={ChevronDown} color="gray" size="sm" onClick={() => moveOption(i, 1)} disabled={i === pricing.options.length - 1} aria-label="Descendre l'option" />
                  <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => set({ options: pricing.options.filter((_, k) => k !== i) })} aria-label="Supprimer l'option" />
                </div>
                <div className="col-span-12 md:col-span-8">
                  <label className={label}>Ce que l&apos;option déverrouille</label>
                  <select value={o.feature} onChange={(e) => setOption(i, { feature: e.target.value })} className={field}>
                    {FEATURE_CHOICES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <GlassButton onClick={addOption} variant="outline" rounded="xl" fullWidth>
            <Plus className="w-4 h-4" /> Ajouter une option
          </GlassButton>
        </div>
      </section>
    </div>
  );
}
