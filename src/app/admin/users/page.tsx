"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import {
  Users, Search, Plus, Trash2, CheckCircle, XCircle,
  Loader2, Shield, User as UserIcon, Baby, Globe, MapPin,
  X, Eye, Ban, KeyRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { avatarUrl } from "@/lib/avatarUrl";

interface User {
  id: string;
  auth_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "parent" | "child";
  status: "active" | "inactive" | "pending";
  created_at: string;
  grade_level?: string;
  child_age?: number;
  avatar?: string;
  last_login_ip?: string;
  last_login_city?: string;
  last_login_country?: string;
  latitude?: number;
  longitude?: number;
  last_active_at?: string;
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const roleBadge = (role: string) => {
  if (role === "admin") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (role === "parent") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const statusBadge = (status: string) => {
  if (status === "active") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Actif</span>;
  if (status === "inactive") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Inactif</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><Loader2 className="w-3 h-3" />En attente</span>;
};

const isOnline = (u: User) =>
  !!u.last_active_at && Date.now() - new Date(u.last_active_at).getTime() < ONLINE_THRESHOLD_MS;

const inputCls = "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentAuthId, setCurrentAuthId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const UserMap = useMemo(() => dynamic(
    () => import("@/components/admin/UserMap"),
    { ssr: false, loading: () => <div className="h-full w-full bg-gray-50 animate-pulse flex items-center justify-center text-gray-400 text-sm">Chargement de la carte...</div> }
  ), []);

  // ── Modal states ──────────────────────────────────────────────────────────
  // Create
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "parent", status: "active", gradeLevel: "" });

  // Ban
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(() => fetchUsers(true), 30000);
    return () => clearInterval(interval);
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentAuthId(user.id);
        const { data: ud } = await supabase.from("users").select("latitude").eq("auth_id", user.id).single();
        const updates: any = { last_active_at: new Date().toISOString() };
        if (ud && !ud.latitude) {
          const geo = await fetch("https://ipapi.co/json/").then(r => r.json());
          if (geo.latitude) { updates.latitude = geo.latitude; updates.longitude = geo.longitude; updates.last_login_city = geo.city; updates.last_login_country = geo.country_name; updates.last_login_ip = geo.ip; }
        }
        await supabase.from("users").update(updates).eq("auth_id", user.id);
      } catch {}
    })();
  }, []);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    let url = "/api/admin/users?";
    if (roleFilter !== "all") url += `&role=${roleFilter}`;
    if (statusFilter !== "all") url += `&status=${statusFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    if (!silent) setLoading(false);
  };

  const filteredUsers = users.filter(u => {
    const s = searchTerm.toLowerCase();
    return (u.first_name?.toLowerCase() || "").includes(s) || (u.last_name?.toLowerCase() || "").includes(s) || (u.email?.toLowerCase() || "").includes(s);
  });

  const onlineCount = users.filter(u => isOnline(u) && u.auth_id !== currentAuthId).length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = { firstName: form.firstName, lastName: form.lastName, email: form.email, role: form.role, status: form.status, gradeLevel: form.gradeLevel, password: form.password };
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      setShowFormModal(false);
      fetchUsers();
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleBanConfirm = async () => {
    if (!banTarget) return;
    setSubmitting(true);
    const isBanned = banTarget.status === "inactive";
    await fetch(`/api/admin/user-detail?id=${banTarget.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isBanned ? "unban" : "ban", payload: { reason: banReason } }),
    });
    setShowBanModal(false);
    setBanReason("");
    setBanTarget(null);
    setSubmitting(false);
    fetchUsers(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/users?auth_id=${deleteTarget.auth_id}`, { method: "DELETE" });
    if (res.ok) setUsers(users.filter(u => u.id !== deleteTarget.id));
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setSubmitting(false);
  };

  const mapUsers = users.filter(u => u.latitude && u.longitude).map(u => ({
    id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email,
    status: u.status, lat: u.latitude!, lng: u.longitude!, role: u.role,
    city: u.last_login_city, lastActive: u.last_active_at, isOnline: isOnline(u),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <Users className="text-[var(--greek-gold)]" size={30} />
              Gestion des Utilisateurs
            </h1>
            <p className="text-[var(--greek-bronze)]">Gérez les comptes parents, élèves et administrateurs</p>
          </div>
          <button onClick={() => { setForm({ firstName: "", lastName: "", email: "", password: "", role: "parent", status: "active", gradeLevel: "" }); setShowFormModal(true); }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors shadow-md font-semibold">
            <Plus size={18} /> Nouvel Utilisateur
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6 relative h-[400px] z-0">
        <div className="flex justify-between items-center mb-4 relative z-10">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] flex items-center gap-2">
            <Globe className="text-[var(--greek-gold)]" size={20} />Carte des Connexions
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full border border-green-100">
              <span className="relative flex h-2 w-2">
                {onlineCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-bold text-green-700">{onlineCount} en ligne</span>
            </div>
            <span className="text-xs text-gray-400">Actif dans les 5 dernières minutes</span>
          </div>
        </div>
        <div className="h-[300px] w-full"><UserMap users={mapUsers} /></div>
        <div className="absolute bottom-3 left-6 text-[10px] text-gray-400 italic z-[1000] pointer-events-none">* Coordonnées approximatives basées sur l'IP</div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Rechercher par nom, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20">
              <option value="all">Tous les rôles</option>
              <option value="admin">Admin</option><option value="parent">Parent</option><option value="child">Élève</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20">
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option><option value="inactive">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Utilisateur", "Email", "Rôle", "Statut", "Dernière activité", "Actions"].map(h => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Chargement...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Aucun utilisateur trouvé</td></tr>
              ) : filteredUsers.map(user => {
                const online = isOnline(user);
                const url = avatarUrl(user.avatar);
                const initials = (user.first_name?.[0] || "") + (user.last_name?.[0] || "");
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold flex items-center justify-center overflow-hidden text-sm">
                            {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : initials}
                          </div>
                          {online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{user.first_name} {user.last_name}</div>
                          {user.last_login_city && <div className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{user.last_login_city}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{user.email}</td>
                    <td className="px-5 py-4">{roleBadge(user.role)}</td>
                    <td className="px-5 py-4">{statusBadge(user.status)}</td>
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {user.last_active_at ? online
                        ? <span className="text-green-600 font-semibold">En ligne</span>
                        : new Date(user.last_active_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Jamais"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => router.push(`/admin/users/detail?id=${user.id}`)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Voir le profil">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => { setBanTarget(user); setBanReason(""); setShowBanModal(true); }}
                          className={`p-1.5 rounded-lg transition-colors ${user.status === "inactive" ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50"}`}
                          title={user.status === "inactive" ? "Réactiver" : "Bannir"}>
                          <Ban size={15} />
                        </button>
                        <button onClick={() => { setDeleteTarget(user); setShowDeleteModal(true); }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Créer utilisateur ── */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouvel utilisateur</h2>
              <button onClick={() => setShowFormModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Prénom</label><input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Nom</label><input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Email</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Mot de passe *</label><input type="text" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls + " font-mono"} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Rôle</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                    <option value="parent">Parent</option><option value="child">Élève</option><option value="admin">Admin</option>
                  </select>
                </div>
                <div><label className={labelCls}>Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowFormModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button type="submit" disabled={submitting} className="px-7 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Ban / Unban ── */}
      {showBanModal && banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-gray-100 px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className={`text-xl font-bold font-[family-name:var(--font-display)] ${banTarget.status === "inactive" ? "text-green-600" : "text-orange-500"}`}>
                {banTarget.status === "inactive" ? "Réactiver le compte" : "Bannir l'utilisateur"}
              </h2>
              <button onClick={() => setShowBanModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">
                {banTarget.status === "inactive"
                  ? `Réactiver le compte de ${banTarget.first_name} ${banTarget.last_name} ?`
                  : `Suspendre le compte de ${banTarget.first_name} ${banTarget.last_name}. L'utilisateur recevra une notification.`}
              </p>
              {banTarget.status === "active" && (
                <div>
                  <label className={labelCls}>Raison (optionnel)</label>
                  <textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Expliquez la raison..." />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBanModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleBanConfirm} disabled={submitting}
                  className={`flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-xl transition-colors disabled:opacity-50 ${banTarget.status === "inactive" ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Ban size={15} />{banTarget.status === "inactive" ? "Réactiver" : "Bannir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Supprimer ── */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-gray-100 px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-red-600 font-[family-name:var(--font-display)]">Supprimer le compte</h2>
              <button onClick={() => setShowDeleteModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">
                Supprimer définitivement le compte de <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> ({deleteTarget.email}) ?
                <br /><span className="text-red-500 font-medium">Cette action est irréversible.</span>
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowDeleteModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleDeleteConfirm} disabled={submitting}
                  className="flex items-center gap-2 px-7 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}<Trash2 size={15} /> Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
