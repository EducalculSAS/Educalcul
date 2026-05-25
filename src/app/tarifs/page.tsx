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
  { key: "max_children",           label: "Nombre d'enfants",        tip: "Profils enfants actifs simultanément" },
  { key: "access_level_exercises", label: "Accès aux exercices",     tip: "Niveaux disponibles (CP à Terminale)" },
  { key: "ai_access",              label: "IA EpsiAI",               tip: "Accès à l'assistante pédagogique IA" },
  { key: "ai_daily_limit",         label: "Questions IA / jour",     tip: "Nombre de messages envoyés à EpsiAI" },
  { key: "detailed_reports",       label: "Rapports hebdomadaires",  tip: "Email récapitulatif chaque semaine" },
  { key: "custom_avatars",         label: "Avatars personnalisés",   tip: "Débloquer des skins exclusifs" },
  { key: "offline_access",         label: "Accès hors-ligne",        tip: "Télécharger les leçons sans internet" },
  { key: "priority_support",       label: "Support prioritaire",     tip: "Réponse garantie sous 4h en semaine" },
];

function formatVal(key: string, val: boolean | number | string | null): { label: string; included: boolean } {
  if (val === false || val === null) return { label: "", included: false };
  if (val === true) return { label: "Inclus", included: true };
  if (key === "max_children") return { label: `${val} enfant${Number(val) > 1 ? "s" : ""}`, included: true };
  if (key === "ai_daily_limit") return { label: val === -1 ? "Illimité" : `${val} / jour`, included: true };
  if (key === "ai_access") return { label: val === "unlimited" ? "Illimité" : "Limité", included: true };
  if (key === "access_level_exercises") return { label: val === "all" ? "Tous niveaux" : String(val), included: true };
  return { label: String(val), included: true };
}

const intervalLabel = (i: string) => i === "year" ? "/an" : "/mois";

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

