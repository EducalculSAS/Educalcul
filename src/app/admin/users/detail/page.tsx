"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, Baby, Ban, MessageCircle, KeyRound, Trash2,
  CheckCircle, AlertTriangle, Send, X, Loader2, Clock, Edit, Bell,
  CreditCard, User as UserIcon, Trophy, MessageSquare,
  Flag, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";

const roleBadge = (r: string) => {
  if (r === "admin") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (r === "parent") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-semibold text-gray-700 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

// Reusable confirm modal
function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel, confirmClass, loading, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-8 space-y-4">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {children}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
            <button onClick={onConfirm} disabled={loading} className={`flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-xl transition-colors disabled:opacity-50 ${confirmClass || "bg-red-500 hover:bg-red-600"}`}>
              {loading && <Loader2 size={14} className="animate-spin" />}{confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: "", content: "", type: "message" });
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Expand sections
  const [showPosts, setShowPosts] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Load plans first, then user
    fetch("/api/admin/subscriptions")
      .then(r => r.json())
      .then(d => {
        setPlans(Array.isArray(d) ? d : []);
        fetchUser();
      });
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/user-detail?id=${id}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setEditForm({ first_name: d.user.first_name || "", last_name: d.user.last_name || "", email: d.user.email || "", role: d.user.role || "parent", status: d.user.status || "active", grade_level: d.user.grade_level || "", password: "" });
      setSelectedPlanId(d.subscription?.plan_id?.toString() || "");
    }
    setLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => { setToast({ type, text }); setTimeout(() => setToast(null), 4000); };

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
      // Also reset password if provided
