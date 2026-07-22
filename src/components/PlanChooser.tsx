"use client";

import { useState, useEffect, type DragEvent } from "react";
import { Check, Star, Sparkles, ArrowRight, Loader2, GripVertical, Save, Plus, Trash2 } from "lucide-react";
import {
  childrenCost, aiMultiplier, configPrice,
  DEFAULT_CUSTOM_PRICING,
  type CustomPlanConfig, type AIId, type PricingCustomConfig, type PricingOption,
} from "@/lib/customPlanPricing";

// Fonctionnalités qu'une option peut déverrouiller (pour le menu admin).
// Regroupées par thème. Celles déjà consommées par l'app fonctionnent tout de
// suite ; les autres sont des drapeaux prêts à être câblés quand la
// fonctionnalité sera développée.
const FEATURE_CHOICES: { key: string; label: string }[] = [
  { key: "", label: "Aucun effet (prix seul)" },
  // Exercices
  { key: "exercises_simple", label: "Exercices — niveau simple" },
  { key: "exercises_intermediaire", label: "Exercices — niveau intermédiaire" },
  { key: "exercises_avance", label: "Exercices — niveau avancé" },
  { key: "exercises_all_levels", label: "Exercices — tous les niveaux" },
  { key: "ai_correction", label: "Correction IA des exercices" },
  // Quiz
  { key: "quiz_access", label: "Accès aux quiz" },
  { key: "quiz_full", label: "Intégralité des quiz" },
  { key: "quiz_exams", label: "Examens blancs / évaluations" },
  // Suivi
  { key: "detailed_reports", label: "Rapports hebdomadaires" },
  { key: "advanced_stats", label: "Statistiques détaillées" },
  { key: "unlimited_history", label: "Historique illimité" },
  { key: "certificates", label: "Certificats de réussite" },
  // Contenu
  { key: "courses_premium", label: "Cours premium" },
  { key: "printable_worksheets", label: "Fiches imprimables (PDF)" },
  { key: "offline_access", label: "Accès hors-ligne" },
  // Cosmétique & confort
  { key: "custom_avatars", label: "Avatars & cosmétiques" },
  { key: "priority_support", label: "Support prioritaire" },
  { key: "no_ads", label: "Sans publicité" },
];
import { DEFAULT_PRICING_CONFIG, type PricingLabels } from "@/lib/pricingConfig";

export interface ChooserPlan {
  id: number | string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: Record<string, any>;
}

/** Mode admin optionnel : glisser les fiches (réordonner / changer de période)
 * + éditer le forfait sur-mesure inline + bouton Sauvegarder. */
export interface PlanChooserAdmin {
  onReorder: (draggedId: string | number, targetId: string | number) => void;
  onMoveInterval: (draggedId: string | number, interval: string) => void;
  pricing: PricingCustomConfig;
  onPricingChange: (p: PricingCustomConfig) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

/* ─── Feature rows (identiques à /tarifs) ─── */
const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "max_children", label: "Enfants" },
  { key: "access_level_exercises", label: "Niveaux scolaires" },
  { key: "ai_access", label: "IA EpsiAI" },
  { key: "ai_daily_limit", label: "Questions IA / jour" },
];

function formatVal(key: string, val: any): { label: string; included: boolean } {
  if (val === false || val === null || val === undefined || val === 0 || val === "none") return { label: "", included: false };
  if (val === true) return { label: "Inclus", included: true };
  if (key === "max_children") return { label: Number(val) === -1 ? "Illimité" : `${val} enfant${Number(val) > 1 ? "s" : ""}`, included: true };
  if (key === "ai_daily_limit") return { label: Number(val) === -1 ? "Illimité" : `${val} / jour`, included: true };
  if (key === "ai_access") {
    if (val === "unlimited") return { label: "Illimité", included: true };
    if (val === "limited") return { label: "Limité", included: true };
    return { label: "", included: false };
  }
  if (key === "access_level_exercises") {
    if (val === "all") return { label: "CP → Terminale", included: true };
    if (val === "college") return { label: "CP → 3ème", included: true };
    if (val === "basic") return { label: "CP → 6ème", included: true };
    return { label: String(val), included: true };
  }
  return { label: String(val), included: true };
}

