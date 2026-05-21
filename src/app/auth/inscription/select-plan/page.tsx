"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { Check, Star, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface Plan {
  id: string | number;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number;
  promo_description: string | null;
  features: Record<string, boolean | number | string | null> | string;
  is_active: boolean;
  sort_order: number;
}

export default function SelectPlan() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check if user has signup data
    const signupData = sessionStorage.getItem("educalcul_signup_data");
    const signupMode = sessionStorage.getItem("educalcul_signup_mode");

    if (!signupData && signupMode !== "google") {
      router.push("/auth/inscription");
      return;
    }

    // Fetch plans
    const fetchPlans = async () => {
      try {
        const { data, error: err } = await supabaseAdmin
          .from("subscription_plans")
          .select("*")
          .order("sort_order", { ascending: true });

        if (err) throw err;

        const activePlans = (data || []).filter((p) => p.is_active);
        setPlans(activePlans);

        // Auto-select the first plan or the most popular one (usually index 1)
        if (activePlans.length > 0) {
          setSelectedPlan(activePlans[1]?.id || activePlans[0].id);
        }
      } catch (err: any) {
        setError("Erreur lors du chargement des plans");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [router]);

  const handleContinue = async () => {
    if (!selectedPlan) {
      setError("Veuillez sélectionner un plan");
      return;
    }

    setProcessing(true);

    try {
      // Store selected plan in sessionStorage
      sessionStorage.setItem("educalcul_selected_plan", selectedPlan.toString());

      // Redirect to checkout or subscription page
      router.push("/parent/subscription?new=true");
    } catch (err: any) {
      setError(err.message || "Erreur lors du traitement");
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    // Clear all signup data
    sessionStorage.removeItem("educalcul_signup_data");
    sessionStorage.removeItem("educalcul_signup_mode");
    sessionStorage.removeItem("educalcul_selected_plan");
    sessionStorage.removeItem("educalcul_pending_role");

    router.push("/auth/inscription");
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--greek-blue)]" />
        <p className="text-gray-500 mt-4">Chargement des plans...</p>
      </div>
    );
  }

  const intervalLabel = (i: string) =>
    i === "year" ? "/an" : i === "week" ? "/sem." : "/mois";

  return (
    <div className="w-full bg-[var(--greek-cream)] py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Choisir votre formule
          </h1>
          <p className="text-gray-600">
            Sélectionnez le plan qui convient le mieux à vos besoins
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-r max-w-4xl mx-auto">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, idx) => {
            const features = typeof plan.features === "string"
              ? JSON.parse(plan.features)
              : plan.features || {};
            const featureList: string[] = [
              features.max_children && `${features.max_children} enfant(s)`,
              features.detailed_reports && "Rapports détaillés",
              features.priority_support && "Support prioritaire",
              features.offline_access && "Accès hors-ligne",
              features.custom_avatars && "Avatars personnalisés",
            ].filter(Boolean) as string[];

            const isPopular = idx === 1;
            const isSelected = selectedPlan === plan.id;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative flex flex-col bg-white rounded-xl transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "border-2 border-[var(--greek-blue)] shadow-lg scale-105 ring-2 ring-[var(--greek-blue)]/20"
                    : isPopular
                    ? "border-2 border-[var(--greek-gold)] shadow-md scale-100"
                    : "border border-[var(--greek-gold)]/30 shadow-sm"
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-[var(--greek-gold)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 fill-current" />
                    POPULAIRE
                  </div>
                )}

                {isSelected && (
                  <div className="absolute top-0 left-0 bg-[var(--greek-blue)] text-white text-xs font-bold px-3 py-1 rounded-br-lg rounded-tl-lg">
                    SÉLECTIONNÉ
                  </div>
                )}

                <div className="p-6 bg-gray-50 rounded-t-xl border-b border-[var(--greek-gold)]/15 text-center">
                  {plan.promo_description && (
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-[var(--greek-gold)] mb-2">
                      <Sparkles className="w-3 h-3" />
                      {plan.promo_description}
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="text-gray-500 text-sm">{plan.description}</p>
                  )}
                </div>

                <div className="flex-grow p-6">
                  {/* Price */}
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-[var(--greek-blue)]">
                      {plan.price === 0 ? "Gratuit" : `${plan.price} €`}
                    </div>
                    {plan.price > 0 && (
                      <span className="text-gray-400 text-sm">
                        {intervalLabel(plan.billing_interval)}
                      </span>
                    )}
                  </div>

                  {/* Trial */}
                  {plan.trial_days > 0 && (
                    <div className="text-center text-sm text-[var(--greek-gold)] font-semibold mb-4 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" />
                      {plan.trial_days} jours d&apos;essai gratuit
                    </div>
                  )}

                  {/* Features */}
                  <div className="space-y-3">
                    {featureList.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-[var(--greek-gold)] flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-[var(--greek-gold)]/15">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(plan.id);
                    }}
                    className={`w-full py-2 rounded-lg font-bold transition-all ${
                      isSelected
                        ? "bg-[var(--greek-blue)] text-white"
                        : "bg-[var(--greek-gold)]/10 text-[var(--greek-blue)] hover:bg-[var(--greek-gold)]/20"
                    }`}
                  >
                    {isSelected ? "Sélectionné" : "Choisir"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center max-w-2xl mx-auto">
          <button
            onClick={handleCancel}
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedPlan || processing}
            className="px-8 py-3 bg-[var(--greek-blue)] text-white rounded-lg font-bold hover:bg-blue-800 transition-all disabled:opacity-50"
          >
            {processing ? "Traitement..." : "Continuer vers le paiement"}
          </button>
        </div>
      </div>
    </div>
  );
}
