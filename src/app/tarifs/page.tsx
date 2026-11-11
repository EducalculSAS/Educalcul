import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { formatEuros, offersSchema, priceTable, pricingDescription } from "@/lib/seo/pricing";
import { socialMeta } from "@/lib/seo/meta";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Check, ArrowRight } from "lucide-react";
import FadeInSection from "@/components/home/FadeInSection";
import TarifsInteractive from "@/components/tarifs/TarifsInteractive";
import TarifsFaqItem from "@/components/tarifs/TarifsFaqItem";
import { fetchActivePlans } from "@/lib/plans";
import GlassButton from "@/components/ui/GlassButton";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { normalizePricingConfig } from "@/lib/pricingConfig";

// Page publique quasi-statique (plans édités en admin) : ISR au lieu d'un
// aller-retour Supabase à chaque visite.
export const revalidate = 300;

// Description et prix publiés pour les moteurs : lus dans les formules actives (jamais écrits à la main).
export async function generateMetadata(): Promise<Metadata> {
  const description = pricingDescription(await fetchActivePlans());
  return { description, ...socialMeta({ title: "Tarifs Educalcul : Essai gratuit 7 jours", description, path: "/tarifs" }) };
}

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
  { s: "θ", x: 50, y: 78, z: 62, d: 2.0, t: 8.8 },
  { s: "β", x: 28, y: 53, z: 42, d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46, d: 1.1, t: 9.7 },
  { s: "÷", x: 19, y: 84, z: 38, d: 2.9, t: 7.3 },
];