/* ─── Sticky comparison table ─── */
function ComparisonTable({ plans }: { plans: Plan[] }) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [pinnedCol, setPinnedCol] = useState<number | null>(1); // Popular pre-selected
  const [tip, setTip] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.05 });
    if (tableRef.current) obs.observe(tableRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={tableRef}
      className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.6s, transform 0.6s",
      }}
    >
      <table className="w-full min-w-[560px] border-collapse">
        {/* Sticky thead */}
        <thead>
          <tr>
            {/* Feature column label */}
            <th
              className="sticky top-0 z-20 text-left px-6 py-5 text-xs font-semibold uppercase tracking-wider"
              style={{ background: "var(--greek-blue)", color: "rgba(255,255,255,0.35)", width: "38%" }}
            >
              Fonctionnalité
            </th>

            {/* Plan headers */}
            {plans.map((plan, idx) => {
              const isPinned = pinnedCol === idx;
              return (
                <th
                  key={plan.id}
                  className="sticky top-0 z-20 text-center px-4 py-0 cursor-pointer transition-colors"
                  style={{
                    background: isPinned ? "rgba(197,161,72,0.14)" : "var(--greek-blue)",
                    borderBottom: isPinned ? "2px solid var(--greek-gold)" : "2px solid transparent",
                    minWidth: 140,
                  }}
                  onClick={() => setPinnedCol(isPinned ? null : idx)}
                >
                  <div className="py-5">
                    {idx === 1 && (
                      <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "var(--greek-gold)", color: "black" }}>
                        <Star className="w-2.5 h-2.5 fill-current" /> Populaire
                      </div>
                    )}
                    <div className="font-bold text-sm" style={{ color: isPinned ? "var(--greek-gold)" : "rgba(255,255,255,0.9)" }}>
                      {plan.name}
                    </div>
                    <div className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold" style={{ color: isPinned ? "var(--greek-gold)" : "white" }}>
                      {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
                      {Number(plan.price) > 0 && (
                        <span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{intervalLabel(plan.billing_interval)}</span>
                      )}
                    </div>
                    {plan.trial_days > 0 && (
                      <div className="text-xs mt-1" style={{ color: "rgba(52,211,153,0.9)" }}>{plan.trial_days}j d&apos;essai</div>
                    )}
                    <div className="mt-2 text-xs" style={{ color: isPinned ? "rgba(197,161,72,0.7)" : "rgba(255,255,255,0.3)" }}>
                      {isPinned ? "Sélectionné ✓" : "Cliquer pour sélectionner"}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {FEATURE_ROWS.map((row, rIdx) => (
            <tr
              key={row.key}
              onMouseEnter={() => setHoveredRow(rIdx)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{ background: hoveredRow === rIdx ? "rgba(197,161,72,0.04)" : rIdx % 2 === 0 ? "white" : "var(--greek-cream)" }}
            >
              {/* Feature label */}
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

              {/* Plan cells */}
              {plans.map((plan, idx) => {
                const { label, included } = formatVal(row.key, plan.features?.[row.key]);
                const isPinned = pinnedCol === idx;
                return (
                  <td
                    key={plan.id}
                    className="px-4 py-4 text-center border-b transition-colors"
                    style={{
                      borderColor: "var(--greek-border)",
                      background: isPinned ? "rgba(197,161,72,0.06)" : "transparent",
                      }}
                  >
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

          {/* CTA row */}
          <tr style={{ background: "var(--greek-cream)" }}>
            <td className="px-6 py-5" />
            {plans.map((plan, idx) => {
              const isPinned = pinnedCol === idx;
              return (
                <td
                  key={plan.id}
                  className="px-4 py-5 text-center"
                  style={{
                    background: isPinned ? "rgba(197,161,72,0.06)" : "transparent",
                    borderLeft: isPinned ? "1px solid rgba(197,161,72,0.2)" : "none",
                    borderRight: isPinned ? "1px solid rgba(197,161,72,0.2)" : "none",
                  }}
                >
                  <Link
                    href="/auth/inscription"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:-translate-y-0.5 hover:shadow-md font-[family-name:var(--font-display)]"
                    style={isPinned
                      ? { background: "var(--greek-blue)", color: "white" }
                      : { border: "2px solid var(--greek-blue)", color: "var(--greek-blue)" }
                    }
                  >
                    {Number(plan.price) === 0 ? "Gratuit" : "Choisir"} <ArrowRight className="w-3 h-3" />
                  </Link>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ─── Page ─── */
export default function Tarifs() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-24 text-center">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.13, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-5">Nos Formules</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
              Sans engagement, sans frais cachés. Annulez à tout moment depuis votre espace.
            </p>
          </div>
        </section>

        {/* PLAN CARDS */}
        <section className="py-20 bg-[var(--greek-cream)]">
          <div className="container mx-auto px-6 max-w-5xl">
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
            ) : plans.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour le moment.</p>
            ) : (
              <>
              <style>{`
                @keyframes cardIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
              `}</style>
              <div className={`grid grid-cols-1 gap-8 ${plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"}`}>
                {plans.map((plan, idx) => {
                  const isPopular = idx === 1;
                  return (
                    <div
                      key={plan.id}
                      style={{
                        position: "relative",
                        zIndex: isPopular ? 10 : 1,
                        transform: isPopular ? "scale(1.04)" : undefined,
                        opacity: cardsVisible ? undefined : 0,
                        animation: cardsVisible ? `cardIn 0.5s ease-out ${isPopular ? "180ms" : "0ms"} both` : "none",
                      }}
                    >
                      <div
                        className="relative flex flex-col bg-white rounded-2xl cursor-pointer group h-full"
                        style={{
                          border: isPopular ? "2px solid var(--greek-gold)" : "1px solid var(--greek-border)",
                          boxShadow: isPopular ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
                        }}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        {isPopular && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
                              <Star className="w-3 h-3 fill-current" /> Populaire
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
                              {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
                            </span>
                            {Number(plan.price) > 0 && (
                              <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>
                            )}
                          </div>
                        </div>

                        <div className="px-7 py-6 flex-grow">
                          <ul className="space-y-2.5 mb-6">
                            {FEATURE_ROWS.slice(0, 4).map(row => {
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
                            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md font-[family-name:var(--font-display)]"
                            style={isPopular
                              ? { background: "var(--greek-blue)", color: "white" }
                              : { border: "2px solid var(--greek-blue)", color: "var(--greek-blue)" }
                            }
                          >
                            Voir les détails <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </section>

        {/* TABLEAU COMPARATIF */}
        {plans.length > 0 && (
          <section className="py-20 bg-[var(--greek-cream)] border-t border-gray-100">
            <div className="container mx-auto px-6 max-w-5xl">
              <div className="text-center mb-12">
                <h2 className="font-[family-name:var(--font-display)] font-bold text-3xl md:text-4xl text-[var(--greek-blue)] mb-3">
                  Comparez les formules
                </h2>
                <p className="text-[var(--text-muted)] text-sm">
                  Cliquez sur un plan pour le mettre en avant. Survolez <Info className="w-3 h-3 inline" /> pour plus de détails.
                </p>
              </div>
              <ComparisonTable plans={plans} />
            </div>
          </section>
        )}

        {/* GARANTIE */}
        <section className="py-14 bg-[var(--greek-cream)] border-t border-gray-100 text-center">
          <div className="container mx-auto px-6 max-w-xl">
            <div className="w-8 h-px bg-[var(--greek-gold)] mx-auto mb-5 opacity-60" />
            <h3 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)] mb-2">
              Sans engagement · Annulable à tout moment
            </h3>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              Paiement sécurisé par Stripe. Aucun frais caché. Remboursement garanti dans les 7 jours si insatisfait.
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
