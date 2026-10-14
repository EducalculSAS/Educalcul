"use client";

import PageHero from "@/components/PageHero";
import PageLoader from "@/components/PageLoader";
import AppLoader from "@/components/AppLoader";
import { useState, useEffect, Suspense } from "react";
import {
  Crown,
  Check,
  CreditCard,
  Clock,
  AlertTriangle,
  Download,
  Loader2,
  Gift,
  Copy,
  CheckCheck,
  Users,
  Undo2,
} from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/Toast";
import { useRouter, useSearchParams } from "next/navigation";
import PlanChooser, { type ChooserPlan } from "@/components/PlanChooser";
import type { CustomPlanConfig } from "@/lib/customPlanPricing";
import { type PricingConfig } from "@/lib/pricingConfig";
import GlassButton from "@/components/ui/GlassButton";
import { getSignupSession, patchSignupSession, clearSignupSession } from "@/lib/signupSession";
import { periodSuffix } from "@/lib/billingPeriods";

interface SubscriptionPlan {
  id: number;
  name: string;
  price: number;
  billing_interval: string;
  features: Record<string, boolean | number | string | null> | null;
  description: string | null;
  trial_days: number;
  promo_description: string | null;
  is_active: boolean;
  sort_order: number;
}

/** Page abonnement : le flow "nouvelle inscription" (isNewSignup) dépend du
 * sessionStorage du navigateur (données saisies avant paiement) et ne peut
 * pas être prérendu côté serveur. Le flow normal (gestion d'un abonnement
 * existant) reçoit maintenant tout — plans, config tarifs, code parrainage,
 * réduction en attente, ET le détail Stripe (abonnement + factures) — déjà
 * chargé du serveur ; plus aucun aller-retour client au premier affichage. */