const MINI_FAQ = [
  { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez passer à un plan supérieur ou inférieur à n'importe quel moment depuis votre espace parent. Le changement est effectif immédiatement et le montant est ajusté au prorata." },
  { q: "Y a-t-il un engagement de durée ?", a: "Non. Les abonnements sont sans engagement. Vous pouvez annuler à tout moment depuis votre compte, sans frais ni justification." },
  { q: "La période d'essai est-elle vraiment gratuite ?", a: "Oui. Pendant 7 jours vous avez accès à toute la formule choisie et rien n'est prélevé. Le moyen de paiement est enregistré à l'inscription ; si vous résiliez avant la fin de l'essai, vous ne payez rien." },
  { q: "Que se passe-t-il si je dépasse le nombre d'enfants autorisé ?", a: "Vous serez invité à passer à un plan supérieur. Aucun enfant ne perd l'accès brutalement, vous avez un délai pour régulariser votre abonnement." },
];

export default async function Tarifs() {
  const [plans, { data: pricingRow }] = await Promise.all([
    fetchActivePlans(),
    supabaseAdmin.from("app_settings").select("value").eq("key", "pricing_config").maybeSingle(),
  ]);
  // Réglages de la page Tarifs (admin > Abonnements) : périodes, sur-mesure, onglets et blocs affichés ou masqués.
  const cfg = normalizePricingConfig(pricingRow?.value);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-blue)" }}>
      <JsonLd data={offersSchema(plans)} />
      <Navbar />
      <main className="flex-grow pt-[64px]">
        {/* HERO — split, panneau droite garanties */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-32">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.z}px`, fontFamily: "Georgia,serif", color: "var(--greek-gold)", opacity: 0.1, animationDuration: `${cfg.t}s`, animationDelay: `${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(197,161,72,0.85)" }}>Abonnements</p>
                <h1 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-5 text-white"
                  style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}>
                  Nos Formules
                </h1>
                <p className="text-white/55 text-lg leading-relaxed mb-8">
                  Sans engagement, sans frais cachés. Annulez à tout moment depuis votre espace.
                </p>
                <GlassButton href="/auth/inscription" variant="gold">
                  Essai gratuit 7 jours <ArrowRight className="w-4 h-4" />
                </GlassButton>
              </div>
              <div className="hidden md:flex flex-col gap-4">
                <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(197,161,72,0.85)" }}>Pour commencer</p>
                  <p className="font-[family-name:var(--font-display)] font-bold mt-2" style={{ color: "var(--greek-gold)", fontSize: "2.8rem", lineHeight: 1 }}>0 €</p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>Accès immédiat à toutes les fonctionnalités : 7 jours sans frais</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Sans engagement", "7 jours d'essai gratuit", "Annulable à tout moment", "Accès immédiat"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--greek-gold)" }} />
                      <span className="text-xs" style={{ color: "rgba(240,237,232,0.55)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABS + CONTENT + COMPARATEUR (client island) */}
        <TarifsInteractive initialPlans={plans} periods={cfg.periods} customPricing={cfg.custom} tabLabels={cfg.tabs} visibility={cfg.visibility} layout={cfg.layout} popularAuto={cfg.popularAuto} />

        {/* TOUS LES TARIFS : texte simple (HTML initial), pour que chaque prix soit lisible sans cliquer sur une période */}
        {(() => {
          const table = priceTable(plans, cfg.periods);
          if (table.rows.length === 0) return null;
          return (
            <section aria-labelledby="tous-les-tarifs" className="pb-14 px-6 bg-[var(--greek-cream)]">
              <div className="max-w-3xl mx-auto bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
                <h2 id="tous-les-tarifs" className="text-xl font-bold text-[var(--greek-blue)]">Tous les tarifs en un coup d&apos;œil</h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">Prix en euros par période de facturation (TVA non applicable), sans engagement. 7 jours d&apos;essai gratuits.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <caption className="sr-only">Prix des formules Solo et Family selon la période de facturation</caption>
                    <thead>
                      <tr className="border-b border-[rgba(197,161,72,0.25)] text-[var(--greek-blue)]">
                        <th scope="col" className="py-2 pr-3 sm:pr-4 font-bold">Formule</th>
                        {table.columns.map((c) => <th key={c.id} scope="col" className="py-2 pr-3 sm:pr-4 font-bold whitespace-nowrap">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {table.free && (
                        <tr className="border-b border-gray-100">
                          <th scope="row" className="py-2.5 pr-3 sm:pr-4 font-bold text-[var(--greek-blue)]">{table.free.name}<span className="block text-xs font-normal text-gray-500">{table.free.maxChildren === 1 ? "1 enfant" : ""}</span></th>
                          <td colSpan={table.columns.length} className="py-2.5 pr-3 sm:pr-4 text-gray-600">Gratuit</td>
                        </tr>
                      )}
                      {table.rows.map((r) => (
                        <tr key={r.name} className="border-b border-gray-100 last:border-0">
                          <th scope="row" className="py-2.5 pr-3 sm:pr-4 font-bold text-[var(--greek-blue)]">{r.name}<span className="block text-xs font-normal text-gray-500">{r.maxChildren === 1 ? "1 enfant" : r.maxChildren ? `jusqu'à ${r.maxChildren} enfants` : ""}</span></th>
                          {table.columns.map((c) => <td key={c.id} className="py-2.5 pr-3 sm:pr-4 text-gray-800 font-semibold whitespace-nowrap">{r.prices[c.id] != null ? `${formatEuros(r.prices[c.id])} €` : "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })()}

        {/* GARANTIE */}
        {cfg.visibility.guarantee && (
          <section className="py-14 bg-[var(--greek-cream)] border-t border-gray-100 text-center">
          <div className="container mx-auto px-6 max-w-xl">
            <FadeInSection translateY={20}>
              <h2 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)] mb-2">
                Sans engagement · Annulable à tout moment
              </h2>
              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                Paiement sécurisé par Stripe, sans frais caché. Vous disposez de 14 jours pour vous rétracter, avec remboursement au prorata de la période non utilisée (voir les CGV).
              </p>
            </FadeInSection>
          </div>
        </section>
        )}

        {/* MINI-FAQ */}
        {cfg.visibility.faq && (
          <section className="py-16 px-6" style={{ background: "var(--greek-cream)" }}>
          <div className="max-w-2xl mx-auto">
            <FadeInSection translateY={20} durationMs={400}>
              <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-center mb-8" style={{ color: "var(--greek-blue)" }}>
                Questions fréquentes
              </h2>
            </FadeInSection>
            <div className="space-y-3">
              {MINI_FAQ.map((item, i) => (
                <FadeInSection key={i} translateY={16} durationMs={400} delayMs={80 + i * 60}>
                  <TarifsFaqItem question={item.q} answer={item.a} />
                </FadeInSection>
              ))}
            </div>
            <p className="text-center text-sm mt-8" style={{ color: "var(--text-muted)" }}>
              Vous avez une autre question ?{" "}
              <a href="/contact" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>Contactez-nous</a>
              {" "}ou consultez la{" "}
              <a href="/faq" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>FAQ complète</a>.
            </p>
          </div>
        </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
