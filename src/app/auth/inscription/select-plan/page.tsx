"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Check, Star, Sparkles, AlertCircle, Loader2, Gift, CheckCircle, ArrowRight,
} from "lucide-react";

interface Plan {
  id: string | number;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: any;
  is_active: boolean;
  sort_order: number;
}

/* ─── Feature rows (mêmes que la page /tarifs) ─── */
const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "max_children", label: "Enfants" },
  { key: "access_level_exercises", label: "Niveaux scolaires" },
  { key: "ai_access", label: "IA EpsiAI" },
  { key: "ai_daily_limit", label: "Questions IA / jour" },
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

export default function SelectPlan() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<string>("month");
  const [processingPlanId, setProcessingPlanId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [referralValidating, setReferralValidating] = useState(false);
  const [signupData, setSignupData] = useState<any>(null);
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("educalcul_signup_data");
    const signupMode = sessionStorage.getItem("educalcul_signup_mode");

    if (!stored && signupMode !== "google") {
      router.push("/auth/inscription");
      return;
    }

    setIsGoogleSignup(signupMode === "google");

    if (stored) {
      const data = JSON.parse(stored);
      setSignupData(data);
      if (data.referralCode) {
        setReferralCode(data.referralCode);
        setReferralStatus("valid");
      }
    }

    fetch("/api/admin/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        setPlans((data || []).filter((p: Plan) => p.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const validateReferral = async (code: string) => {
    if (!code.trim()) { setReferralStatus("idle"); return; }
    setReferralValidating(true);
    try {
      const res = await fetch("/api/parent/validate-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setReferralStatus(data.valid ? "valid" : "invalid");
    } catch {
      setReferralStatus("invalid");
    } finally {
      setReferralValidating(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (processingPlanId) return;
    setProcessingPlanId(plan.id);
    setError(null);

    try {
      const currentData = signupData || {};
      const updatedData = {
        ...currentData,
        referralCode: referralStatus === "valid" ? referralCode.trim().toUpperCase() : null,
      };
      sessionStorage.setItem("educalcul_signup_data", JSON.stringify(updatedData));
      sessionStorage.setItem("educalcul_selected_plan", JSON.stringify(plan));

      const email = updatedData.email || (await supabase.auth.getUser()).data.user?.email || "";

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          isNewSignup: true,
          email,
          firstName: updatedData.firstName,
          lastName: updatedData.lastName,
          password: updatedData.password,
          referralCode: referralStatus === "valid" ? referralCode.trim().toUpperCase() : null,
        }),
      });

      const data = await res.json();
      if (data.url) {
        if (data.authId) sessionStorage.setItem("educalcul_pending_auth_id", data.authId);
        window.location.href = data.url;
      } else {
        setError(data.error || "Erreur lors de la création de la session de paiement.");
        setProcessingPlanId(null);
      }
    } catch {
      setError("Une erreur est survenue, veuillez réessayer.");
      setProcessingPlanId(null);
    }
  };

  const freePlans = plans.filter((p) => Number(p.price) === 0);
  const paidForInterval = plans.filter((p) => Number(p.price) > 0 && p.billing_interval === interval);
  // Les formules gratuites n'ont pas d'intervalle de facturation pertinent : on les
  // affiche à la suite quel que soit l'onglet sélectionné.
  const visiblePlans = [...paidForInterval, ...freePlans];

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--greek-blue)]" />
        <p className="text-gray-500 mt-4">Chargement des plans...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--greek-cream)] py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Choisir votre formule
          </h1>
          <p className="text-gray-600">Cliquez sur un plan pour passer au paiement</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r max-w-2xl mx-auto flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Sélecteur de période — identique à /tarifs */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-xl" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
            {INTERVAL_LABELS.map((it) => (
              <button
                key={it.id}
                onClick={() => setInterval(it.id)}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all font-[family-name:var(--font-display)]"
                style={interval === it.id
                  ? { background: "var(--greek-blue)", color: "#fff" }
                  : { background: "transparent", color: "var(--greek-blue)" }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cartes de plans — style /tarifs */}
        {visiblePlans.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour cette période.</p>
        ) : (
          <div className={`grid grid-cols-1 gap-8 mb-10 ${visiblePlans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : visiblePlans.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-3"}`}>
            {visiblePlans.map((plan, idx) => {
              const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
              const popular = visiblePlans.length > 1 && idx === 1;
              const isProcessing = processingPlanId === plan.id;
              const isFree = Number(plan.price) === 0;

              return (
                <div
                  key={plan.id}
                  style={{
                    position: "relative",
                    zIndex: popular ? 10 : 1,
                    transform: popular ? "scale(1.04)" : undefined,
                  }}
                >
                  <div
                    className="relative flex flex-col bg-white rounded-2xl h-full"
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
                        {!isFree && (
                          <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>
                        )}
                      </div>
                      {referralStatus === "valid" && !isFree && (
                        <div className="mt-2 text-xs text-green-600 font-semibold">Remise appliquée au paiement</div>
                      )}
                    </div>

                    <div className="px-7 py-6 flex-grow flex flex-col">
                      <ul className="space-y-2.5 mb-6">
                        {FEATURE_ROWS.map((row) => {
                          const { label, included } = formatVal(row.key, features?.[row.key]);
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
                        onClick={() => handleSelectPlan(plan)}
                        disabled={!!processingPlanId}
                        className="mt-auto w-full py-3 px-4 rounded-xl font-bold text-sm text-center transition-all hover:-translate-y-0.5 hover:shadow-md font-[family-name:var(--font-display)] disabled:opacity-50 disabled:hover:translate-y-0"
                        style={popular
                          ? { background: "var(--greek-gold)", color: "#fff" }
                          : { background: "var(--greek-blue)", color: "#fff" }
                        }
                      >
                        {isProcessing ? (
                          <><Loader2 className="inline-block w-4 h-4 animate-spin align-[-0.15em] mr-1.5" />Chargement...</>
                        ) : isFree ? (
                          <>Commencer gratuitement <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
                        ) : plan.trial_days > 0 ? (
                          <>Essai gratuit · Payer <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
                        ) : (
                          <>Payer {plan.price}€{intervalLabel(plan.billing_interval)} <ArrowRight className="inline-block w-4 h-4 align-[-0.15em]" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Code de parrainage — uniquement pour Google */}
        {isGoogleSignup && <div className="max-w-sm mx-auto mb-8">
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-5 shadow-sm">
            <label className="block text-[var(--greek-blue)] font-bold mb-3 text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-[var(--greek-gold)]" />
              Code de parrainage <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={referralCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setReferralCode(val);
                  setReferralStatus("idle");
                }}
                onBlur={() => validateReferral(referralCode)}
                className={`w-full px-4 py-3 border rounded-xl font-mono tracking-widest uppercase text-sm focus:outline-none pr-10 ${
                  referralStatus === "valid"
                    ? "border-green-400 bg-green-50"
                    : referralStatus === "invalid"
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 focus:border-[var(--greek-blue)]"
                }`}
                placeholder="EX: RUBEN3K7P"
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                {referralValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!referralValidating && referralStatus === "valid" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {!referralValidating && referralStatus === "invalid" && <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>
            </div>
            {referralStatus === "valid" && (
              <p className="text-xs text-green-600 font-medium mt-2">✓ Code valide — remise appliquée lors du paiement</p>
            )}
            {referralStatus === "invalid" && (
              <p className="text-xs text-red-500 mt-2">Code invalide ou expiré</p>
            )}
          </div>
        </div>}

        <div className="text-center">
          <button
            onClick={() => router.push("/auth/inscription")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Retour à l&apos;inscription
          </button>
        </div>
      </div>
    </div>
  );
}
