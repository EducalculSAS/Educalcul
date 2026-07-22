"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircle, Loader2, Gift, CheckCircle } from "lucide-react";
import PlanChooser, { type ChooserPlan } from "@/components/PlanChooser";
import type { CustomPlanConfig } from "@/lib/customPlanPricing";

interface Plan extends ChooserPlan {
  is_active: boolean;
  sort_order: number;
}

const intervalLabel = (i: string) =>
  i === "year" ? "/an" : i === "semester" ? "/semestre" : i === "quarter" ? "/trimestre" : "/mois";

export default function SelectPlan() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | number | null>(null);
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

  // Lance le checkout Stripe (plan existant OU config sur mesure).
  const startCheckout = async (
    key: string | number,
    body: Record<string, any>,
  ) => {
    if (processingKey) return;
    setProcessingKey(key);
    setError(null);

    try {
      const currentData = signupData || {};
      const rc = referralStatus === "valid" ? referralCode.trim().toUpperCase() : null;
      const updatedData = { ...currentData, referralCode: rc };
      sessionStorage.setItem("educalcul_signup_data", JSON.stringify(updatedData));

      const email = updatedData.email || (await supabase.auth.getUser()).data.user?.email || "";

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNewSignup: true,
          email,
          firstName: updatedData.firstName,
          lastName: updatedData.lastName,
          password: updatedData.password,
          referralCode: rc,
          ...body,
        }),
      });

      const data = await res.json();
      if (data.url) {
        if (data.authId) sessionStorage.setItem("educalcul_pending_auth_id", data.authId);
        window.location.href = data.url;
      } else {
        setError(data.error || "Erreur lors de la création de la session de paiement.");
        setProcessingKey(null);
      }
    } catch {
      setError("Une erreur est survenue, veuillez réessayer.");
      setProcessingKey(null);
    }
  };

  const handleSelectPlan = (plan: ChooserPlan) => {
    sessionStorage.setItem("educalcul_selected_plan", JSON.stringify(plan));
    startCheckout(plan.id, { planId: plan.id });
  };

  const handleSelectCustom = (config: CustomPlanConfig) => {
    startCheckout("custom", { customConfig: { config } });
  };

  const planCta = (plan: ChooserPlan) =>
    Number(plan.price) === 0
      ? "Commencer gratuitement"
      : plan.trial_days > 0
      ? "Essai gratuit · Payer"
      : `Payer ${plan.price}€${intervalLabel(plan.billing_interval)}`;

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
          <p className="text-gray-600">Choisissez une formule ou composez la vôtre sur mesure</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r max-w-2xl mx-auto flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <PlanChooser
          plans={plans}
          onChoosePlan={handleSelectPlan}
          onChooseCustom={handleSelectCustom}
          planCta={planCta}
          customCtaLabel="Choisir cette formule"
          processingKey={processingKey}
        />

        {/* Code de parrainage — uniquement pour Google */}
        {isGoogleSignup && <div className="max-w-sm mx-auto mt-10 mb-8">
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

        <div className="text-center mt-8">
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
