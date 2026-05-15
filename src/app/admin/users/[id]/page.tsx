"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, Baby, Calendar, MapPin, Globe,
  Activity, BookOpen, MessageSquare, Trophy, Ban, MessageCircle,
  KeyRound, Trash2, CheckCircle, AlertTriangle, Send, X, Loader2,
  Clock, Edit, Bell, CreditCard, Save, User as UserIcon,
} from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";

const roleBadge = (r: string) => {
  if (r === "admin") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (r === "parent") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: "", content: "", type: "message" });

  // Ban modal
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");

  useEffect(() => { fetchUser(); }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/user-detail?id=${id}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setEditForm({
        first_name: d.user.first_name || "",
        last_name: d.user.last_name || "",
        email: d.user.email || "",
        role: d.user.role || "parent",
        status: d.user.status || "active",
        grade_level: d.user.grade_level || "",
      });
    }
    setLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const doAction = async (actionName: string, payload?: any) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast("success", "Action effectuée");
      fetchUser();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const saveEdit = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("success", "Profil mis à jour");
      setEditMode(false);
      fetchUser();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    await doAction("ban", { reason: banReason });
    setShowBanModal(false);
    setBanReason("");
  };

  const handleSendMessage = async () => {
    await doAction("send_message", msgForm);
    setShowMessageModal(false);
    setMsgForm({ title: "", content: "", type: "message" });
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    setActionLoading(true);
    const res = await fetch(`/api/admin/users?auth_id=${data.user.auth_id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/users");
    else showToast("error", "Erreur lors de la suppression");
    setActionLoading(false);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" />
    </div>
  );
  if (!data) return <div className="p-6 text-red-500">Utilisateur introuvable.</div>;

  const { user, stats, subscription, children, recent_activity, notifications, badges } = data;
  const isBanned = user.status === "inactive";
  const img = avatarUrl(user.avatar);
  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin/users")} className="p-2 text-[var(--greek-blue)] hover:bg-blue-50 rounded-xl transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold text-2xl flex items-center justify-center overflow-hidden">
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              {isBanned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><Ban className="w-3 h-3 text-white" /></div>}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                  {user.first_name} {user.last_name}
                </h1>
                {roleBadge(user.role)}
                {isBanned && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><Ban className="w-3 h-3" />Banni</span>}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
              {user.last_login_city && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{user.last_login_city}, {user.last_login_country}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {editMode ? (
              <>
                <button onClick={saveEdit} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
                </button>
                <button onClick={() => { setEditMode(false); }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                  <X size={15} /> Annuler
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-4 py-2 border border-[var(--greek-blue)] text-[var(--greek-blue)] rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors">
                <Edit size={15} /> Modifier
              </button>
            )}
            <button onClick={() => setShowMessageModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm">
              <MessageCircle size={15} /> Message
            </button>
            {isBanned ? (
              <button onClick={() => doAction("unban")} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50">
                <CheckCircle size={15} /> Réactiver
              </button>
            ) : (
              <button onClick={() => setShowBanModal(true)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50">
                <Ban size={15} /> Bannir
              </button>
            )}
            <button onClick={() => doAction("reset_password")} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              <KeyRound size={15} /> Reset MDP
            </button>
            <button onClick={handleDelete} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 text-red-500 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">

          {/* Edit form or info display */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              {editMode ? "Modifier le profil" : "Informations"}
            </h2>
            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prénom</label>
                    <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nom</label>
                    <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Rôle</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                      <option value="parent">Parent</option>
                      <option value="child">Élève</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Statut</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
                {(editForm.role === "child") && (
                  <div>
                    <label className={labelCls}>Niveau</label>
                    <input value={editForm.grade_level} onChange={e => setEditForm({ ...editForm, grade_level: e.target.value })} className={inputCls} placeholder="6eme, 5eme..." />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <Row label="Inscrit le" value={new Date(user.created_at).toLocaleDateString("fr-FR")} />
                {user.last_active_at && <Row label="Dernière activité" value={new Date(user.last_active_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} />}
                {user.grade_level && <Row label="Niveau" value={user.grade_level} />}
                {user.last_login_ip && <Row label="IP" value={user.last_login_ip} mono />}
                {user.last_login_country && <Row label="Pays" value={`${user.last_login_city || ""} ${user.last_login_country}`} />}
              </div>
            )}
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Abonnement</h2>
            {subscription ? (
              <div>
                <p className="font-bold text-[var(--greek-blue)]">{subscription.plan?.name}</p>
                <p className="text-xs text-gray-400">{subscription.plan?.price}€ / mois</p>
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucun abonnement actif</p>}
          </div>

          {/* Children */}
          {user.role === "parent" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Enfants ({children.length})</h2>
              {children.length > 0 ? children.map((c: any) => (
                <button key={c.id} onClick={() => router.push(`/admin/users/${c.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl(c.avatar) ? <img src={avatarUrl(c.avatar)!} className="w-full h-full object-cover" alt="" /> : (c.first_name?.[0] || "?")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-400">{c.grade_level}</p>
                  </div>
                </button>
              )) : <p className="text-sm text-gray-400 italic">Aucun enfant lié</p>}
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" />Badges</h2>
              <div className="flex flex-wrap gap-2">
                {badges.map((b: any, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">{b.badge?.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Exercices", value: stats.exercise_attempts, color: "bg-orange-50 text-orange-600" },
              { label: "Quiz", value: stats.quiz_attempts, color: "bg-blue-50 text-blue-600" },
              { label: "Cours suivis", value: stats.course_progress, color: "bg-teal-50 text-teal-600" },
              { label: "Sujets forum", value: stats.forum_posts, color: "bg-purple-50 text-purple-600" },
              { label: "Commentaires", value: stats.forum_comments, color: "bg-pink-50 text-pink-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className={`text-2xl font-bold mb-1 ${s.color.split(" ")[1]}`}>{s.value}</p>
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Admin notifications history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Bell className="w-4 h-4" />Historique des actions</h2>
            {notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n: any) => {
                  const c: any = { ban: "bg-red-50 text-red-700 border-red-100", warning: "bg-orange-50 text-orange-700 border-orange-100", message: "bg-blue-50 text-blue-700 border-blue-100", info: "bg-green-50 text-green-700 border-green-100" };
                  return (
                    <div key={n.id} className={`p-3 rounded-xl border text-sm ${c[n.type] || c.message}`}>
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold">{n.title}</p>
                        <span className="text-xs opacity-60 shrink-0">{new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <p className="opacity-75 mt-0.5 text-xs">{n.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucune action enregistrée</p>}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Clock className="w-4 h-4" />Activité récente</h2>
            {recent_activity.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recent_activity.map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--greek-blue)] shrink-0" />
                    <span className="text-gray-600 flex-1">{a.exercise?.title || "Exercice"}</span>
                    <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucune activité enregistrée</p>}
          </div>
        </div>
      </div>

      {/* Send message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-gray-100 px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Envoyer un message</h2>
              <button onClick={() => setShowMessageModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className={labelCls}>Type</label>
                <select value={msgForm.type} onChange={e => setMsgForm({ ...msgForm, type: e.target.value })} className={inputCls}>
                  <option value="message">Message</option>
                  <option value="warning">Avertissement</option>
                  <option value="info">Information</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Titre *</label>
                <input value={msgForm.title} onChange={e => setMsgForm({ ...msgForm, title: e.target.value })} className={inputCls} placeholder="Objet du message" />
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={msgForm.content} onChange={e => setMsgForm({ ...msgForm, content: e.target.value })} className={inputCls + " h-28 resize-none"} placeholder="Contenu du message..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowMessageModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleSendMessage} disabled={!msgForm.title || !msgForm.content || actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-gray-100 px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-red-600 font-[family-name:var(--font-display)]">Bannir l'utilisateur</h2>
              <button onClick={() => setShowBanModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">Le compte sera suspendu et l'utilisateur recevra une notification.</p>
              <div>
                <label className={labelCls}>Raison (optionnel)</label>
                <textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-24 resize-none"} placeholder="Expliquez la raison..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBanModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleBan} disabled={actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Bannir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-semibold text-gray-700 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
