"use client";

import type { Loose } from "@/types/loose";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getPendingSignupPassword, clearPendingSignupPassword } from "@/lib/pendingSignupPassword";
import { getSignupSession, patchSignupSession } from "@/lib/signupSession";
import { AlertCircle, Loader2, Gift, CheckCircle, Pencil, User, Mail, ArrowLeft, Check } from "lucide-react";
import { computeCustomPlan, DEFAULT_CUSTOM_PRICING } from "@/lib/customPlanPricing";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricingConfig";
import GlassButton from "@/components/ui/GlassButton";
import { periodSuffix } from "@/lib/billingPeriods";

const intervalLabel = periodSuffix;

const AI_LABEL: Record<string, string> = {
  none: "Aucune", "15": "15 questions/jour", "30": "30 questions/jour",
  "60": "60 questions/jour", "120": "120 questions/jour", unlim: "Illimitée",
};

/** Dernière étape avant paiement : récapitule tout ce qui a été saisi
 * (profil, formule) pour laisser une chance de corriger avant de payer.
 * Rien de nouveau n'est saisi ici à part le code de parrainage (dont le
 * champ vit ici plutôt qu'à l'étape précédente, puisqu'il influence
 * directement le prix affiché). */
export default function RecapClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<Loose>(null);
  const [selectedPlan, setSelectedPlan] = useState<Loose>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [referralCode, setReferralCode] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [referralValidating, setReferralValidating] = useState(false);
  const [signupMode, setSignupMode] = useState<string>("email");

  useEffect(() => {
    (async () => {
      const [s, pricing] = await Promise.all([
        getSignupSession(),
        fetch("/api/pricing-config").then((r) => r.json()).catch(() => null),
      ]);
      if (pricing) setPricingConfig(pricing);

      if (!s.data) { router.push("/auth/inscription"); return; }
      if (!s.selectedPlan) { router.push("/auth/inscription/select-plan"); return; }
      if (s.mode === "email" && !getPendingSignupPassword()) {
        router.push("/auth/inscription");
        return;
      }

      setSignupMode(s.mode || "email");
      setSignupData(s.data);
      setSelectedPlan(s.selectedPlan);
      if (s.data.referralCode) {
        setReferralCode(s.data.referralCode);
        setReferralStatus("valid");
      }
      setLoading(false);
    })();
  }, [router]);

  const validateReferral = async (code: string) => {
    if (!code.trim()) { setReferralStatus("idle"); return; }
    setReferralValidating(true);
    try {
      const res = await fetch("/api/parent/validate-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setReferralStatus(data.valid ? "valid" : "invalid");
    } catch {
      setReferralStatus("invalid");
    } finally {
      setReferralValidating(false);
    }
  };

  const custom = selectedPlan?.custom ? computeCustomPlan(selectedPlan.config, pricingConfig.custom || DEFAULT_CUSTOM_PRICING) : null;

  const confirmAndPay = async () => {
    if (processing || !signupData || !selectedPlan) return;
    setProcessing(true);
    setError(null);

    try {
      const rc = referralStatus === "valid" ? referralCode.trim().toUpperCase() : null;
      const updatedData = { ...signupData, referralCode: rc };
      await patchSignupSession({ data: updatedData });

      const email = updatedData.email || (await supabase.auth.getUser()).data.user?.email || "";
      const isFreePlan = selectedPlan.price === 0 || custom?.price === 0;

      // Plan gratuit + inscription email/mot de passe (pas Google, deja
      // authentifie autrement) : rien a payer, donc pas besoin de passer par
      // create-checkout-session. On cree le compte ICI, avec le VRAI mot de
      // passe encore en memoire (voir pendingSignupPassword.ts) -- le
      // deleguer a l'etape suivante (redirection puis create-account) le
      // perdait definitivement (jamais transmis au store cote serveur, et de
      // toute facon efface par la navigation window.location.href, meme
      // same-origin), forcant un mot de passe aleatoire inconnu de
      // l'utilisateur (bug constate en test : compte cree mais impossible a
      // se connecter dessus ensuite).
      if (isFreePlan && signupMode === "email") {
        const pwd = getPendingSignupPassword();
        const createRes = await fetch("/api/auth/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "parent",
            firstName: updatedData.firstName,
            lastName: updatedData.lastName,
            email,
            password: pwd,
            sessionId: "free",
            existingAuthId: null,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          setError(createData.error || "Erreur lors de la création du compte.");
          setProcessing(false);
          return;
        }
        if (pwd) {
          await supabase.auth.signInWithPassword({ email, password: pwd });
        }
        clearPendingSignupPassword();
        // On garde la session d'inscription et on atterrit sur la MEME URL
        // que l'ancien flux (create-checkout-session -> session_id=free) :
        // ParentLayout n'autorise /parent/dashboard qu'une fois qu'une ligne
        // "subscriptions" active existe -- ce qui n'est jamais le cas pour le
        // plan gratuit (son absence EST la definition du plan gratuit ici).
        // /parent/subscription?new=true est explicitement exempte de cette
        // verification ; SubscriptionClient s'y trouve deja avec sa session
        // (isSameSignup) et termine lui-meme (no-op sur le compte deja cree,
        // nettoyage de la session, puis navigation CLIENT-SIDE vers le
        // dashboard qui ne re-declenche pas la verification du layout deja
        // monte). Naviguer directement vers /parent/dashboard ici forcerait
        // un premier montage du layout qui bloquerait indefiniment (bug
        // constate en test : page bloquee en chargement).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- rechargement complet voulu (voir le commentaire ci-dessus)
        window.location.href = `${window.location.origin}/parent/subscription?new=true&success=1&session_id=free`;
        return;
      }

      const body = selectedPlan.custom
        ? { customConfig: { config: selectedPlan.config } }
        : { planId: selectedPlan.id };

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNewSignup: true,
          email,
          firstName: updatedData.firstName,
          lastName: updatedData.lastName,
          password: getPendingSignupPassword(),
          referralCode: rc,
          ...body,
        }),
      });

      const data = await res.json();
      if (data.url) {
        // Le compte est créé côté serveur à ce stade : le mot de passe n'a
        // plus besoin de rester en mémoire.
        clearPendingSignupPassword();
        if (data.authId) await patchSignupSession({ pendingAuthId: data.authId });
        window.location.href = data.url;
      } else {
        setError(data.error || "Erreur lors de la création de la session de paiement.");
        setProcessing(false);
      }
    } catch {
      setError("Une erreur est survenue, veuillez réessayer.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--greek-blue)]" />
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--greek-cream)] py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Vérifiez vos informations
          </h1>
          <p className="text-gray-600">Dernière étape avant le paiement, corrigez si besoin</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Profil */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--greek-gold)]" /> Vos informations
            </h2>
            <GlassButton onClick={() => router.push("/auth/inscription")} variant="ghost" size="sm">
              <Pencil className="w-3 h-3" /> Modifier
            </GlassButton>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="text-gray-400">Nom :</span> {signupData.firstName} {signupData.lastName}</p>
            <p className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" /> {signupData.email}
            </p>
          </div>
        </div>

        {/* Formule */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--greek-blue)]">Formule choisie</h2>
            <GlassButton onClick={() => router.push("/auth/inscription/select-plan")} variant="ghost" size="sm">
              <Pencil className="w-3 h-3" /> Changer
            </GlassButton>
          </div>

          {selectedPlan.custom ? (
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-bold text-[var(--greek-blue)] text-base mb-2">Formule sur mesure</p>
              <p>{selectedPlan.config.children} compte{selectedPlan.config.children > 1 ? "s" : ""} enfant{selectedPlan.config.children > 1 ? "s" : ""}</p>
              <p>IA : {AI_LABEL[selectedPlan.config.ai] || selectedPlan.config.ai}</p>
              {(pricingConfig.custom?.options || []).filter((o) => selectedPlan.config.options?.[o.id]).map((o) => (
                <p key={o.id}>+ {o.label}</p>
              ))}
              <p className="text-xl font-bold text-[var(--greek-blue)] mt-3">
                {custom ? custom.price.toFixed(2) : "-"}€<span className="text-sm font-normal">/mois</span>
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-bold text-[var(--greek-blue)] text-base mb-2">{selectedPlan.name}</p>
              {selectedPlan.description && <p>{selectedPlan.description}</p>}
              {selectedPlan.trial_days > 0 && (
                <p className="text-green-600 font-medium">{selectedPlan.trial_days} jours d&apos;essai gratuit</p>
              )}
              <p className="text-xl font-bold text-[var(--greek-blue)] mt-3">
                {selectedPlan.price === 0 ? "Gratuit" : <>{selectedPlan.price}€<span className="text-sm font-normal">{intervalLabel(selectedPlan.billing_interval)}</span></>}
              </p>
            </div>
          )}
        </div>

        {/* Code de parrainage */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-6 shadow-sm mb-6">
          <label className="block text-[var(--greek-blue)] font-bold mb-3 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 text-[var(--greek-gold)]" />
            Code de parrainage <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={referralCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setReferralCode(val);
                setReferralStatus("idle");
              }}
              onBlur={() => validateReferral(referralCode)}
              className={`w-full px-4 py-3 border rounded-xl font-mono tracking-widest uppercase text-sm focus:outline-none pr-10 ${
                referralStatus === "valid"
                  ? "border-green-400 bg-green-50"
                  : referralStatus === "invalid"
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 focus:border-[var(--greek-blue)]"
              }`}
              placeholder="EX: ABCD1234"
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              {referralValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              {!referralValidating && referralStatus === "valid" && <CheckCircle className="w-4 h-4 text-green-500" />}
              {!referralValidating && referralStatus === "invalid" && <AlertCircle className="w-4 h-4 text-red-500" />}
            </div>
          </div>
          {referralStatus === "valid" && (
            <p className="text-xs text-green-600 font-medium mt-2"><Check className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Code valide, remise appliquée lors du paiement</p>
          )}
          {referralStatus === "invalid" && (
            <p className="text-xs text-red-500 mt-2">Code invalide ou expiré</p>
          )}
        </div>

        <GlassButton onClick={confirmAndPay} variant="navy" fullWidth disabled={processing} className="text-lg">
          {processing
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Traitement…</>
            : selectedPlan.price === 0 || custom?.price === 0
            ? "Confirmer et créer mon compte"
            : "Confirmer et payer"}
        </GlassButton>

        <div className="text-center mt-6">
          <GlassButton onClick={() => router.push("/auth/inscription/select-plan")} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Retour aux formules
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
