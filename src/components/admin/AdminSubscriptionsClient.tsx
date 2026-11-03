"use client";

import GlassCheckbox from "@/components/ui/GlassCheckbox";
import type { Loose } from "@/types/loose";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { useState, useRef } from "react";
import { BORDER_STYLES, NAME_COLORS } from "@/lib/badgeStyles";
import { normalizeDifficulty } from "@/lib/difficultyLevels";
import {
  CreditCard, Plus, Edit, Trash2, CheckCircle, AlertTriangle,
  Clock, X, Power, Users, Tag, Gift,
  TrendingUp, Copy, Check, GripVertical,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import PlanChooser, { type ChooserPlan } from "@/components/PlanChooser";
import { type PricingConfig } from "@/lib/pricingConfig";
import { ONE_TIME, defaultPeriodLabel, isValidPeriodId, monthsOfPeriod, periodIdForMonths, periodSuffix, MAX_PERIOD_MONTHS, type BillingPeriod } from "@/lib/billingPeriods";

// ── Types ──────────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: string;
  trial_days: number | null;
  promo_description: string | null;
  features: Loose;
  is_active: boolean;
  sort_order: number;
  subscriber_count: number;
  subscribers?: Array<{ user_id: string; status: string; current_period_end: string; user?: { first_name: string; last_name: string; email: string } }>;
  created_at: string;
}

interface ReferralCode {
  id: string;
  code: string;
  owner?: { first_name: string; last_name: string; email: string } | null;
  discount_type: "percent" | "fixed" | "free_months";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  description: string | null;
  referral_uses: Loose[];
  created_at: string;
}

// ── Default form values ────────────────────────────────────────────────────
const CUSTOM_PERIOD = "__custom";
const defaultPlanForm = {
  name: "", description: "", price: 0, billing_interval: "month", custom_months: "2", custom_label: "",
  trial_days: "", promo_description: "", is_active: true, sort_order: 0,
  feature_max_children: 1, feature_access_level_exercises: "difficile",
  feature_detailed_reports: false, feature_priority_support: false,
  feature_custom_avatars: false, feature_calia_classe: false,
  feature_ai_access: "limited" as "none" | "limited" | "unlimited",
  feature_ai_daily_limit: 10,
  feature_minigames_daily_limit: 3,
  feature_minigames_premium_content: false,
  cosmetic_borders: [] as string[],
  cosmetic_colors: [] as string[],
};

