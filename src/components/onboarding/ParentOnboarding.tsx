"use client";

import Image from "next/image";
import { useState } from "react";
import { updateMyProfile } from "@/lib/updateMyProfile";
import { CGU_SECTIONS, CGU_VERSION } from "@/lib/cgu";
import { CheckCircle, Sparkles, Shield } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface Props {
  firstName: string;
  authId: string;
  onComplete: () => void;
}

export default function ParentOnboarding({ firstName, onComplete }: Props) {
  const [step, setStep] = useState<"cgu" | "welcome">("cgu");
  const [cguScrolled, setCguScrolled] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    // cgu_accepted_at est horodaté côté serveur quand onboarding_completed passe à true.
    await updateMyProfile({ onboarding_completed: true });
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-overlay">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[var(--greek-gold)] transition-all duration-500"
            style={{
              width: step === "cgu" ? "40%" : "100%"
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
                  Conditions d&apos;utilisation
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
              <GlassButton
                onClick={() => setStep("welcome")}
                variant="navy"
                fullWidth
                disabled={!cguScrolled}
              >
                <CheckCircle className="w-5 h-5" />
                J&apos;accepte les conditions d&apos;utilisation
              </GlassButton>
            </div>
          </div>
        )}

        {/* ── WELCOME ── */}
        {step === "welcome" && (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-6 flex-1">
            <Image src="/logo.png" alt="Educalcul" width={80} height={80} className="w-20 h-20 object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                Bienvenue, {firstName} !
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                Vous rejoignez Educalcul, la plateforme de mathématiques qui s&apos;adapte au niveau de vos enfants.
              </p>
            </div>
            <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl p-5 max-w-md text-left space-y-2">
              {["Suivez la progression de vos enfants en temps réel", "Cours, exercices et quiz corrigés par IA", "Assistant Calia disponible selon votre plan"].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-[var(--greek-gold)] shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            {/* La visite guidée (GuidedTour) prend le relais dès la fermeture de cette fenêtre. */}
            <GlassButton onClick={handleComplete} variant="navy" disabled={saving}>
              <Sparkles className="w-5 h-5" />
              {saving ? "Un instant…" : "Commencer la visite guidée"}
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}
