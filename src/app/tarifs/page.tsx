"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { Check, X, Star, ArrowRight, Sparkles, Info } from "lucide-react";

/* ─── Types ─── */
interface Plan {
  id: number;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: Record<string, boolean | number | string | null>;
}

/* A row in the comparison: either a real plan or a custom config */
interface CompareItem {
  key: string;            // unique key (plan-<id> or custom-<n>)
  name: string;
  price: number;
  billing_interval: string;
  features: Record<string, boolean | number | string | null>;
}

/* ─── Floating symbols ─── */
const SYM = [
  { s: "∑", x: 6,  y: 10, z: 96,  d: 0,   t: 7.2  },
  { s: "π", x: 87, y: 7,  z: 72,  d: 1.3, t: 8.5  },
  { s: "√", x: 12, y: 62, z: 58,  d: 0.6, t: 9.1  },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4  },
  { s: "Δ", x: 43, y: 14, z: 50,  d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66,  d: 1.8, t: 8.0  },
  { s: "α", x: 2,  y: 40, z: 44,  d: 2.7, t: 9.3  },
  { s: "×", x: 76, y: 26, z: 54,  d: 0.4, t: 7.8  },
  { s: "θ", x: 50, y: 78, z: 62,  d: 2.0, t: 8.8  },
  { s: "β", x: 28, y: 53, z: 42,  d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46,  d: 1.1, t: 9.7  },
  { s: "÷", x: 19, y: 84, z: 38,  d: 2.9, t: 7.3  },
];

/* ─── Feature rows with tooltips ─── */
const FEATURE_ROWS: { key: string; label: string; tip?: string }[] = [
  { key: "max_children",           label: "Enfants",                 tip: "Profils enfants actifs simultanément" },
  { key: "access_level_exercises", label: "Niveaux scolaires",       tip: "CP à 6ème / CP à 3ème / CP à Terminale" },
  { key: "ai_access",              label: "IA EpsiAI",               tip: "Accès à l'assistante pédagogique IA" },
  { key: "ai_daily_limit",         label: "Questions IA / jour",     tip: "Nombre de messages envoyés à EpsiAI" },
  { key: "quiz_access",            label: "Quiz & évaluations",      tip: "Accès à tous les quiz" },
  { key: "detailed_reports",       label: "Rapports hebdomadaires",  tip: "Email récapitulatif chaque semaine" },
  { key: "custom_avatars",         label: "Avatars & cosmétiques",   tip: "Contours et couleurs de nom exclusifs" },
  { key: "priority_support",       label: "Support prioritaire",     tip: "Réponse garantie sous 4h en semaine" },
];

function formatVal(key: string, val: boolean | number | string | null): { label: string; included: boolean } {
  if (val === false || val === null || val === 0 || val === "none") return { label: "", included: false };
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
  if (key === "history") {
    if (val === "unlim" || val === "unlimited") return { label: "Illimité", included: true };
    if (val === "30d") return { label: "30 jours", included: true };
    if (val === "7d") return { label: "7 jours", included: true };
    return { label: String(val), included: true };
  }
  return { label: String(val), included: true };
}

const intervalLabel = (i: string) => i === "year" ? "/an" : "/mois";

const isLyceen = (p: Plan) => /lycéen/i.test(p.name);

