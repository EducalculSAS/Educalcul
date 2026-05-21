import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { Check, Tag, CreditCard, Star, Sparkles } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseClient";

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

export const dynamic = "force-dynamic";

async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Erreur chargement tarifs:", error);
    return [];
  }

  return (data || []).filter((plan) => plan.is_active);
}

export default async function Tarifs() {
  const plans = await getPlans();

  const intervalLabel = (i: string) =>
    i === "year" ? "/an" : i === "week" ? "/sem." : "/mois";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px]">
        {/* Hero */}
        <section className="bg-[var(--greek-cream)] py-16 text-center">
          <div className="container mx-auto px-4 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
              <Tag className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)]" />
              Nos Formules d&apos;Abonnement
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
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto`}>
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

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col bg-white rounded-xl transition-all duration-300 ${
                        isPopular
                          ? "border-2 border-[var(--greek-gold)] shadow-lg scale-105 z-10"
                          : "border border-[var(--greek-gold)] shadow-md"
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
                        <h3 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mb-1">
                          {plan.name}
                        </h3>
                        {plan.description && (
                          <p className="text-gray-500 text-sm">{plan.description}</p>
                        )}
                      </div>

                      <div className="p-6 flex-grow flex flex-col">
                        <div className="text-center mb-4">
                          <span className="text-4xl font-bold text-[var(--greek-gold)] font-[family-name:var(--font-display)]">
                            {plan.price === 0 ? "Gratuit" : `${plan.price} €`}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-gray-400 text-sm">{intervalLabel(plan.billing_interval)}</span>
                          )}
                        </div>
                        {plan.trial_days > 0 && (
                          <p className="text-center text-xs text-green-600 font-semibold mb-4 bg-green-50 py-1.5 rounded-lg">
                            {plan.trial_days} jours d&apos;essai gratuit
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

                        <Link
                          href={`/parent/subscription?plan=${plan.id}`}
                          className={`w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                            isPopular
                              ? "btn-primary-greek shadow-md hover:shadow-lg"
                              : "btn-outline-light-greek"
                          }`}
                        >
                          <CreditCard className="w-5 h-5" />
                          {plan.price === 0 ? "Commencer gratuitement" : "Choisir cette offre"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
