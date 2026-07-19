"use client";

import { useState, useEffect, Suspense } from "react";
import {
  Crown,
  Check,
  CreditCard,
  Clock,
  AlertTriangle,
  Download,
  Loader2,
  Sparkles,
  Gift,
  Copy,
  CheckCheck,
  Users,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/Toast";
import AppAdminLoader from "@/components/AppAdminLoader";
import { useRouter, useSearchParams } from "next/navigation";

/* ─── Feature rows (mirroring /tarifs) ─── */
const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "max_children",           label: "Enfants" },
  { key: "access_level_exercises", label: "Niveaux scolaires" },
  { key: "ai_access",              label: "IA EpsiAI" },
  { key: "ai_daily_limit",         label: "Questions IA / jour" },
  { key: "quiz_access",            label: "Quiz & évaluations" },
  { key: "detailed_reports",       label: "Rapports hebdomadaires" },
  { key: "custom_avatars",         label: "Avatars & cosmétiques" },
  { key: "priority_support",       label: "Support prioritaire" },
];

function formatVal(key: string, val: boolean | number | string | null | undefined): { label: string; included: boolean } {
  if (val === false || val === null || val === undefined || val === 0 || val === "none") return { label: "", included: false };
  if (val === true) return { label: "Inclus", included: true };
  if (key === "max_children") return { label: Number(val) === -1 ? "Illimité" : `${val} enfant${Number(val) > 1 ? "s" : ""}`, included: true };
  if (key === "ai_daily_limit") return { label: Number(val) === -1 ? "Illimité" : `${val} / jour`, included: true };
  if (key === "ai_access") {
    if (val === "unlimited") return { label: "Illimité", included: true };
    if (val === "limited") return { label: "Limité", included: true };
    return { label: "", included: false };
  }
  if (key === "access_level_exercises") {
    if (val === "all") return { label: "CP → Terminale", included: true };
    if (val === "college") return { label: "CP → 3ème", included: true };
    if (val === "basic") return { label: "CP → 6ème", included: true };
    return { label: String(val), included: true };
  }
  return { label: String(val), included: true };
}

const intervalLabel = (i: string) => {
  switch (i) {
    case "year": return "/an";
    case "semester": return "/semestre";
    case "quarter": return "/trimestre";
    default: return "/mois";
  }
};

/* ─── Configurateur "Sur mesure" (mirroring /tarifs) ─── */
const AI_OPTIONS = [
  { id: "none",  label: "Aucune",     daily: 0,   basePrice: 0    },
  { id: "15",    label: "15/j",       daily: 15,  basePrice: 0.99 },
  { id: "30",    label: "30/j",       daily: 30,  basePrice: 1.99 },
  { id: "60",    label: "60/j",       daily: 60,  basePrice: 3.49 },
  { id: "120",   label: "120/j",      daily: 120, basePrice: 5.99 },
  { id: "unlim", label: "Illimitée",  daily: -1,  basePrice: 8.99 },
] as const;
type AIId = "none" | "15" | "30" | "60" | "120" | "unlim";

const CUSTOM_BASE_PRICE = 14.99;

function childrenCost(n: number): number {
  if (n <= 1) return 0;
  const x = n - 1;
  return Math.round((0.5 * x + 0.25 * x * x) * 100) / 100;
}

function aiMultiplier(n: number): number {
  return Math.min(1 + (n - 1) * 0.35, 4.0);
}

interface ConfigState {
  children: number;
  ai: AIId;
  reports: boolean;
  support: boolean;
  avatars: boolean;
  quiz: boolean;
}

function configPrice(c: ConfigState): number {
  let p = CUSTOM_BASE_PRICE;
  const n = Math.max(1, c.children);
  p += childrenCost(n);
  const aiBase = AI_OPTIONS.find(o => o.id === c.ai)!.basePrice;
  p += Math.round(aiBase * aiMultiplier(n) * 100) / 100;
  if (c.reports) p += 0.99;
  if (c.support) p += 1.49;
  if (c.avatars) p += 0.99;
  if (c.quiz)    p += 0.99;
  return Math.round(p * 100) / 100;
}

function configFeatures(c: ConfigState) {
  const ai = AI_OPTIONS.find(o => o.id === c.ai)!;
  const n = Math.max(1, c.children);
  return {
    max_children: n,
    access_level_exercises: "all",
    ai_access: c.ai === "none" ? "none" : c.ai === "unlim" ? "unlimited" : "limited",
    ai_daily_limit: c.ai === "none" ? 0 : ai.daily,
    detailed_reports: c.reports,
    custom_avatars: c.avatars,
    priority_support: c.support,
    quiz_access: c.quiz,
  };
}

