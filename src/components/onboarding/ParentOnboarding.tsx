"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CGU_SECTIONS, CGU_VERSION } from "@/lib/cgu";
import {
  CheckCircle, ChevronRight, ChevronLeft,
  Users, BookOpen, MessageSquare, BarChart2,
  CreditCard, Sparkles, Shield,
} from "lucide-react";

interface Props {
  firstName: string;
  authId: string;
  onComplete: () => void;
}

const TOUR_STEPS = [
  {
    icon: <BarChart2 className="w-12 h-12 text-[var(--greek-gold)]" />,
    title: "Tableau de bord",
    desc: "Votre vue d'ensemble : progression de vos enfants, alertes, raccourcis vers toutes les sections.",
    color: "from-blue-50 to-indigo-50",
    features: ["Progression en temps réel", "Dernières activités", "Accès rapide aux rapports"],
  },
  {
    icon: <Users className="w-12 h-12 text-[var(--greek-gold)]" />,
    title: "Mes Enfants",
    desc: "Gérez les profils de vos enfants, suivez leurs cours, exercices et quiz en détail.",
    color: "from-green-50 to-teal-50",
    features: ["Suivi par enfant", "Scores et tentatives", "Rapport d'analyse IA"],
  },
  {
    icon: <BookOpen className="w-12 h-12 text-[var(--greek-gold)]" />,
    title: "Cours, Exercices & Quiz",
    desc: "Vos enfants accèdent à du contenu adapté à leur niveau avec correction automatique par IA.",
    color: "from-orange-50 to-amber-50",
    features: ["Cours interactifs avec formules", "Exercices corrigés par IA", "Quiz avec feedback"],
  },
  {
    icon: <MessageSquare className="w-12 h-12 text-[var(--greek-gold)]" />,
    title: "Forum & Support",
    desc: "Un espace d'échange pour poser des questions, et notre support pour vous aider.",
    color: "from-purple-50 to-pink-50",
    features: ["Forum communautaire", "Support tickets", "Réponses dans les 24h"],
  },
  {
    icon: <CreditCard className="w-12 h-12 text-[var(--greek-gold)]" />,
    title: "Abonnement & Parrainage",
    desc: "Gérez votre formule et partagez votre code parrainage pour obtenir des réductions.",
    color: "from-yellow-50 to-green-50",
    features: ["Gérer votre plan", "Historique de facturation", "Code parrainage 10% de réduction"],
  },
];

export default function ParentOnboarding({ firstName, authId, onComplete }: Props) {
  const [step, setStep] = useState<"cgu" | "welcome" | "tour" | "end">("cgu");
  const [tourIndex, setTourIndex] = useState(0);
  const [cguScrolled, setCguScrolled] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    await supabase.from("users").update({
      onboarding_completed: true,
      cgu_accepted_at: new Date().toISOString(),
    }).eq("auth_id", authId);
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[var(--greek-gold)] transition-all duration-500"
            style={{
              width: step === "cgu" ? "10%" : step === "welcome" ? "25%" : step === "tour"
                ? `${25 + ((tourIndex + 1) / TOUR_STEPS.length) * 60}%` : "100%"
            }}
          />
        </div>

        {/* ── CGU ── */}
        {step === "cgu" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-8 pt-8 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <Shield className="w-6 h-6 text-[var(--greek-blue)]" />
                <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                  Conditions d'utilisation
                </h2>
              </div>
              <p className="text-sm text-gray-400">{CGU_VERSION} · Aucun cookie publicitaire</p>
            </div>

            <div
              className="flex-1 overflow-y-auto px-8 py-4 space-y-5"
              onScroll={e => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setCguScrolled(true);
              }}
            >
              {CGU_SECTIONS.map((s, i) => (
                <div key={i}>
                  <h3 className="font-bold text-[var(--greek-blue)] text-sm mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
                </div>
              ))}
              <div className="h-4" />
            </div>

            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50">
              {!cguScrolled && (
                <p className="text-xs text-gray-400 text-center mb-3">↓ Faites défiler pour lire et accepter</p>
              )}
              <button
                onClick={() => setStep("welcome")}
                disabled={!cguScrolled}
                className="w-full py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                J'accepte les conditions d'utilisation
              </button>
            </div>
          </div>
        )}

        {/* ── WELCOME ── */}
        {step === "welcome" && (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-6 flex-1">
            <img src="/logo.png" alt="Educalcul" className="w-20 h-20 object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                Bienvenue, {firstName} !
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                Vous rejoignez Educalcul, la plateforme de mathématiques qui s'adapte au niveau de vos enfants.
              </p>
            </div>
            <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl p-5 max-w-md text-left space-y-2">
              {["Suivez la progression de vos enfants en temps réel", "Cours, exercices et quiz corrigés par IA", "Assistant Athéna disponible selon votre plan"].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-[var(--greek-gold)] shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("tour")}
              className="px-8 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg"
            >
              <Sparkles className="w-5 h-5" />
              Découvrir la plateforme
            </button>
          </div>
        )}

        {/* ── TOUR ── */}
        {step === "tour" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Slide */}
            <div className={`flex-1 bg-gradient-to-br ${TOUR_STEPS[tourIndex].color} flex flex-col items-center justify-center px-8 py-10 text-center gap-6 transition-all duration-300`}>
              <div className="animate-bounce-slow">
                {TOUR_STEPS[tourIndex].icon}
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-widest mb-2">
                  {tourIndex + 1} / {TOUR_STEPS.length}
                </p>
                <h3 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                  {TOUR_STEPS[tourIndex].title}
                </h3>
                <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
                  {TOUR_STEPS[tourIndex].desc}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {TOUR_STEPS[tourIndex].features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/70 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium shadow-sm">
                    <CheckCircle className="w-4 h-4 text-[var(--greek-gold)] shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Nav */}
            <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => tourIndex === 0 ? setStep("welcome") : setTourIndex(i => i - 1)}
                className="flex items-center gap-1 text-gray-400 hover:text-[var(--greek-blue)] transition-colors font-semibold text-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>

              {/* Dots */}
              <div className="flex gap-2">
                {TOUR_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setTourIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === tourIndex ? "bg-[var(--greek-gold)] w-5" : "bg-gray-200"}`}
                  />
                ))}
              </div>

              {tourIndex < TOUR_STEPS.length - 1 ? (
                <button
                  onClick={() => setTourIndex(i => i + 1)}
                  className="flex items-center gap-1 text-[var(--greek-blue)] font-bold text-sm hover:text-blue-800 transition-colors"
                >
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setStep("end")}
                  className="flex items-center gap-1 bg-[var(--greek-blue)] text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-800 transition-colors"
                >
                  Terminer <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── END ── */}
        {step === "end" && (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-6 flex-1">
            <img src="/logo.png" alt="Educalcul" className="w-20 h-20 object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                Vous êtes prêt(e) !
              </h2>
              <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
                La plateforme n'a plus de secrets pour vous. Commencez par ajouter vos enfants depuis votre tableau de bord.
              </p>
            </div>
            <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl p-5 max-w-sm text-left">
              <p className="font-bold text-[var(--greek-blue)] text-sm mb-2">Premier pas recommandé</p>
              <p className="text-sm text-gray-600">Ajoutez votre premier enfant depuis <strong>Mes Enfants → Ajouter un enfant</strong> pour commencer le suivi.</p>
            </div>
            <button
              onClick={handleComplete}
              disabled={saving}
              className="px-10 py-3 bg-[var(--greek-gold)] text-white font-bold rounded-xl hover:bg-yellow-600 transition-colors shadow-lg text-lg disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "Accéder au tableau de bord"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
