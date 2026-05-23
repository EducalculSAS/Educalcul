/* Copie exacte de src/app/tarifs/page.tsx — sans Navbar/Footer, plans hardcodés */
import { useState, useEffect } from "react";
import { Check, Tag, Star, Sparkles } from "lucide-react";

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

interface Props { onNavigate: (view: any) => void; }

const intervalLabel = (i: string) => i === "year" ? "/an" : i === "week" ? "/sem." : "/mois";

// Plans depuis l'API — identiques à la page tarifs du site
const FALLBACK_PLANS: Plan[] = [
  {
    id: 1, name: "Gratuit", description: "Pour découvrir la plateforme", price: 0,
    billing_interval: "month", trial_days: 0, promo_description: null,
    features: { max_children: 1 }, is_active: true, sort_order: 1,
  },
  {
    id: 2, name: "Famille", description: "La formule complète pour toute la famille", price: 9.99,
    billing_interval: "month", trial_days: 14, promo_description: "Populaire",
    features: { max_children: 3, detailed_reports: true, priority_support: true }, is_active: true, sort_order: 2,
  },
  {
    id: 3, name: "Annuel", description: "2 mois offerts", price: 89,
    billing_interval: "year", trial_days: 14, promo_description: "Meilleure valeur",
    features: { max_children: 3, detailed_reports: true, priority_support: true, offline_access: true }, is_active: true, sort_order: 3,
  },
];

export default function Tarifs({ onNavigate }: Props) {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);

  useEffect(() => {
    fetch("/api/admin/subscriptions")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setPlans(data.filter((p: Plan) => p.is_active)); })
      .catch(() => {}); // garde les fallback plans en cas d'erreur CORS
  }, []);

  return (
    <main className="flex-grow pt-[64px]">
      {/* Hero */}
      <section className="bg-[var(--greek-cream)] py-16 text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
            <Tag className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)]" />
            Nos Formules d'Abonnement
          </h1>
          <p className="text-[var(--greek-blue)] text-xl opacity-80">
            Choisissez la formule qui correspond le mieux aux besoins de votre enfant
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          {plans.length === 0 ? (
            <p className="text-center text-gray-400 py-20">Aucun plan disponible.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {plans.map((plan, idx) => {
                const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
                const featureList: string[] = [
                  features.max_children && `${features.max_children} enfant(s)`,
                  features.detailed_reports && "Rapports détaillés",
                  features.priority_support && "Support prioritaire",
                  features.offline_access && "Accès hors-ligne",
                  features.custom_avatars && "Avatars personnalisés",
                ].filter(Boolean) as string[];
                const isPopular = idx === 1;

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col bg-white rounded-xl transition-all duration-300 ${
                      isPopular
                        ? "border-2 border-[rgba(197,161,72,0.25)] shadow-lg scale-105 z-10"
                        : "border border-[rgba(197,161,72,0.25)] shadow-md"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-0 bg-[var(--greek-gold)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-current" />
                        POPULAIRE
                      </div>
                    )}

                    <div className="p-6 bg-gray-50 rounded-t-xl border-b border-gray-100 text-center">
                      {plan.promo_description && (
                        <div className="flex items-center justify-center gap-1 text-xs font-bold text-[var(--greek-gold)] mb-2">
                          <Sparkles className="w-3 h-3" />{plan.promo_description}
                        </div>
                      )}
                      <h3 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mb-1">{plan.name}</h3>
                      {plan.description && <p className="text-gray-500 text-sm">{plan.description}</p>}
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                      <div className="text-center mb-4">
                        <span className="text-4xl font-bold text-[var(--greek-gold)] font-[family-name:var(--font-display)]">
                          {plan.price === 0 ? "Gratuit" : `${plan.price} €`}
                        </span>
                        {plan.price > 0 && <span className="text-gray-400 text-sm">{intervalLabel(plan.billing_interval)}</span>}
                      </div>
                      {plan.trial_days > 0 && (
                        <p className="text-center text-xs text-green-600 font-semibold mb-4 bg-green-50 py-1.5 rounded-lg">
                          {plan.trial_days} jours d'essai gratuit
                        </p>
                      )}

                      <ul className="space-y-3 mb-8 flex-grow">
                        {featureList.map((f) => (
                          <li key={f} className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-[var(--greek-gold)] flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{f}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Pas de bouton de redirection — page waitlist */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
