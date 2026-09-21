"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Shield, Baby, Ban, MessageCircle, KeyRound, Trash2,
  CheckCircle, AlertTriangle, Send, X, Loader2, Edit, Bell,
  CreditCard, User as UserIcon, Trophy, MessageSquare,
  Flag, ChevronDown, ChevronUp, Save, Eye, EyeOff, ShieldCheck, UserCog,
  Gamepad2,
} from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";
import { supabase } from "@/lib/supabaseClient";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { validatePassword } from "@/lib/validation";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

const roleBadge = (r: string) => {
  if (r === "admin") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (r === "parent") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

const MINIGAME_LABEL: Record<string, string> = {
  mathador: "Mathador",
  calcul_mental: "Calcul mental",
  enigmes: "Énigmes",
  suites: "Suites",
  langues: "Maths en langues",
};
const MINIGAME_STATUS_LABEL: Record<string, string> = {
  in_progress: "En cours",
  completed: "Terminée",
  abandoned: "Abandonnée",
};
const MINIGAME_STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-gray-100 text-gray-500",
};
function formatMinigameDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-semibold text-gray-700 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

// Reusable confirm modal
function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel, confirmVariant, loading, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4">
      <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-gray-800">{title}</h2>
          <GlassCloseButton onClick={onClose} />
        </div>
        <div className="p-8 space-y-4">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {children}
          <div className="flex justify-end gap-3 pt-2">
            <GlassButton size="sm" variant="ghost" onClick={onClose}>Annuler</GlassButton>
            <GlassButton size="sm" variant={confirmVariant || "danger"} disabled={loading} onClick={onConfirm}>
              {loading && <Loader2 size={14} className="animate-spin" />}{confirmLabel}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fiche utilisateur admin : la fiche complète (profil, stats, abonnement,
 * tentatives, tickets, forum, signalements) arrive déjà chargées du serveur
 * pour l'id demandé ; toutes les mutations (édition, ban, message,
 * abonnement, suppression...) restent des allers-retours client, comme
 * avant. */
