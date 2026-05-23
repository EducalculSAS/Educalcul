import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { Check, X, Star, ArrowRight, Sparkles } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

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

const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "max_children", label: "Nombre d'enfants" },
  { key: "access_level_exercises", label: "Accès aux exercices" },
  { key: "ai_access", label: "IA Athéna" },
  { key: "ai_daily_limit", label: "Questions IA / jour" },
  { key: "detailed_reports", label: "Rapports hebdomadaires" },
  { key: "custom_avatars", label: "Avatars personnalisés" },
  { key: "offline_access", label: "Accès hors-ligne" },
  { key: "priority_support", label: "Support prioritaire" },
];

function formatVal(key: string, val: boolean | number | string | null): { label: string; included: boolean } {
  if (val === false || val === null) return { label: "—", included: false };
  if (val === true) return { label: "Inclus", included: true };
  if (key === "max_children") return { label: `${val} enfant${Number(val) > 1 ? "s" : ""}`, included: true };
  if (key === "ai_daily_limit") return { label: val === -1 ? "Illimité" : `${val} / jour`, included: true };
  if (key === "ai_access") return { label: val === "unlimited" ? "Illimité" : "Limité", included: true };
  if (key === "access_level_exercises") return { label: val === "all" ? "Tous niveaux" : String(val), included: true };
  return { label: String(val), included: true };
}

const intervalLabel = (i: string) => i === "year" ? "/an" : "/mois";

async function getPlans(): Promise<Plan[]> {
  const { data } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, name, description, price, billing_interval, trial_days, promo_description, features")
    .eq("is_active", true)
    .order("sort_order");
  return (data || []) as Plan[];
}

export default async function Tarifs() {
  const plans = await getPlans();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-24 text-center">
          {[{s:"∑",x:6,y:10,z:96,d:0,t:7.2},{s:"π",x:87,y:7,z:72,d:1.3,t:8.5},{s:"√",x:12,y:62,z:58,d:0.6,t:9.1},{s:"∫",x:91,y:48,z:104,d:2.1,t:7.4},{s:"Δ",x:43,y:14,z:50,d:0.9,t:10.2},{s:"∞",x:65,y:70,z:66,d:1.8,t:8.0},{s:"α",x:2,y:40,z:44,d:2.7,t:9.3},{s:"×",x:76,y:26,z:54,d:0.4,t:7.8},{s:"θ",x:50,y:78,z:62,d:2.0,t:8.8},{s:"β",x:28,y:53,z:42,d:3.3,t:10.5},{s:"≠",x:58,y:30,z:46,d:1.1,t:9.7},{s:"÷",x:19,y:84,z:38,d:2.9,t:7.3}].map((cfg,i)=>(
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none" style={{left:`${cfg.x}%`,top:`${cfg.y}%`,fontSize:`${cfg.z}px`,fontFamily:"Georgia,serif",color:"var(--greek-gold)",opacity:0.13,animationDuration:`${cfg.t}s`,animationDelay:`${cfg.d}s`}}>{cfg.s}</span>
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
            {plans.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] py-20">Aucun plan disponible pour le moment.</p>
            ) : (
              <div className={`grid grid-cols-1 ${plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"} gap-8`}>
                {plans.map((plan, idx) => {
                  const isPopular = idx === 1;
                  return (
                    <div key={plan.id}
                      className={`relative flex flex-col bg-white rounded-2xl transition-all duration-200 ${isPopular ? "shadow-xl border-2 border-[var(--greek-gold)] scale-105 z-10" : "border border-[var(--greek-border)] shadow-sm hover:shadow-md"}`}>

                      {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
                            <Star className="w-3 h-3 fill-current" /> Populaire
                          </div>
                        </div>
                      )}

                      {/* Header */}
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

                      {/* Price */}
                      <div className="px-7 py-6 text-center border-b border-[var(--greek-border)]">
                        <div className="flex items-end justify-center gap-1">
                          <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--greek-blue)]">
                            {Number(plan.price) === 0 ? "Gratuit" : `${plan.price} €`}
                          </span>
                          {Number(plan.price) > 0 && (
                            <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>
                          )}
                        </div>
                      </div>

                      {/* Key features preview */}
                      <div className="px-7 py-6 flex-grow">
                        <ul className="space-y-2.5 mb-8">
                          {FEATURE_ROWS.slice(0, 5).map(row => {
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
                        <Link href="/auth/inscription"
                          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isPopular ? "bg-[var(--greek-blue)] text-white hover:opacity-90 shadow-md" : "border-2 border-[var(--greek-blue)] text-[var(--greek-blue)] hover:bg-[var(--greek-blue)] hover:text-white"}`}>
                          {Number(plan.price) === 0 ? "Commencer gratuitement" : "Choisir cette formule"}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* TABLEAU COMPARATIF */}
        <section className="py-20 bg-white border-t border-[var(--greek-border)]">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="font-[family-name:var(--font-display)] font-bold text-3xl md:text-4xl text-[var(--greek-blue)] mb-3">
                Comparatif détaillé
              </h2>
              <p className="text-[var(--text-muted)] text-base">Toutes les fonctionnalités, formule par formule.</p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-[var(--greek-border)] shadow-sm">
              {/* Header */}
              <div className={`grid text-sm font-bold bg-[var(--greek-blue)] text-white`}
                style={{ gridTemplateColumns: `1fr repeat(${plans.length}, 1fr)` }}>
                <div className="px-6 py-4 text-white/60 text-xs uppercase tracking-wider font-semibold">Fonctionnalité</div>
                {plans.map((p, idx) => (
                  <div key={p.id} className={`px-6 py-4 text-center ${idx === 1 ? "text-[var(--greek-gold)]" : ""}`}>
                    {p.name}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {FEATURE_ROWS.map((row, rIdx) => (
                <div key={row.key}
                  className={`grid text-sm border-b border-[var(--greek-border)] ${rIdx % 2 === 0 ? "bg-white" : "bg-[var(--greek-cream)]"}`}
                  style={{ gridTemplateColumns: `1fr repeat(${plans.length}, 1fr)` }}>
                  <div className="px-6 py-4 font-medium text-[var(--greek-blue)]">{row.label}</div>
                  {plans.map(plan => {
                    const { label, included } = formatVal(row.key, plan.features?.[row.key]);
                    return (
                      <div key={plan.id} className="px-6 py-4 text-center">
                        {included ? (
                          label === "Inclus" ? (
                            <Check className="w-4 h-4 mx-auto text-[var(--greek-gold)]" />
                          ) : (
                            <span className="text-xs font-semibold text-[var(--text-dark)]">{label}</span>
                          )
                        ) : (
                          <X className="w-4 h-4 mx-auto text-gray-300" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* CTA row */}
              <div className={`grid bg-[var(--greek-cream)]`}
                style={{ gridTemplateColumns: `1fr repeat(${plans.length}, 1fr)` }}>
                <div className="px-6 py-5" />
                {plans.map((plan, idx) => (
                  <div key={plan.id} className="px-4 py-5 flex justify-center">
                    <Link href="/auth/inscription"
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${idx === 1 ? "bg-[var(--greek-blue)] text-white hover:opacity-90 shadow-md" : "border-2 border-[var(--greek-blue)] text-[var(--greek-blue)] hover:bg-[var(--greek-blue)] hover:text-white"}`}>
                      Choisir
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* GARANTIE */}
        <section className="py-14 bg-[var(--greek-cream)] border-t border-[var(--greek-border)] text-center">
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
    </div>
  );
}
