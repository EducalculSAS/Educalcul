"use client";

import { useState, useEffect, type DragEvent, type ReactNode } from "react";
import { Check, Star, Sparkles, ArrowRight, Loader2, GripVertical, Save, Plus, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { DEFAULT_PERIODS, MAX_PERIOD_MONTHS, defaultPeriodLabel, isValidPeriodId, monthsOfPeriod, periodIdForMonths, periodSuffix, type BillingPeriod } from "@/lib/billingPeriods";
import {
  childrenCost, aiMultiplier, configPrice,
  DEFAULT_CUSTOM_PRICING,
  type CustomPlanConfig, type AIId, type PricingCustomConfig, type PricingOption,
} from "@/lib/customPlanPricing";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassSwitch from "@/components/ui/GlassSwitch";
import CustomPricingEditor, { FEATURE_CHOICES } from "@/components/admin/CustomPricingEditor";

import { DEFAULT_PRICING_CONFIG, DEFAULT_VISIBILITY, type PricingLabels, type PricingLayout, type PricingVisibility } from "@/lib/pricingConfig";
import PeriodChips from "@/components/PeriodChips";
import { groupPlans, type PlanGroup } from "@/lib/planGroups";

export interface ChooserPlan {
  id: number | string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: Record<string, unknown>;
  /** Faux = formule masquée aux clients (visible, estompée, dans l'aperçu admin). */
  is_active?: boolean;
}

/** Mode admin optionnel : glisser les fiches (réordonner / changer de période)
 * + éditer le forfait sur-mesure inline + bouton Sauvegarder. */
export interface PlanChooserAdmin {
  /** Nouvel ordre des fiches payantes de la période affichée (identifiants, de gauche à droite). */
  onReorder: (orderedIds: (string | number)[]) => void;
  onMoveInterval: (draggedId: string | number, interval: string) => void;
  /** Met la fiche en avant (« Populaire ») ou retire l'étiquette. */
  onTogglePopular: (id: string | number) => void;
  /** Masque / affiche une formule aux clients (sans la supprimer). */
  onToggleVisible: (id: string | number) => void;
  /** Masque / affiche un onglet ou un bloc de la page de tarifs. */
  onVisibilityChange: (v: PricingVisibility) => void;
  /** Renomme les deux onglets (« Pour les familles », « Sur mesure »). */
  onTabLabelsChange: (tabs: { familles: string; custom: string }) => void;
  /** Un onglet par période, ou une fiche par formule avec le choix de la durée dedans. */
  onLayoutChange: (layout: PricingLayout) => void;
  /** Étiquette « Populaire » automatique sur la fiche du milieu (quand aucune n'est marquée). */
  onPopularAutoChange: (on: boolean) => void;
  /** Périodes proposées aux clients : ajout, retrait, renommage. */
  onPeriodsChange: (periods: BillingPeriod[]) => void;
  pricing: PricingCustomConfig;
  onPricingChange: (p: PricingCustomConfig) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

/* ─── Feature rows (identiques à /tarifs) ─── */
const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "max_children", label: "Enfants" },
  { key: "access_level_exercises", label: "Difficulté des exercices" },
  { key: "ai_access", label: "IA Calia" },
  { key: "ai_daily_limit", label: "Questions IA / jour" },
];

function formatVal(key: string, val: unknown): { label: string; included: boolean } {
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
    const level = normalizeDifficulty(String(val));
    return { label: `Jusqu'à ${DIFFICULTY_LABELS[level]}`, included: true };
  }
  return { label: String(val), included: true };
}

const intervalLabel = periodSuffix;