function SubscriptionPageContent({
  authId,
  authEmail,
  initialPlans,
  initialPricingConfig,
  initialReferralCode,
  initialPendingDiscount,
  initialCurrentPlan,
  initialBillingHistory,
}: {
  authId: string | null;
  authEmail: string | null;
  initialPlans: SubscriptionPlan[];
  initialPricingConfig: PricingConfig;
  initialReferralCode: any | null;
  initialPendingDiscount: number;
  initialCurrentPlan: any | null;
  initialBillingHistory: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewSignup = searchParams.get("new") === "true";
  const [loading, setLoading] = useState(isNewSignup);
  const [subLoading, setSubLoading] = useState(false);
  const [plans] = useState<SubscriptionPlan[]>(initialPlans);
  // Toutes chargées côté serveur et jamais modifiées côté client (un retour
  // de checkout re-render le composant serveur via router.replace, voir plus
  // bas) : pas besoin d'état local pour ces trois-là.
  const currentPlan = initialCurrentPlan;
  const billingHistory = initialBillingHistory;
  const user = isNewSignup || !authId ? null : { id: authId, email: authEmail };
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const { error: toastError, success: toastSuccess } = useToast();
  const myReferralCode = initialReferralCode;
  const [copied, setCopied] = useState(false);
  const [pendingDiscount] = useState(initialPendingDiscount);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [signupData, setSignupData] = useState<any>(null);
  const [customProcessing, setCustomProcessing] = useState(false);
  const [pricingConfig] = useState<PricingConfig>(initialPricingConfig);
  // Fonction de rétractation (14 jours après la souscription, voir src/lib/withdrawal.ts)
  const [withdrawal, setWithdrawal] = useState<{ deadline: string; refundCents: number; planName: string } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (isNewSignup || !initialCurrentPlan?.stripe_subscription_id || initialCurrentPlan?.status === "cancelled") return;
    let alive = true;
    fetch("/api/parent/withdrawal")
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => { if (alive && q?.eligible) setWithdrawal(q); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isNewSignup, initialCurrentPlan]);

  const confirmWithdrawal = async () => {
    setWithdrawing(true);
    try {
      const res = await fetch("/api/parent/withdrawal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error || "La rétractation n'a pas pu être enregistrée.");
        return;
      }
      toastSuccess("Rétractation enregistrée. Un accusé de réception vous a été envoyé par email.");
      setWithdrawOpen(false);
      setWithdrawal(null);
      router.refresh();
    } finally {
      setWithdrawing(false);
    }
  };

  useEffect(() => {
    if (isNewSignup) {
      (async () => {
        try {
          const s = await getSignupSession();
          if (!s.selectedPlan || !s.data) {
            router.push("/auth/inscription");
            return;
          }
          setSelectedPlan(s.selectedPlan);
          setSignupData(s.data);
          setLoading(false);
        } catch (error) {
          console.error("Error loading signup data:", error);
          router.push("/auth/inscription");
        }
      })();
      return;
    }

    // NORMAL FLOW : tout arrive déjà chargé du serveur (props) — rien à faire.
    // Un retour de checkout Stripe déclenche un router.replace vers cette
    // même page (voir plus bas), ce qui refait tourner le composant serveur
    // et rapporte un abonnement à jour — pas besoin d'un fetch client ici.
    if (!authId) {
      router.push("/auth/connexion");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewSignup, authId]);

  // Sync subscription after Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success !== "1" || !sessionId) return;

    (async () => {
      try {
        // NEW SIGNUP FLOW
        if (isNewSignup && signupData) {
          const cleanup = () => clearSignupSession();

          // Plan gratuit : rien à frauder, le compte est créé directement.
          if (sessionId === "free") {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            // La session active dans ce navigateur n'est le compte qu'on est
            // en train de creer QUE si son email correspond (cas Google
            // OAuth, deja authentifie avant cette derniere etape) — sinon
            // c'est une session sans rapport qu'il ne faut pas faire passer
            // pour "le compte existant" aupres de la route de creation.
            const isSameSignup = currentUser?.email === signupData.email;
            const createUserRes = await fetch("/api/auth/create-account", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(isSameSignup && currentSession ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
              },
              body: JSON.stringify({ ...signupData, sessionId, existingAuthId: isSameSignup ? currentUser!.id : null }),
            });
            if (createUserRes.ok) {
              cleanup();
              // Le mot de passe choisi ne survit jamais a la navigation
              // window.location.href faite par RecapClient (perte du module
              // JS pendingSignupPassword, meme en rechargement same-origin) :
              // signupData.password est donc TOUJOURS undefined ici, pour le
              // plan gratuit comme pour le paiement reel -- inutile de tenter
              // signInWithPassword. Seul le cas Google OAuth (isSameSignup)
              // a deja une session valide et peut aller direct au dashboard ;
              // sinon on renvoie vers la connexion avec un message clair au
              // lieu de rediriger vers /parent/dashboard sans session (ce qui
              // echouait silencieusement sur /auth/connexion).
              if (isSameSignup) {
                router.replace("/parent/dashboard");
              } else {
                toastSuccess("Compte créé ! Connectez-vous avec le mot de passe choisi à l'inscription.");
                router.replace("/auth/connexion");
              }
            } else {
              console.error("Failed to create account:", await createUserRes.json().catch(() => ({})));
            }
            return;
          }

          // Paiement Stripe réel : le webhook crée le compte une fois le
          // paiement confirmé — on attend juste que ce soit fait. On vérifie
          // par authId (fiable), pas par email (modifiable sur la page Stripe).
          const pendingAuthId = (await getSignupSession()).pendingAuthId;
          const { data: { user: liveUserForStatus } } = await supabase.auth.getUser();
          const statusQuery = pendingAuthId
            ? `authId=${encodeURIComponent(pendingAuthId)}`
            : liveUserForStatus
            ? `authId=${encodeURIComponent(liveUserForStatus.id)}`
            : null; // sans identifiant de compte : pas d'attente (voir /api/auth/signup-status)

          let ready = false;
          const deadline = Date.now() + 20000;
          while (statusQuery && Date.now() < deadline) {
            const res = await fetch(`/api/auth/signup-status?${statusQuery}`);
            const json = await res.json().catch(() => null);
            if (json?.ready) { ready = true; break; }
            await new Promise(r => setTimeout(r, 1500));
          }
          if (!ready) {
            toastError("Paiement reçu, la finalisation prend plus de temps que prévu, vérifiez vos emails dans quelques minutes.");
            return;
          }

          // Le mot de passe choisi n'est jamais persiste au-dela de la
          // creation du compte (voir pendingSignupPassword.ts) : apres
          // l'aller-retour cross-origin vers Stripe Checkout, signupData.password
          // est TOUJOURS undefined ici pour une inscription email/mot de passe
          // fraiche -- il n'y a jamais eu de reconnexion automatique possible
          // dans ce cas. Sans session deja valide, rediriger vers
          // /parent/dashboard ferait juste echouer silencieusement
          // l'utilisateur sur /auth/connexion : on l'y envoie directement,
          // avec un message clair.
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          cleanup();
          if (!currentUser) {
            toastSuccess("Paiement confirmé ! Connectez-vous avec le mot de passe choisi à l'inscription.");
            router.replace("/auth/connexion");
            return;
          }
          router.replace("/parent/dashboard");
          return;
        }

        // NORMAL FLOW
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await fetch("/api/parent/sync-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, authId: user.id }),
        });
        router.replace("/parent/subscription");
      } catch (error) {
        console.error("Error syncing subscription:", error);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- les fonctions de notification sont stables ; l'effet ne doit réagir qu'à la navigation
  }, [searchParams, isNewSignup, signupData, router]);

  const copyCode = () => {
    if (!myReferralCode?.code) return;
    navigator.clipboard.writeText(myReferralCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubscribe = async (planId: number) => {
    setProcessingPlanId(planId);
    try {
      if (isNewSignup && signupData) {
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            isNewSignup: true,
            email: signupData.email,
            firstName: signupData.firstName,
            lastName: signupData.lastName,
            password: signupData.password,
            referralCode: signupData.referralCode || undefined,
          }),
        });

        const data = await response.json();
        if (data.url) {
          if (data.authId) await patchSignupSession({ pendingAuthId: data.authId });
          window.location.href = data.url;
        } else {
          console.error("Error creating checkout session:", data.error);
          toastError("Une erreur est survenue. Veuillez réessayer.");
          setProcessingPlanId(null);
        }
        return;
      }

      if (!user) {
        router.push("/auth/connexion?redirect=/parent/subscription");
        return;
      }

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId: user.id,
          email: user.email,
          referralCode: undefined,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Erreur lors de la création de la session:", data.error);
        toastError("Une erreur est survenue. Veuillez réessayer.");
        setProcessingPlanId(null);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toastError("Une erreur est survenue. Veuillez réessayer.");
      setProcessingPlanId(null);
    }
  };

  const handleSubscribeCustom = async (cfg: CustomPlanConfig) => {
    if (!user) {
      router.push("/auth/connexion?redirect=/parent/subscription");
      return;
    }
    setCustomProcessing(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customConfig: { config: cfg },
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Erreur lors de la création de la session:", data.error);
        toastError("Une erreur est survenue. Veuillez réessayer.");
        setCustomProcessing(false);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toastError("Une erreur est survenue. Veuillez réessayer.");
      setCustomProcessing(false);
    }
  };

  const handleManagePayment = async () => {
    if (!user) return;

    setSubLoading(true);
    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toastError("Impossible d'accéder au portail de paiement.");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toastError("Une erreur est survenue.");
    } finally {
      setSubLoading(false);
    }
  };

  const handleCancel = () => {
    if (isNewSignup) {
      clearSignupSession();
      router.push("/");
    } else {
      handleManagePayment();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader className="h-32" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero
        icon={Crown}
        title={isNewSignup ? "Choisir un plan" : "Mon abonnement"}
        badge="Formule"
        subtitle={isNewSignup ? "Finalisez votre inscription en choisissant un plan." : "Gérez votre formule et accédez à vos factures."}
      />

      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        {/* Current Subscription Status (only for normal flow) */}
        {!isNewSignup && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6 mb-8">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2 font-[family-name:var(--font-display)]">
              <CreditCard className="w-5 h-5 text-[var(--greek-gold)]" />
              Mon abonnement
            </h2>
            {subLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <p className="text-gray-600">
                    Plan actuel :{" "}
                    <span className="font-bold text-[var(--greek-blue)] text-lg">
                      {plans.find((p) => String(p.id) === String(currentPlan?.plan_id))?.name || (currentPlan?.plan_id ? "Plan actif" : "Gratuit")}
                    </span>
                  </p>
                  {currentPlan?.current_period_end && !currentPlan?.cancel_at_period_end && (
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <Clock className="w-4 h-4 mr-1" />
                      Renouvellement le : {new Date(currentPlan.current_period_end).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {currentPlan?.cancel_at_period_end && currentPlan?.current_period_end && (
                    <p className="text-sm text-red-500 flex items-center mt-1">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Se termine le : {new Date(currentPlan.current_period_end).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {currentPlan?.status === "past_due" && (
                    <p className="text-sm text-red-500 flex items-center mt-1 font-semibold">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Échec du paiement, mettez à jour votre moyen de paiement
                    </p>
                  )}
                </div>
                {currentPlan?.stripe_customer_id && (
                  <GlassButton onClick={handleManagePayment} variant="navy" size="sm" className="whitespace-nowrap">
                    <CreditCard className="w-4 h-4" />
                    {currentPlan?.status === "past_due" ? "Mettre à jour mon paiement" : "Gérer votre abonnement"}
                  </GlassButton>
                )}
              </div>
            )}
            {withdrawal && (
              <div className="mt-5 pt-4 border-t border-[rgba(197,161,72,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Vous pouvez vous rétracter jusqu’au{" "}
                  <strong className="text-[var(--greek-blue)]">{new Date(withdrawal.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</strong>, sans justification.
                </p>
                <GlassButton onClick={() => setWithdrawOpen(true)} variant="outline" size="sm" className="whitespace-nowrap">
                  <Undo2 className="w-4 h-4" />
                  Se rétracter du contrat ici
                </GlassButton>
              </div>
            )}
          </div>
        )}

        {withdrawOpen && withdrawal && (
          <GlassDialog
            title="Se rétracter du contrat"
            onClose={() => !withdrawing && setWithdrawOpen(false)}
            footer={
              <>
                <GlassButton onClick={() => setWithdrawOpen(false)} variant="ghost" size="sm" disabled={withdrawing}>Annuler</GlassButton>
                <GlassButton onClick={confirmWithdrawal} variant="danger" size="sm" disabled={withdrawing}>
                  {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                  Confirmer la rétractation
                </GlassButton>
              </>
            }
          >
            <div className="space-y-3 text-sm text-[var(--text-dark)]">
              <p>Vous vous rétractez de votre abonnement <strong>{withdrawal.planName}</strong> ({authEmail}).</p>
              <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-5">
                <li>L’abonnement est arrêté immédiatement, aucun nouveau prélèvement n’aura lieu.</li>
                <li>
                  {withdrawal.refundCents > 0
                    ? <>Remboursement de <strong className="text-[var(--greek-blue)]">{(withdrawal.refundCents / 100).toFixed(2).replace(".", ",")} €</strong> au prorata de la période non utilisée, sous 5 à 10 jours ouvrés.</>
                    : "Aucun montant n'a été prélevé : il n'y a rien à rembourser."}
                </li>
                <li>Votre compte et la progression de vos enfants sont conservés.</li>
              </ul>
              <p className="text-xs text-[var(--text-muted)]">Un accusé de réception vous sera envoyé par email.</p>
            </div>
          </GlassDialog>
        )}

        {/* Parrainage reward banner (only for normal flow) */}
        {!isNewSignup && pendingDiscount > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl px-6 py-4 flex items-center gap-3">
            <Gift className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-800">Récompense parrainage disponible</p>
              <p className="text-sm text-green-700">Un ami a utilisé votre code ! Vous bénéficiez de <strong>{pendingDiscount}% de réduction</strong> sur votre prochain abonnement.</p>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        {isNewSignup ? (
          selectedPlan && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="bg-white rounded-xl shadow-sm border border-[var(--greek-gold)] ring-2 ring-[var(--greek-gold)] p-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedPlan.name}</h3>
                {selectedPlan.description && <p className="text-gray-500 mb-6">{selectedPlan.description}</p>}
                <div className="text-4xl font-bold text-[var(--greek-blue)] mb-6">
                  {selectedPlan.price === 0 ? "Gratuit" : `${selectedPlan.price}€`}
                  {selectedPlan.price > 0 && <span className="text-sm text-gray-500 font-normal"> {periodSuffix(selectedPlan.billing_interval)}</span>}
                </div>
                {selectedPlan.trial_days > 0 && (
                  <p className="text-sm text-green-600 font-medium mb-6 bg-green-50 px-4 py-2 rounded-lg">
                    {selectedPlan.trial_days} jours d&apos;essai gratuit
                  </p>
                )}
                <ul className="space-y-3 mb-8">
                  {(Array.isArray(selectedPlan.features) ? selectedPlan.features : []).map((feature, idx) => (
                    <li key={idx} className="flex items-start text-gray-600">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-4">
                  <GlassButton onClick={handleCancel} variant="outline" fullWidth>
                    Annuler
                  </GlassButton>
                  <GlassButton
                    onClick={() => handleSubscribe(selectedPlan.id)}
                    variant="navy"
                    fullWidth
                    disabled={processingPlanId === selectedPlan.id}
                  >
                    {processingPlanId === selectedPlan.id ? "Chargement..." : "Payer"}
                  </GlassButton>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="mb-16">
            <PlanChooser
              plans={plans as unknown as ChooserPlan[]}
              onChoosePlan={(plan) => handleSubscribe(Number(plan.id))}
              onChooseCustom={handleSubscribeCustom}
              planCta={(plan) => Number(plan.price) === 0 ? "Choisir" : plan.trial_days > 0 ? "Essai gratuit" : "S'abonner"}
              customCtaLabel="S'abonner"
              processingKey={customProcessing ? "custom" : processingPlanId}
              currentPlanId={currentPlan?.plan_id ?? null}
              labels={pricingConfig}
              customPricing={pricingConfig.custom}
            />
          </div>
        )}

        {/* Billing History (only for normal flow) */}
        {!isNewSignup && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2 font-[family-name:var(--font-display)]">
              <Clock className="w-5 h-5 text-[var(--greek-gold)]" />
              Historique de facturation
            </h2>
            {subLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : billingHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(197,161,72,0.25)]">
                      <th className="text-left py-3 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-3 text-gray-500 font-medium">Montant</th>
                      <th className="text-left py-3 text-gray-500 font-medium">Statut</th>
                      <th className="text-right py-3 text-gray-500 font-medium">Facture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((bill) => (
                      <tr key={bill.id} className="border-b border-[rgba(197,161,72,0.25)]">
                        <td className="py-4 text-gray-800">{new Date(bill.date).toLocaleDateString()}</td>
                        <td className="py-4 text-gray-800 font-medium">{bill.amount}€</td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${bill.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {bill.status === "paid" ? "Payé" : bill.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {bill.pdf_url ? (
                            <div className="flex justify-end">
                              <GlassButton href={bill.pdf_url} variant="outline" size="sm">
                                <Download className="w-4 h-4" /> PDF
                              </GlassButton>
                            </div>
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
        )}

        {/* Parrainage (only for normal flow) */}
        {!isNewSignup && (
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Mon code */}
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
              <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1 flex items-center gap-2">
                <Gift className="w-5 h-5 text-[var(--greek-gold)]" />
                Mon code de parrainage
              </h2>
              <p className="text-sm text-gray-500 mb-4">Partagez ce code, vos filleuls ont {myReferralCode?.discount_value ?? 10}% de réduction, et vous gagnez 10% sur votre prochain renouvellement.</p>
              {myReferralCode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-[var(--greek-cream)] rounded-xl px-3 py-3 sm:px-4 sm:py-4 border border-[rgba(197,161,72,0.25)]">
                    <span className="flex-1 min-w-0 font-mono font-bold text-xl sm:text-2xl tracking-[0.15em] sm:tracking-[0.25em] text-[var(--greek-blue)] truncate">
                      {myReferralCode.code}
                    </span>
                    <GlassButton onClick={copyCode} variant="navy" size="sm" className="shrink-0">
                      {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copié !" : "Copier"}
                    </GlassButton>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span className="font-bold text-gray-800">{myReferralCode.current_uses ?? 0}</span> filleul{(myReferralCode.current_uses ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200 whitespace-nowrap">
                      {myReferralCode.discount_value}% offerts à chaque filleul
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              )}
            </div>

            {/* Filleuls */}
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
              <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--greek-gold)]" />
                Mes filleuls
              </h2>
              <p className="text-sm text-gray-500 mb-4">Personnes qui ont utilisé votre code.</p>
              {!myReferralCode ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : (myReferralCode.uses?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Personne n&apos;a encore utilisé votre code.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {myReferralCode.uses.map((u: any) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2 border-b border-[rgba(197,161,72,0.25)] last:border-0">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {u.users?.first_name || u.users?.last_name
                            ? `${u.users.first_name ?? ""} ${u.users.last_name ?? ""}`.trim()
                            : u.users?.email ?? "Utilisateur"}
                        </p>
                        {u.users?.email && (u.users.first_name || u.users.last_name) && (
                          <p className="text-xs text-gray-400">{u.users.email}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(u.used_at).toLocaleDateString("fr-FR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionClient(props: {
  authId: string | null;
  authEmail: string | null;
  initialPlans: SubscriptionPlan[];
  initialPricingConfig: PricingConfig;
  initialReferralCode: any | null;
  initialPendingDiscount: number;
  initialCurrentPlan: any | null;
  initialBillingHistory: any[];
}) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><AppLoader /></div>}>
      <SubscriptionPageContent {...props} />
    </Suspense>
  );
}
