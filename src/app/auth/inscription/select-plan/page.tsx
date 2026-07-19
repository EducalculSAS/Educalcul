"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Check, Star, Sparkles, AlertCircle, Loader2, Gift, CheckCircle,
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

export default function SelectPlan() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
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
      // Mettre à jour le code de parrainage dans signupData
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

  const intervalLabel = (i: string) =>
    i === "year" ? "/an" : i === "week" ? "/sem." : "/mois";

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
        <div className="text-center mb-10">
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

        {/* Plans */}
        <div className={`grid gap-6 mb-10 ${plans.length <= 2 ? "md:grid-cols-2 max-w-2xl mx-auto" : "md:grid-cols-3"}`}>
          {plans.map((plan, idx) => {
            const features = typeof plan.features === "string"
              ? JSON.parse(plan.features)
              : plan.features || {};
            const featureList: string[] = Array.isArray(features)
              ? features
              : [
                  features.max_children && `${features.max_children} enfant(s)`,
                  features.detailed_reports && "Rapports détaillés",
                  features.priority_support && "Support prioritaire",
                  features.offline_access && "Accès hors-ligne",
                  features.custom_avatars && "Avatars personnalisés",
                ].filter(Boolean) as string[];

            const isPopular = idx === 1;
            const isProcessing = processingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col bg-white rounded-2xl transition-all duration-200 shadow-sm ${
                  isPopular
                    ? "border-2 border-[var(--greek-gold)] shadow-md"
                    : "border border-[rgba(197,161,72,0.25)]"
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-[var(--greek-gold)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-2xl flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> POPULAIRE
                  </div>
                )}

                <div className="p-6 bg-gray-50 rounded-t-2xl border-b border-[rgba(197,161,72,0.15)] text-center">
                  {plan.promo_description && (
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-[var(--greek-gold)] mb-2">
                      <Sparkles className="w-3 h-3" /> {plan.promo_description}
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-1">{plan.name}</h3>
                  {plan.description && <p className="text-gray-500 text-sm">{plan.description}</p>}
                </div>

                <div className="flex-grow p-6">
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-[var(--greek-blue)]">
                      {plan.price === 0 ? "Gratuit" : `${plan.price} €`}
                    </div>
                    {plan.price > 0 && (
                      <span className="text-gray-400 text-sm">{intervalLabel(plan.billing_interval)}</span>
                    )}
                    {/* Affichage du prix réduit si code parrainage valide */}
                    {referralStatus === "valid" && plan.price > 0 && (
                      <div className="mt-1 text-sm text-green-600 font-semibold">
                        Prix avec remise appliqué au paiement
                      </div>
                    )}
                  </div>

                  {plan.trial_days > 0 && (
                    <div className="text-center text-sm text-green-600 font-semibold mb-4 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> {plan.trial_days} jours d&apos;essai gratuit
                    </div>
                  )}

                  <div className="space-y-2">
                    {featureList.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-[var(--greek-gold)] shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-[rgba(197,161,72,0.15)]">
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={!!processingPlanId}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      isPopular
                        ? "bg-[var(--greek-gold)] text-white hover:opacity-90 shadow-md"
                        : "bg-[var(--greek-blue)] text-white hover:opacity-90"
                    } disabled:opacity-50`}
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
                    ) : plan.price === 0 ? (
                      "Commencer gratuitement"
                    ) : plan.trial_days > 0 ? (
                      `Essai gratuit · Payer`
                    ) : (
                      `Payer ${plan.price} €${intervalLabel(plan.billing_interval)}`
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Code de parrainage — uniquement pour Google (email/password le saisit sur la page inscription) */}
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
            ← Retour à l'inscription
          </button>
        </div>
      </div>
    </div>
  );
}