const featuresOf = (plan: ChooserPlan): Record<string, unknown> => {
  try {
    return typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
  } catch {
    return {};
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
        aria-label="Modifier la valeur"
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
function PlanCard({ plan, popular, cta, onChoose, processing, isCurrent, drag, tools, displayName, chips }: {
  plan: ChooserPlan;
  /** Nom affiché si différent de celui de la ligne en base (« Solo » au lieu de « Solo - 1 mois »). */
  displayName?: string;
  /** Choix de la durée affiché sous le nom (présentation « une fiche par formule »). */
  chips?: ReactNode;
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
    /** Où la fiche glissée atterrirait par rapport à celle-ci. */
    over: false | "before" | "after";
  };
  /** Outils admin de la fiche : afficher / masquer, et (formules payantes) flèches de déplacement + étiquette « Populaire ». */
  tools?: { visible: boolean; onToggleVisible: () => void; reorder?: { onLeft?: () => void; onRight?: () => void; popularFlag: boolean; onTogglePopular: () => void } };
}) {
  const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
  const isFree = Number(plan.price) === 0;
  return (
    <div
      style={{ position: "relative", zIndex: popular ? 10 : 1, transform: popular ? "scale(1.04)" : undefined, opacity: plan.is_active === false ? 0.55 : undefined }}
      draggable={!!drag}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
    >
      <div className="relative flex flex-col bg-white rounded-2xl h-full"
        style={{
          border: popular ? "2px solid var(--greek-gold)" : isCurrent ? "2px solid var(--greek-blue)" : "1px solid var(--greek-border)",
          boxShadow: popular ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
        }}>
        {drag?.over && (
          <span
            aria-hidden
            className="absolute -top-2 -bottom-2 w-1.5 rounded-full bg-[var(--greek-gold)] shadow-[0_0_14px_rgba(197,161,72,0.8)] pointer-events-none"
            style={drag.over === "before" ? { left: -18 } : { right: -18 }}
          />
        )}
        {drag && (
          <div className="absolute top-3 left-3 text-gray-300 cursor-grab" title="Glisser pour réordonner / changer de période">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        {tools && (
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1">
            {tools.reorder && (
              <>
                <GlassIconButton icon={ChevronLeft} color="gray" size="sm" onClick={tools.reorder.onLeft} disabled={!tools.reorder.onLeft} aria-label="Déplacer à gauche" />
                <GlassIconButton icon={ChevronRight} color="gray" size="sm" onClick={tools.reorder.onRight} disabled={!tools.reorder.onRight} aria-label="Déplacer à droite" />
                <GlassIconButton icon={Star} color={tools.reorder.popularFlag ? "gold" : "gray"} size="sm" onClick={tools.reorder.onTogglePopular} aria-label={tools.reorder.popularFlag ? "Retirer l'étiquette Populaire" : "Mettre en avant (Populaire)"} />
              </>
            )}
            <GlassIconButton icon={tools.visible ? Eye : EyeOff} color={tools.visible ? "gray" : "orange"} size="sm" onClick={tools.onToggleVisible} aria-label={tools.visible ? "Masquer cette formule aux clients" : "Afficher cette formule aux clients"} />
          </div>
        )}
        {plan.is_active === false && (
          <div className="absolute top-12 right-3 z-20 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Masquée aux clients</div>
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
          <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-1">{displayName ?? plan.name}</h3>
          {plan.description && <p className="text-sm text-[var(--text-muted)]">{plan.description}</p>}
        </div>

        {chips}

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
          <GlassButton
            onClick={onChoose}
            variant={popular ? "navy" : "outline"}
            fullWidth
            className="mt-auto"
            disabled={processing || isCurrent}
          >
            {processing ? (
              <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
            ) : isCurrent ? (
              <>Formule actuelle <Check className="inline-block w-4 h-4 align-[-0.15em]" aria-hidden="true" /></>
            ) : (
              <>{cta} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
            )}
          </GlassButton>
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
        aria-label="Modifier le texte"
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
            <GlassIconButton icon={Trash2} onClick={edit.onDelete} color="red" size="sm" aria-label="Supprimer l'option" />
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
  const mult = aiMultiplier(n, pricing);
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
            {n > 1 && <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>+{childrenCost(n, pricing).toFixed(2)}€</span>}
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
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>IA Calia</p>
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
            <p className="text-xs mt-1.5" style={{ color: "rgba(197,161,72,0.8)" }}><AlertTriangle className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Le prix de l&apos;IA augmente avec le nombre d&apos;enfants</p>
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
            <GlassButton onClick={addOption} variant="outline" rounded="xl" fullWidth>
              <Plus className="w-4 h-4" /> Ajouter une option
            </GlassButton>
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
                <span>{n} enfants</span><span>+{childrenCost(n, pricing).toFixed(2)}€</span>
              </div>
            )}
            {cfg.ai !== "none" && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>IA {aiOption.label}</span><span>+{aiActualPrice.toFixed(2)}€</span>
              </div>
            )}
          </div>
          {!edit && (
            <GlassButton
              onClick={() => onChoose(cfg)}
              variant="gold"
              fullWidth
              disabled={processing}
            >
              {processing ? (
                <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
              ) : (
                <>{ctaLabel} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
              )}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Fiche d'une formule avec le choix de la durée dedans (« 1 mois · 3 mois · 1 an ») ─── */
function PlanGroupCard({ group, autoPopular, cta, onChoose, processingKey, currentPlanId, tools }: {
  group: PlanGroup<ChooserPlan>;
  autoPopular: boolean;
  cta: (p: ChooserPlan) => string;
  onChoose: (p: ChooserPlan) => void;
  processingKey: string | number | null;
  currentPlanId?: string | number | null;
  tools?: { onLeft?: () => void; onRight?: () => void; onTogglePopular: (p: ChooserPlan) => void; onToggleVisible: (p: ChooserPlan) => void };
}) {
  // Durée présélectionnée : celle de l'abonnement en cours, sinon la mise en avant, sinon la plus courte affichée.
  const initial = () =>
    group.plans.find(p => currentPlanId != null && String(p.id) === String(currentPlanId))
    ?? group.plans.find(p => featuresOf(p).popular === true && p.is_active !== false)
    ?? group.plans.find(p => p.is_active !== false)
    ?? group.plans[0];
  const [sel, setSel] = useState<string>(() => String(initial().id));
  const plan = group.plans.find(p => String(p.id) === sel) ?? initial();
  const paid = Number(plan.price) > 0;
  return (
    <PlanCard
      plan={plan}
      displayName={group.name}
      popular={paid && (featuresOf(plan).popular === true || autoPopular)}
      cta={cta(plan)}
      onChoose={() => onChoose(plan)}
      processing={processingKey === plan.id}
      isCurrent={currentPlanId != null && String(currentPlanId) === String(plan.id)}
      chips={<PeriodChips plans={group.plans} value={plan.id} onChange={setSel} />}
      tools={tools ? {
        visible: plan.is_active !== false,
        onToggleVisible: () => tools.onToggleVisible(plan),
        reorder: paid ? {
          onLeft: tools.onLeft,
          onRight: tools.onRight,
          popularFlag: featuresOf(plan).popular === true,
          onTogglePopular: () => tools.onTogglePopular(plan),
        } : undefined,
      } : undefined}
    />
  );
}

/* ─── Affichage (mode admin) : masquer / afficher les onglets et blocs de la page de tarifs ─── */
function SectionsEditor({ visibility, tabs, showCustom, onVisibilityChange, onTabLabelsChange, layout, popularAuto, onLayoutChange, onPopularAutoChange }: {
  layout: PricingLayout;
  popularAuto: boolean;
  onLayoutChange: (l: PricingLayout) => void;
  onPopularAutoChange: (on: boolean) => void;
  visibility: PricingVisibility;
  tabs: { familles: string; custom: string };
  showCustom: boolean;
  onVisibilityChange: (v: PricingVisibility) => void;
  onTabLabelsChange: (t: { familles: string; custom: string }) => void;
}) {
  const rows: { key: keyof PricingVisibility; title: string; hint: string; rename?: "familles" | "custom" }[] = [
    { key: "familles", title: "Onglet des formules", hint: "Les fiches Solo, Family…", rename: "familles" },
    ...(showCustom ? [{ key: "custom" as const, title: "Onglet sur-mesure", hint: "Le configurateur à la carte", rename: "custom" as const }] : []),
    { key: "comparator", title: "Comparateur", hint: "Tableau comparatif (page Tarifs)" },
    { key: "guarantee", title: "Bandeau garantie", hint: "Page Tarifs" },
    { key: "faq", title: "Mini-FAQ", hint: "Page Tarifs" },
  ];
  const set = (key: keyof PricingVisibility, v: boolean) => {
    const next = { ...visibility, [key]: v };
    // Il faut garder au moins un onglet visible, sinon les clients n'auraient plus rien à choisir.
    if (!next.familles && !(showCustom && next.custom)) next[key === "familles" ? "custom" : "familles"] = true;
    onVisibilityChange(next);
  };
  return (
    <div className="mb-8 rounded-2xl border border-[var(--greek-border)] bg-white/70 backdrop-blur p-5 max-w-3xl mx-auto">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Affichage pour les clients</p>
      <p className="text-xs text-gray-400 mb-4">Masquer ne supprime rien : le contenu reste modifiable ici et réapparaît dès que tu le réaffiches. N&apos;oublie pas « Sauvegarder ».</p>
      <div className="flex flex-wrap items-center gap-4 pb-4 mb-1 border-b border-[var(--greek-border)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--greek-blue)]">Présentation des formules</p>
          <p className="text-xs text-gray-400">Par période : un onglet Mensuel / Trimestriel / Annuel. Par formule : une fiche Solo, une fiche Family, avec « 1 mois · 3 mois · 1 an » dedans.</p>
        </div>
        <GlassSegmentedControl
          size="sm"
          value={layout}
          onChange={(id) => onLayoutChange(id as PricingLayout)}
          options={[{ id: "byPeriod", label: "Par période" }, { id: "byPlan", label: "Par formule" }]}
        />
      </div>
      <div className="flex items-center gap-4 py-3 border-b border-[var(--greek-border)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--greek-blue)]">« Populaire » automatique</p>
          <p className="text-xs text-gray-400">Activé : la fiche du milieu porte l&apos;étiquette tant que tu n&apos;en as marqué aucune. Désactivé : seules les fiches avec une étoile (⭐ sur la fiche ou sur sa durée) l&apos;ont.</p>
        </div>
        <GlassSwitch checked={popularAuto} onChange={onPopularAutoChange} label={popularAuto ? "Désactiver le Populaire automatique" : "Activer le Populaire automatique"} />
      </div>
      <div className="divide-y divide-[var(--greek-border)]">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--greek-blue)]">{r.title}</p>
              <p className="text-xs text-gray-400">{r.hint}</p>
            </div>
            {r.rename && (
              <input
                value={tabs[r.rename]} maxLength={40} aria-label={`Nom de l'onglet « ${r.title} »`}
                onChange={(e) => onTabLabelsChange({ ...tabs, [r.rename!]: e.target.value })}
                className="w-44 px-3 py-1.5 rounded-xl border border-[var(--greek-border)] bg-white text-sm text-[var(--greek-blue)] outline-none focus:border-[var(--greek-gold)]"
              />
            )}
            <GlassSwitch checked={visibility[r.key]} onChange={(v) => set(r.key, v)} label={`${visibility[r.key] ? "Masquer" : "Afficher"} : ${r.title}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Périodes de facturation (mode admin) : ajouter, renommer, retirer ─── */
function PeriodsEditor({ periods, plans, onChange }: {
  periods: BillingPeriod[];
  plans: ChooserPlan[];
  onChange: (p: BillingPeriod[]) => void;
}) {
  const confirm = useConfirm();
  const [months, setMonths] = useState("2");
  const [label, setLabel] = useState("");
  const m = Math.round(Number(months));
  const id = Number.isFinite(m) && m >= 1 && m <= MAX_PERIOD_MONTHS ? periodIdForMonths(m) : null;
  const exists = !!id && periods.some((p) => p.id === id);
  const usedBy = (pid: string) => plans.filter((p) => p.billing_interval === pid).length;

  const add = () => {
    if (!id || exists) return;
    const next = [...periods, { id, label: label.trim() || defaultPeriodLabel(id), months: monthsOfPeriod(id)! }];
    onChange(next.sort((a, b) => a.months - b.months));
    setLabel("");
  };
  const remove = async (p: BillingPeriod) => {
    if (periods.length <= 1) return;
    const n = usedBy(p.id);
    const ok = await confirm(
      n > 0
        ? `Retirer « ${p.label} » ? ${n} formule${n > 1 ? "s sont" : " est"} sur cette période : ${n > 1 ? "elles ne seront" : "elle ne sera"} plus proposée${n > 1 ? "s" : ""} aux clients tant que la période est masquée (rien n'est supprimé).`
        : `Retirer la période « ${p.label} » ?`,
    );
    if (ok) onChange(periods.filter((x) => x.id !== p.id));
  };

  return (
    <div className="mb-10 rounded-2xl border border-[var(--greek-border)] bg-white/70 backdrop-blur p-5 max-w-3xl mx-auto">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Périodes proposées aux clients</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {periods.map((p) => (
          <div key={p.id} className="flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 rounded-full border border-[var(--greek-border)] bg-white">
            <EditableText value={p.label} className="text-sm font-semibold text-[var(--greek-blue)]" onChange={(v) => onChange(periods.map((x) => (x.id === p.id ? { ...x, label: v } : x)))} />
            <span className="text-[11px] text-gray-400">{p.months} mois{usedBy(p.id) > 0 ? ` · ${usedBy(p.id)} formule${usedBy(p.id) > 1 ? "s" : ""}` : ""}</span>
            <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => remove(p)} disabled={periods.length <= 1} aria-label={`Retirer la période ${p.label}`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500">
          Durée (mois)
          <input type="number" min={1} max={MAX_PERIOD_MONTHS} value={months} onChange={(e) => setMonths(e.target.value)}
            className="block mt-1 w-24 px-3 py-2 rounded-xl border border-[var(--greek-border)] bg-white text-sm text-[var(--greek-blue)] outline-none focus:border-[var(--greek-gold)]" />
        </label>
        <label className="text-xs text-gray-500">
          Nom affiché (facultatif)
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={id ? defaultPeriodLabel(id) : "Ex. Bimestriel"} maxLength={40}
            className="block mt-1 w-48 px-3 py-2 rounded-xl border border-[var(--greek-border)] bg-white text-sm text-[var(--greek-blue)] outline-none focus:border-[var(--greek-gold)]" />
        </label>
        <GlassButton onClick={add} variant="navy" size="sm" disabled={!id || exists}>
          <Plus className="w-4 h-4" /> Ajouter la période
        </GlassButton>
        {exists && <span className="text-xs text-[var(--greek-bronze)]">Cette durée existe déjà.</span>}
        {!id && <span className="text-xs text-[var(--greek-bronze)]">Entre une durée de 1 à {MAX_PERIOD_MONTHS} mois.</span>}
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
  // Demarre sur la periode de FACTURATION REELLE de l'abonnement en cours
  // (pas toujours "month") — sinon un abonne trimestriel/semestriel/annuel
  // voit sa propre formule affichee comme "Essai gratuit"/"S'abonner", la
  // carte de son vrai plan (autre periode) n'etant simplement pas affichee.
  const [billing, setBilling] = useState<string>(() => {
    const current = currentPlanId != null ? plans.find(p => String(p.id) === String(currentPlanId)) : null;
    return current?.billing_interval || "month";
  });
  const [draggedId, setDraggedId] = useState<string | number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
  const [overInterval, setOverInterval] = useState<string | null>(null);

  const effectivePricing = admin ? admin.pricing : customPricing;

  const periods = labels.periods ?? DEFAULT_PERIODS;
  // La période de l'abonnement en cours reste visible même si l'admin l'a retirée de la liste (sinon sa formule disparaît).
  const currentInterval = currentPlanId != null ? plans.find(p => String(p.id) === String(currentPlanId))?.billing_interval : undefined;
  const intervalTabs = [
    ...periods.map(p => ({ id: p.id, label: p.label })),
    ...(currentInterval && isValidPeriodId(currentInterval) && !periods.some(p => p.id === currentInterval)
      ? [{ id: currentInterval, label: defaultPeriodLabel(currentInterval) }] : []),
  ];

  // Période affichée retirée de la liste : on retombe sur la première.
  useEffect(() => {
    if (intervalTabs.length > 0 && !intervalTabs.some(t => t.id === billing)) setBilling(intervalTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalTabs.map(t => t.id).join("|")]);

  // Onglets : ceux que l'admin a masqués disparaissent chez les clients ; l'admin les voit tous (marqués « masqué »).
  const vis = labels.visibility ?? DEFAULT_VISIBILITY;
  const tabDefs = [
    { id: "familles" as const, label: labels.tabs.familles, visible: vis.familles },
    ...(showCustom ? [{ id: "custom" as const, label: labels.tabs.custom, visible: vis.custom }] : []),
  ];
  const shownTabs = admin ? tabDefs : tabDefs.filter(t => t.visible);
  const TABS = (shownTabs.length > 0 ? shownTabs : tabDefs.slice(0, 1)).map(t => ({ id: t.id, label: admin && !t.visible ? `${t.label} (masqué)` : t.label }));
  useEffect(() => {
    if (!TABS.some(t => t.id === tab)) setTab(TABS[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TABS.map(t => t.id).join("|")]);

  const freePlans = plans.filter(p => Number(p.price) === 0);
  const paidForInterval = plans.filter(p => Number(p.price) > 0 && p.billing_interval === billing);
  const list = [...paidForInterval, ...freePlans];
  // « Populaire » : la fiche marquée par l'admin ; sans marque, la fiche du milieu (comportement historique).
  const layout: PricingLayout = labels.layout ?? "byPeriod";
  const popularAuto = labels.popularAuto !== false;
  const flaggedPopular = paidForInterval.some(p => featuresOf(p).popular === true);
  const isPopular = (p: ChooserPlan, idx: number) =>
    Number(p.price) > 0 && (flaggedPopular ? featuresOf(p).popular === true : popularAuto && list.length > 1 && idx === 1);

  // Présentation « une fiche par formule » : les lignes « Solo - 1 mois », « Solo - 1 an »… se regroupent sous « Solo ».
  const shownIntervals = new Set(intervalTabs.map(t => t.id));
  const grouped = layout === "byPlan" ? groupPlans(plans.filter(p => Number(p.price) === 0 || shownIntervals.has(p.billing_interval))) : [];
  const paidGroups = grouped.filter(g => Number(g.plans[0].price) > 0);
  const groups = [...paidGroups, ...grouped.filter(g => Number(g.plans[0].price) === 0)];
  const anyGroupFlagged = paidGroups.some(g => g.plans.some(p => featuresOf(p).popular === true));
  const moveGroup = (idx: number, to: number) => {
    if (to < 0 || to >= paidGroups.length || to === idx) return;
    const next = [...paidGroups];
    const [moved] = next.splice(idx, 1);
    next.splice(to, 0, moved);
    admin?.onReorder(next.flatMap(g => g.plans.map(p => p.id)));
  };
  const paidIds = paidForInterval.map(p => p.id);
  const moveInPaid = (id: string | number, to: number) => {
    const from = paidIds.findIndex(x => String(x) === String(id));
    if (from < 0 || to < 0 || to >= paidIds.length || from === to) return;
    const next = [...paidIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    admin?.onReorder(next);
  };

  return (
    <div>
      {admin && (
        <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" /> Réordonnez les fiches avec les flèches (ou en les glissant en présentation par période) ; l&apos;étoile met en avant la fiche, ou la durée choisie dans la fiche ; l&apos;œil la masque aux clients. Gérez les périodes juste en dessous.
        </p>
      )}

      {admin && <SectionsEditor visibility={vis} tabs={labels.tabs} showCustom={showCustom} onVisibilityChange={admin.onVisibilityChange} onTabLabelsChange={admin.onTabLabelsChange} layout={layout} popularAuto={popularAuto} onLayoutChange={admin.onLayoutChange} onPopularAutoChange={admin.onPopularAutoChange} />}

      {/* Onglets principaux (inutiles s'il n'en reste qu'un) */}
      {TABS.length > 1 && (
        <div className="flex justify-center mb-12">
          <GlassSegmentedControl
            options={TABS.map(t => ({ id: t.id, label: t.label }))}
            value={tab}
            onChange={(id) => setTab(id as "familles" | "custom")}
          />
        </div>
      )}

      {tab === "familles" && (
        <>
          {/* Onglets de période : GlassSegmentedControl (survol, glissé, rebond) ; en mode admin chaque onglet est aussi
             une zone de dépôt pour changer la période d'une fiche. */}
          {layout === "byPeriod" && <div className="flex justify-center mb-10">
            <GlassSegmentedControl
              options={intervalTabs.map(it => ({
                id: it.id,
                label: it.label,
                hot: overInterval === it.id,
                ...(admin ? {
                  onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverInterval(it.id); },
                  onDragLeave: () => setOverInterval(null),
                  onDrop: () => { if (draggedId != null) admin.onMoveInterval(draggedId, it.id); setOverInterval(null); setDraggedId(null); },
                } : {}),
              }))}
              value={billing}
              onChange={setBilling}
            />
          </div>}

          {admin && <PeriodsEditor periods={periods} plans={plans} onChange={admin.onPeriodsChange} />}

          {layout === "byPlan" ? (
            groups.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] py-20">Aucune formule à afficher.</p>
            ) : (
              <div className={`grid grid-cols-1 gap-8 ${groups.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : groups.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
                {groups.map((g, idx) => (
                  <PlanGroupCard
                    key={g.key}
                    group={g}
                    autoPopular={popularAuto && !anyGroupFlagged && paidGroups.length > 1 && idx === 1 && Number(g.plans[0].price) > 0}
                    cta={planCta}
                    onChoose={onChoosePlan}
                    processingKey={processingKey}
                    currentPlanId={currentPlanId}
                    tools={admin ? {
                      onLeft: idx > 0 && idx < paidGroups.length ? () => moveGroup(idx, idx - 1) : undefined,
                      onRight: idx < paidGroups.length - 1 ? () => moveGroup(idx, idx + 1) : undefined,
                      onTogglePopular: (p) => admin.onTogglePopular(p.id),
                      onToggleVisible: (p) => admin.onToggleVisible(p.id),
                    } : undefined}
                  />
                ))}
              </div>
            )
          ) : list.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] py-20">Aucun plan dans cette période. Glissez-en un ici depuis une autre période.</p>
          ) : (
            <div className={`grid grid-cols-1 gap-8 ${list.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : list.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
              {list.map((plan, idx) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  popular={isPopular(plan, idx)}
                  cta={planCta(plan)}
                  onChoose={() => onChoosePlan(plan)}
                  processing={processingKey === plan.id}
                  isCurrent={currentPlanId != null && String(currentPlanId) === String(plan.id)}
                  drag={admin && Number(plan.price) > 0 ? {
                    onDragStart: () => setDraggedId(plan.id),
                    onDragEnd: () => { setDraggedId(null); setOverId(null); },
                    onDragOver: (e) => { e.preventDefault(); if (draggedId != null) setOverId(plan.id); },
                    onDrop: () => {
                      if (draggedId != null && String(draggedId) !== String(plan.id)) {
                        const to = paidIds.findIndex(x => String(x) === String(plan.id));
                        // Fiche d'une autre période déposée ici : elle rejoint cette période, à cette place.
                        if (!paidIds.some(x => String(x) === String(draggedId))) admin.onMoveInterval(draggedId, billing);
                        else moveInPaid(draggedId, to);
                      }
                      setOverId(null); setDraggedId(null);
                    },
                    over: overId === plan.id && draggedId != null && String(draggedId) !== String(plan.id)
                      ? (paidIds.findIndex(x => String(x) === String(draggedId)) > paidIds.findIndex(x => String(x) === String(plan.id)) ? "before" : "after")
                      : false,
                  } : undefined}
                  tools={admin ? {
                    visible: plan.is_active !== false,
                    onToggleVisible: () => admin.onToggleVisible(plan.id),
                    reorder: Number(plan.price) > 0 ? {
                      onLeft: idx > 0 ? () => moveInPaid(plan.id, idx - 1) : undefined,
                      onRight: idx < paidIds.length - 1 ? () => moveInPaid(plan.id, idx + 1) : undefined,
                      popularFlag: featuresOf(plan).popular === true,
                      onTogglePopular: () => admin.onTogglePopular(plan.id),
                    } : undefined,
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
          {admin && <CustomPricingEditor pricing={effectivePricing} onChange={admin.onPricingChange} />}
        </div>
      )}

      {/* Barre de sauvegarde (mode admin, forfait sur-mesure) */}
      {admin && admin.dirty && (
        <div className="sticky bottom-4 mt-8 flex justify-center">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-white border border-[var(--greek-gold)]">
            <span className="text-sm font-semibold text-[var(--greek-blue)]">Modifications non enregistrées</span>
            <GlassButton
              onClick={admin.onSave}
              variant="navy"
              size="sm"
              disabled={admin.saving}
            >
              {admin.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
