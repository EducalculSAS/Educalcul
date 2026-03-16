"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Check, X, Tag, Users, Baby, CreditCard, Star } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanFeature = {
  text: string;
  included: boolean;
};

type Plan = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  features: PlanFeature[];
  popular?: boolean;
  buttonVariant: "primary" | "outline";
};

const parentPlans: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    subtitle: "Parfait pour débuter",
    price: 9.99,
    features: [
      { text: "Accès aux cours de base", included: true },
      { text: "50 exercices interactifs", included: true },
      { text: "Suivi de progression simple", included: true },
      { text: "Assistant IA basique (5 questions/jour)", included: true },
      { text: "Support par email uniquement", included: true },
      { text: "Pas d'accès parent", included: false },
    ],
    buttonVariant: "outline",
  },
  {
    id: "avance",
    name: "Avancé",
    subtitle: "Le plus choisi par les familles",
    price: 19.99,
    features: [
      { text: "Accès complet aux cours", included: true },
      { text: "Exercices illimités", included: true },
      { text: "Suivi de progression détaillé", included: true },
      { text: "Assistant IA avancé (illimité)", included: true },
      { text: "Chatbot IA personnalisé", included: true },
      { text: "Analyse IA des progrès", included: true },
      { text: "Support prioritaire", included: true },
      { text: "Accès Espace Parents", included: true },
      { text: "Rapports de progression", included: true },
    ],
    popular: true,
    buttonVariant: "primary",
  },
  {
    id: "premium",
    name: "Premium",
    subtitle: "L'expérience complète",
    price: 29.99,
    features: [
      { text: "Tout de l'offre Avancé", included: true },
      {
        text: "IA Premium : génération de cours personnalisés",
        included: true,
      },
      { text: "IA Premium : création d'exercices adaptatifs", included: true },
      { text: "Tuteur IA personnel dédié", included: true },
      { text: "Support prioritaire 24/7", included: true },
      { text: "Sessions de tutorat en ligne", included: true },
      { text: "Contenu exclusif", included: true },
      { text: "Accès anticipé aux nouveautés", included: true },
      { text: "Certificats de réussite", included: true },
    ],
    buttonVariant: "outline",
  },
];

const childPlans: Plan[] = [
  {
    id: "decouverte_enfant",
    name: "Découverte Enfant",
    subtitle: "Idéal pour débuter",
    price: 7.99,
    features: [
      { text: "Accès aux cours CP-CE1", included: true },
      { text: "Exercices interactifs de base", included: true },
      { text: "Quiz chronométrés avec scores", included: true },
      { text: "Suivi de progression visuel", included: true },
      { text: "Assistant IA Educalcul (3 questions/jour)", included: true },
      { text: "Interface adaptée aux jeunes enfants", included: true },
    ],
    buttonVariant: "outline",
  },
  {
    id: "explorateur_enfant",
    name: "Explorateur Enfant",
    subtitle: "Pour progresser avec confiance",
    price: 14.99,
    features: [
      { text: "Accès complet CP au CM2", included: true },
      { text: "Tous types d'exercices", included: true },
      { text: "Quiz illimités avec explications détaillées", included: true },
      { text: "Tableaux de bord de progression gamifiés", included: true },
      { text: "Assistant IA Educalculate illimité", included: true },
      { text: "Jeux mathématiques interactifs", included: true },
      { text: "Badges et récompenses de progression", included: true },
    ],
    popular: true,
    buttonVariant: "primary",
  },
  {
    id: "genie_enfant",
    name: "Génie Enfant",
    subtitle: "L'excellence mathématique",
    price: 22.99,
    features: [
      { text: "Accès complet CP au CM2 + 6ème", included: true },
      { text: "Exercices avancés et problèmes contextualisés", included: true },
      { text: "Quiz adaptatifs selon le niveau", included: true },
      { text: "Suivi détaillé par domaines", included: true },
      { text: "Assistant IA Educalculate premium illimité", included: true },
      { text: "Contenu interactif avancé", included: true },
      { text: "Rapports de progression détaillés", included: true },
      { text: "Accès prioritaire aux nouveautés", included: true },
    ],
    buttonVariant: "outline",
  },
];

export default function Tarifs() {
  const [activeTab, setActiveTab] = useState<"parent" | "child">("parent");

  const router = useRouter();

  const handlePayment = (planId: string, price: number, planName: string) => {
    // Redirect to subscription page for proper handling
    router.push(`/parent/subscription?plan=${planId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px]">
        {/* Hero Section */}
        <section className="bg-[var(--greek-cream)] py-16 text-center relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
                <Tag className="w-10 h-10 md:w-12 md:h-12" />
                Nos Formules d'Abonnement
              </h1>
              <p className="text-[var(--greek-blue)] text-xl opacity-80">
                Choisissez la formule qui correspond le mieux aux besoins de
                votre enfant
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="pb-20">
          <div className="container mx-auto px-4">
            {/* Toggle Buttons */}
            <div className="flex justify-center mb-12">
              <div className="bg-white p-1 rounded-full shadow-md border border-[var(--greek-bronze)] inline-flex">
                <button
                  onClick={() => setActiveTab("parent")}
                  className={`px-6 py-3 rounded-full text-lg font-semibold flex items-center gap-2 transition-all duration-300 ${
                    activeTab === "parent"
                      ? "bg-[var(--greek-bronze)] text-white shadow-sm"
                      : "text-[var(--greek-bronze)] hover:bg-orange-50"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  Plans Parent
                </button>
                <button
                  onClick={() => setActiveTab("child")}
                  className={`px-6 py-3 rounded-full text-lg font-semibold flex items-center gap-2 transition-all duration-300 ${
                    activeTab === "child"
                      ? "bg-[var(--greek-bronze)] text-white shadow-sm"
                      : "text-[var(--greek-bronze)] hover:bg-orange-50"
                  }`}
                >
                  <Baby className="w-5 h-5" />
                  Plans Enfant
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {(activeTab === "parent" ? parentPlans : childPlans).map(
                (plan) => (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col bg-white rounded-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                      plan.popular
                        ? "border-2 border-[var(--greek-bronze)] shadow-lg scale-105 z-10"
                        : "border border-[var(--card-border-antique)] shadow-md"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-br from-[var(--greek-bronze)] to-[var(--greek-gold)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-current" />
                        POPULAIRE
                      </div>
                    )}

                    <div className="p-6 bg-gray-50 rounded-t-xl border-b border-gray-100 text-center">
                      <h3 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-gray-500 text-sm">{plan.subtitle}</p>
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                      <div className="text-center mb-6">
                        <span className="text-4xl font-bold text-[var(--greek-bronze)] font-[family-name:var(--font-display)]">
                          {plan.price} €
                        </span>
                        <span className="text-gray-400 text-sm">/mois</span>
                      </div>

                      <ul className="space-y-4 mb-8 flex-grow">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            {feature.included ? (
                              <Check className="w-5 h-5 text-[var(--greek-bronze)] flex-shrink-0 mt-0.5" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-sm ${
                                feature.included
                                  ? "text-gray-700"
                                  : "text-gray-400"
                              }`}
                            >
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() =>
                          handlePayment(plan.id, plan.price, plan.name)
                        }
                        className={`w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                          plan.buttonVariant === "primary"
                            ? "bg-[var(--greek-bronze)] text-white hover:bg-[var(--greek-gold)] shadow-md hover:shadow-lg"
                            : "bg-transparent border-2 border-[var(--greek-bronze)] text-[var(--greek-bronze)] hover:bg-[var(--greek-bronze)] hover:text-white"
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        Choisir cette offre
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