const intervalLabel = (i: string) => {
  switch (i) {
    case "year": return "/an";
    case "semester": return "/semestre";
    case "quarter": return "/trimestre";
    default: return "/mois";
  }
};

/* ─── Valeur numérique éditable au clic (mode admin) ─── */
function EditableNumber({ value, onChange, className, suffix = "€" }: {
  value: number; onChange: (v: number) => void; className?: string; suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  if (editing) {
    return (
      <input
        type="number" step="0.01" min="0" autoFocus value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => { setEditing(false); onChange(Math.max(0, Math.round((Number(v) || 0) * 100) / 100)); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onClick={e => e.stopPropagation()}
        className="w-20 px-1.5 py-0.5 rounded border border-[var(--greek-gold)] text-sm text-[var(--greek-blue)] bg-white outline-none"
      />
    );
  }
  return (
    <button type="button" onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Cliquer pour modifier"
      className={`underline decoration-dotted decoration-[var(--greek-gold)] underline-offset-2 hover:text-[var(--greek-gold)] transition-colors ${className || ""}`}>
      {value.toFixed(2)}{suffix}
    </button>
  );
}

/* ─── Plan card (style /tarifs) ─── */
function PlanCard({ plan, popular, cta, onChoose, processing, isCurrent, drag }: {
  plan: ChooserPlan;
  popular: boolean;
  cta: string;
  onChoose: () => void;
  processing: boolean;
  isCurrent: boolean;
  drag?: {
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: () => void;
    over: boolean;
  };
}) {
  const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
  const isFree = Number(plan.price) === 0;
  return (
    <div
      style={{ position: "relative", zIndex: popular ? 10 : 1, transform: popular ? "scale(1.04)" : undefined }}
      draggable={!!drag}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
    >
      <div className="relative flex flex-col bg-white rounded-2xl h-full"
        style={{
          border: drag?.over ? "2px dashed var(--greek-gold)" : popular ? "2px solid var(--greek-gold)" : isCurrent ? "2px solid var(--greek-blue)" : "1px solid var(--greek-border)",
          boxShadow: popular ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
        }}>
        {drag && (
          <div className="absolute top-3 left-3 text-gray-300" title="Glisser pour réordonner / changer de période">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        {popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-current" /> Populaire
            </div>
          </div>
        )}
        {isCurrent && !popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-blue)] text-white shadow-md">
              Formule actuelle
            </div>
          </div>
        )}

        <div className="px-7 pt-8 pb-5 text-center border-b border-[var(--greek-border)]">
          {plan.promo_description && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-[var(--greek-gold)] mb-3">
              <Sparkles className="w-3 h-3" />{plan.promo_description}
            </div>
          )}
          {plan.trial_days > 0 && (
            <div className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200 mb-3">
              {plan.trial_days} jours d&apos;essai gratuit
            </div>
          )}
          <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-1">{plan.name}</h3>
          {plan.description && <p className="text-sm text-[var(--text-muted)]">{plan.description}</p>}
        </div>

        <div className="px-7 py-6 text-center border-b border-[var(--greek-border)]">
          <div className="flex items-end justify-center gap-1">
            <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--greek-blue)]">
              {isFree ? "Gratuit" : `${plan.price}€`}
            </span>
            {!isFree && <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>}
          </div>
        </div>

        <div className="px-7 py-6 flex-grow flex flex-col">
          <ul className="space-y-2.5 mb-6">
            {FEATURE_ROWS.map(row => {
              const { label, included } = formatVal(row.key, features?.[row.key]);
              if (!included) return null;
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[rgba(197,161,72,0.12)] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[var(--greek-gold)]" />
                  </div>
                  <span className="text-sm text-[var(--text-dark)] flex-1">{row.label}</span>
                  {label !== "Inclus" && <span className="text-xs font-semibold text-[var(--greek-gold)]">{label}</span>}
                </li>
              );
            })}
          </ul>
          <button
            onClick={onChoose}
            disabled={processing || isCurrent}
            className="mt-auto w-full py-3 px-4 rounded-xl font-bold text-sm text-center transition-all hover:-translate-y-0.5 hover:shadow-md font-[family-name:var(--font-display)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            style={popular
              ? { background: "var(--greek-blue)", color: "white" }
              : { border: "2px solid var(--greek-blue)", color: "var(--greek-blue)" }}
          >
            {processing ? (
              <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
            ) : isCurrent ? (
              "Formule actuelle ✓"
            ) : (
              <>{cta} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Texte éditable au clic (mode admin) ─── */
function EditableText({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  if (editing) {
    return (
      <input autoFocus value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => { setEditing(false); onChange(v.trim() || value); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onClick={e => e.stopPropagation()}
        className="px-1.5 py-0.5 rounded border border-[var(--greek-gold)] text-sm text-[var(--greek-blue)] bg-white outline-none" />
    );
  }
  return (
    <button type="button" onClick={e => { e.stopPropagation(); setEditing(true); }} title="Cliquer pour modifier"
      className={`underline decoration-dotted decoration-[var(--greek-gold)] underline-offset-2 hover:text-[var(--greek-gold)] transition-colors text-left ${className || ""}`}>
      {value}
    </button>
  );
}

/* ─── Ligne d'option (style /tarifs) ; éditable/supprimable en mode admin ─── */
function OptionRow({ option, selected, onToggle, edit }: {
  option: PricingOption;
  selected: boolean;
  onToggle: (v: boolean) => void;
  edit?: { onChange: (patch: Partial<PricingOption>) => void; onDelete: () => void };
}) {
  return (
    <div className="rounded-xl" style={{ background: "#fff", border: `1.5px solid ${selected ? "rgba(197,161,72,0.5)" : "var(--greek-border)"}` }}>
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="min-w-0">
          <span className="text-sm font-semibold block" style={{ color: "var(--greek-blue)" }}>
            {edit ? <EditableText value={option.label} className="text-sm font-semibold" onChange={(v) => edit.onChange({ label: v })} /> : option.label}
          </span>
          {option.sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{option.sub}</p>}
          <span className="text-xs font-semibold ml-0.5" style={{ color: "var(--greek-gold)" }}>
            +{edit ? <EditableNumber value={option.price} onChange={(p) => edit.onChange({ price: p })} className="text-xs font-semibold" /> : `${option.price.toFixed(2)}€`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {edit && (
            <button type="button" onClick={edit.onDelete} title="Supprimer l'option"
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => onToggle(!selected)}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{ background: selected ? "var(--greek-gold)" : "rgba(15,30,58,0.12)" }}>
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: selected ? "translateX(20px)" : "translateX(0)" }} />
          </button>
        </div>
      </div>
      {edit && (
        <div className="px-5 pb-3 -mt-1">
          <label className="text-[11px] text-gray-400 mr-2">Déverrouille :</label>
          <select value={option.feature} onChange={e => edit.onChange({ feature: e.target.value })}
            className="text-xs border border-[var(--greek-border)] rounded-lg px-2 py-1 bg-white text-[var(--greek-blue)] outline-none">
            {FEATURE_CHOICES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

/* ─── Configurateur "Sur mesure" ; éditable en mode admin ─── */
function Configurator({ onChoose, processing, ctaLabel, pricing, edit }: {
  onChoose: (c: CustomPlanConfig) => void;
  processing: boolean;
  ctaLabel: string;
  pricing: PricingCustomConfig;
  edit?: { onPricingChange: (p: PricingCustomConfig) => void };
}) {
  const [cfg, setCfg] = useState<CustomPlanConfig>({ children: 1, ai: "none", options: {} });
  const n = Math.max(1, cfg.children);
  const mult = aiMultiplier(n);
  const total = configPrice(cfg, pricing);
  const aiOption = pricing.ai_options.find(o => o.id === cfg.ai) ?? pricing.ai_options[0];
  const aiActualPrice = Math.round(aiOption.basePrice * mult * 100) / 100;
  const aiIdx = pricing.ai_options.findIndex(o => o.id === cfg.ai);

  const updateOption = (idx: number, patch: Partial<PricingOption>) => {
    const opts = [...pricing.options];
    opts[idx] = { ...opts[idx], ...patch };
    edit?.onPricingChange({ ...pricing, options: opts });
  };
  const deleteOption = (idx: number) => {
    edit?.onPricingChange({ ...pricing, options: pricing.options.filter((_, i) => i !== idx) });
  };
  const addOption = () => {
    const id = "opt_" + Math.random().toString(36).slice(2, 8);
    edit?.onPricingChange({ ...pricing, options: [...pricing.options, { id, label: "Nouvelle option", price: 0.99, feature: "" }] });
  };

  return (
    <div className="grid md:grid-cols-5 gap-8 items-start">
      <div className="md:col-span-3 space-y-6">
        {/* Enfants */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nombre d&apos;enfants</p>
            {n > 1 && <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>+{childrenCost(n).toFixed(2)}€</span>}
          </div>
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={pricing.max_children} value={cfg.children}
              onChange={e => setCfg(c => ({ ...c, children: Math.min(pricing.max_children, Math.max(1, parseInt(e.target.value) || 1)) }))}
              className="w-28 px-4 py-2.5 rounded-xl text-sm font-bold text-center border outline-none focus:border-[var(--greek-blue)]"
              style={{ border: "1.5px solid var(--greek-border)", color: "var(--greek-blue)" }} />
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <div>1er enfant inclus</div>
              {edit ? (
                <div>Max enfants : <EditableNumber value={pricing.max_children} suffix="" onChange={(v) => edit.onPricingChange({ ...pricing, max_children: Math.max(1, Math.floor(v)) })} /></div>
              ) : (
                <div>Plus d&apos;enfants → IA plus chère</div>
              )}
            </div>
          </div>
        </div>

        {/* IA */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>IA EpsiAI</p>
            {cfg.ai !== "none" && (
              <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>
                +{aiActualPrice.toFixed(2)}€
                {n > 1 && <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>(×{mult.toFixed(2)} pour {n} enfants)</span>}
              </span>
            )}
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--greek-border)" }}>
            {pricing.ai_options.map((o, i) => (
              <button key={o.id} onClick={() => setCfg(c => ({ ...c, ai: o.id as AIId }))}
                className="flex-1 py-2.5 text-center transition-all"
                style={{
                  background: i <= aiIdx ? "var(--greek-blue)" : "#fff",
                  color: i <= aiIdx ? (i === aiIdx ? "var(--greek-gold)" : "rgba(255,255,255,0.6)") : "var(--text-muted)",
                  fontSize: "0.7rem", fontWeight: 600,
                  borderRight: i < pricing.ai_options.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
                }}>
                {o.label}
              </button>
            ))}
          </div>
          {edit && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pricing.ai_options.map((o, i) => (
                <div key={o.id} className="flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[var(--greek-border)] text-xs">
                  <span className="font-semibold text-[var(--greek-blue)]">{o.label}</span>
                  <EditableNumber value={o.basePrice} className="text-xs font-semibold text-[var(--greek-gold)]"
                    onChange={(v) => {
                      const ai = [...pricing.ai_options];
                      ai[i] = { ...ai[i], basePrice: v };
                      edit.onPricingChange({ ...pricing, ai_options: ai });
                    }} />
                </div>
              ))}
            </div>
          )}
          {!edit && n > 1 && cfg.ai !== "none" && (
            <p className="text-xs mt-1.5" style={{ color: "rgba(197,161,72,0.8)" }}>⚠ Le prix de l&apos;IA augmente avec le nombre d&apos;enfants</p>
          )}
        </div>

        <div className="space-y-2.5">
          {pricing.options.map((opt, i) => (
            <OptionRow
              key={opt.id}
              option={opt}
              selected={!!cfg.options[opt.id]}
              onToggle={v => setCfg(c => ({ ...c, options: { ...c.options, [opt.id]: v } }))}
              edit={edit ? { onChange: (patch) => updateOption(i, patch), onDelete: () => deleteOption(i) } : undefined}
            />
          ))}
          {edit && (
            <button type="button" onClick={addOption}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[var(--greek-border)] text-sm font-semibold text-[var(--greek-blue)] hover:border-[var(--greek-gold)] hover:text-[var(--greek-gold)] transition-colors">
              <Plus className="w-4 h-4" /> Ajouter une option
            </button>
          )}
        </div>
      </div>

      {/* Résumé */}
      <div className="md:col-span-2">
        <div className="rounded-2xl p-7 sticky top-24" style={{ background: "var(--greek-blue)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(197,161,72,0.7)" }}>Votre formule</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">{total.toFixed(2)}€</span>
            <span className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>/mois</span>
          </div>
          <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {`Sur mesure · ${cfg.children} enfant${cfg.children > 1 ? "s" : ""}`}
          </p>
          <div className="space-y-1.5 mb-6 text-xs border-t border-white/10 pt-4">
            <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.55)" }}>
              <span>Base personnalisée</span>
              <span className="text-white">
                {edit
                  ? <EditableNumber value={pricing.base_price} className="text-white" onChange={(v) => edit.onPricingChange({ ...pricing, base_price: v })} />
                  : `${pricing.base_price.toFixed(2)}€`}
              </span>
            </div>
            {n > 1 && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>{n} enfants</span><span>+{childrenCost(n).toFixed(2)}€</span>
              </div>
            )}
            {cfg.ai !== "none" && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>IA {aiOption.label}</span><span>+{aiActualPrice.toFixed(2)}€</span>
              </div>
            )}
          </div>
          {!edit && (
            <button onClick={() => onChoose(cfg)} disabled={processing}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-center transition-all font-[family-name:var(--font-display)] disabled:opacity-50 hover:-translate-y-0.5"
              style={{ background: "var(--greek-gold)", color: "#fff" }}>
              {processing ? (
                <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
              ) : (
                <>{ctaLabel} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ─── */
export default function PlanChooser({
  plans,
  onChoosePlan,
  onChooseCustom,
  planCta,
  customCtaLabel = "Choisir cette formule",
  processingKey = null,
  currentPlanId,
  showCustom = true,
  labels = DEFAULT_PRICING_CONFIG,
  customPricing = DEFAULT_CUSTOM_PRICING,
  admin,
}: {
  plans: ChooserPlan[];
  onChoosePlan: (plan: ChooserPlan) => void;
  onChooseCustom: (config: CustomPlanConfig) => void;
  planCta: (plan: ChooserPlan) => string;
  customCtaLabel?: string;
  processingKey?: string | number | null;
  currentPlanId?: string | number | null;
  showCustom?: boolean;
  labels?: PricingLabels;
  customPricing?: PricingCustomConfig;
  admin?: PlanChooserAdmin;
}) {
  const [tab, setTab] = useState<"familles" | "custom">("familles");
  const [billing, setBilling] = useState<string>("month");
  const [draggedId, setDraggedId] = useState<string | number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
  const [overInterval, setOverInterval] = useState<string | null>(null);

  const effectivePricing = admin ? admin.pricing : customPricing;

  const intervalTabs = [
    { id: "month", label: labels.intervals.month },
    { id: "quarter", label: labels.intervals.quarter },
    { id: "semester", label: labels.intervals.semester },
    { id: "year", label: labels.intervals.year },
  ];

  const TABS = [
    { id: "familles" as const, label: labels.tabs.familles },
    ...(showCustom ? [{ id: "custom" as const, label: labels.tabs.custom }] : []),
  ];

  const freePlans = plans.filter(p => Number(p.price) === 0);
  const paidForInterval = plans.filter(p => Number(p.price) > 0 && p.billing_interval === billing);
  const list = [...paidForInterval, ...freePlans];

  return (
    <div>
      {admin && (
        <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" /> Glissez les fiches pour les réordonner, ou déposez-les sur un onglet de période (Mensuel/Annuel…) pour changer leur période. Cliquez une valeur du sur-mesure pour la modifier.
        </p>
      )}

      {/* Onglets principaux */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-2xl" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all font-[family-name:var(--font-display)]"
              style={tab === t.id ? { background: "var(--greek-blue)", color: "#fff" } : { background: "transparent", color: "var(--greek-blue)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "familles" && (
        <>
          {/* Onglets de période (= zones de dépôt en mode admin) */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
              {intervalTabs.map(it => (
                <button key={it.id}
                  onClick={() => setBilling(it.id)}
                  onDragOver={admin ? (e) => { e.preventDefault(); setOverInterval(it.id); } : undefined}
                  onDragLeave={admin ? () => setOverInterval(null) : undefined}
                  onDrop={admin ? () => { if (draggedId != null) admin.onMoveInterval(draggedId, it.id); setOverInterval(null); setDraggedId(null); } : undefined}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all font-[family-name:var(--font-display)]"
                  style={overInterval === it.id
                    ? { background: "var(--greek-gold)", color: "#fff" }
                    : billing === it.id ? { background: "var(--greek-blue)", color: "#fff" } : { background: "transparent", color: "var(--greek-blue)" }}>
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] py-20">Aucun plan dans cette période. Glissez-en un ici depuis une autre période.</p>
          ) : (
            <div className={`grid grid-cols-1 gap-8 ${list.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : list.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
              {list.map((plan, idx) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  popular={list.length > 1 && idx === 1}
                  cta={planCta(plan)}
                  onChoose={() => onChoosePlan(plan)}
                  processing={processingKey === plan.id}
                  isCurrent={currentPlanId != null && String(currentPlanId) === String(plan.id)}
                  drag={admin ? {
                    onDragStart: () => setDraggedId(plan.id),
                    onDragEnd: () => { setDraggedId(null); setOverId(null); },
                    onDragOver: (e) => { e.preventDefault(); setOverId(plan.id); },
                    onDrop: () => { if (draggedId != null && draggedId !== plan.id) admin.onReorder(draggedId, plan.id); setOverId(null); setDraggedId(null); },
                    over: overId === plan.id && draggedId !== plan.id,
                  } : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "custom" && showCustom && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-[var(--greek-blue)] mb-2">Composez votre formule</h2>
            <p className="text-[var(--text-muted)] text-sm">
              {admin ? "Cliquez une valeur (prix de base, paliers IA, options) pour la modifier." : "Ajustez les options, le prix se met à jour automatiquement."}
            </p>
          </div>
          <Configurator
            onChoose={onChooseCustom}
            processing={processingKey === "custom"}
            ctaLabel={customCtaLabel}
            pricing={effectivePricing}
            edit={admin ? { onPricingChange: admin.onPricingChange } : undefined}
          />
        </div>
      )}

      {/* Barre de sauvegarde (mode admin, forfait sur-mesure) */}
      {admin && admin.dirty && (
        <div className="sticky bottom-4 mt-8 flex justify-center">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-white border border-[var(--greek-gold)]">
            <span className="text-sm font-semibold text-[var(--greek-blue)]">Modifications non enregistrées</span>
            <button onClick={admin.onSave} disabled={admin.saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 text-sm">
              {admin.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
