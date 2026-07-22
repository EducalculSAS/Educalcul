"use client";

import { useState } from "react";
import { Check, Star, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import {
  AI_OPTIONS, CUSTOM_BASE_PRICE, MAX_CHILDREN,
  childrenCost, aiMultiplier, configPrice,
  type CustomPlanConfig, type AIId,
} from "@/lib/customPlanPricing";

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

const INTERVAL_LABELS: { id: string; label: string }[] = [
  { id: "month", label: "Mensuel" },
  { id: "quarter", label: "Trimestriel" },
  { id: "semester", label: "Semestriel" },
  { id: "year", label: "Annuel" },
];

/* ─── Plan card (style /tarifs) ─── */
function PlanCard({ plan, popular, cta, onChoose, processing, isCurrent }: {
  plan: ChooserPlan;
  popular: boolean;
  cta: string;
  onChoose: () => void;
  processing: boolean;
  isCurrent: boolean;
}) {
  const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
  const isFree = Number(plan.price) === 0;
  return (
    <div style={{ position: "relative", zIndex: popular ? 10 : 1, transform: popular ? "scale(1.04)" : undefined }}>
      <div className="relative flex flex-col bg-white rounded-2xl h-full"
        style={{
          border: popular ? "2px solid var(--greek-gold)" : isCurrent ? "2px solid var(--greek-blue)" : "1px solid var(--greek-border)",
          boxShadow: popular ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
        }}>
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

/* ─── Toggle (style /tarifs) ─── */
function Toggle({ label, sub, price, value, onChange }: { label: string; sub?: string; price: number; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl"
      style={{ background: "#fff", border: `1.5px solid ${value ? "rgba(197,161,72,0.5)" : "var(--greek-border)"}` }}>
      <div className="min-w-0">
        <span className="text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>{label}</span>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        <span className="text-xs font-semibold ml-1" style={{ color: "var(--greek-gold)" }}>+{price.toFixed(2)}€</span>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? "var(--greek-gold)" : "rgba(15,30,58,0.12)" }}>
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}

/* ─── Configurateur "Sur mesure" (style /tarifs) ─── */
function Configurator({ onChoose, processing, ctaLabel }: { onChoose: (c: CustomPlanConfig) => void; processing: boolean; ctaLabel: string }) {
  const [cfg, setCfg] = useState<CustomPlanConfig>({ children: 1, ai: "none", reports: false, support: false, avatars: false, quiz: false });
  const n = Math.max(1, cfg.children);
  const mult = aiMultiplier(n);
  const total = configPrice(cfg);
  const aiOption = AI_OPTIONS.find(o => o.id === cfg.ai)!;
  const aiActualPrice = Math.round(aiOption.basePrice * mult * 100) / 100;
  const aiIdx = AI_OPTIONS.findIndex(o => o.id === cfg.ai);

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
            <input type="number" min={1} max={MAX_CHILDREN} value={cfg.children}
              onChange={e => setCfg(c => ({ ...c, children: Math.min(MAX_CHILDREN, Math.max(1, parseInt(e.target.value) || 1)) }))}
              className="w-28 px-4 py-2.5 rounded-xl text-sm font-bold text-center border outline-none focus:border-[var(--greek-blue)]"
              style={{ border: "1.5px solid var(--greek-border)", color: "var(--greek-blue)" }} />
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <div>1er enfant inclus</div>
              <div>Plus d&apos;enfants → IA plus chère</div>
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
            {AI_OPTIONS.map((o, i) => (
              <button key={o.id} onClick={() => setCfg(c => ({ ...c, ai: o.id as AIId }))}
                className="flex-1 py-2.5 text-center transition-all"
                style={{
                  background: i <= aiIdx ? "var(--greek-blue)" : "#fff",
                  color: i <= aiIdx ? (i === aiIdx ? "var(--greek-gold)" : "rgba(255,255,255,0.6)") : "var(--text-muted)",
                  fontSize: "0.7rem", fontWeight: 600,
                  borderRight: i < AI_OPTIONS.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
                }}>
                {o.label}
              </button>
            ))}
          </div>
          {n > 1 && cfg.ai !== "none" && (
            <p className="text-xs mt-1.5" style={{ color: "rgba(197,161,72,0.8)" }}>⚠ Le prix de l&apos;IA augmente avec le nombre d&apos;enfants</p>
          )}
        </div>

        <div className="space-y-2.5">
          <Toggle label="Rapports hebdomadaires" sub="Résumé email chaque semaine" price={0.99} value={cfg.reports} onChange={v => setCfg(c => ({ ...c, reports: v }))} />
          <Toggle label="Quiz" sub="Accès à tous les quiz et évaluations" price={0.99} value={cfg.quiz} onChange={v => setCfg(c => ({ ...c, quiz: v }))} />
          <Toggle label="Avatars & cosmétiques" sub="Contours et couleurs de nom exclusifs" price={0.99} value={cfg.avatars} onChange={v => setCfg(c => ({ ...c, avatars: v }))} />
          <Toggle label="Support prioritaire" sub="Réponse garantie sous 4h en semaine" price={1.49} value={cfg.support} onChange={v => setCfg(c => ({ ...c, support: v }))} />
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
            <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
              <span>Base personnalisée</span><span>{CUSTOM_BASE_PRICE.toFixed(2)}€</span>
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
          <button onClick={() => onChoose(cfg)} disabled={processing}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-center transition-all font-[family-name:var(--font-display)] disabled:opacity-50 hover:-translate-y-0.5"
            style={{ background: "var(--greek-gold)", color: "#fff" }}>
            {processing ? (
              <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
            ) : (
              <>{ctaLabel} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
            )}
          </button>
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
}: {
  plans: ChooserPlan[];
  onChoosePlan: (plan: ChooserPlan) => void;
  onChooseCustom: (config: CustomPlanConfig) => void;
  planCta: (plan: ChooserPlan) => string;
  customCtaLabel?: string;
  processingKey?: string | number | null;
  currentPlanId?: string | number | null;
  showCustom?: boolean;
}) {
  const [tab, setTab] = useState<"familles" | "custom">("familles");
  const [billing, setBilling] = useState<string>("month");

  const TABS = [
    { id: "familles" as const, label: "Pour les familles" },
    ...(showCustom ? [{ id: "custom" as const, label: "Sur mesure" }] : []),
  ];

  const freePlans = plans.filter(p => Number(p.price) === 0);
  const paidForInterval = plans.filter(p => Number(p.price) > 0 && p.billing_interval === billing);
  const list = [...paidForInterval, ...freePlans];

  return (
    <div>
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
          {/* Onglets de période */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
              {INTERVAL_LABELS.map(it => (
                <button key={it.id} onClick={() => setBilling(it.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all font-[family-name:var(--font-display)]"
                  style={billing === it.id ? { background: "var(--greek-blue)", color: "#fff" } : { background: "transparent", color: "var(--greek-blue)" }}>
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour cette période.</p>
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
            <p className="text-[var(--text-muted)] text-sm">Ajustez les options, le prix se met à jour automatiquement.</p>
          </div>
          <Configurator onChoose={onChooseCustom} processing={processingKey === "custom"} ctaLabel={customCtaLabel} />
        </div>
      )}
    </div>
  );
}