const defaultRefForm = {
  code: "", description: "", discount_type: "percent", discount_value: 10,
  max_uses: "", valid_from: "", valid_until: "", is_active: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────
function intervalLabel(i: string) {
  return i === ONE_TIME ? "unique" : periodSuffix(i).replace("/", "/ ");
}

/** Les plans dans l'ordre d'affichage : ordre enregistré, puis identifiant (jamais d'égalité, donc jamais d'ordre « au hasard »). */
const sortPlans = <T extends { sort_order: number; id: string | number }>(list: T[]) =>
  [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || Number(a.id) - Number(b.id));
function discountLabel(type: string, value: number) {
  if (type === "percent") return `−${value}%`;
  if (type === "fixed") return `−${value}€`;
  return `${value} mois offerts`;
}

/** Abonnements / codes promo / parrainage : plans, codes, et config tarifaire
 * arrivent déjà chargés du serveur ; tout le CRUD (plans, codes, glisser-
 * déposer, aperçu tarifaire) reste des allers-retours client, comme avant. */
export default function AdminSubscriptionsClient({
  initialPlans,
  initialCodes,
  initialPricingConfig,
}: {
  initialPlans: Plan[];
  initialCodes: ReferralCode[];
  initialPricingConfig: PricingConfig;
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"plans" | "promos" | "parrainage">("plans");
  // Config d'affichage des tarifs (libellés + forfait sur-mesure) — éditée via l'aperçu.
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(initialPricingConfig);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<Loose>(defaultPlanForm);

  // Referrals state
  const [codes, setCodes] = useState<ReferralCode[]>(initialCodes);
  const [showRefModal, setShowRefModal] = useState(false);
  const [editingCode, setEditingCode] = useState<ReferralCode | null>(null);
  const [refForm, setRefForm] = useState<Loose>(defaultRefForm);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Drag-and-drop
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Shared
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Fetches ──────────────────────────────────────────────────────────────
  const fetchPlans = async () => {
    const res = await fetch("/api/admin/subscriptions");
    if (res.ok) setPlans(await res.json());
  };

  const fetchCodes = async () => {
    const res = await fetch("/api/admin/referral-codes");
    if (res.ok) setCodes(await res.json());
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Plan CRUD ─────────────────────────────────────────────────────────────
  const openPlanModal = (plan: Plan | null = null) => {
    setEditingPlan(plan);
    if (plan) {
      const f = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
      setPlanForm({
        name: plan.name, description: plan.description || "",
        price: plan.price, billing_interval: plan.billing_interval, custom_months: "2", custom_label: "",
        trial_days: plan.trial_days?.toString() || "",
        promo_description: plan.promo_description || "",
        is_active: plan.is_active, sort_order: plan.sort_order ?? 0,
        feature_max_children: f.max_children || 1,
        feature_access_level_exercises: normalizeDifficulty(f.access_level_exercises),
        feature_detailed_reports: !!f.detailed_reports,
        feature_priority_support: !!f.priority_support,
        feature_custom_avatars: !!f.custom_avatars,
        feature_calia_classe: !!f.calia_classe,
        feature_ai_access: (f.ai_access || "limited") as "none" | "limited" | "unlimited",
        feature_ai_daily_limit: f.ai_daily_limit ?? 10,
        feature_minigames_daily_limit: f.minigames_daily_limit ?? 3,
        feature_minigames_premium_content: !!f.minigames_premium_content,
        cosmetic_borders: (f.cosmetic_borders as string[]) ?? [],
        cosmetic_colors: (f.cosmetic_colors as string[]) ?? [],
      });
    } else {
      setPlanForm(defaultPlanForm);
    }
    setShowPlanModal(true);
  };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    // Période : une durée libre devient une période proposée aux clients (enregistrée avec la config tarifaire).
    let billingInterval: string = planForm.billing_interval;
    if (billingInterval === CUSTOM_PERIOD) {
      const m = Math.round(Number(planForm.custom_months));
      if (!Number.isFinite(m) || m < 1 || m > MAX_PERIOD_MONTHS) { showToast("error", `Durée libre : entre 1 et ${MAX_PERIOD_MONTHS} mois.`); return; }
      billingInterval = periodIdForMonths(m);
      if (!pricingConfig.periods.some((p) => p.id === billingInterval)) {
        const periods = [...pricingConfig.periods, { id: billingInterval, label: planForm.custom_label?.trim() || defaultPeriodLabel(billingInterval), months: monthsOfPeriod(billingInterval)! }].sort((a, b) => a.months - b.months);
        const res = await fetch("/api/admin/pricing-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pricingConfig, periods }) });
        const data = await res.json();
        if (!res.ok) { showToast("error", data.error || "Impossible d'ajouter la période."); return; }
        setPricingConfig(data);
      }
    }

    const previousFeatures = editingPlan ? (typeof editingPlan.features === "string" ? JSON.parse(editingPlan.features) : editingPlan.features || {}) : {};
    const features = {
      ...previousFeatures,
      max_children: Number(planForm.feature_max_children),
      access_level_exercises: planForm.feature_access_level_exercises,
      detailed_reports: planForm.feature_detailed_reports,
      priority_support: planForm.feature_priority_support,
      custom_avatars: planForm.feature_custom_avatars,
      calia_classe: planForm.feature_calia_classe,
      ai_access: planForm.feature_ai_access,
      ai_daily_limit: planForm.feature_ai_access === "unlimited" ? -1 : Number(planForm.feature_ai_daily_limit),
      minigames_daily_limit: Number(planForm.feature_minigames_daily_limit),
      minigames_premium_content: planForm.feature_minigames_premium_content,
      cosmetic_borders: planForm.cosmetic_borders,
      cosmetic_colors: planForm.cosmetic_colors,
    };
    const payload = {
      name: planForm.name, description: planForm.description,
      price: Number(planForm.price), billing_interval: billingInterval,
      trial_days: planForm.trial_days ? Number(planForm.trial_days) : 0,
      promo_description: planForm.promo_description || null,
      is_active: planForm.is_active, sort_order: Number(planForm.sort_order),
      features,
    };
    const method = editingPlan ? "PUT" : "POST";
    const body = editingPlan ? JSON.stringify({ ...payload, id: editingPlan.id }) : JSON.stringify(payload);
    const res = await fetch("/api/admin/subscriptions", { method, headers: { "Content-Type": "application/json" }, body });
    const result = await res.json();
    if (!res.ok) { showToast("error", result.error || "Erreur"); return; }
    if (result.stripe_sync && result.stripe_sync.ok === false) {
      showToast("error", "Plan enregistré, mais Stripe n'a pas pu être mis à jour : réenregistre le plan pour réessayer.");
    } else {
      showToast("success", editingPlan ? "Plan modifié, Stripe mis à jour" : "Plan créé, Stripe mis à jour");
    }
    setShowPlanModal(false);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    if (!(await confirm("Supprimer ce plan ?"))) return;
    const res = await fetch(`/api/admin/subscriptions?id=${id}`, { method: "DELETE" });
    const result = await res.json();
    if (!res.ok) { showToast("error", result.error); return; }
    showToast("success", "Plan supprimé");
    fetchPlans();
  };

  // ── Drag-and-drop reorder ──────────────────────────────────────────────────
  /** Enregistre un nouvel ordre COMPLET : chaque plan reçoit 10, 20, 30… (plus d'égalité possible), en une seule requête. */
  const persistOrder = async (ordered: Plan[]) => {
    const renumbered = ordered.map((p, i) => ({ ...p, sort_order: (i + 1) * 10 }));
    const changes = renumbered.filter(p => plans.find(q => q.id === p.id)?.sort_order !== p.sort_order);
    setPlans(renumbered);
    if (changes.length === 0) return;
    const res = await fetch("/api/admin/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: changes.map(p => ({ id: p.id, sort_order: p.sort_order })) }),
    });
    if (res.ok) showToast("success", "Ordre enregistré");
    else { showToast("error", "L'ordre n'a pas pu être enregistré."); fetchPlans(); }
  };

  const handleDrop = async (targetId: string) => {
    const fromId = dragId.current;
    setDragOver(null);
    if (!fromId || fromId === targetId) return;
    const ordered = sortPlans(plans);
    const from = ordered.findIndex(p => p.id === fromId);
    const to = ordered.findIndex(p => p.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await persistOrder(next);
  };

  const togglePlan = async (plan: Plan) => {
    const res = await fetch("/api/admin/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plan.id, is_active: !plan.is_active }),
    });
    if (res.ok) fetchPlans();
  };

  // ── Aperçu interactif : config sur-mesure + glisser les fiches ─────────────
  /** Réordonne les fiches payantes d'une période : elles gardent les places qu'elles occupaient dans l'ordre général, entre elles dans le nouvel ordre. */
  const previewReorder = async (orderedIds: (string | number)[]) => {
    const all = sortPlans(plans);
    const members = new Set(orderedIds.map(String));
    const slots = all.map((p, i) => (members.has(String(p.id)) ? i : -1)).filter(i => i >= 0);
    const byId = new Map(all.map(p => [String(p.id), p]));
    const next = [...all];
    orderedIds.forEach((id, k) => { const p = byId.get(String(id)); if (p && slots[k] !== undefined) next[slots[k]] = p; });
    await persistOrder(next);
  };

  const previewMoveInterval = async (id: string | number, interval: string) => {
    const plan = plans.find(p => String(p.id) === String(id));
    if (!plan || plan.billing_interval === interval) return;
    setPlans(plans.map(p => p.id === plan.id ? { ...p, billing_interval: interval } : p));
    const res = await fetch("/api/admin/subscriptions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plan.id, billing_interval: interval }) });
    if (res.ok) showToast("success", "Période mise à jour");
    else { showToast("error", "La période n'a pas pu être changée."); fetchPlans(); }
  };

  /** « Populaire » : en présentation par période, une seule fiche par période (marquer l'une retire l'étiquette des autres) ;
   * en présentation par formule, chaque durée se marque librement (ex. le « 3 mois » de Solo ET de Family). */
  const previewTogglePopular = async (id: string | number) => {
    const plan = plans.find(p => String(p.id) === String(id));
    if (!plan) return;
    const featuresOf = (p: Plan) => (typeof p.features === "string" ? JSON.parse(p.features) : p.features || {});
    const turnOn = featuresOf(plan).popular !== true;
    const exclusive = pricingConfig.layout !== "byPlan";
    const touched = plans.filter(p => p.id === plan.id || (exclusive && turnOn && p.billing_interval === plan.billing_interval && Number(p.price) > 0 && featuresOf(p).popular === true));
    setPlans(plans.map(p => touched.some(t => t.id === p.id) ? { ...p, features: { ...featuresOf(p), popular: p.id === plan.id ? turnOn : false } } : p));
    const results = await Promise.all(touched.map(p =>
      fetch("/api/admin/subscriptions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, features: { ...featuresOf(p), popular: p.id === plan.id ? turnOn : false } }) }),
    ));
    if (results.every(r => r.ok)) showToast("success", turnOn ? "Fiche mise en avant" : "Étiquette retirée");
    else { showToast("error", "L'étiquette n'a pas pu être modifiée."); fetchPlans(); }
  };

  /** Masque / affiche une formule aux clients (sans la supprimer) : même effet que le bouton « Activer / Désactiver » de la liste. */
  const previewToggleVisible = async (id: string | number) => {
    const plan = plans.find(p => String(p.id) === String(id));
    if (!plan) return;
    const next = !plan.is_active;
    setPlans(plans.map(p => p.id === plan.id ? { ...p, is_active: next } : p));
    const res = await fetch("/api/admin/subscriptions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plan.id, is_active: next }) });
    if (res.ok) showToast("success", next ? "Formule affichée aux clients" : "Formule masquée aux clients");
    else { showToast("error", "La visibilité n'a pas pu être modifiée."); fetchPlans(); }
  };

  const changeVisibility = (visibility: PricingConfig["visibility"]) => {
    setPricingConfig(pc => ({ ...pc, visibility }));
    setPricingDirty(true);
  };

  const changeLayout = (layout: PricingConfig["layout"]) => {
    setPricingConfig(pc => ({ ...pc, layout }));
    setPricingDirty(true);
  };

  const changePopularAuto = (popularAuto: boolean) => {
    setPricingConfig(pc => ({ ...pc, popularAuto }));
    setPricingDirty(true);
  };

  const changeTabLabels = (tabs: PricingConfig["tabs"]) => {
    setPricingConfig(pc => ({ ...pc, tabs }));
    setPricingDirty(true);
  };

  const changePeriods = (periods: BillingPeriod[]) => {
    setPricingConfig(pc => ({
      ...pc,
      periods,
      intervals: {
        month: periods.find(p => p.id === "month")?.label ?? pc.intervals.month,
        quarter: periods.find(p => p.id === "quarter")?.label ?? pc.intervals.quarter,
        semester: periods.find(p => p.id === "semester")?.label ?? pc.intervals.semester,
        year: periods.find(p => p.id === "year")?.label ?? pc.intervals.year,
      },
    }));
    setPricingDirty(true);
  };

  const savePricing = async () => {
    setPricingSaving(true);
    try {
      const res = await fetch("/api/admin/pricing-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricingConfig) });
      const data = await res.json();
      if (res.ok) { setPricingConfig(data); setPricingDirty(false); showToast("success", "Tarifs enregistrés"); }
      else showToast("error", data.error || "Échec de l'enregistrement");
    } catch { showToast("error", "Une erreur est survenue"); }
    finally { setPricingSaving(false); }
  };

  // ── Referral CRUD ─────────────────────────────────────────────────────────
  const openRefModal = (code: ReferralCode | null = null) => {
    setEditingCode(code);
    if (code) {
      setRefForm({
        code: code.code, description: code.description || "",
        discount_type: code.discount_type, discount_value: code.discount_value,
        max_uses: code.max_uses?.toString() || "", is_active: code.is_active,
        valid_from: code.valid_from ? code.valid_from.slice(0, 10) : "",
        valid_until: code.valid_until ? code.valid_until.slice(0, 10) : "",
      });
    } else {
      setRefForm(defaultRefForm);
    }
    setShowRefModal(true);
  };

  const saveRef = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: refForm.code?.toUpperCase() || undefined,
      description: refForm.description,
      discount_type: refForm.discount_type,
      discount_value: Number(refForm.discount_value),
      max_uses: refForm.max_uses ? Number(refForm.max_uses) : null,
      valid_from: refForm.valid_from || new Date().toISOString(),
      valid_until: refForm.valid_until || null,
      is_active: refForm.is_active,
    };
    const method = editingCode ? "PUT" : "POST";
    const body = editingCode ? JSON.stringify({ ...payload, id: editingCode.id }) : JSON.stringify(payload);
    const res = await fetch("/api/admin/referral-codes", { method, headers: { "Content-Type": "application/json" }, body });
    const result = await res.json();
    if (!res.ok) { showToast("error", result.error || "Erreur"); return; }
    showToast("success", editingCode ? "Code modifié" : "Code créé");
    setShowRefModal(false);
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    if (!(await confirm("Supprimer ce code de parrainage ?"))) return;
    const res = await fetch(`/api/admin/referral-codes?id=${id}`, { method: "DELETE" });
    if (res.ok) { showToast("success", "Code supprimé"); fetchCodes(); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalSubscribers = plans.reduce((a, p) => a + (p.subscriber_count || 0), 0);
  const activePlans = plans.filter((p) => p.is_active).length;
  const promoCodes = codes.filter((c) => !c.owner);
  const parainageCodes = codes.filter((c) => !!c.owner);
  const totalCodeUses = codes.reduce((a, c) => a + c.current_uses, 0);

  // ── Input helper ──────────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
  const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <AdminPageHeader
          icon={CreditCard}
          title="Abonnements & Parrainage"
          subtitle="Gérez les plans, les tarifs et les codes de parrainage"
          actions={
            <GlassButton
              size="sm"
              variant="navy"
              className={tab === "parrainage" ? "invisible" : ""}
              onClick={() => tab === "plans" ? openPlanModal() : tab === "promos" ? openRefModal() : undefined}
            >
              <Plus size={18} />
              {tab === "plans" ? "Nouveau plan" : "Nouveau code promo"}
            </GlassButton>
          }
        />
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Plans actifs",       value: activePlans,       icon: CreditCard,  color: "text-blue-600",  bg: "bg-blue-50" },
          { label: "Abonnés actifs",     value: totalSubscribers,  icon: Users,       color: "text-green-600", bg: "bg-green-50" },
          { label: "Codes promo",          value: promoCodes.length, icon: Tag,         color: "text-purple-600",bg: "bg-purple-50" },
          { label: "Utilisations codes", value: totalCodeUses,     icon: TrendingUp,  color: "text-amber-600", bg: "bg-amber-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <GlassSegmentedControl
        className="w-fit mb-6"
        options={[
          { id: "plans", label: "Plans d'abonnement" },
          { id: "promos", label: "Codes promo" },
          { id: "parrainage", label: "Parrainage" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* ════════════════ PLANS TAB ════════════════ */}
      {tab === "plans" && (
        <>
          {plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun plan créé</p>
            </div>
          ) : (
            <>
            <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5" /> Glissez les cartes pour réorganiser l&apos;ordre d&apos;affichage sur le site.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortPlans(plans).map((plan) => {
                const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || {};
                const featureList = [
                  `${features.max_children || 1} enfant(s)`,
                  features.detailed_reports && "Rapports détaillés",
                  features.priority_support && "Support prioritaire",
                  features.custom_avatars && "Avatars personnalisés",
                ].filter(Boolean) as string[];

                return (
                  <div
                    key={plan.id}
                    draggable
                    onDragStart={() => { dragId.current = plan.id; }}
                    onDragEnd={() => { dragId.current = null; setDragOver(null); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(plan.id); }}
                    onDrop={() => handleDrop(plan.id)}
                    className={`bg-white rounded-2xl border-2 shadow-sm transition-all hover:shadow-md flex flex-col select-none ${plan.is_active ? "border-[rgba(197,161,72,0.25)]" : "border-dashed border-[rgba(197,161,72,0.25)] opacity-70"} ${dragOver === plan.id ? "ring-2 ring-[var(--greek-gold)] ring-offset-2 scale-[1.02]" : ""}`}
                    style={{ transition: "transform 0.15s, box-shadow 0.15s" }}
                  >
                    {/* Card header */}
                    <div className="px-6 pt-5 pb-4 border-b border-[rgba(197,161,72,0.25)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                          <div>
                            <h3 className="font-bold text-lg text-[var(--greek-blue)]">{plan.name}</h3>
                            {plan.promo_description && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">{plan.promo_description}</span>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 text-xs font-bold rounded-full ${plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {plan.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-800">{plan.price}€</span>
                        <span className="text-gray-400 text-sm">{intervalLabel(plan.billing_interval)}</span>
                      </div>
                      {plan.trial_days ? (
                        <div className="flex items-center gap-1 mt-1 text-xs text-green-600 font-medium">
                          <Clock size={12} /> {plan.trial_days} jours d&apos;essai
                        </div>
                      ) : null}
                    </div>

                    {/* Features */}
                    <div className="px-6 py-4 flex-1">
                      <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                      <ul className="space-y-1.5 mb-3">
                        {featureList.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle size={14} className="text-green-500 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                      {/* AI & Personalization restrictions */}
                      <div className="border-t border-[rgba(197,161,72,0.25)] pt-3 space-y-1.5">
                        {/* AI */}
                        <div className="flex items-center gap-2 text-xs">
                          {features.ai_access === "none" ? (
                            <span className="flex items-center gap-1 text-red-400"><X size={12} /> IA : non incluse</span>
                          ) : features.ai_access === "limited" ? (
                            <span className="flex items-center gap-1 text-orange-500"><CheckCircle size={12} /> IA : {features.ai_daily_limit} messages/jour</span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> IA : illimitée</span>
                          )}
                        </div>
                        {/* Subscription borders */}
                        {(() => {
                          const subUnlocks = { "1": [], "2": ["Premium"], "3": ["Famille"], "4": ["Pro","Elite"] } as Record<string, string[]>;
                          const borders = subUnlocks[plan.id?.toString()] || [];
                          const colorMap = { "1": [], "2": ["Violet"], "3": ["Turquoise"], "4": ["Flamme","Elite"] } as Record<string, string[]>;
                          const colors = colorMap[plan.id?.toString()] || [];
                          return (
                            <>
                              <div className="flex items-center gap-2 text-xs">
                                {borders.length > 0
                                  ? <span className="flex items-center gap-1 text-purple-600"><CheckCircle size={12} /> Contours : {borders.join(", ")}</span>
                                  : <span className="flex items-center gap-1 text-gray-400"><X size={12} /> Contours abonnement : aucun</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {colors.length > 0
                                  ? <span className="flex items-center gap-1 text-indigo-600"><CheckCircle size={12} /> Couleurs nom : {colors.join(", ")}</span>
                                  : <span className="flex items-center gap-1 text-gray-400"><X size={12} /> Couleurs nom abonnement : aucune</span>}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Subscriber list — collapsible */}
                    {plan.subscriber_count > 0 && expandedPlan === plan.id && (
                      <div className="px-6 pb-3">
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {plan.subscribers?.map((s) => {
                            const u = s.user;
                            const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || "Utilisateur";
                            return (
                              <div key={s.user_id} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg text-xs">
                                <div className="w-6 h-6 rounded-lg bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold flex items-center justify-center shrink-0 text-[10px]">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-700 truncate">{name}</p>
                                  {u?.email && name !== u.email && <p className="text-gray-400 truncate">{u.email}</p>}
                                </div>
                                {s.current_period_end && (
                                  <span className="text-gray-300 shrink-0">
                                    {new Date(s.current_period_end).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="px-6 pb-5 flex items-center justify-between border-t border-[rgba(197,161,72,0.25)] pt-4">
                      <button
                        onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${plan.subscriber_count > 0 ? "text-[var(--greek-blue)] hover:text-blue-800 cursor-pointer" : "text-gray-400 cursor-default"}`}
                      >
                        <Users size={14} />
                        <span className="font-semibold">{plan.subscriber_count}</span> abonné(s)
                        {plan.subscriber_count > 0 && (
                          <span className="text-xs opacity-60">{expandedPlan === plan.id ? "▲" : "▼"}</span>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        <GlassIconButton
                          icon={Power}
                          color={plan.is_active ? "orange" : "green"}
                          size="sm"
                          onClick={() => togglePlan(plan)}
                          aria-label={plan.is_active ? "Désactiver" : "Activer"}
                        />
                        <GlassIconButton icon={Edit} color="navy" size="sm" onClick={() => openPlanModal(plan)} aria-label="Modifier le plan" />
                        <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => deletePlan(plan.id)} aria-label="Supprimer le plan" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}

          {/* ── Vrai aperçu interactif (ce que voient les clients) ── */}
          <div className="mt-14 pt-10 border-t border-[rgba(197,161,72,0.25)]">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Aperçu client (interactif)</h2>
              <p className="text-sm text-gray-500 mt-1">Vue exacte du site. Glissez les fiches pour les réordonner ou changer leur période, et cliquez les valeurs du sur-mesure pour les modifier.</p>
            </div>
            <div className="bg-[var(--greek-cream)] rounded-2xl border border-[rgba(197,161,72,0.25)] p-6">
              <PlanChooser
                plans={sortPlans(plans) as unknown as ChooserPlan[]}
                onChoosePlan={() => {}}
                onChooseCustom={() => {}}
                planCta={() => "Choisir"}
                customCtaLabel="S'abonner"
                labels={pricingConfig}
                admin={{
                  onReorder: previewReorder,
                  onMoveInterval: previewMoveInterval,
                  onTogglePopular: previewTogglePopular,
                  onToggleVisible: previewToggleVisible,
                  onVisibilityChange: changeVisibility,
                  onTabLabelsChange: changeTabLabels,
                  onLayoutChange: changeLayout,
                  onPopularAutoChange: changePopularAuto,
                  onPeriodsChange: changePeriods,
                  pricing: pricingConfig.custom,
                  onPricingChange: (custom) => { setPricingConfig(pc => ({ ...pc, custom })); setPricingDirty(true); },
                  dirty: pricingDirty,
                  saving: pricingSaving,
                  onSave: savePricing,
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ════════════════ CODES PROMO TAB ════════════════ */}
      {tab === "promos" && (
        <>
          {promoCodes.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Tag size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun code promo</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
                  <tr>
                    {["Code", "Remise", "Utilisation", "Validité", "Statut", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {promoCodes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--greek-blue)] bg-blue-50 px-2.5 py-1 rounded-lg text-sm tracking-wider">{c.code}</span>
                          <GlassIconButton
                            icon={copiedCode === c.code ? Check : Copy}
                            color={copiedCode === c.code ? "green" : "navy"}
                            size="sm"
                            onClick={() => copyCode(c.code)}
                            aria-label="Copier le code"
                          />
                        </div>
                        {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold rounded-full text-xs">
                          {discountLabel(c.discount_type, c.discount_value)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-gray-700">
                          {c.current_uses} {c.max_uses ? `/ ${c.max_uses}` : ""}
                        </div>
                        {c.max_uses && (
                          <div className="mt-1 w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--greek-blue)] rounded-full" style={{ width: `${Math.min(100, (c.current_uses / c.max_uses) * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {c.valid_until ? (
                          <span className={new Date(c.valid_until) < new Date() ? "text-red-500 font-medium" : ""}>
                            jusqu&apos;au {new Date(c.valid_until).toLocaleDateString("fr-FR")}
                          </span>
                        ) : <span className="text-green-600">Sans limite</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.is_active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <GlassIconButton icon={Edit} color="navy" size="sm" onClick={() => openRefModal(c)} aria-label="Modifier le code" />
                          <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => deleteCode(c.id)} aria-label="Supprimer le code" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ════════════════ PARRAINAGE TAB ════════════════ */}
      {tab === "parrainage" && (
        <>
          {parainageCodes.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Gift size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun utilisateur n&apos;a encore de code de parrainage</p>
              <p className="text-sm mt-1">Les codes sont générés automatiquement à la première visite de la page abonnement</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] flex items-center justify-between">
                <p className="text-sm text-gray-500">{parainageCodes.length} utilisateur(s) avec un code actif</p>
                <p className="text-sm text-gray-500">Total utilisations : <span className="font-bold text-gray-700">{parainageCodes.reduce((a, c) => a + c.current_uses, 0)}</span></p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
                  <tr>
                    {["Utilisateur", "Code", "Remise offerte", "Utilisations", "Statut", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parainageCodes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800">{c.owner?.first_name} {c.owner?.last_name}</div>
                        <div className="text-xs text-gray-400">{c.owner?.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--greek-blue)] bg-blue-50 px-2.5 py-1 rounded-lg text-sm tracking-wider">{c.code}</span>
                          <GlassIconButton
                            icon={copiedCode === c.code ? Check : Copy}
                            color={copiedCode === c.code ? "green" : "navy"}
                            size="sm"
                            onClick={() => copyCode(c.code)}
                            aria-label="Copier le code"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold rounded-full text-xs">
                          {discountLabel(c.discount_type, c.discount_value)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-gray-800">{c.current_uses}</span>
                          {c.referral_uses?.length > 0 && (
                            <span className="text-xs text-gray-400">filleul(s)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.is_active ? "Actif" : "Suspendu"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <GlassIconButton icon={Edit} color="navy" size="sm" onClick={() => openRefModal(c)} aria-label="Modifier la remise" />
                          <GlassIconButton
                            icon={Power}
                            color={c.is_active ? "orange" : "green"}
                            size="sm"
                            onClick={async () => {
                              await fetch("/api/admin/referral-codes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, is_active: !c.is_active }) });
                              fetchCodes();
                            }}
                            aria-label={c.is_active ? "Suspendre" : "Réactiver"}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ════════ PLAN MODAL ════════ */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                {editingPlan ? "Modifier le plan" : "Nouveau plan"}
              </h2>
              <GlassCloseButton onClick={() => setShowPlanModal(false)} variant="light" />
            </div>
            <form onSubmit={savePlan} className="p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className={labelCls}>Nom du plan *</label>
                  <input type="text" required value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} className={inputCls} placeholder="ex: Premium Mensuel" />
                </div>
                <div>
                  <label className={labelCls}>Prix (€) *</label>
                  <input type="number" step="0.01" min="0" required value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Facturation *</label>
                  <select value={planForm.billing_interval} onChange={e => setPlanForm({...planForm, billing_interval: e.target.value})} className={inputCls}>
                    {pricingConfig.periods.map(p => <option key={p.id} value={p.id}>{p.label} ({p.months === 1 ? "tous les mois" : p.months % 12 === 0 ? (p.months === 12 ? "tous les ans" : `tous les ${p.months / 12} ans`) : `tous les ${p.months} mois`})</option>)}
                    {isValidPeriodId(planForm.billing_interval) && !pricingConfig.periods.some(p => p.id === planForm.billing_interval) && (
                      <option value={planForm.billing_interval}>{defaultPeriodLabel(planForm.billing_interval)} (période masquée)</option>
                    )}
                    <option value={ONE_TIME}>Paiement unique</option>
                    <option value={CUSTOM_PERIOD}>Autre durée…</option>
                  </select>
                  {planForm.billing_interval === CUSTOM_PERIOD && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input type="number" min="1" max={MAX_PERIOD_MONTHS} value={planForm.custom_months} onChange={e => setPlanForm({...planForm, custom_months: e.target.value})} className={inputCls} placeholder="Mois" aria-label="Durée en mois" />
                      <input type="text" maxLength={40} value={planForm.custom_label} onChange={e => setPlanForm({...planForm, custom_label: e.target.value})} className={inputCls} placeholder="Nom (ex. Bimestriel)" aria-label="Nom de la période" />
                      <p className="col-span-2 text-xs text-gray-400">Facturé tous les {Math.round(Number(planForm.custom_months)) || "…"} mois (1 à {MAX_PERIOD_MONTHS}). La période est ajoutée aux onglets proposés aux clients.</p>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea rows={2} value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} className={inputCls + " resize-none"} placeholder="Visible par les utilisateurs" />
                </div>
                <div>
                  <label className={labelCls}>Essai gratuit (jours)</label>
                  <input type="number" min="0" value={planForm.trial_days} onChange={e => setPlanForm({...planForm, trial_days: e.target.value})} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>Badge promo</label>
                  <input type="text" value={planForm.promo_description} onChange={e => setPlanForm({...planForm, promo_description: e.target.value})} className={inputCls} placeholder="ex: 2 mois offerts" />
                </div>
                <div>
                  <label className={labelCls}>Ordre d&apos;affichage (aussi en glissant)</label>
                  <input type="number" min="0" value={planForm.sort_order} onChange={e => setPlanForm({...planForm, sort_order: e.target.value})} className={inputCls} />
                </div>
              </div>

              {/* Cosmétiques débloqués */}
              <div className="border-t border-[rgba(197,161,72,0.25)] pt-5">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Cosmétiques débloqués automatiquement</h3>
                <p className="text-xs text-gray-400 mb-4">L&apos;enfant voit ces éléments disponibles dans Trophées → Personnalisation</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contours d&apos;avatar</p>
                    <div className="space-y-2">
                      {Object.entries(BORDER_STYLES).filter(([, v]) => v.source === "subscription").map(([key, val]) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                          <GlassCheckbox
                            checked={planForm.cosmetic_borders.includes(key)}
                            onChange={e => setPlanForm({ ...planForm, cosmetic_borders: e.target.checked ? [...planForm.cosmetic_borders, key] : planForm.cosmetic_borders.filter((b: string) => b !== key) })}
                            
                          />
                          <span className={`w-4 h-4 rounded-full border-2 ${val.preview}`} />
                          <span className="text-sm font-medium text-gray-700">{val.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Couleurs de nom</p>
                    <div className="space-y-2">
                      {Object.entries(NAME_COLORS).filter(([, v]) => v.source === "subscription").map(([key, val]) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                          <GlassCheckbox
                            checked={planForm.cosmetic_colors.includes(key)}
                            onChange={e => setPlanForm({ ...planForm, cosmetic_colors: e.target.checked ? [...planForm.cosmetic_colors, key] : planForm.cosmetic_colors.filter((c: string) => c !== key) })}
                            
                          />
                          <span className={`text-sm font-bold ${val.cls}`}>{val.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="border-t border-[rgba(197,161,72,0.25)] pt-5">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Fonctionnalités incluses</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nb enfants max</label>
                    <input type="number" min="1" value={planForm.feature_max_children} onChange={e => setPlanForm({...planForm, feature_max_children: e.target.value})} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Difficulté max. des exercices</label>
                    <select value={planForm.feature_access_level_exercises} onChange={e => setPlanForm({...planForm, feature_access_level_exercises: e.target.value})} className={inputCls}>
                      <option value="facile">Facile</option>
                      <option value="moyen">Moyen</option>
                      <option value="avance">Avancé</option>
                      <option value="difficile">Difficile (tout)</option>
                    </select>
                  </div>
                  {/* IA access */}
                  <div>
                    <label className={labelCls}>Accès IA (Calia)</label>
                    <select value={planForm.feature_ai_access} onChange={e => setPlanForm({...planForm, feature_ai_access: e.target.value as "none" | "limited" | "unlimited"})} className={inputCls}>
                      <option value="none">Aucun accès</option>
                      <option value="limited">Limité (messages/jour)</option>
                      <option value="unlimited">Illimité</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Messages IA / jour {planForm.feature_ai_access === "unlimited" ? "(ignoré si illimité)" : ""}</label>
                    <input type="number" min="0" value={planForm.feature_ai_daily_limit} disabled={planForm.feature_ai_access !== "limited"} onChange={e => setPlanForm({...planForm, feature_ai_daily_limit: Number(e.target.value)})} className={inputCls + (planForm.feature_ai_access !== "limited" ? " opacity-40" : "")} />
                  </div>
                  <div>
                    <label className={labelCls}>Mini-jeux, parties / jour (-1 = illimité)</label>
                    <input type="number" min="-1" value={planForm.feature_minigames_daily_limit} onChange={e => setPlanForm({...planForm, feature_minigames_daily_limit: Number(e.target.value)})} className={inputCls} />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    {[
                      { key: "feature_detailed_reports", label: "Rapports détaillés" },
                      { key: "feature_priority_support", label: "Support prioritaire" },
                      { key: "feature_custom_avatars",   label: "Avatars personnalisés" },
                      { key: "feature_minigames_premium_content", label: "Mini-jeux, contenu premium (5 questions au lieu de 2)" },
                      { key: "feature_calia_classe", label: "Calia en classe (IA vocale qui enseigne à l'oral)" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 p-3 border border-[rgba(197,161,72,0.25)] rounded-xl cursor-pointer hover:border-[var(--greek-blue)] transition-colors">
                        <GlassSwitch checked={!!(planForm as Record<string, unknown>)[key]} onChange={(next) => setPlanForm({ ...planForm, [key]: next })} label={label} />
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer border border-[rgba(197,161,72,0.25)] hover:border-green-400 transition-colors">
                <GlassSwitch checked={planForm.is_active} onChange={(next) => setPlanForm({ ...planForm, is_active: next })} label="Plan actif" />
                <span className="text-sm font-semibold text-gray-700">Plan actif (visible pour les utilisateurs)</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowPlanModal(false)}>Annuler</GlassButton>
                <GlassButton size="sm" variant="navy" onClick={() => savePlan({ preventDefault: () => {} } as unknown as React.FormEvent)}>
                  {editingPlan ? "Mettre à jour" : "Créer le plan"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ REFERRAL MODAL ════════ */}
      {showRefModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                {editingCode ? "Modifier le code" : "Nouveau code promo"}
              </h2>
              <GlassCloseButton onClick={() => setShowRefModal(false)} variant="light" />
            </div>
            <form onSubmit={saveRef} className="p-8 space-y-4">
              <div>
                <label className={labelCls}>Code (auto-généré si vide)</label>
                <input type="text" value={refForm.code} onChange={e => setRefForm({...refForm, code: e.target.value.toUpperCase()})} className={inputCls + " font-mono tracking-wider"} placeholder="ex: BIENVENUE20" />
              </div>
              <div>
                <label className={labelCls}>Description interne</label>
                <input type="text" value={refForm.description} onChange={e => setRefForm({...refForm, description: e.target.value})} className={inputCls} placeholder="ex: Parrainage influenceur été 2025" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type de remise</label>
                  <select value={refForm.discount_type} onChange={e => setRefForm({...refForm, discount_type: e.target.value})} className={inputCls}>
                    <option value="percent">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (€)</option>
                    <option value="free_months">Mois offerts</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Valeur</label>
                  <input type="number" min="0" step="0.01" required value={refForm.discount_value} onChange={e => setRefForm({...refForm, discount_value: e.target.value})} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Limite d&apos;utilisation</label>
                <input type="number" min="1" value={refForm.max_uses} onChange={e => setRefForm({...refForm, max_uses: e.target.value})} className={inputCls} placeholder="Illimité si vide" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Valide à partir du</label>
                  <input type="date" value={refForm.valid_from} onChange={e => setRefForm({...refForm, valid_from: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Expire le</label>
                  <input type="date" value={refForm.valid_until} onChange={e => setRefForm({...refForm, valid_until: e.target.value})} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer border border-[rgba(197,161,72,0.25)]">
                <GlassSwitch checked={refForm.is_active} onChange={(next) => setRefForm({ ...refForm, is_active: next })} label="Code actif" />
                <span className="text-sm font-semibold text-gray-700">Code actif</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowRefModal(false)}>Annuler</GlassButton>
                <GlassButton size="sm" variant="navy" type="submit">
                  {editingCode ? "Mettre à jour" : "Créer le code"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