function Toggle({ label, sub, price, value, onChange }: { label: string; sub?: string; price: number; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl"
      style={{ background: "#fff", border: `1.5px solid ${value ? "rgba(197,161,72,0.5)" : "var(--greek-border)"}` }}>
      <div className="min-w-0">
        <span className="text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>{label}</span>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
        <span className="text-xs font-semibold ml-1" style={{ color: "var(--greek-gold)" }}>+{price.toFixed(2)}€</span>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? "var(--greek-gold)" : "rgba(15,30,58,0.12)" }}>
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}

function Configurator({ onSubscribe, processing }: { onSubscribe: (cfg: ConfigState) => void; processing: boolean }) {
  const [cfg, setCfg] = useState<ConfigState>({
    children: 1, ai: "none",
    reports: false, support: false, avatars: false, quiz: false,
  });
  const n = Math.max(1, cfg.children);
  const mult = aiMultiplier(n);
  const total = configPrice(cfg);
  const aiOption = AI_OPTIONS.find(o => o.id === cfg.ai)!;
  const aiActualPrice = Math.round(aiOption.basePrice * mult * 100) / 100;
  const aiIdx = AI_OPTIONS.findIndex(o => o.id === cfg.ai);

  return (
    <div className="grid md:grid-cols-5 gap-8 items-start bg-white rounded-2xl p-7" style={{ border: "1px solid var(--greek-border)" }}>
      <div className="md:col-span-3 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nombre d&apos;enfants</p>
            {n > 1 && <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>
              +{childrenCost(n).toFixed(2)}€
            </span>}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number" min={1} max={999} value={cfg.children}
              onChange={e => setCfg(c => ({ ...c, children: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="w-28 px-4 py-2.5 rounded-xl text-sm font-bold text-center border outline-none focus:border-[var(--greek-blue)]"
              style={{ border: "1.5px solid var(--greek-border)", color: "var(--greek-blue)" }}
            />
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <div>1er enfant inclus</div>
              <div>Plus d&apos;enfants → IA plus chère</div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>IA EpsiAI</p>
            {cfg.ai !== "none" && (
              <span className="text-xs font-semibold" style={{ color: "var(--greek-gold)" }}>
                +{aiActualPrice.toFixed(2)}€
                {n > 1 && (
                  <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                    (×{mult.toFixed(2)} pour {n} enfants)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--greek-border)" }}>
              {AI_OPTIONS.map((o, i) => (
                <button key={o.id} onClick={() => setCfg(c => ({ ...c, ai: o.id }))}
                  className="flex-1 py-2.5 text-center transition-all"
                  style={{
                    background: i <= aiIdx ? "var(--greek-blue)" : "#fff",
                    color: i <= aiIdx ? (i === aiIdx ? "var(--greek-gold)" : "rgba(255,255,255,0.6)") : "var(--text-muted)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    borderRight: i < AI_OPTIONS.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {n > 1 && cfg.ai !== "none" && (
            <p className="text-xs mt-1.5" style={{ color: "rgba(197,161,72,0.8)" }}>
              ⚠ Le prix de l&apos;IA augmente avec le nombre d&apos;enfants
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <Toggle label="Rapports hebdomadaires" sub="Résumé email chaque semaine" price={0.99} value={cfg.reports} onChange={v => setCfg(c => ({ ...c, reports: v }))} />
          <Toggle label="Quiz" sub="Accès à tous les quiz et évaluations" price={0.99} value={cfg.quiz} onChange={v => setCfg(c => ({ ...c, quiz: v }))} />
          <Toggle label="Avatars &amp; cosmétiques" sub="Contours et couleurs de nom exclusifs" price={0.99} value={cfg.avatars} onChange={v => setCfg(c => ({ ...c, avatars: v }))} />
          <Toggle label="Support prioritaire" sub="Réponse garantie sous 4h en semaine" price={1.49} value={cfg.support} onChange={v => setCfg(c => ({ ...c, support: v }))} />
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="rounded-2xl p-7 sticky top-24" style={{ background: "var(--greek-blue)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(197,161,72,0.7)" }}>Votre formule</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-white">{total.toFixed(2)}€</span>
            <span className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>/mois</span>
          </div>
          <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {`Sur mesure · ${cfg.children} enfant${cfg.children > 1 ? "s" : ""}`}
          </p>
          <div className="space-y-1.5 mb-6 text-xs border-t border-white/10 pt-4">
            <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
              <span>Base personnalisée</span>
              <span>{CUSTOM_BASE_PRICE.toFixed(2)}€</span>
            </div>
            {n > 1 && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>{n} enfants</span>
                <span>+{childrenCost(n).toFixed(2)}€</span>
              </div>
            )}
            {cfg.ai !== "none" && (
              <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>IA {AI_OPTIONS.find(o => o.id === cfg.ai)!.label}</span>
                <span>+{aiActualPrice.toFixed(2)}€</span>
              </div>
            )}
          </div>
          <button onClick={() => onSubscribe(cfg)} disabled={processing}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all font-[family-name:var(--font-display)] disabled:opacity-60 hover:-translate-y-0.5"
            style={{ background: "var(--greek-gold)", color: "#fff" }}>
            {processing ? "Chargement..." : "S'abonner"}
            {!processing && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

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

function SubscriptionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewSignup = searchParams.get("new") === "true";
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const { error: toastError } = useToast();
  const [myReferralCode, setMyReferralCode] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [signupData, setSignupData] = useState<any>(null);
  const [tab, setTab] = useState<"solo" | "famille" | "custom">("solo");
  const [customProcessing, setCustomProcessing] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      // NEW SIGNUP FLOW
      if (isNewSignup) {
        try {
          const storedPlan = sessionStorage.getItem("educalcul_selected_plan");
          const storedData = sessionStorage.getItem("educalcul_signup_data");
          
          if (!storedPlan || !storedData) {
            router.push("/auth/inscription");
            return;
          }

          const planData = JSON.parse(storedPlan);
          const signupFormData = JSON.parse(storedData);
          
          setSelectedPlan(planData);
          setSignupData(signupFormData);
          setLoading(false);
          return;
        } catch (error) {
          console.error("Error loading signup data:", error);
          router.push("/auth/inscription");
          return;
        }
      }

      // NORMAL FLOW
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/connexion");
        return;
      }
      setUser(user);

      try {
        const plansRes = await fetch("/api/admin/subscriptions");
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans((plansData || []).filter((p: SubscriptionPlan) => p.is_active));
        }

        const subRes = await fetch(`/api/parent/subscription-details?userId=${user.id}`);
        const subData = await subRes.json();
        if (subData.subscription) {
          setCurrentPlan(subData.subscription);
        } else {
          setCurrentPlan({ plan_id: null, status: "active" });
        }
        if (subData.invoices) setBillingHistory(subData.invoices);

        const refRes = await fetch(`/api/parent/my-referral-code?authId=${user.id}`);
        if (refRes.ok) setMyReferralCode(await refRes.json());

        const { data: userRow } = await supabase
          .from("users")
          .select("pending_discount_percent")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (userRow?.pending_discount_percent) setPendingDiscount(userRow.pending_discount_percent);
      } catch (error) {
        console.error("Error fetching data:", error);
        setCurrentPlan({ plan_id: null, status: "active" });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [isNewSignup, router]);

  // Default tab = the family the user's current plan belongs to
  useEffect(() => {
    if (!currentPlan?.plan_id || plans.length === 0) return;
    const current = plans.find(p => String(p.id) === String(currentPlan.plan_id));
    if (current?.name?.toLowerCase().includes("famil")) setTab("famille");
    else if (current?.name?.toLowerCase().includes("solo")) setTab("solo");
  }, [currentPlan, plans]);

  // Sync subscription after Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success !== "1" || !sessionId) return;

    (async () => {
      try {
        // NEW SIGNUP FLOW
        if (isNewSignup && signupData) {
          const cleanup = () => {
            sessionStorage.removeItem("educalcul_signup_data");
            sessionStorage.removeItem("educalcul_selected_plan");
            sessionStorage.removeItem("educalcul_signup_mode");
            sessionStorage.removeItem("educalcul_pending_role");
          };

          // Plan gratuit : rien à frauder, le compte est créé directement.
          if (sessionId === "free") {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const createUserRes = await fetch("/api/auth/create-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...signupData, sessionId, existingAuthId: currentUser?.id || null }),
            });
            if (createUserRes.ok) {
              if (signupData.password && !currentUser) {
                await supabase.auth.signInWithPassword({ email: signupData.email, password: signupData.password });
              }
              cleanup();
              router.replace("/parent/dashboard");
            } else {
              console.error("Failed to create account:", await createUserRes.json().catch(() => ({})));
            }
            return;
          }

          // Paiement Stripe réel : le webhook crée le compte une fois le
          // paiement confirmé — on attend juste que ce soit fait.
          let ready = false;
          const deadline = Date.now() + 20000;
          while (Date.now() < deadline) {
            const res = await fetch(`/api/auth/signup-status?email=${encodeURIComponent(signupData.email)}`);
            const json = await res.json().catch(() => null);
            if (json?.ready) { ready = true; break; }
            await new Promise(r => setTimeout(r, 1500));
          }
          if (!ready) {
            toastError("Paiement reçu — la finalisation prend plus de temps que prévu, vérifiez vos emails dans quelques minutes.");
            return;
          }

          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser && signupData.password) {
            await supabase.auth.signInWithPassword({ email: signupData.email, password: signupData.password });
          }
          cleanup();
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

  const handleSubscribeCustom = async (cfg: ConfigState) => {
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
          // Send the raw config; the server recomputes price + features authoritatively.
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
    
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isNewSignup) {
      sessionStorage.removeItem("educalcul_signup_data");
      sessionStorage.removeItem("educalcul_selected_plan");
      sessionStorage.removeItem("educalcul_signup_mode");
      sessionStorage.removeItem("educalcul_pending_role");
      router.push("/");
    } else {
      handleManagePayment();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <Crown className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            {isNewSignup ? "CHOISIR UN PLAN" : "MON ABONNEMENT"}
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">FORMULE</span>
            <span>{isNewSignup ? "Finalisez votre inscription en choisissant un plan" : "Gérez votre formule et accédez à vos factures"}</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        {/* Current Subscription Status (only for normal flow) */}
        {!isNewSignup && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6 mb-8">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2 font-[family-name:var(--font-display)]">
              <CreditCard className="w-5 h-5 text-[var(--greek-gold)]" />
              Mon abonnement
            </h2>
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
              </div>
              {currentPlan?.stripe_customer_id && (
                <button
                  onClick={handleManagePayment}
                  className="px-5 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <CreditCard className="w-4 h-4" />
                  Gérer votre abonnement
                </button>
              )}
            </div>
          </div>
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
          // NEW SIGNUP - Show only selected plan
          selectedPlan && (
            <div className="max-w-2xl mx-auto mb-12">
              <div className="bg-white rounded-xl shadow-sm border border-[var(--greek-gold)] ring-2 ring-[var(--greek-gold)] p-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedPlan.name}</h3>
                {selectedPlan.description && <p className="text-gray-500 mb-6">{selectedPlan.description}</p>}
                <div className="text-4xl font-bold text-[var(--greek-blue)] mb-6">
                  {selectedPlan.price === 0 ? "Gratuit" : `${selectedPlan.price}€`}
                  {selectedPlan.price > 0 && <span className="text-sm text-gray-500 font-normal"> /{selectedPlan.billing_interval === "year" ? "an" : "mois"}</span>}
                </div>
                {selectedPlan.trial_days > 0 && (
                  <p className="text-sm text-green-600 font-medium mb-6 bg-green-50 px-4 py-2 rounded-lg">
                    {selectedPlan.trial_days} jours d'essai gratuit
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
                  <button
                    onClick={handleCancel}
                    className="py-3 rounded-xl font-bold text-[var(--greek-blue)] border-2 border-[var(--greek-blue)] hover:bg-blue-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleSubscribe(selectedPlan.id)}
                    disabled={processingPlanId === selectedPlan.id}
                    className="py-3 rounded-xl font-bold bg-[var(--greek-gold)] text-white hover:opacity-90 transition-colors disabled:opacity-60"
                  >
                    {processingPlanId === selectedPlan.id ? "Chargement..." : "Payer"}
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <>
          {/* Tabs Solo / Famille / Sur mesure */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {([
              { id: "solo", label: "Solo" },
              { id: "famille", label: "Famille" },
              { id: "custom", label: "Sur mesure" },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold font-[family-name:var(--font-display)] transition-all"
                style={tab === t.id
                  ? { background: "var(--greek-blue)", color: "#fff" }
                  : { background: "#fff", color: "var(--greek-blue)", border: "1px solid var(--greek-border)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "custom" ? (
            <div className="mb-12">
              <Configurator onSubscribe={handleSubscribeCustom} processing={customProcessing} />
            </div>
          ) : (
          // NORMAL FLOW - Show all intervals for the selected tab, current plan first
          <div className={`grid gap-8 mb-12 ${plans.length <= 2 ? "md:grid-cols-2" : plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
            {plans
              .filter(p => p.name.toLowerCase().includes(tab === "solo" ? "solo" : "famil"))
              .sort((a, b) => {
                const order = ["month", "quarter", "semester", "year"];
                const aCurrent = String(currentPlan?.plan_id) === String(a.id) ? 0 : 1;
                const bCurrent = String(currentPlan?.plan_id) === String(b.id) ? 0 : 1;
                if (aCurrent !== bCurrent) return aCurrent - bCurrent;
                return order.indexOf(a.billing_interval) - order.indexOf(b.billing_interval);
              })
              .map((plan) => {
              const isCurrent = String(currentPlan?.plan_id) === String(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col bg-white rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                    isCurrent ? "ring-2 ring-[var(--greek-gold)]" : ""
                  }`}
                  style={{
                    border: isCurrent ? "2px solid var(--greek-gold)" : "1px solid var(--greek-border)",
                    boxShadow: isCurrent ? "0 8px 40px rgba(197,161,72,0.18)" : "0 2px 12px rgba(15,30,58,0.05)",
                  }}
                >
                  {isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--greek-gold)] text-black shadow-md flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 fill-current" /> Abonnement actuel
                      </div>
                    </div>
                  )}

                  <div className="px-7 pt-8 pb-5 text-center border-b border-[var(--greek-border)]">
                    {plan.promo_description && (
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-[var(--greek-gold)] mb-3">
                        <Sparkles className="w-3 h-3" />{plan.promo_description}
                      </div>
                    )}
                    {plan.trial_days > 0 && (
                      <div className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200 mb-3">
                        {plan.trial_days} jours d'essai gratuit
                      </div>
                    )}
                    <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-1">{plan.name}</h3>
                    {plan.description && <p className="text-sm text-[var(--text-muted)]">{plan.description}</p>}
                  </div>

                  <div className="px-7 py-6 text-center border-b border-[var(--greek-border)]">
                    <div className="flex items-end justify-center gap-1">
                      <span className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--greek-blue)]">
                        {Number(plan.price) === 0 ? "Gratuit" : `${plan.price}€`}
                      </span>
                      {Number(plan.price) > 0 && (
                        <span className="text-sm text-[var(--text-muted)] mb-1.5">{intervalLabel(plan.billing_interval)}</span>
                      )}
                    </div>
                  </div>

                  <div className="px-7 py-6 flex-grow flex flex-col">
                    <ul className="space-y-2.5 mb-6">
                      {FEATURE_ROWS.map(row => {
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
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={isCurrent}
                      className="w-full mt-auto py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all font-[family-name:var(--font-display)] disabled:opacity-100"
                      style={isCurrent
                        ? { background: "rgba(197,161,72,0.10)", color: "var(--greek-gold)", cursor: "default" }
                        : { background: "var(--greek-blue)", color: "white" }
                      }
                    >
                      {isCurrent ? "Abonnement actuel" : processingPlanId === plan.id ? "Chargement..." : (
                        <>{plan.trial_days > 0 ? "Essai gratuit" : "S'abonner"} <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {plans.filter(p => p.name.toLowerCase().includes(tab === "solo" ? "solo" : "famil")).length === 0 && !loading && (
              <div className="col-span-full text-center py-12 text-gray-400">
                Aucun plan disponible pour le moment.
              </div>
            )}
          </div>
          )}
          </>
        )}

        {/* Billing History (only for normal flow) */}
        {!isNewSignup && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2 font-[family-name:var(--font-display)]">
              <Clock className="w-5 h-5 text-[var(--greek-gold)]" />
              Historique de facturation
            </h2>
            {billingHistory.length > 0 ? (
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
                            <a href={bill.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[var(--greek-blue)] hover:underline flex items-center justify-end">
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
              <p className="text-sm text-gray-500 mb-4">Partagez ce code — vos filleuls ont {myReferralCode?.discount_value ?? 10}% de réduction, et vous gagnez 10% sur votre prochain renouvellement.</p>
              {myReferralCode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-[var(--greek-cream)] rounded-xl px-3 py-3 sm:px-4 sm:py-4 border border-[rgba(197,161,72,0.25)]">
                    <span className="flex-1 min-w-0 font-mono font-bold text-xl sm:text-2xl tracking-[0.15em] sm:tracking-[0.25em] text-[var(--greek-blue)] truncate">
                      {myReferralCode.code}
                    </span>
                    <button onClick={copyCode} className="flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-2 rounded-lg bg-[var(--greek-blue)] text-white hover:opacity-90 transition shrink-0">
                      {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copié !" : "Copier"}
                    </button>
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
                  <p className="text-sm">Personne n'a encore utilisé votre code.</p>
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

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-[var(--greek-blue)]" /></div>}>
      <SubscriptionPageContent />
    </Suspense>
  );
}


