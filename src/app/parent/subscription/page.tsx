"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Check,
  X,
  CreditCard,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import MathLoader from "@/components/MathLoader";
import { useRouter } from "next/navigation";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  max_children: number;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Découverte",
    price: 0,
    interval: "mois",
    features: [
      "Accès limité aux exercices",
      "1 compte enfant",
      "Suivi basique",
    ],
    max_children: 1,
  },
  {
    id: "premium",
    name: "Premium",
    price: 9.99,
    interval: "mois",
    features: [
      "Accès illimité",
      "Jusqu'à 3 enfants",
      "Rapports détaillés",
      "Support prioritaire",
    ],
    max_children: 3,
  },
  {
    id: "family",
    name: "Famille",
    price: 19.99,
    interval: "mois",
    features: [
      "Tout illimité",
      "Jusqu'à 6 enfants",
      "Contenus exclusifs",
      "Coaching mensuel",
    ],
    max_children: 6,
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      
      setUser(user);

      try {
        const response = await fetch(`/api/parent/subscription-details?userId=${user.id}`);
        const data = await response.json();

        if (data.subscription) {
          setCurrentPlan(data.subscription);
        } else {
          setCurrentPlan({ plan_id: "free", status: "active" });
        }

        if (data.invoices) {
          setBillingHistory(data.invoices);
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error);
        setCurrentPlan({ plan_id: "free", status: "active" });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") {
      // Logic for free plan (downgrade or keep as is)
      alert("Vous êtes déjà sur le plan gratuit.");
      return;
    }

    setProcessingPlanId(planId);
    try {
      if (!user) {
        // Redirect to login if not authenticated
        router.push("/auth/connexion?redirect=/parent/subscription");
        return;
      }

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Erreur lors de la création de la session:", data.error);
        alert("Une erreur est survenue. Veuillez réessayer.");
        setProcessingPlanId(null);
      }
    } catch (error) {
      console.error("Erreur:", error);
      alert("Une erreur est survenue. Veuillez réessayer.");
      setProcessingPlanId(null);
    }
  };

  const handleManagePayment = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Impossible d'accéder au portail de paiement. Avez-vous un abonnement actif ?");
      }
    } catch (error) {
      console.error("Erreur:", error);
      alert("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    handleManagePayment(); // Redirect to portal for cancellation
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <Crown className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Mon Abonnement
        </h1>
        <p className="text-gray-600 text-lg">
          Gérez votre formule et accédez à vos factures
        </p>
      </div>

      {/* Current Subscription Status */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-8 mb-12 border-l-4 border-l-[var(--greek-gold)]">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center font-[family-name:var(--font-display)]">
          <CreditCard className="w-6 h-6 mr-3 text-[var(--greek-blue)]" />
          État actuel
        </h2>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-gray-600">
              Plan actuel :{" "}
              <span className="font-bold text-[var(--greek-blue)] text-lg">
                {PLANS.find((p) => p.id === currentPlan?.plan_id)?.name ||
                  "Gratuit"}
              </span>
            </p>
            {currentPlan?.current_period_end && (
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Clock className="w-4 h-4 mr-1" />
                Renouvellement le : {new Date(currentPlan.current_period_end).toLocaleDateString()}
              </p>
            )}
            {currentPlan?.cancel_at_period_end && (
              <p className="text-sm text-red-500 flex items-center mt-1">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Se termine le : {new Date(currentPlan.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleManagePayment}
              className="px-4 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-[var(--greek-blue)] transition-colors"
            >
              Gérer le paiement
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-xl shadow-sm border p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
              currentPlan?.plan_id === plan.id
                ? "border-[var(--greek-gold)] ring-1 ring-[var(--greek-gold)]"
                : "border-gray-200"
            }`}
          >
            {currentPlan?.plan_id === plan.id && (
              <div className="absolute top-0 right-0 bg-[var(--greek-gold)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                ACTUEL
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {plan.name}
            </h3>
            <div className="text-3xl font-bold text-[var(--greek-blue)] mb-4">
              {plan.price}€{" "}
              <span className="text-sm text-gray-500 font-normal">
                /{plan.interval}
              </span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start text-sm text-gray-600"
                >
                  <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={currentPlan?.plan_id === plan.id}
              className={`w-full py-3 rounded-xl font-bold transition-all shadow-md ${
                currentPlan?.plan_id === plan.id
                  ? "bg-gray-100 text-gray-400 cursor-default shadow-none"
                  : "bg-[var(--greek-blue)] text-white hover:bg-[var(--greek-blue)] hover:shadow-lg hover:-translate-y-0.5"
              }`}
            >
              {currentPlan?.plan_id === plan.id
                ? "Abonnement Actuel"
                : processingPlanId === plan.id
                ? "Chargement..."
                : "S'abonner"}
            </button>
          </div>
        ))}
      </div>

      {/* Billing History */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-8 border-l-4 border-l-gray-400">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center font-[family-name:var(--font-display)]">
          <Clock className="w-6 h-6 mr-3 text-gray-600" />
          Historique de facturation
        </h2>
        {billingHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 text-gray-500 font-medium">
                    Date
                  </th>
                  <th className="text-left py-3 text-gray-500 font-medium">
                    Montant
                  </th>
                  <th className="text-left py-3 text-gray-500 font-medium">
                    Statut
                  </th>
                  <th className="text-right py-3 text-gray-500 font-medium">
                    Facture
                  </th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((bill) => (
                  <tr key={bill.id} className="border-b border-gray-100">
                    <td className="py-4 text-gray-800">
                      {new Date(bill.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-gray-800 font-medium">
                      {bill.amount}€
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          bill.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {bill.status === "paid" ? "Payé" : bill.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {bill.pdf_url ? (
                        <a
                          href={bill.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--greek-blue)] hover:underline flex items-center justify-end"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">Indisponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">Aucune facture disponible.</p>
        )}
      </div>
    </div>
  );
}