/* ─── Mini FAQ item ─── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(197,161,72,0.18)", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[rgba(197,161,72,0.03)]"
      >
        <span className="font-[family-name:var(--font-display)] font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>{question}</span>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-light transition-transform duration-300"
          style={{ background: "rgba(197,161,72,0.10)", color: "var(--greek-gold)", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >+</span>
      </button>
      <div style={{ maxHeight: open ? "200px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p className="px-6 pb-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{answer}</p>
      </div>
    </div>
  );
}

/* ─── Plan detail modal ─── */
function PlanModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{
        background: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "none",
        transition: "background 0.26s, backdrop-filter 0.26s",
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.97)",
          transition: "opacity 0.26s, transform 0.26s",
        }}
      >
        {/* Handle mobile */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />

        {/* Navy header */}
        <div className="px-8 pt-6 pb-7 text-center relative" style={{ background: "var(--greek-blue)" }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <X className="w-4 h-4" />
          </button>
          {plan.promo_description && (
            <div className="inline-flex items-center gap-1 text-xs font-bold mb-3" style={{ color: "var(--greek-gold)" }}>
              <Sparkles className="w-3 h-3" />{plan.promo_description}
            </div>
          )}
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white mb-1">{plan.name}</h2>
          {plan.description && <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{plan.description}</p>}
          <div className="mt-5 flex items-end justify-center gap-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">
              {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
            </span>
            {Number(plan.price) > 0 && (
              <span className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>{intervalLabel(plan.billing_interval)}</span>
            )}
          </div>
          {plan.trial_days > 0 && (
            <div className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(197,161,72,0.18)", color: "var(--greek-gold)" }}>
              {plan.trial_days} jours d&apos;essai gratuit
            </div>
          )}
        </div>

        {/* Features */}
        <div className="px-8 py-6">
          <ul className="space-y-3 mb-6">
            {FEATURE_ROWS.map(row => {
              const { label, included } = formatVal(row.key, plan.features?.[row.key]);
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${included ? "bg-[rgba(197,161,72,0.12)]" : "bg-gray-50"}`}>
                    {included ? <Check className="w-3 h-3" style={{ color: "var(--greek-gold)" }} /> : <X className="w-3 h-3 text-gray-300" />}
                  </div>
                  <span className={`text-sm flex-1 ${included ? "text-[var(--text-dark)]" : "text-gray-300"}`}>{row.label}</span>
                  {included && label !== "Inclus" && (
                    <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            href="/auth/inscription"
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg font-[family-name:var(--font-display)]"
            style={{ background: "var(--greek-blue)", color: "#fff" }}
          >
            {Number(plan.price) === 0 ? "Commencer gratuitement" : "Choisir ce plan"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Plan card (used in both Familles and Lycéens tabs) ─── */
function PlanCard({
  plan, idx, popular, hideChildren, cardsVisible, onOpen,
  compareChecked, onToggleCompare,
}: {
  plan: Plan;
  idx: number;
  popular: boolean;
  hideChildren: boolean;
  cardsVisible: boolean;
  onOpen: () => void;
  compareChecked: boolean;
  onToggleCompare: () => void;
}) {
  const rows = FEATURE_ROWS.slice(0, 4).filter(r => !(hideChildren && r.key === "max_children"));
  return (
    <div
      style={{
        position: "relative",
        zIndex: popular ? 10 : 1,
        transform: popular ? "scale(1.04)" : undefined,
        opacity: cardsVisible ? undefined : 0,
        animation: cardsVisible ? `cardIn 0.5s ease-out ${popular ? "180ms" : "0ms"} both` : "none",
      }}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl group h-full"
        style={{
          border: popular ? "2px solid var(--greek-gold)" : "1px solid var(--greek-border)",
          boxShadow: popular ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
        }}
      >
        {popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-current" /> Populaire
            </div>
          </div>
        )}

        <div className="px-7 pt-8 pb-5 text-center border-b border-[var(--greek-border)] cursor-pointer" onClick={onOpen}>
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

        <div className="px-7 py-6 text-center border-b border-[var(--greek-border)] cursor-pointer" onClick={onOpen}>
          <div className="flex items-end justify-center gap-1">
            <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--greek-blue)]">
              {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
            </span>
            {Number(plan.price) > 0 && (
              <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>
            )}
          </div>
        </div>

        <div className="px-7 py-6 flex-grow flex flex-col">
          <ul className="space-y-2.5 mb-6">
            {rows.map(row => {
              const { label, included } = formatVal(row.key, plan.features?.[row.key]);
              if (!included) return null;
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[rgba(197,161,72,0.12)] flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[var(--greek-gold)]" />
                  </div>
                  <span className="text-sm text-[var(--text-dark)] flex-1">{row.label}</span>
                  {label !== "Inclus" && (
                    <span className="text-xs font-semibold text-[var(--greek-gold)]">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            onClick={onOpen}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md font-[family-name:var(--font-display)]"
            style={popular
              ? { background: "var(--greek-blue)", color: "white" }
              : { border: "2px solid var(--greek-blue)", color: "var(--greek-blue)" }
            }
          >
            Voir les détails <ArrowRight className="w-4 h-4" />
          </button>

          {/* Comparer checkbox */}
          <label className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer select-none" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={compareChecked}
              onChange={onToggleCompare}
              className="w-4 h-4 rounded accent-[var(--greek-gold)] cursor-pointer"
            />
            Comparer
          </label>
        </div>
      </div>
    </div>
  );
}

/* ─── Comparison table (driven by generic CompareItem list) ─── */
function ComparisonTable({ items, onRemove }: { items: CompareItem[]; onRemove: (key: string) => void }) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tip, setTip] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th
              className="sticky top-0 z-20 text-left px-6 py-5 text-xs font-semibold uppercase tracking-wider"
              style={{ background: "var(--greek-blue)", color: "rgba(255,255,255,0.35)", width: "34%" }}
            >
              Fonctionnalité
            </th>
            {items.map(item => (
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
                  <div className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{item.name}</div>
                  <div className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    {Number(item.price) === 0 ? "Gratuit" : `${item.price.toFixed(2)}€`}
                    {Number(item.price) > 0 && (
                      <span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{intervalLabel(item.billing_interval)}</span>
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
              style={{ background: hoveredRow === rIdx ? "rgba(197,161,72,0.04)" : rIdx % 2 === 0 ? "white" : "var(--greek-cream)" }}
            >
              <td className="px-6 py-4 border-b" style={{ borderColor: "var(--greek-border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--greek-blue)" }}>{row.label}</span>
                  {row.tip && (
                    <button
                      onMouseEnter={() => setTip(row.tip!)}
                      onMouseLeave={() => setTip(null)}
                      className="relative"
                    >
                      <Info className="w-3.5 h-3.5 text-gray-300 hover:text-gray-400 transition-colors" />
                      {tip === row.tip && (
                        <div className="absolute left-5 top-0 z-30 w-52 px-3 py-2 text-xs rounded-xl shadow-xl pointer-events-none"
                          style={{ background: "var(--greek-blue)", color: "rgba(255,255,255,0.8)" }}>
                          {row.tip}
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </td>

              {items.map(item => {
                const { label, included } = formatVal(row.key, item.features?.[row.key]);
                return (
                  <td key={item.key} className="px-4 py-4 text-center border-b" style={{ borderColor: "var(--greek-border)" }}>
                    {included ? (
                      label === "Inclus" ? (
                        <div className="flex justify-center">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(197,161,72,0.12)" }}>
                            <Check className="w-3.5 h-3.5" style={{ color: "var(--greek-gold)" }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(197,161,72,0.08)", color: "var(--text-dark)" }}>
                          {label}
                        </span>
                      )
                    ) : (
                      <div className="flex justify-center">
                        <X className="w-4 h-4 text-gray-200" />
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

// Options IA (prix de base, multipliés ensuite par le nb d'enfants)
const AI_OPTIONS = [
  { id: "none",  label: "Aucune",     daily: 0,   basePrice: 0    },
  { id: "5",     label: "5/j",        daily: 5,   basePrice: 0.79 },
  { id: "10",    label: "10/j",       daily: 10,  basePrice: 1.49 },
  { id: "20",    label: "20/j",       daily: 20,  basePrice: 2.49 },
  { id: "50",    label: "50/j",       daily: 50,  basePrice: 4.29 },
  { id: "100",   label: "100/j",      daily: 100, basePrice: 5.99 },
  { id: "unlim", label: "Illimitée",  daily: -1,  basePrice: 6.99 },
] as const;
type AIId = "none" | "5" | "10" | "20" | "50" | "100" | "unlim";

const BASE_PRICE = { lyceen: 1.99, famille: 2.99 };

/** Coût des enfants : quadratique */
function childrenCost(n: number): number {
  if (n <= 1) return 0;
  const x = n - 1;
  return Math.round((0.5 * x + 0.25 * x * x) * 100) / 100;
}

/** Multiplicateur IA selon nb enfants (exponentiel, plafonné à ×4) */
function aiMultiplier(type: "lyceen" | "famille", n: number): number {
  if (type === "lyceen") return 1;
  return Math.min(1 + (n - 1) * 0.35, 4.0);
}

interface ConfigState {
  type: "lyceen" | "famille";
  children: number;   // nombre saisi librement
  ai: AIId;
  reports: boolean;
  support: boolean;
  avatars: boolean;
  quiz: boolean;
}

function configPrice(c: ConfigState): number {
  let p = BASE_PRICE[c.type];
  const n = Math.max(1, c.children);
  if (c.type === "famille") p += childrenCost(n);
  const aiBase = AI_OPTIONS.find(o => o.id === c.ai)!.basePrice;
  p += Math.round(aiBase * aiMultiplier(c.type, n) * 100) / 100;
  if (c.reports) p += 0.99;
  if (c.support) p += 1.49;
  if (c.avatars) p += 0.99;
  if (c.quiz)    p += 0.99;
  return Math.round(p * 100) / 100;
}

function configToCompareItem(c: ConfigState, key: string): CompareItem {
  const ai = AI_OPTIONS.find(o => o.id === c.ai)!;
  const n = Math.max(1, c.children);
  return {
    key,
    name: c.type === "lyceen" ? "Mon plan (Lycéen)" : "Mon plan (Famille)",
    price: configPrice(c),
    billing_interval: "month",
    features: {
      max_children: c.type === "famille" ? n : 0,
      access_level_exercises: "all",
      ai_access: c.ai === "none" ? "none" : c.ai === "unlim" ? "unlimited" : "limited",
      ai_daily_limit: c.ai === "none" ? 0 : ai.daily,
      detailed_reports: c.reports,
      custom_avatars: c.avatars,
      priority_support: c.support,
      quiz_access: c.quiz,
    },
  };
}

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

function Configurator({ onAdd, alreadyAdded }: { onAdd: (c: ConfigState) => void; alreadyAdded: boolean }) {
  const [cfg, setCfg] = useState<ConfigState>({
    type: "famille", children: 1, ai: "none",
    reports: false, support: false, avatars: false, quiz: false,
  });
  const n = Math.max(1, cfg.children);
  const mult = aiMultiplier(cfg.type, n);
  const total = configPrice(cfg);
  const aiOption = AI_OPTIONS.find(o => o.id === cfg.ai)!;
  const aiActualPrice = Math.round(aiOption.basePrice * mult * 100) / 100;
  const aiIdx = AI_OPTIONS.findIndex(o => o.id === cfg.ai);

  return (
    <div className="grid md:grid-cols-5 gap-8 items-start">
      <div className="md:col-span-3 space-y-6">

        {/* Type */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Type d&apos;abonnement</p>
          <div className="flex gap-3">
            {([["lyceen", "Lycéen solo"], ["famille", "Famille"]] as const).map(([val, lab]) => (
              <button key={val} onClick={() => setCfg(c => ({ ...c, type: val, children: 1 }))}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all font-[family-name:var(--font-display)]"
                style={cfg.type === val
                  ? { background: "var(--greek-blue)", color: "#fff" }
                  : { border: "2px solid var(--greek-border)", color: "var(--greek-blue)" }}>
                {lab}
              </button>
            ))}
          </div>
        </div>

        {/* Enfants — saisie libre */}
        {cfg.type === "famille" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nombre d&apos;enfants</p>
              {n > 1 && <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>
                +{childrenCost(n).toFixed(2)}€
              </span>}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number" min={1} max={999} value={cfg.children}
                onChange={e => setCfg(c => ({ ...c, children: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-28 px-4 py-2.5 rounded-xl text-sm font-bold text-center border outline-none focus:border-[var(--greek-blue)]"
                style={{ border: "1.5px solid var(--greek-border)", color: "var(--greek-blue)" }}
              />
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                <div>1er enfant inclus</div>
                <div>Plus d&apos;enfants → IA plus chère</div>
              </div>
            </div>
          </div>
        )}

        {/* IA — barre de sélection visuelle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>IA EpsiAI</p>
            {cfg.ai !== "none" && (
              <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>
                +{aiActualPrice.toFixed(2)}€
                {cfg.type === "famille" && n > 1 && (
                  <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                    (×{mult.toFixed(2)} pour {n} enfants)
                  </span>
                )}
              </span>
            )}
          </div>
          {/* Barre track */}
          <div className="relative">
            {/* Piste de fond */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--greek-border)" }}>
              {AI_OPTIONS.map((o, i) => (
                <button key={o.id} onClick={() => setCfg(c => ({ ...c, ai: o.id }))}
                  className="flex-1 py-2.5 text-center transition-all"
                  style={{
                    background: i <= aiIdx ? "var(--greek-blue)" : "#fff",
                    color: i <= aiIdx ? (i === aiIdx ? "var(--greek-gold)" : "rgba(255,255,255,0.6)") : "var(--text-muted)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    borderRight: i < AI_OPTIONS.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {cfg.type === "famille" && n > 1 && cfg.ai !== "none" && (
            <p className="text-xs mt-1.5" style={{ color: "rgba(197,161,72,0.8)" }}>
              ⚠ Le prix de l&apos;IA augmente avec le nombre d&apos;enfants
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <Toggle label="Rapports hebdomadaires" sub="Résumé email chaque semaine" price={0.99} value={cfg.reports} onChange={v => setCfg(c => ({ ...c, reports: v }))} />
          <Toggle label="Quiz" sub="Accès à tous les quiz et évaluations" price={0.99} value={cfg.quiz} onChange={v => setCfg(c => ({ ...c, quiz: v }))} />
          <Toggle label="Avatars &amp; cosmétiques" sub="Contours et couleurs de nom exclusifs" price={0.99} value={cfg.avatars} onChange={v => setCfg(c => ({ ...c, avatars: v }))} />
          <Toggle label="Support prioritaire" sub="Réponse garantie sous 4h en semaine" price={1.49} value={cfg.support} onChange={v => setCfg(c => ({ ...c, support: v }))} />
        </div>
      </div>

      {/* Summary card */}
      <div className="md:col-span-2">
        <div className="rounded-2xl p-7 sticky top-24" style={{ background: "var(--greek-blue)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(197,161,72,0.7)" }}>Votre formule</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">{total.toFixed(2)}€</span>
            <span className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>/mois</span>
          </div>
          <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {cfg.type === "famille"
              ? `Famille · ${cfg.children === -1 ? "enfants illimités" : `${cfg.children} enfant${cfg.children > 1 ? "s" : ""}`}`
              : "Lycéen solo"}
          </p>
          {/* Mini détail prix */}
          <div className="space-y-1.5 mb-6 text-xs border-t border-white/10 pt-4">
            <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
              <span>Base {cfg.type === "lyceen" ? "lycéen" : "famille"}</span>
              <span>{BASE_PRICE[cfg.type].toFixed(2)}€</span>
            </div>
            {cfg.type === "famille" && n > 1 && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>{n} enfants</span>
                <span>+{childrenCost(n).toFixed(2)}€</span>
              </div>
            )}
            {cfg.ai !== "none" && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>IA {AI_OPTIONS.find(o => o.id === cfg.ai)!.label}</span>
                <span>+{aiActualPrice.toFixed(2)}€</span>
              </div>
            )}
          </div>
          <button onClick={() => onAdd(cfg)} disabled={alreadyAdded}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all font-[family-name:var(--font-display)] disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{ background: "var(--greek-gold)", color: "#fff" }}>
            {alreadyAdded ? "Déjà ajouté ✓" : "Ajouter à la comparaison"}
            {!alreadyAdded && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
type TabId = "familles" | "lyceens" | "abonnement";

export default function Tarifs() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<TabId>("familles");
  const [cardsVisible,   setCardsVisible]   = useState(false);
  const [garantieVisible, setGarantieVisible] = useState(false);
  const [faqVisible,      setFaqVisible]      = useState(false);
  const cardsRef    = useRef<HTMLDivElement>(null);
  const garantieRef = useRef<HTMLDivElement>(null);
  const faqRef      = useRef<HTMLDivElement>(null);

  // Comparison: set of selected real-plan ids + an optional custom config
  const [comparePlanIds, setComparePlanIds] = useState<Set<number>>(new Set());
  const [customConfig, setCustomConfig] = useState<ConfigState | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then(r => r.json())
      .then(data => {
        setPlans(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || plans.length === 0) return;
    const t = setTimeout(() => setCardsVisible(true), 80);
    return () => clearTimeout(t);
  }, [loading, plans]);

  useEffect(() => {
    const makeObs = (ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
      const el = ref.current; if (!el) return;
      if (el.getBoundingClientRect().top < window.innerHeight) { setter(true); return; }
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setter(true); obs.disconnect(); } }, { threshold: 0.1 });
      obs.observe(el);
      return () => obs.disconnect();
    };
    makeObs(garantieRef, setGarantieVisible);
    makeObs(faqRef, setFaqVisible);
  }, []);

  const famillePlans = plans.filter(p => !isLyceen(p));
  const lyceenPlans = plans.filter(p => isLyceen(p));

  const togglePlanCompare = (id: number) => {
    setComparePlanIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Build list of compare items (preserve plan order, custom last)
  const compareItems: CompareItem[] = [
    ...plans
      .filter(p => comparePlanIds.has(p.id))
      .map(p => ({
        key: `plan-${p.id}`,
        name: p.name,
        price: Number(p.price),
        billing_interval: p.billing_interval,
        features: p.features,
      })),
    ...(customConfig ? [configToCompareItem(customConfig, "custom")] : []),
  ];

  const removeCompare = (key: string) => {
    if (key === "custom") { setCustomConfig(null); return; }
    const id = Number(key.replace("plan-", ""));
    setComparePlanIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "familles", label: "Pour les familles" },
    { id: "lyceens", label: "Pour les lycéens" },
    { id: "abonnement", label: "Mon abonnement" },
  ];

  const renderCards = (list: Plan[], hideChildren: boolean) => (
    <div className={`grid grid-cols-1 gap-8 ${list.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : list.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
      {list.map((plan, idx) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          idx={idx}
          popular={list.length > 1 && idx === 1}
          hideChildren={hideChildren}
          cardsVisible={cardsVisible}
          onOpen={() => setSelectedPlan(plan)}
          compareChecked={comparePlanIds.has(plan.id)}
          onToggleCompare={() => togglePlanCompare(plan.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO — split, panneau droite garanties */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-32">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.1, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Gauche */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(197,161,72,0.6)" }}>Abonnements</p>
                <h1 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-5 text-white"
                  style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}>
                  Nos Formules
                </h1>
                <p className="text-white/55 text-lg leading-relaxed mb-8">
                  Sans engagement, sans frais cachés. Annulez à tout moment depuis votre espace.
                </p>
                <Link href="/auth/inscription"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg font-[family-name:var(--font-display)]"
                  style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 32px rgba(197,161,72,0.32)" }}>
                  Essai gratuit 7 jours <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              {/* Droite — garanties visuelles */}
              <div className="hidden md:flex flex-col gap-4">
                <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(197,161,72,0.6)" }}>Pour commencer</p>
                  <p className="font-[family-name:var(--font-display)] font-bold mt-2" style={{ color: "var(--greek-gold)", fontSize: "2.8rem", lineHeight: 1 }}>0 €</p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>Accès immédiat à toutes les fonctionnalités — 7 jours sans frais</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Sans engagement", "Sans carte bancaire", "Annulable à tout moment", "Accès immédiat"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--greek-gold)" }} />
                      <span className="text-xs" style={{ color: "rgba(240,237,232,0.55)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABS + CONTENT */}
        <section className="py-20 bg-[var(--greek-cream)]" ref={cardsRef}>
          <div className="container mx-auto px-6 max-w-5xl">
            <style>{`
              @keyframes cardIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
            `}</style>

            {/* Tab switcher */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-2xl" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all font-[family-name:var(--font-display)]"
                    style={tab === t.id
                      ? { background: "var(--greek-blue)", color: "#fff" }
                      : { background: "transparent", color: "var(--greek-blue)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex flex-col bg-white rounded-2xl overflow-hidden"
                    style={{ border: "1px solid var(--greek-border)", transform: i === 1 ? "scale(1.04)" : "none", zIndex: i === 1 ? 10 : 1 }}>
                    <div className="px-7 pt-8 pb-5 border-b border-[var(--greek-border)] flex flex-col items-center gap-3">
                      <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                      <div className="h-5 w-32 rounded-full bg-gray-100 animate-pulse" />
                      <div className="h-3 w-28 rounded-full bg-gray-100 animate-pulse" />
                    </div>
                    <div className="px-7 py-6 border-b border-[var(--greek-border)] flex justify-center">
                      <div className="h-10 w-24 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                    <div className="px-7 py-6 flex flex-col gap-3">
                      {[60, 48, 52, 44].map((w, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                          <div className="h-3 rounded-full bg-gray-100 animate-pulse" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                      <div className="mt-3 h-11 w-full rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {tab === "familles" && (
                  famillePlans.length === 0
                    ? <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour le moment.</p>
                    : renderCards(famillePlans, false)
                )}
                {tab === "lyceens" && (
                  lyceenPlans.length === 0
                    ? <p className="text-center text-[var(--text-muted)] py-20">Aucun plan lycéen disponible pour le moment.</p>
                    : renderCards(lyceenPlans, true)
                )}
                {tab === "abonnement" && (
                  <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-10">
                      <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-[var(--greek-blue)] mb-2">Composez votre formule</h2>
                      <p className="text-[var(--text-muted)] text-sm">Ajustez les options, le prix se met à jour automatiquement.</p>
                    </div>
                    <Configurator
                      onAdd={(c) => setCustomConfig(c)}
                      alreadyAdded={customConfig !== null}
                    />
                  </div>
                )}
              </>
            )}

            {/* COMPARATEUR */}
            {compareItems.length >= 2 && (
              <div className="mt-16">
                <div className="text-center mb-8">
                  <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl md:text-3xl text-[var(--greek-blue)] mb-3">
                    Comparateur
                  </h2>
                  {/* Selected chips */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {compareItems.map(item => (
                      <span key={item.key} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(197,161,72,0.12)", color: "var(--greek-blue)" }}>
                        {item.name}
                        <button onClick={() => removeCompare(item.key)} className="hover:text-[var(--greek-gold)] transition-colors" aria-label="Retirer">
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

        {/* GARANTIE */}
        <section className="py-14 bg-[var(--greek-cream)] border-t border-gray-100 text-center">
          <div className="container mx-auto px-6 max-w-xl">
            <div ref={garantieRef} style={{ opacity: garantieVisible ? 1 : 0, transform: garantieVisible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s, transform 0.5s" }}>
            <div className="w-8 h-px bg-[var(--greek-gold)] mx-auto mb-5 opacity-60" />
            <h3 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)] mb-2">
              Sans engagement · Annulable à tout moment
            </h3>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              Paiement sécurisé par Stripe. Aucun frais caché. Remboursement garanti dans les 7 jours si insatisfait.
            </p>
            </div>
          </div>
        </section>

        {/* MINI-FAQ */}
        <section className="py-16 px-6" style={{ background: "var(--greek-cream)" }}>
          <div className="max-w-2xl mx-auto" ref={faqRef}>
            <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-center mb-8" style={{ color: "var(--greek-blue)", opacity: faqVisible ? 1 : 0, transform: faqVisible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.4s, transform 0.4s" }}>
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {[
                { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez passer à un plan supérieur ou inférieur à n'importe quel moment depuis votre espace parent. Le changement est effectif immédiatement et le montant est ajusté au prorata." },
                { q: "Y a-t-il un engagement de durée ?", a: "Non. Les abonnements sont sans engagement. Vous pouvez annuler à tout moment depuis votre compte, sans frais ni justification." },
                { q: "La période d'essai est-elle vraiment gratuite ?", a: "Oui, aucune carte bancaire n'est requise pour commencer. L'essai gratuit vous donne accès à toutes les fonctionnalités du plan choisi sans limitation." },
                { q: "Que se passe-t-il si je dépasse le nombre d'enfants autorisé ?", a: "Vous serez invité à passer à un plan supérieur. Aucun enfant ne perd l'accès brutalement — vous avez un délai pour régulariser votre abonnement." },
              ].map((item, i) => (
                <div key={i} style={{ opacity: faqVisible ? 1 : 0, transform: faqVisible ? "translateY(0)" : "translateY(16px)", transition: `opacity 0.4s ${80 + i * 60}ms, transform 0.4s ${80 + i * 60}ms` }}>
                  <FaqItem question={item.q} answer={item.a} />
                </div>
              ))}
            </div>
            <p className="text-center text-sm mt-8" style={{ color: "var(--text-muted)" }}>
              Vous avez une autre question ?{" "}
              <a href="/contact" className="font-semibold hover:underline" style={{ color: "var(--greek-gold)" }}>Contactez-nous</a>
              {" "}ou consultez la{" "}
              <a href="/faq" className="font-semibold hover:underline" style={{ color: "var(--greek-gold)" }}>FAQ complète</a>.
            </p>
          </div>
        </section>

      </main>
      <Footer />

      {selectedPlan && (
        <PlanModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      )}
    </div>
  );
}