export default function AdminUserDetailClient({
  id,
  initialData,
  initialPlans,
}: {
  id: string;
  initialData: any;
  initialPlans: any[];
}) {
  const router = useRouter();
  const [data, setData] = useState<any>(initialData);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    first_name: initialData.user.first_name || "",
    last_name: initialData.user.last_name || "",
    email: initialData.user.email || "",
    role: initialData.user.role || "parent",
    admin_level: initialData.user.admin_level || "super",
    status: initialData.user.status || "active",
    grade_level: initialData.user.grade_level || "",
    password: "",
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: "", content: "", type: "message" });
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banDays, setBanDays] = useState<number | null>(null);
  // Modale de traitement d'un signalement (message + conséquence).
  const [reportModal, setReportModal] = useState<any>(null);
  const [reportMsg, setReportMsg] = useState("");
  const [reportConsequence, setReportConsequence] = useState<"none" | "warn" | "ban7" | "ban_perm">("none");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentAuthId, setCurrentAuthId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentAuthId(session?.user.id ?? null);
    })();
  }, []);

  // Expand sections
  const [showPosts, setShowPosts] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);
  const [showMinigames, setShowMinigames] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [plans] = useState<any[]>(initialPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialData.subscription?.plan_id?.toString() || "");
  // "offert" = accès sans facturation (compte de test, partenariat, élève sans
  // parent payeur) ; "stripe" = facturation réelle exigée, l'action échoue si
  // Stripe ne peut pas créer l'abonnement (voir adminGrantSubscription.ts).
  const [planBillingMode, setPlanBillingMode] = useState<"offert" | "stripe">("offert");
  const [savingPlan, setSavingPlan] = useState(false);
  const [freeWeeksOffset, setFreeWeeksOffset] = useState<number>(0);
  const [freeTimeLoading, setFreeTimeLoading] = useState(false);

  const fetchUser = async () => {
    const res = await fetch(`/api/admin/user-detail?id=${id}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setEditForm({ first_name: d.user.first_name || "", last_name: d.user.last_name || "", email: d.user.email || "", role: d.user.role || "parent", status: d.user.status || "active", grade_level: d.user.grade_level || "", password: "" });
      setSelectedPlanId(d.subscription?.plan_id?.toString() || "");
    }
  };

  const showToast = (type: "success" | "error", text: string) => { setToast({ type, text }); setTimeout(() => setToast(null), 4000); };

  const [impersonating, setImpersonating] = useState(false);

  const impersonate = async () => {
    setImpersonating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // La session admin d'origine est déjà gardée côté serveur (voir
      // /api/admin/impersonate, référencée par un cookie httpOnly) — il ne
      // reste plus qu'à remplacer la session courante par celle de la cible
      // via le lien magique généré côté serveur.
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" });
      if (verifyError) throw verifyError;

      window.location.href = result.targetRole === "child" ? "/child/dashboard" : "/parent/dashboard";
    } catch (err: any) {
      showToast("error", err.message || "Échec de la connexion en tant qu'utilisateur");
      setImpersonating(false);
    }
  };

  const doAction = async (actionName: string, payload?: any) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, payload }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast("success", "Action effectuée");
      fetchUser();
    } catch (err: any) { showToast("error", err.message); }
    finally { setActionLoading(false); }
  };

  const saveEdit = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("success", "Profil mis à jour");
      setShowEditModal(false);
      fetchUser();
    } catch (err: any) { showToast("error", err.message); }
    finally { setActionLoading(false); }
  };

  const handleBan = async () => { await doAction("ban", { reason: banReason, banDays }); setShowBanModal(false); setBanReason(""); setBanDays(null); };

  const submitReportAction = async () => {
    if (!reportModal) return;
    setActionLoading(true);
    try {
      // 1. Marque le signalement traité.
      await fetch(`/api/admin/user-detail?id=${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review_report", payload: { report_id: reportModal.id } }) });
      // 2. Message à l'utilisateur signalé (facultatif).
      if (reportMsg.trim()) {
        await fetch(`/api/admin/user-detail?id=${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_message", payload: { title: "Suite à un signalement", content: reportMsg.trim(), type: "warning" } }) });
      }
      // 3. Conséquence.
      if (reportConsequence === "ban7") {
        await fetch(`/api/admin/user-detail?id=${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ban", payload: { reason: `Signalement retenu : ${reportModal.reason}`, banDays: 7 } }) });
      } else if (reportConsequence === "ban_perm") {
        await fetch(`/api/admin/user-detail?id=${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ban", payload: { reason: `Signalement retenu : ${reportModal.reason}`, banDays: null } }) });
      }
      showToast("success", "Signalement traité");
      setReportModal(null); setReportMsg(""); setReportConsequence("none");
      fetchUser();
    } catch (err: any) {
      showToast("error", err.message || "Échec");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/users?auth_id=${data.user.auth_id}&userId=${currentAuthId}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/users");
    else showToast("error", "Erreur lors de la suppression");
    setActionLoading(false);
    setShowDeleteModal(false);
  };

  const savePlan = async () => {
    if (!selectedPlanId) return;
    setSavingPlan(true);
    try {
      const res = await fetch("/api/admin/user-detail?id=" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_plan",
          payload: { plan_id: selectedPlanId, billing_mode: planBillingMode },
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(
        "success",
        result.offered
          ? "Abonnement offert attribué (aucune facturation)"
          : result.stripeLinked
            ? "Abonnement mis à jour (Stripe synchronisé)"
            : "Abonnement mis à jour (sans Stripe — client introuvable ou plan gratuit)",
      );
      fetchUser();
    } catch (err: any) { showToast("error", err.message || "Erreur"); }
    finally { setSavingPlan(false); }
  };

  const addFreeTime = async (sign: 1 | -1) => {
    setFreeTimeLoading(true);
    try {
      const res = await fetch("/api/admin/user-detail?id=" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_free_time", payload: { days: sign * 7 } }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFreeWeeksOffset(w => w + sign);
      showToast("success", sign > 0 ? "1 semaine ajoutée" : "1 semaine retirée");
      fetchUser();
    } catch (err: any) { showToast("error", err.message || "Erreur"); }
    finally { setFreeTimeLoading(false); }
  };

  const handleSendMessage = async () => {
    await doAction("send_message", msgForm);
    setShowMessageModal(false);
    setMsgForm({ title: "", content: "", type: "message" });
  };

  const {
    user, stats, subscription, children, notifications, badges, forum_posts, forum_comments, reports,
    exercise_attempts = [], quiz_attempts = [], course_progress = [], support_tickets = [],
    minigame_sessions = [],
  } = data;
  const isChild = user.role === "child";
  const isParent = user.role === "parent";
  const isBanned = user.status === "inactive";
  const img = avatarUrl(user.avatar);
  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`;

  const notifColors: any = { ban: "bg-red-50 text-red-700 border-red-100", warning: "bg-orange-50 text-orange-700 border-orange-100", message: "bg-blue-50 text-blue-700 border-blue-100", info: "bg-green-50 text-green-700 border-green-100" };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}{toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <span className="shrink-0 mt-1">
              <GlassIconButton
                icon={ArrowLeft}
                color="navy"
                onClick={() => router.push("/admin/users")}
                aria-label="Retour à la liste des utilisateurs"
              />
            </span>
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold text-2xl flex items-center justify-center overflow-hidden">
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              {isBanned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><Ban className="w-3 h-3 text-white" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {roleBadge(user.role)}
                {isBanned && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><Ban className="w-3 h-3" />Banni</span>}
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] truncate leading-tight">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5 truncate">{user.email}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => { setEditForm({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "", role: user.role, admin_level: user.admin_level || "super", status: user.status, grade_level: user.grade_level || "", password: "" }); setShowEditModal(true); }}
            >
              <Edit size={14} /> Modifier
            </GlassButton>
            <GlassButton size="sm" variant="outline" onClick={() => { setNewPassword(""); setShowResetModal(true); }}>
              <KeyRound size={14} /> Reset MDP
            </GlassButton>
            {user.role !== "admin" && (
              <GlassButton size="sm" variant="outline" disabled={impersonating} onClick={impersonate}>
                <UserCog size={14} /> Se connecter en tant que
              </GlassButton>
            )}
            {user.role !== "admin" && (
              <GlassButton size="sm" variant="ghost" disabled={actionLoading} onClick={() => doAction("toggle_2fa")}>
                <ShieldCheck size={14} /> {user.two_factor_enabled ? "Désactiver la 2FA" : "Activer la 2FA"}
              </GlassButton>
            )}
            <GlassButton size="sm" variant="navy" onClick={() => setShowMessageModal(true)}>
              <MessageCircle size={14} /> Message
            </GlassButton>
            {isBanned ? (
              <GlassButton size="sm" variant="outline" disabled={actionLoading} onClick={() => doAction("unban")}>
                <CheckCircle size={14} /> Réactiver
              </GlassButton>
            ) : (
              <GlassButton size="sm" variant="danger" onClick={() => setShowBanModal(true)}>
                <Ban size={14} /> Bannir
              </GlassButton>
            )}
            <GlassButton size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={14} /> Supprimer
            </GlassButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-5">
          {/* Info / Edit */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Informations</h2>
            <div className="space-y-3 text-sm">
              <Row label="Inscrit le" value={new Date(user.created_at).toLocaleDateString("fr-FR")} />
              {user.last_active_at && <Row label="Dernière activité" value={new Date(user.last_active_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} />}
              {user.grade_level && <Row label="Niveau" value={user.grade_level} />}
              {user.last_login_ip && <Row label="IP" value={user.last_login_ip} mono />}
              {user.last_login_country && <Row label="Localisation" value={`${user.last_login_city || ""} ${user.last_login_country}`} />}
            </div>
          </div>

          {/* Subscription — parents only, pas pour les admins */}
          {user.role !== "admin" && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />Abonnement
              </h2>
              {isChild && (
                <p className="text-xs text-gray-500 mb-3">
                  {user.parent_id
                    ? "Cet élève dépend normalement de l'abonnement de son parent : un abonnement attribué ici ne sera pas utilisé tant qu'il a un parent."
                    : "Élève sans parent : c'est son propre abonnement qui détermine ses accès."}
                </p>
              )}
              <div className="space-y-3">
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Aucun abonnement —</option>
                  {Object.entries(
                    plans
                      .filter((p: any) => p.is_active)
                      .reduce((groups: Record<string, any[]>, p: any) => {
                        (groups[p.name] ??= []).push(p);
                        return groups;
                      }, {})
                  ).map(([groupName, groupPlans]) => {
                    const order = ["month", "quarter", "semester", "year", "one_time"];
                    const sorted = [...(groupPlans as any[])].sort((a, b) => order.indexOf(a.billing_interval) - order.indexOf(b.billing_interval));
                    return (
                      <optgroup key={groupName} label={groupName}>
                        {sorted.map((p: any) => (
                          <option key={p.id} value={p.id.toString()}>
                            {p.price}€ — {
                              p.billing_interval === "year" ? "Annuel"
                              : p.billing_interval === "semester" ? "Semestriel"
                              : p.billing_interval === "quarter" ? "Trimestriel"
                              : p.billing_interval === "one_time" ? "Unique"
                              : "Mensuel"
                            }
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {selectedPlanId && (
                  <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="planBillingMode"
                        checked={planBillingMode === "offert"}
                        onChange={() => setPlanBillingMode("offert")}
                        className="mt-1"
                      />
                      <span><strong>Offert</strong> — accès immédiat, aucune facturation.</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="planBillingMode"
                        checked={planBillingMode === "stripe"}
                        onChange={() => setPlanBillingMode("stripe")}
                        className="mt-1"
                      />
                      <span><strong>Facturé</strong> — exige un client Stripe existant, sinon refusé.</span>
                    </label>
                  </div>
                )}
                <GlassButton
                  size="sm"
                  variant="navy"
                  fullWidth
                  disabled={savingPlan || !selectedPlanId}
                  onClick={savePlan}
                >
                  {savingPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Attribuer cet abonnement
                </GlassButton>
                {subscription ? (
                  <p className="text-xs text-gray-400 text-center">
                    Actuel : <span className="font-semibold text-gray-600">
                      {plans.find((p: any) => p.id.toString() === subscription?.plan_id?.toString())?.name || subscription?.plan_id || "?"}
                    </span>
                    {subscription.current_period_end && ` · jusqu'au ${new Date(subscription.current_period_end).toLocaleDateString("fr-FR")}`}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 text-center italic">Aucun abonnement actif</p>
                )}

                {subscription && (() => {
                  const remainingMs = subscription.current_period_end
                    ? new Date(subscription.current_period_end).getTime() - Date.now()
                    : 0;
                  const remainingDays = Math.max(0, Math.round(remainingMs / (24 * 60 * 60 * 1000)));
                  const remainingWeeks = Math.round(remainingDays / 7);
                  return (
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <p className={labelCls}>Durée gratuite offerte</p>
                      <p className="text-xs text-gray-500">
                        Temps restant : <span className="font-semibold text-gray-700">{remainingDays} jour{remainingDays > 1 ? "s" : ""}</span>
                        {" "}(~{remainingWeeks} semaine{remainingWeeks > 1 ? "s" : ""})
                      </p>
                      <div className="flex items-center gap-2">
                        <GlassButton
                          size="sm"
                          variant="danger"
                          disabled={freeTimeLoading}
                          onClick={() => addFreeTime(-1)}
                        >
                          − 1 semaine
                        </GlassButton>
                        <span className="flex-1 text-center text-sm font-bold" style={{ color: "var(--greek-blue)" }}>
                          {freeWeeksOffset > 0 ? `+${freeWeeksOffset}` : freeWeeksOffset} semaine{Math.abs(freeWeeksOffset) > 1 ? "s" : ""}
                        </span>
                        <GlassButton
                          size="sm"
                          variant="outline"
                          disabled={freeTimeLoading}
                          onClick={() => addFreeTime(1)}
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", borderColor: "rgba(22,163,74,0.3)" }}
                        >
                          + 1 semaine
                        </GlassButton>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Children — parents only */}
          {isParent && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Enfants ({children.length})</h2>
              {children.length > 0 ? children.map((c: any) => (
                <button key={c.id} onClick={() => router.push(`/admin/users/detail?id=${c.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl(c.avatar) ? <img src={avatarUrl(c.avatar)!} className="w-full h-full object-cover" alt="" /> : (c.first_name?.[0] || "?")}
                  </div>
                  <div><p className="text-sm font-semibold text-gray-700">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.grade_level}</p></div>
                </button>
              )) : <p className="text-sm text-gray-400 italic">Aucun enfant lié</p>}
            </div>
          )}

          {badges.length > 0 && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" />Badges</h2>
              <div className="flex flex-wrap gap-2">
                {badges.map((b: any, i: number) => <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">{b.badge?.name}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-5">

          {/* Stats — children only for exos/quiz/cours */}
          {isChild && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Exercices", value: stats.exercise_attempts, color: "text-orange-600" },
                { label: "Quiz", value: stats.quiz_attempts, color: "text-blue-600" },
                { label: "Cours", value: stats.course_progress, color: "text-teal-600" },
                { label: "Mini-jeux", value: stats.minigame_sessions, color: "text-purple-600" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4">
                  <p className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Détail des tentatives — exercices / quiz / cours */}
          {isChild && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <button onClick={() => setShowAttempts(!showAttempts)} className="w-full flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4" />Détail des tentatives ({exercise_attempts.length + quiz_attempts.length + course_progress.length})
                </h2>
                {showAttempts ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {showAttempts && (
                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Exercices ({exercise_attempts.length})</p>
                    {exercise_attempts.length > 0 ? (
                      <div className="space-y-1.5">
                        {exercise_attempts.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-700 truncate">{a.exercises?.title || "Exercice supprimé"}</p>
                              <p className="text-xs text-gray-400">{new Date(a.completed_at || a.attempted_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {a.score}/{a.total_points} ({a.score_percent}%)
                              </span>
                              {a.exercise_id && (
                                <Link
                                  href={`/admin/users/attempt-review?userId=${id}&kind=exercise&itemId=${a.exercise_id}`}
                                  className="p-1 rounded-lg text-gray-400 hover:text-[var(--greek-blue)] hover:bg-[rgba(15,30,58,0.06)] transition-colors"
                                  title="Voir la correction"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 italic">Aucune tentative</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quiz ({quiz_attempts.length})</p>
                    {quiz_attempts.length > 0 ? (
                      <div className="space-y-1.5">
                        {quiz_attempts.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-700 truncate">{a.quizzes?.title || "Quiz supprimé"}</p>
                              <p className="text-xs text-gray-400">{new Date(a.completed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {a.score}/{a.total_points} ({a.score_percent}%)
                              </span>
                              {a.quiz_id && (
                                <Link
                                  href={`/admin/users/attempt-review?userId=${id}&kind=quiz&itemId=${a.quiz_id}`}
                                  className="p-1 rounded-lg text-gray-400 hover:text-[var(--greek-blue)] hover:bg-[rgba(15,30,58,0.06)] transition-colors"
                                  title="Voir la correction"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 italic">Aucune tentative</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cours ({course_progress.length})</p>
                    {course_progress.length > 0 ? (
                      <div className="space-y-1.5">
                        {course_progress.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-700 truncate">{c.courses?.title || "Cours supprimé"}</p>
                              <p className="text-xs text-gray-400">Chapitre {c.chapter_index + 1} · {c.completed_at ? new Date(c.completed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "en cours"}</p>
                            </div>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${c.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {c.status === "completed" ? "Terminé" : "En cours"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 italic">Aucune progression</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mini-jeux */}
          {isChild && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <button onClick={() => setShowMinigames(!showMinigames)} className="w-full flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4" />Mini-jeux ({minigame_sessions.length})
                </h2>
                {showMinigames ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {showMinigames && (
                <div className="mt-4">
                  {minigame_sessions.length > 0 ? (
                    <div className="space-y-1.5">
                      {minigame_sessions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-700 truncate">{MINIGAME_LABEL[s.game_type] || s.game_type}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(s.completed_at || s.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                              {" · "}{formatMinigameDuration(s.duration_seconds)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.max_score != null && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {s.score}/{s.max_score}
                              </span>
                            )}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${MINIGAME_STATUS_COLOR[s.status] || "bg-gray-100 text-gray-500"}`}>
                              {MINIGAME_STATUS_LABEL[s.status] || s.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400 italic">Aucune partie jouée</p>}
                </div>
              )}
            </div>
          )}

          {/* Tickets support */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <button onClick={() => setShowTickets(!showTickets)} className="w-full flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><MessageCircle className="w-4 h-4" />Tickets support ({support_tickets.length})</h2>
              {showTickets ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {showTickets && (
              <div className="mt-3 space-y-2">
                {support_tickets.length > 0 ? support_tickets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-700 truncate">{t.subject}</p>
                      <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${t.status === "Résolu" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {t.status}{t.priority === "high" ? " · Urgent" : ""}
                    </span>
                  </div>
                )) : <p className="text-sm text-gray-400 italic">Aucun ticket</p>}
              </div>
            )}
          </div>

          {/* Messages admin (notifications) */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Bell className="w-4 h-4" />Messages & actions admin</h2>
            {notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n: any) => (
                  <div key={n.id} className={`p-3 rounded-xl border text-sm ${notifColors[n.type] || notifColors.message}`}>
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold">{n.title}</p>
                      <span className="text-xs opacity-60 shrink-0">{new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p className="opacity-75 mt-0.5 text-xs">{n.content}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucun message envoyé</p>}
          </div>

          {/* Forum posts */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <button onClick={() => setShowPosts(!showPosts)} className="w-full flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><MessageSquare className="w-4 h-4" />Sujets forum ({forum_posts.length})</h2>
              {showPosts ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {showPosts && (
              <div className="mt-3 space-y-2">
                {forum_posts.length > 0 ? forum_posts.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)]">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.category?.name} · {new Date(p.created_at).toLocaleDateString("fr-FR")}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.content}</p>
                    </div>
                    <GlassIconButton
                      icon={Trash2}
                      color="red"
                      size="sm"
                      onClick={() => doAction("delete_post", { post_id: p.id })}
                      aria-label="Supprimer"
                      className="shrink-0"
                    />
                  </div>
                )) : <p className="text-sm text-gray-400 italic">Aucun sujet</p>}
              </div>
            )}
          </div>

          {/* Forum comments → "Messages" */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <button onClick={() => setShowComments(!showComments)} className="w-full flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><MessageCircle className="w-4 h-4" />Messages forum ({forum_comments.length})</h2>
              {showComments ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {showComments && (
              <div className="mt-3 space-y-2">
                {forum_comments.length > 0 ? forum_comments.map((c: any) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)]">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">Dans : {c.post?.title || "Sujet supprimé"}</p>
                      <p className="text-sm text-gray-700 line-clamp-3">{c.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <GlassIconButton
                      icon={Trash2}
                      color="red"
                      size="sm"
                      onClick={() => doAction("delete_comment", { comment_id: c.id })}
                      aria-label="Supprimer"
                      className="shrink-0"
                    />
                  </div>
                )) : <p className="text-sm text-gray-400 italic">Aucun message</p>}
              </div>
            )}
          </div>

          {/* Signalements */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-400" />
              Signalements reçus ({reports.filter((r: any) => r.status === "pending").length} en attente)
            </h2>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.map((r: any) => (
                  <div key={r.id} className={`p-3 rounded-xl border text-sm ${r.status === "pending" ? "bg-red-50 border-red-100" : r.status === "reviewed" ? "bg-green-50 border-green-100" : "bg-gray-50 border-[rgba(197,161,72,0.25)]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{r.reason}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Par {r.reporter?.first_name || "Anonyme"} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                          {r.post && ` · Sujet: "${r.post.title}"`}
                          {r.comment && ` · Message: "${r.comment.content?.slice(0, 40)}..."`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {r.status === "pending" && (
                          <>
                            <GlassIconButton icon={CheckCircle} color="green" size="sm" loading={actionLoading} onClick={() => { setReportModal(r); setReportMsg(""); setReportConsequence("none"); }} aria-label="Traiter le signalement" />
                            <GlassIconButton icon={X} color="gray" size="sm" loading={actionLoading} onClick={() => doAction("dismiss_report", { report_id: r.id })} aria-label="Ignorer le signalement" />
                          </>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === "pending" ? "bg-red-100 text-red-700" : r.status === "reviewed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {r.status === "pending" ? "En attente" : r.status === "reviewed" ? "Traité" : "Ignoré"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucun signalement</p>}
          </div>
        </div>
      </div>

      {/* ── MODAL: Modifier le profil ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Modifier le profil</h2>
              <GlassCloseButton onClick={() => setShowEditModal(false)} />
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Prénom</label><input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Nom</label><input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Rôle</label>
                  <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                    <option value="parent">Parent</option><option value="child">Élève</option><option value="admin">Admin</option>
                  </select>
                </div>
                <div><label className={labelCls}>Statut</label>
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>
              {editForm.role === "admin" && <div><label className={labelCls}>Niveau admin</label>
                <select value={editForm.admin_level} onChange={e => setEditForm({ ...editForm, admin_level: e.target.value })} className={inputCls}>
                  <option value="super">Super admin (accès complet)</option>
                  <option value="support">Support (tickets, forum, profil uniquement)</option>
                </select>
              </div>}
              {editForm.role === "child" && <div><label className={labelCls}>Niveau</label>
                <select
                  value={editForm.grade_level}
                  onChange={(e) => setEditForm({ ...editForm, grade_level: e.target.value })}
                  className={inputCls}
                >
                  {SCHOOL_LEVELS.map(l => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
              </div>}
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowEditModal(false)}>Annuler</GlassButton>
                <GlassButton size="sm" variant="navy" disabled={actionLoading} onClick={saveEdit}>
                  {actionLoading && <Loader2 size={14} className="animate-spin" />} Enregistrer
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reset MDP ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-purple-600 font-[family-name:var(--font-display)]">Nouveau mot de passe</h2>
              <GlassCloseButton onClick={() => setShowResetModal(false)} />
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">Définir un nouveau mot de passe pour <strong>{user?.first_name} {user?.last_name}</strong>.</p>
              <div><label className={labelCls}>Nouveau mot de passe *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={inputCls + " font-mono pr-10"}
                    placeholder="Minimum 10 caractères"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <GlassIconButton
                      icon={showNewPassword ? EyeOff : Eye}
                      color="navy"
                      size="sm"
                      onClick={() => setShowNewPassword(v => !v)}
                      aria-label={showNewPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    />
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowResetModal(false)}>Annuler</GlassButton>
                <GlassButton
                  size="sm"
                  variant="navy"
                  disabled={!!validatePassword(newPassword) || actionLoading}
                  onClick={async () => {
                    if (validatePassword(newPassword)) return;
                    setActionLoading(true);
                    await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentAuthId, id: data.user.id, auth_id: data.user.auth_id, password: newPassword }) });
                    showToast("success", "Mot de passe mis à jour");
                    setShowResetModal(false);
                    setNewPassword("");
                    setActionLoading(false);
                  }}
                >
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}<KeyRound size={14} /> Appliquer
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1060] p-4">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Envoyer un message</h2>
              <GlassCloseButton onClick={() => setShowMessageModal(false)} />
            </div>
            <div className="p-8 space-y-4">
              <div><label className={labelCls}>Type</label><select value={msgForm.type} onChange={e => setMsgForm({ ...msgForm, type: e.target.value })} className={inputCls}><option value="message">Message</option><option value="warning">Avertissement</option><option value="info">Information</option></select></div>
              <div><label className={labelCls}>Titre *</label><input value={msgForm.title} onChange={e => setMsgForm({ ...msgForm, title: e.target.value })} className={inputCls} placeholder="Objet" /></div>
              <div><label className={labelCls}>Message *</label><textarea value={msgForm.content} onChange={e => setMsgForm({ ...msgForm, content: e.target.value })} className={inputCls + " h-28 resize-none"} placeholder="Contenu..." /></div>
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowMessageModal(false)}>Annuler</GlassButton>
                <GlassButton size="sm" variant="navy" disabled={!msgForm.title || !msgForm.content || actionLoading} onClick={handleSendMessage}>
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      <ConfirmModal
        open={showBanModal} onClose={() => { setShowBanModal(false); setBanReason(""); setBanDays(null); }}
        onConfirm={handleBan} title="Bannir l'utilisateur"
        description="Le compte sera suspendu et l'utilisateur recevra une notification."
        confirmLabel="Bannir" confirmVariant="danger" loading={actionLoading}
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Durée du bannissement</label>
            <select value={banDays || ""} onChange={e => setBanDays(e.target.value ? parseInt(e.target.value) : null)} className={inputCls}>
              <option value="">Permanente</option>
              <option value="1">1 jour</option>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
            </select>
          </div>
          <div><label className={labelCls}>Raison (optionnel)</label><textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Expliquez la raison..." /></div>
        </div>
      </ConfirmModal>

      {/* Delete modal */}
      <ConfirmModal
        open={showDeleteModal} onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete} title="Supprimer le compte"
        description={`Supprimer définitivement le compte de ${data?.user.first_name} ${data?.user.last_name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement" confirmVariant="danger" loading={actionLoading}
      />

      {/* Traitement d'un signalement */}
      <ConfirmModal
        open={!!reportModal}
        onClose={() => { setReportModal(null); setReportMsg(""); setReportConsequence("none"); }}
        onConfirm={submitReportAction}
        title="Traiter le signalement"
        description="Marque le signalement comme traité, avec un message et/ou une sanction pour l'utilisateur signalé."
        confirmLabel="Valider le traitement"
        confirmVariant={reportConsequence.startsWith("ban") ? "danger" : "navy"}
        loading={actionLoading}
      >
        <div className="space-y-3 text-left">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Motif signalé</p>
            <p className="text-sm text-gray-700">{reportModal?.reason}</p>
            <p className="text-xs text-gray-400 mt-1">
              Par {reportModal?.reporter?.first_name || "Anonyme"}
              {reportModal?.post && ` · Sujet "${reportModal.post.title}"`}
              {reportModal?.comment && ` · Commentaire`}
            </p>
          </div>
          <div>
            <label className={labelCls}>Message à l'utilisateur signalé (facultatif)</label>
            <textarea value={reportMsg} onChange={e => setReportMsg(e.target.value)} className={inputCls + " h-24 resize-none"} placeholder="Ex : ton message enfreint la charte du forum…" />
          </div>
          <div>
            <label className={labelCls}>Conséquence</label>
            <select value={reportConsequence} onChange={e => setReportConsequence(e.target.value as any)} className={inputCls}>
              <option value="none">Aucune — juste marquer traité</option>
              <option value="warn">Avertissement (message seul)</option>
              <option value="ban7">Bannir le compte 7 jours</option>
              <option value="ban_perm">Bannir le compte définitivement</option>
            </select>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