showToast("success", "Profil mis à jour");
      setShowEditModal(false);
      fetchUser();
    } catch (err: any) { showToast("error", err.message); }
    finally { setActionLoading(false); }
  };

  const handleBan = async () => { await doAction("ban", { reason: banReason }); setShowBanModal(false); setBanReason(""); };

  const handleDelete = async () => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/users?auth_id=${data.user.auth_id}`, { method: "DELETE" });
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
        body: JSON.stringify({ action: "set_plan", payload: { plan_id: selectedPlanId } }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast("success", "Abonnement mis à jour");
      fetchUser();
    } catch (err: any) { showToast("error", err.message || "Erreur"); }
    finally { setSavingPlan(false); }
  };

  const handleSendMessage = async () => {
    await doAction("send_message", msgForm);
    setShowMessageModal(false);
    setMsgForm({ title: "", content: "", type: "message" });
  };

  if (!id) return <div className="p-6 text-red-500">ID manquant.</div>;
  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>;
  if (!data) return <div className="p-6 text-red-500">Utilisateur introuvable.</div>;

  const { user, stats, subscription, children, notifications, badges, forum_posts, forum_comments, reports } = data;
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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <button onClick={() => router.push("/admin/users")} className="p-2 text-[var(--greek-blue)] hover:bg-blue-50 rounded-xl transition-colors shrink-0 mt-1">
              <ArrowLeft size={20} />
            </button>
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold text-2xl flex items-center justify-center overflow-hidden">
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              {isBanned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><Ban className="w-3 h-3 text-white" /></div>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {roleBadge(user.role)}
                {isBanned && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><Ban className="w-3 h-3" />Banni</span>}
              </div>
              {/* Name wraps on long names */}
              <h1 className="text-xl md:text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] break-words leading-tight">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5 break-all">{user.email}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={() => { setEditForm({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "", role: user.role, status: user.status, grade_level: user.grade_level || "", password: "" }); setShowEditModal(true); }}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--greek-blue)] text-[var(--greek-blue)] rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors">
              <Edit size={14} /> Modifier
            </button>
            <button onClick={() => { setNewPassword(""); setShowResetModal(true); }}
              className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-600 rounded-xl text-sm font-semibold hover:bg-purple-50 transition-colors">
              <KeyRound size={14} /> Reset MDP
            </button>
            <button onClick={() => setShowMessageModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm">
              <MessageCircle size={14} /> Message
            </button>
            {isBanned ? (
              <button onClick={() => doAction("unban")} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50">
                <CheckCircle size={14} /> Réactiver
              </button>
            ) : (
              <button onClick={() => setShowBanModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm">
                <Ban size={14} /> Bannir
              </button>
            )}
            <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 text-red-500 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> Supprimer
            </button>
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
          {!isChild && user.role !== "admin" && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />Abonnement
              </h2>
              <div className="space-y-3">
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Aucun abonnement —</option>
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.name} — {p.price}€/{p.billing_interval === "year" ? "an" : "mois"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={savePlan}
                  disabled={savingPlan || !selectedPlanId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {savingPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Appliquer
                </button>
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Exercices", value: stats.exercise_attempts, color: "text-orange-600" },
                { label: "Quiz", value: stats.quiz_attempts, color: "text-blue-600" },
                { label: "Cours", value: stats.course_progress, color: "text-teal-600" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4">
                  <p className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          )}

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
                    <button onClick={() => doAction("delete_post", { post_id: p.id })} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
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
                    <button onClick={() => doAction("delete_comment", { comment_id: c.id })} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
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
                            <button onClick={() => doAction("review_report", { report_id: r.id })} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors" title="Marquer traité"><CheckCircle size={14} /></button>
                            <button onClick={() => doAction("dismiss_report", { report_id: r.id })} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Ignorer"><X size={14} /></button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Modifier le profil</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
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
              {editForm.role === "child" && <div><label className={labelCls}>Niveau</label><input value={editForm.grade_level} onChange={e => setEditForm({ ...editForm, grade_level: e.target.value })} className={inputCls} placeholder="6eme..." /></div>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={saveEdit} disabled={actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50">
                  {actionLoading && <Loader2 size={14} className="animate-spin" />} Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reset MDP ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-purple-600 font-[family-name:var(--font-display)]">Nouveau mot de passe</h2>
              <button onClick={() => setShowResetModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">Définir un nouveau mot de passe pour <strong>{user?.first_name} {user?.last_name}</strong>.</p>
              <div><label className={labelCls}>Nouveau mot de passe *</label>
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls + " font-mono"} placeholder="Minimum 6 caractères" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowResetModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button
                  onClick={async () => {
                    if (!newPassword.trim() || newPassword.length < 6) return;
                    setActionLoading(true);
                    await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.user.id, auth_id: data.user.auth_id, password: newPassword }) });
                    showToast("success", "Mot de passe mis à jour");
                    setShowResetModal(false);
                    setNewPassword("");
                    setActionLoading(false);
                  }}
                  disabled={!newPassword.trim() || newPassword.length < 6 || actionLoading}
                  className="flex items-center gap-2 px-7 py-2.5 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50">
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}<KeyRound size={14} /> Appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Envoyer un message</h2>
              <button onClick={() => setShowMessageModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div><label className={labelCls}>Type</label><select value={msgForm.type} onChange={e => setMsgForm({ ...msgForm, type: e.target.value })} className={inputCls}><option value="message">Message</option><option value="warning">Avertissement</option><option value="info">Information</option></select></div>
              <div><label className={labelCls}>Titre *</label><input value={msgForm.title} onChange={e => setMsgForm({ ...msgForm, title: e.target.value })} className={inputCls} placeholder="Objet" /></div>
              <div><label className={labelCls}>Message *</label><textarea value={msgForm.content} onChange={e => setMsgForm({ ...msgForm, content: e.target.value })} className={inputCls + " h-28 resize-none"} placeholder="Contenu..." /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowMessageModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleSendMessage} disabled={!msgForm.title || !msgForm.content || actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      <ConfirmModal
        open={showBanModal} onClose={() => { setShowBanModal(false); setBanReason(""); }}
        onConfirm={handleBan} title="Bannir l'utilisateur"
        description="Le compte sera suspendu et l'utilisateur recevra une notification."
        confirmLabel="Bannir" confirmClass="bg-orange-500 hover:bg-orange-600" loading={actionLoading}
      >
        <div><label className={labelCls}>Raison (optionnel)</label><textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Expliquez la raison..." /></div>
      </ConfirmModal>

      {/* Delete modal */}
      <ConfirmModal
        open={showDeleteModal} onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete} title="Supprimer le compte"
        description={`Supprimer définitivement le compte de ${data?.user.first_name} ${data?.user.last_name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement" confirmClass="bg-red-500 hover:bg-red-600" loading={actionLoading}
      />
    </div>
  );
}

export default function UserDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>}>
      <UserDetailContent />
    </Suspense>
  );
}
