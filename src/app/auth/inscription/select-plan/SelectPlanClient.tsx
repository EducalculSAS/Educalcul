"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPendingSignupPassword } from "@/lib/pendingSignupPassword";
import { getSignupSession, patchSignupSession } from "@/lib/signupSession";
import { Loader2, ArrowLeft } from "lucide-react";
import PlanChooser, { type ChooserPlan } from "@/components/PlanChooser";
import type { CustomPlanConfig } from "@/lib/customPlanPricing";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricingConfig";
import GlassButton from "@/components/ui/GlassButton";
import { periodSuffix } from "@/lib/billingPeriods";

interface Plan extends ChooserPlan {
  is_active: boolean;
  sort_order: number;
}

const intervalLabel = periodSuffix;

export default function SelectPlan() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | number | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    (async () => {
      const s = await getSignupSession();
      const stored = s.data;
      const signupMode = s.mode;

      // Le mot de passe n'est jamais persisté côté serveur ni en stockage
      // navigateur (voir pendingSignupPassword.ts) : s'il a été perdu
      // (rechargement de page, navigation directe), on renvoie l'utilisateur
      // ressaisir ses infos plutôt que de tenter une création de compte sans
      // mot de passe.
      if ((!stored || (signupMode === "email" && !getPendingSignupPassword())) && signupMode !== "google") {
        router.push("/auth/inscription");
        return;
      }
    })();

    fetch("/api/admin/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        setPlans((data || []).filter((p: Plan) => p.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/pricing-config")
      .then((r) => r.json())
      .then((cfg) => cfg && setPricingConfig(cfg))
      .catch(() => {});
  }, [router]);

  // La formule choisie est enregistrée puis on passe par le récapitulatif —
  // le paiement lui-même ne se déclenche que depuis là (voir RecapClient).
  const handleSelectPlan = async (plan: ChooserPlan) => {
    setProcessingKey(plan.id);
    await patchSignupSession({ selectedPlan: plan });
    router.push("/auth/inscription/recap");
  };

  const handleSelectCustom = async (config: CustomPlanConfig) => {
    setProcessingKey("custom");
    await patchSignupSession({ selectedPlan: { custom: true, config } });
    router.push("/auth/inscription/recap");
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

        <PlanChooser
          plans={plans}
          onChoosePlan={handleSelectPlan}
          onChooseCustom={handleSelectCustom}
          planCta={planCta}
          customCtaLabel="Choisir cette formule"
          processingKey={processingKey}
          labels={pricingConfig}
          customPricing={pricingConfig.custom}
        />

        <div className="text-center mt-8">
          <GlassButton onClick={() => router.push("/auth/inscription")} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Retour à l&apos;inscription
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
