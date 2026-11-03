"use client";

import GlassCheckbox from "@/components/ui/GlassCheckbox";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X, Star, ArrowRight, Sparkles, Info, AlertTriangle } from "lucide-react";
import type { Plan } from "@/lib/plans";
import { FEATURE_ROWS, formatVal, intervalLabel } from "@/lib/planFeatures";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { DEFAULT_PERIODS, type BillingPeriod } from "@/lib/billingPeriods";
import { DEFAULT_CUSTOM_PRICING, aiMultiplier, childrenCost, configFeatures, configPrice, type CustomPlanConfig, type PricingCustomConfig } from "@/lib/customPlanPricing";
import { DEFAULT_VISIBILITY, type PricingLayout, type PricingVisibility } from "@/lib/pricingConfig";
import PeriodChips from "@/components/PeriodChips";
import { groupPlans, type PlanGroup } from "@/lib/planGroups";

/* A row in the comparison: either a real plan or a custom config */
interface CompareItem {
  key: string; // unique key (plan-<id> or custom-<n>)
  name: string;
  price: number;
  billing_interval: string;
  features: Record<string, boolean | number | string | null>;
}


/* ─── Plan detail modal ─── */
function PlanModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{
        background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "none",
        transition: "background 0.26s, backdrop-filter 0.26s",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translateY(0) scale(1)"
            : "translateY(32px) scale(0.97)",
          transition: "opacity 0.26s, transform 0.26s",
        }}
      >
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />

        <div
          className="px-8 pt-6 pb-7 text-center relative"
          style={{ background: "var(--greek-blue)" }}
        >
          <div className="absolute top-4 right-4">
            <GlassCloseButton onClick={handleClose} variant="dark" size="sm" />
          </div>
          {plan.promo_description && (
            <div
              className="inline-flex items-center gap-1 text-xs font-bold mb-3"
              style={{ color: "var(--greek-gold)" }}
            >
              <Sparkles className="w-3 h-3" />
              {plan.promo_description}
            </div>
          )}
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white mb-1">
            {plan.name}
          </h2>
          {plan.description && (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {plan.description}
            </p>
          )}
          <div className="mt-5 flex items-end justify-center gap-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">
              {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
            </span>
            {Number(plan.price) > 0 && (
              <span
                className="text-sm mb-2"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {intervalLabel(plan.billing_interval)}
              </span>
            )}
          </div>
          {plan.trial_days > 0 && (
            <div
              className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(197,161,72,0.18)",
                color: "var(--greek-gold)",
              }}
            >
              {plan.trial_days} jours d&apos;essai gratuit
            </div>
          )}
        </div>

        <div className="px-8 py-6">
          <ul className="space-y-3 mb-6">
            {FEATURE_ROWS.map((row) => {
              const { label, included } = formatVal(
                row.key,
                plan.features?.[row.key],
              );
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${included ? "bg-[rgba(197,161,72,0.12)]" : "bg-gray-50"}`}
                  >
                    {included ? (
                      <Check
                        className="w-3 h-3"
                        style={{ color: "var(--greek-gold)" }}
                        aria-label="Inclus"
                      />
                    ) : (
                      <X
                        className="w-3 h-3 text-gray-300"
                        aria-label="Non inclus"
                      />
                    )}
                  </div>
                  <span
                    className={`text-sm flex-1 ${included ? "text-[var(--text-dark)]" : "text-gray-300"}`}
                  >
                    {row.label}
                  </span>
                  {included && label !== "Inclus" && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--greek-gold)" }}
                    >
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <GlassButton
            href="/auth/inscription"
            variant="gold"
            fullWidth
            className="font-[family-name:var(--font-display)] font-bold text-sm"
          >
            <span className="inline-flex items-center gap-2">
              {Number(plan.price) === 0
                ? "Commencer gratuitement"
                : "Choisir ce plan"}
              <ArrowRight className="w-4 h-4" />
            </span>
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Fiche d'une formule avec le choix de la durée dedans (présentation « par formule ») ─── */
function PlanGroupCard({ group, autoPopular, hideCompare, cardsVisible, onOpen, comparePlanIds, onToggleCompare }: {
  group: PlanGroup<Plan>;
  autoPopular: boolean;
  hideCompare: boolean;
  cardsVisible: boolean;
  onOpen: (p: Plan) => void;
  comparePlanIds: Set<number>;
  onToggleCompare: (id: number) => void;
}) {
  const initial = () => group.plans.find((p) => p.features?.popular === true) ?? group.plans[0];
  const [sel, setSel] = useState<string>(() => String(initial().id));
  const plan = group.plans.find((p) => String(p.id) === sel) ?? initial();
  return (
    <PlanCard
      plan={plan}
      displayName={group.name}
      popular={Number(plan.price) > 0 && (plan.features?.popular === true || autoPopular)}
      hideChildren={false}
      cardsVisible={cardsVisible}
      onOpen={() => onOpen(plan)}
      hideCompare={hideCompare}
      compareChecked={comparePlanIds.has(plan.id)}
      onToggleCompare={() => onToggleCompare(plan.id)}
      chips={<PeriodChips plans={group.plans} value={plan.id} onChange={setSel} />}
    />
  );
}

/**
 * Les fiches de formules, EXACTEMENT comme sur la page Tarifs : une fiche par formule avec le choix de la durée dedans
 * (présentation « byPlan »), ou un sélecteur de période au-dessus des fiches (« byPeriod »). Même ordre (formules
 * payantes dans l'ordre réglé en admin, gratuite à la fin), même fiche « Populaire ». Utilisé par /tarifs et par l'aperçu
 * de la page d'accueil, pour qu'ils ne divergent jamais.
 */
export function PlansGrid({
  plans,
  periods,
  layout,
  popularAuto,
  cardsVisible,
  hideCompare,
  comparePlanIds,
  onToggleCompare,
  onOpen,
}: {
  plans: Plan[];
  periods: BillingPeriod[];
  layout: PricingLayout;
  popularAuto: boolean;
  cardsVisible: boolean;
  hideCompare: boolean;
  comparePlanIds: Set<number>;
  onToggleCompare: (id: number) => void;
  onOpen: (p: Plan) => void;
}) {
  const [interval, setInterval] = useState<string>(() => (periods.some((p) => p.id === "month") ? "month" : periods[0]?.id ?? "month"));

  if (layout === "byPlan") {
    // Une fiche par formule : « Solo - 1 mois », « Solo - 1 an »… se regroupent sous « Solo ».
    const groupedAll = groupPlans(plans.filter((p) => Number(p.price) === 0 || periods.some((x) => x.id === p.billing_interval)));
    const paidGroups = groupedAll.filter((g) => Number(g.plans[0].price) > 0);
    const groups = [...paidGroups, ...groupedAll.filter((g) => Number(g.plans[0].price) === 0)];
    const anyGroupFlagged = paidGroups.some((g) => g.plans.some((p) => p.features?.popular === true));
    if (groups.length === 0) return <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour le moment.</p>;
    return (
      <div className={`grid grid-cols-1 gap-8 ${groups.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : groups.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
        {groups.map((g, idx) => (
          <PlanGroupCard
            key={g.key}
            group={g}
            autoPopular={popularAuto && !anyGroupFlagged && paidGroups.length > 1 && idx === 1 && Number(g.plans[0].price) > 0}
            hideCompare={hideCompare}
            cardsVisible={cardsVisible}
            onOpen={onOpen}
            comparePlanIds={comparePlanIds}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
    );
  }

  const list = plans.filter((p) => p.billing_interval === interval);
  return (
    <>
      <div className="flex justify-center mb-10">
        <GlassSegmentedControl options={periods.map((p) => ({ id: p.id, label: p.label }))} value={interval} onChange={setInterval} size="sm" />
      </div>
      {list.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour le moment.</p>
      ) : (
        <div className={`grid grid-cols-1 gap-8 ${list.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : list.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
          {list.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              popular={list.some((p) => p.features?.popular === true) ? plan.features?.popular === true : popularAuto && list.length > 1 && idx === 1}
              hideChildren={false}
              cardsVisible={cardsVisible}
              onOpen={() => onOpen(plan)}
              hideCompare={hideCompare}
              compareChecked={comparePlanIds.has(plan.id)}
              onToggleCompare={() => onToggleCompare(plan.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Plan card (used in both Familles and Lycéens tabs) ─── */
function PlanCard({
  plan,
  popular,
  hideChildren,
  cardsVisible,
  onOpen,
  compareChecked,
  onToggleCompare,
  hideCompare = false,
  displayName,
  chips,
}: {
  plan: Plan;
  /** « Solo » au lieu de « Solo - 1 mois » (présentation par formule). */
  displayName?: string;
  /** Choix de la durée sous le nom (présentation par formule). */
  chips?: ReactNode;
  popular: boolean;
  hideChildren: boolean;
  cardsVisible: boolean;
  onOpen: () => void;
  compareChecked: boolean;
  onToggleCompare: () => void;
  hideCompare?: boolean;
}) {
  const rows = FEATURE_ROWS.slice(0, 4).filter(
    (r) => !(hideChildren && r.key === "max_children"),
  );
  return (
    <div
      className="h-full"
      style={{
        position: "relative",
        zIndex: popular ? 10 : 1,
        opacity: cardsVisible ? undefined : 0,
        animation: cardsVisible
          ? `cardIn 0.5s ease-out ${popular ? "180ms" : "0ms"} both`
          : "none",
      }}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl group h-full"
        style={{
          border: popular
            ? "2px solid var(--greek-gold)"
            : "1px solid var(--greek-border)",
          boxShadow: popular
            ? "0 8px 40px rgba(197,161,72,0.18)"
            : "0 2px 12px rgba(15,30,58,0.05)",
        }}
      >
        {popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-current" /> Populaire
            </div>
          </div>
        )}

        <div className="px-7 pt-8 pb-5 text-center border-b border-[var(--greek-border)]">
          <div className="min-h-[26px] mb-3 flex flex-wrap items-center justify-center gap-2">
            {/* Avec un essai gratuit, seul le badge vert s'affiche : la mention dorée disait la même chose. */}
            {plan.promo_description && !(plan.trial_days > 0) && (
              <div className="inline-flex items-center gap-1 text-xs font-bold text-[var(--greek-gold)]">
                <Sparkles className="w-3 h-3" />
                {plan.promo_description}
              </div>
            )}
            {plan.trial_days > 0 && (
              <div className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                {plan.trial_days} jours d&apos;essai gratuit
              </div>
            )}
          </div>
          <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-1">
            {displayName ?? plan.name}
          </h3>
          {plan.description && (
            <p className="text-sm text-[var(--text-muted)]">
              {plan.description}
            </p>
          )}
        </div>

        {chips}

        <div className="px-7 py-6 text-center border-b border-[var(--greek-border)]">
          <div className="flex items-end justify-center gap-1">
            <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--greek-blue)]">
              {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
            </span>
            {Number(plan.price) > 0 && (
              <span className="text-sm text-[var(--text-muted)] mb-1.5">
                {intervalLabel(plan.billing_interval)}
              </span>
            )}
          </div>
        </div>

        <div className="px-7 py-6 flex-grow flex flex-col">
          <ul className="space-y-2.5 mb-6">
            {rows.map((row) => {
              const { label, included } = formatVal(
                row.key,
                plan.features?.[row.key],
              );
              if (!included) return null;
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[rgba(197,161,72,0.12)] flex items-center justify-center flex-shrink-0">
                    <Check
                      className="w-3 h-3 text-[var(--greek-gold)]"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm text-[var(--text-dark)] flex-1">
                    {row.label}
                  </span>
                  {label !== "Inclus" && (
                    <span className="text-xs font-semibold text-[var(--greek-gold)]">
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-auto">
            <GlassButton
              onClick={onOpen}
              variant={popular ? "navy" : "outline"}
              fullWidth
              className="font-bold font-[family-name:var(--font-display)]"
            >
              Voir les détails <ArrowRight className="w-4 h-4" />
            </GlassButton>

            {!hideCompare && (
              <label
                className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer select-none"
                style={{ color: "var(--text-muted)" }}
              >
                <GlassCheckbox
                  checked={compareChecked}
                  onChange={onToggleCompare}
                  
                />
                Comparer
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Comparison table (driven by generic CompareItem list) ─── */
function ComparisonTable({
  items,
  onRemove,
}: {
  items: CompareItem[];
  onRemove: (key: string) => void;
}) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tip, setTip] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th
              className="sticky top-0 z-20 text-left px-6 py-5 text-xs font-semibold uppercase tracking-wider"
              style={{
                background: "var(--greek-blue)",
                color: "rgba(255,255,255,0.55)",
                width: "34%",
              }}
            >
              Fonctionnalité
            </th>
            {items.map((item) => (
              <th
                key={item.key}
                className="sticky top-0 z-20 text-center px-4 py-0"
                style={{ background: "var(--greek-blue)", minWidth: 150 }}
              >
                <div className="py-5 relative">
                  <button
                    onClick={() => onRemove(item.key)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    aria-label="Retirer de la comparaison"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div
                    className="font-bold text-sm"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    {item.name}
                  </div>
                  <div className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    {Number(item.price) === 0
                      ? "Gratuit"
                      : `${item.price.toFixed(2)}€`}
                    {Number(item.price) > 0 && (
                      <span
                        className="text-xs font-normal ml-0.5"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {intervalLabel(item.billing_interval)}
                      </span>
                    )}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {FEATURE_ROWS.map((row, rIdx) => (
            <tr
              key={row.key}
              onMouseEnter={() => setHoveredRow(rIdx)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                background:
                  hoveredRow === rIdx
                    ? "rgba(197,161,72,0.04)"
                    : rIdx % 2 === 0
                      ? "white"
                      : "var(--greek-cream)",
              }}
            >
              <td
                className="px-6 py-4 border-b"
                style={{ borderColor: "var(--greek-border)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--greek-blue)" }}
                  >
                    {row.label}
                  </span>
                  {row.tip && (
                    <button
                      onMouseEnter={() => setTip(row.tip!)}
                      onMouseLeave={() => setTip(null)}
                      className="relative"
                    >
                      <Info className="w-3.5 h-3.5 text-gray-300 hover:text-gray-400 transition-colors" />
                      {tip === row.tip && (
                        <div
                          className="absolute left-5 top-0 z-30 w-52 px-3 py-2 text-xs rounded-xl shadow-xl pointer-events-none"
                          style={{
                            background: "var(--greek-blue)",
                            color: "rgba(255,255,255,0.8)",
                          }}
                        >
                          {row.tip}
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </td>

              {items.map((item) => {
                const { label, included } = formatVal(
                  row.key,
                  item.features?.[row.key],
                );
                return (
                  <td
                    key={item.key}
                    className="px-4 py-4 text-center border-b"
                    style={{ borderColor: "var(--greek-border)" }}
                  >
                    {included ? (
                      label === "Inclus" ? (
                        <div className="flex justify-center">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(197,161,72,0.12)" }}
                          >
                            <Check
                              className="w-3.5 h-3.5"
                              style={{ color: "var(--greek-gold)" }}
                              aria-label="Inclus"
                            />
                          </div>
                        </div>
                      ) : (
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{
                            background: "rgba(197,161,72,0.08)",
                            color: "var(--text-dark)",
                          }}
                        >
                          {label}
                        </span>
                      )
                    ) : (
                      <div className="flex justify-center">
                        <X
                          className="w-4 h-4 text-gray-200"
                          aria-label="Non inclus"
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Configurator ─── */

/** Ligne du comparateur pour la formule sur-mesure : prix et fonctionnalités calculés comme au paiement (mêmes réglages). */
function configToCompareItem(c: CustomPlanConfig, key: string, pricing: PricingCustomConfig, name: string): CompareItem {
  return { key, name, price: configPrice(c, pricing), billing_interval: "month", features: configFeatures(c, pricing) };
}

function Toggle({
  label,
  sub,
  price,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  price: number;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl"
      style={{
        background: "#fff",
        border: `1.5px solid ${value ? "rgba(197,161,72,0.5)" : "var(--greek-border)"}`,
      }}
    >
      <div className="min-w-0">
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--greek-blue)" }}
        >
          {label}
        </span>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
        <span
          className="text-xs font-semibold ml-1"
          style={{ color: "var(--greek-gold)" }}
        >
          +{price.toFixed(2)}€
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{
          background: value ? "var(--greek-gold)" : "rgba(15,30,58,0.12)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function Configurator({
  onAdd,
  alreadyAdded,
  pricing,
  hideCompare = false,
}: {
  onAdd: (c: CustomPlanConfig) => void;
  alreadyAdded: boolean;
  /** Comparateur masqué : le bouton mène à l'inscription au lieu d'ajouter à la comparaison. */
  hideCompare?: boolean;
  /** Réglages enregistrés en admin (prix de base, enfants, IA, options) : les mêmes qu'au paiement. */
  pricing: PricingCustomConfig;
}) {
  const [cfg, setCfg] = useState<CustomPlanConfig>({ children: 1, ai: "none", options: {} });
  const n = Math.max(1, cfg.children);
  const mult = aiMultiplier(n, pricing);
  const total = configPrice(cfg, pricing);
  const aiOption = pricing.ai_options.find((o) => o.id === cfg.ai) ?? pricing.ai_options[0];
  const aiActualPrice = Math.round(aiOption.basePrice * mult * 100) / 100;
  const aiIdx = Math.max(0, pricing.ai_options.findIndex((o) => o.id === cfg.ai));

  return (
    <div className="grid md:grid-cols-5 gap-8 items-start">
      <div className="md:col-span-3 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Nombre d&apos;enfants
            </p>
            {n > 1 && (
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--greek-gold)" }}
              >
                +{childrenCost(n, pricing).toFixed(2)}€
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={pricing.max_children}
              value={cfg.children}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  children: Math.min(pricing.max_children, Math.max(1, parseInt(e.target.value) || 1)),
                }))
              }
              className="w-28 px-4 py-2.5 rounded-xl text-sm font-bold text-center border outline-none focus:border-[var(--greek-blue)]"
              style={{
                border: "1.5px solid var(--greek-border)",
                color: "var(--greek-blue)",
              }}
            />
            <div
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              <div>1er enfant inclus</div>
              <div>Plus d&apos;enfants → IA plus chère</div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              IA Calia
            </p>
            {cfg.ai !== "none" && (
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--greek-gold)" }}
              >
                +{aiActualPrice.toFixed(2)}€
                {n > 1 && (
                  <span
                    className="ml-1 font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    (×{mult.toFixed(2)} pour {n} enfants)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="relative">
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ border: "1.5px solid var(--greek-border)" }}
            >
              {pricing.ai_options.map((o, i) => (
                <button
                  key={o.id}
                  onClick={() => setCfg((c) => ({ ...c, ai: o.id }))}
                  className="flex-1 py-2.5 text-center transition-all"
                  style={{
                    background: i <= aiIdx ? "var(--greek-blue)" : "#fff",
                    color:
                      i <= aiIdx
                        ? i === aiIdx
                          ? "var(--greek-gold)"
                          : "rgba(255,255,255,0.6)"
                        : "var(--text-muted)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    borderRight:
                      i < pricing.ai_options.length - 1
                        ? "1px solid rgba(255,255,255,0.15)"
                        : "none",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {n > 1 && cfg.ai !== "none" && (
            <p
              className="text-xs mt-1.5"
              style={{ color: "rgba(197,161,72,0.8)" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Le prix de l&apos;IA augmente avec le nombre d&apos;enfants
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          {pricing.options.map((opt) => (
            <Toggle
              key={opt.id}
              label={opt.label}
              sub={opt.sub}
              price={opt.price}
              value={!!cfg.options[opt.id]}
              onChange={(v) => setCfg((c) => ({ ...c, options: { ...c.options, [opt.id]: v } }))}
            />
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <div
          className="rounded-2xl p-7 sticky top-24"
          style={{ background: "var(--greek-blue)" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "rgba(197,161,72,0.7)" }}
          >
            Votre formule
          </p>
          <div className="flex items-end gap-1 mb-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">
              {total.toFixed(2)}€
            </span>
            <span
              className="text-sm mb-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              /mois
            </span>
          </div>
          <p
            className="text-xs mb-5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {`Sur mesure · ${cfg.children} enfant${cfg.children > 1 ? "s" : ""}`}
          </p>
          <div className="space-y-1.5 mb-6 text-xs border-t border-white/10 pt-4">
            <div
              className="flex justify-between"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <span>Base personnalisée</span>
              <span>{pricing.base_price.toFixed(2)}€</span>
            </div>
            {n > 1 && (
              <div
                className="flex justify-between"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                <span>{n} enfants</span>
                <span>+{childrenCost(n, pricing).toFixed(2)}€</span>
              </div>
            )}
            {cfg.ai !== "none" && (
              <div
                className="flex justify-between"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                <span>IA {aiOption.label}</span>
                <span>+{aiActualPrice.toFixed(2)}€</span>
              </div>
            )}
          </div>
          {hideCompare ? (
            <GlassButton href="/auth/inscription" variant="gold" fullWidth className="font-[family-name:var(--font-display)] font-bold text-sm">
              <span className="inline-flex items-center gap-2">Commencer <ArrowRight className="w-4 h-4" /></span>
            </GlassButton>
          ) : (
            <GlassButton
              onClick={() => onAdd(cfg)}
              disabled={alreadyAdded}
              variant="gold"
              fullWidth
              className="font-[family-name:var(--font-display)] font-bold text-sm"
            >
              <span className="inline-flex items-center gap-2">
                {alreadyAdded ? <>Déjà ajouté <Check className="w-4 h-4" aria-hidden="true" /></> : "Ajouter à la comparaison"}
                {!alreadyAdded && <ArrowRight className="w-4 h-4" />}
              </span>
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}

type TabId = "familles" | "abonnement";

const DEFAULT_TABS = { familles: "Pour les familles", custom: "Sur mesure" };

/** Tout ce qui est réellement interactif sur /tarifs : tabs, cartes de plan,
 * configurateur et comparateur. Isolé en client island, reçoit les plans
 * déjà chargés côté serveur (plus de skeleton de chargement à l'arrivée). Le
 * hero, la garantie et la mini-FAQ restent rendus côté serveur autour de ce
 * composant. */
export default function TarifsInteractive({
  initialPlans,
  periods = DEFAULT_PERIODS,
  customPricing = DEFAULT_CUSTOM_PRICING,
  tabLabels = DEFAULT_TABS,
  visibility = DEFAULT_VISIBILITY,
  layout = "byPeriod",
  popularAuto = true,
}: {
  /** Un onglet par période, ou une fiche par formule avec le choix de la durée dedans. */
  layout?: PricingLayout;
  /** Étiquette « Populaire » automatique sur la fiche du milieu quand aucune n'est marquée. */
  popularAuto?: boolean;
  initialPlans: Plan[];
  /** Onglets de périodes proposés (réglés en admin : Abonnements). */
  periods?: BillingPeriod[];
  /** Réglages du sur-mesure (admin) : le même calcul qu'au paiement. */
  customPricing?: PricingCustomConfig;
  tabLabels?: { familles: string; custom: string };
  /** Onglets et blocs que l'admin affiche ou masque. */
  visibility?: PricingVisibility;
}) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<TabId>("familles");
  const [cardsVisible, setCardsVisible] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);

  const [comparePlanIds, setComparePlanIds] = useState<Set<number>>(new Set());
  const [customConfig, setCustomConfig] = useState<CustomPlanConfig | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCardsVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const togglePlanCompare = (id: number) => {
    setComparePlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const compareItems: CompareItem[] = [
    ...initialPlans
      .filter((p) => comparePlanIds.has(p.id))
      .map((p) => ({
        key: `plan-${p.id}`,
        name: p.name,
        price: Number(p.price),
        billing_interval: p.billing_interval,
        features: p.features,
      })),
    ...(customConfig ? [configToCompareItem(customConfig, "custom", customPricing, "Mon abonnement personnalisé")] : []),
  ];

  const removeCompare = (key: string) => {
    if (key === "custom") {
      setCustomConfig(null);
      return;
    }
    const id = Number(key.replace("plan-", ""));
    setComparePlanIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const TABS: { id: TabId; label: string }[] = [
    ...(visibility.familles ? [{ id: "familles" as TabId, label: tabLabels.familles }] : []),
    ...(visibility.custom ? [{ id: "abonnement" as TabId, label: tabLabels.custom }] : []),
  ];
  // Onglet masqué : on affiche celui qui reste (jamais une page vide).
  const activeTab: TabId = TABS.some((t) => t.id === tab) ? tab : TABS[0]?.id ?? "familles";

  return (
    <>
      <section className="py-20 bg-[var(--greek-cream)]" ref={cardsRef}>
        <div className="container mx-auto px-6 max-w-5xl">
          <style>{`
            @keyframes cardIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
          `}</style>

          {TABS.length > 1 && (
            <div className="flex justify-center mb-12">
              <GlassSegmentedControl
                options={TABS}
                value={activeTab}
                onChange={(id) => setTab(id as TabId)}
              />
            </div>
          )}

          {activeTab === "familles" && (
            <>
              <PlansGrid
                plans={initialPlans}
                periods={periods}
                layout={layout}
                popularAuto={popularAuto}
                cardsVisible={cardsVisible}
                hideCompare={!visibility.comparator}
                comparePlanIds={comparePlanIds}
                onToggleCompare={togglePlanCompare}
                onOpen={setSelectedPlan}
              />
            </>
          )}
          {activeTab === "abonnement" && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-[var(--greek-blue)] mb-2">
                  Composez votre formule
                </h2>
                <p className="text-[var(--text-muted)] text-sm">
                  Ajustez les options, le prix se met à jour automatiquement.
                </p>
              </div>
              <Configurator
                onAdd={(c) => setCustomConfig(c)}
                alreadyAdded={customConfig !== null}
                pricing={customPricing}
                hideCompare={!visibility.comparator}
              />
            </div>
          )}

          {visibility.comparator && compareItems.length >= 2 && (
            <div className="mt-16">
              <div className="text-center mb-8">
                <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl md:text-3xl text-[var(--greek-blue)] mb-3">
                  Comparateur
                </h2>
                <div className="flex flex-wrap justify-center gap-2">
                  {compareItems.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "rgba(197,161,72,0.12)",
                        color: "var(--greek-blue)",
                      }}
                    >
                      {item.name}
                      <button
                        onClick={() => removeCompare(item.key)}
                        className="hover:text-[var(--greek-gold)] transition-colors"
                        aria-label="Retirer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <ComparisonTable items={compareItems} onRemove={removeCompare} />
            </div>
          )}
        </div>
      </section>

      {selectedPlan && (
        <PlanModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      )}
    </>
  );
}
