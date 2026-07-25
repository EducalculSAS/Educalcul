"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import {
  User, Trophy, Shield, School, BookOpen, Mail,
  CheckCircle, AlertCircle, Trash2,
  Camera, Bell, Loader2, Brain,
} from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import { avatarUrl } from "@/lib/avatarUrl";
import { getNameColor } from "@/lib/badgeStyles";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getSimpleLevelLabel } from "@/lib/constants";
import TwoFactorToggle from "@/components/TwoFactorToggle";

const GoogleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function ChildProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [user, setUser]       = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1|2>(1);

  const [activities, setActivities] = useState<{ exercises: any[]; quizzes: any[]; courses: any[] }>({ exercises: [], quizzes: [], courses: [] });

  // Formulaires
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", avatar: "/avatars/avatar1.png" });
  const [notifications, setNotifications] = useState({ notif_weekly_reports: false, notif_offers_news: false });

  useEffect(() => {
    const load = async () => {
      const { data: { user: au } } = await supabase.auth.getUser();
      if (!au) { window.location.href = "/auth/connexion"; return; }
      setAuthUser(au);
      setGoogleLinked(!!au.identities?.some((id: any) => id.provider === "google"));

      const { data: userData }: any = await supabase.from("users").select(USER_SELECT_COLUMNS).eq("auth_id", au.id).maybeSingle();
      if (userData) {
        setUser(userData);
        setFormData({
          firstName: userData.first_name || "",
          lastName:  userData.last_name  || "",
          email:     userData.email      || au.email || "",
          avatar:    userData.avatar     || "/avatars/avatar1.png",
        });
        setNotifications({
          notif_weekly_reports: userData.notif_weekly_reports ?? false,
          notif_offers_news:    userData.notif_offers_news    ?? false,
        });

        // Activités
        try {
          const r = await fetch(`/api/child/activities?userId=${au.id}`);
          if (r.ok) setActivities(await r.json());
        } catch {}
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", e.target.files[0]);
      fd.append("folder", "uploads/avatars");
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setFormData(prev => ({ ...prev, avatar: d.url }));
      const { data: { user: au } } = await supabase.auth.getUser();
      if (au) await supabase.from("users").update({ avatar: d.url }).eq("auth_id", au.id);
      setMessage({ type: "success", text: "Photo mise à jour." });
    } catch { setMessage({ type: "error", text: "Erreur lors de l'upload." }); }
    finally { setSaving(false); }
  };

  const handleLinkGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch (err: any) { setMessage({ type: "error", text: err.message }); }
  };

  const handleUnlinkGoogle = async () => {
    try {
      const { data: { user: au } } = await supabase.auth.getUser();
      const identity = au?.identities?.find((id: any) => id.provider === "google");
      if (!identity) throw new Error("Aucun compte Google lié.");
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      setGoogleLinked(false);
      setMessage({ type: "success", text: "Compte Google délié." });
    } catch (err: any) { setMessage({ type: "error", text: err.message }); }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    setShowDeleteModal(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expirée");
      const r = await fetch("/api/parent/delete-account", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!r.ok) throw new Error((await r.json()).error);
      await supabase.auth.signOut();
      sessionStorage.clear(); localStorage.clear();
      window.location.href = "/";
    } catch (err: any) { setMessage({ type: "error", text: err.message }); setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><AppAdminLoader /></div>;
  if (!user)   return <div className="min-h-screen flex items-center justify-center"><p>Profil introuvable</p></div>;

  return (
    <>
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-2 flex items-center gap-4">
            <User className="w-10 h-10 text-[var(--greek-gold)]" />
            MON PROFIL
          </h1>
          <p className="opacity-70 text-sm">Gérez tes informations et ta progression</p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 max-w-5xl space-y-6">

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            {message.text}
            <button className="ml-auto font-bold text-lg leading-none" onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {/* ── Avatar + identité ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] overflow-hidden">
          <div className="h-24 bg-[var(--greek-blue)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 0,transparent 50%)", backgroundSize: "12px 12px" }} />
          </div>
          <div className="relative -mt-12 flex flex-col items-center gap-3 px-6 pb-6 text-center">
            <div className="relative">
              <AvatarWithBorder avatar={user.avatar} equippedBorder={user.equipped_border} name={user.first_name || "?"} size="xl" bgClass="transparent" circular />
              <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-110" style={{ background: "var(--greek-blue)" }}>
                <Camera className="w-4 h-4 text-white" />
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={saving} />
              </label>
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${getNameColor(user.name_color || "default").cls}`}>{user.first_name} {user.last_name}</h2>
              <p className="text-sm font-bold flex items-center justify-center gap-1.5" style={{ color: "var(--greek-gold)" }}>
                <Shield className="w-4 h-4" />{user.child_username}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats rapides ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: School,   label: "Niveau",       value: user.grade_level ? getSimpleLevelLabel(user.grade_level) : "—", color: "#3b82f6" },
            { icon: Trophy,   label: "Trophées",     value: "0",                    color: "var(--greek-gold)" },
            { icon: BookOpen, label: "Cours suivis", value: `${activities.courses.length}`, color: "#a855f7" },
            { icon: Brain,    label: "Exercices",    value: `${activities.exercises.length}`, color: "#10b981" },
          ].map(({ icon: Icon, label, value, color }, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-[rgba(197,161,72,0.2)] flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--greek-blue)" }}>{value}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {/* ── Infos personnelles ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              <User className="w-5 h-5 text-[var(--greek-gold)]" />
              Informations personnelles
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: "var(--greek-blue)" }}>Pseudo</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input type="text" value={user.child_username || ""} disabled
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none opacity-70 cursor-not-allowed"
                    style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: "var(--greek-blue)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input type="email" value={formData.email} disabled
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none opacity-70 cursor-not-allowed"
                    style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
          {/* ── Comptes liés ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              <Mail className="w-5 h-5 text-[var(--greek-gold)]" />
              Comptes liés
            </h2>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--greek-cream)", border: "1px solid rgba(197,161,72,0.2)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"><GoogleIcon /></div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>Google</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{googleLinked ? "Compte lié" : "Non lié"}</p>
                </div>
              </div>
              {googleLinked ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Lié</span>
                  <button onClick={handleUnlinkGoogle} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={handleLinkGoogle} className="text-xs font-bold px-4 py-2 rounded-xl border transition-all hover:opacity-80" style={{ borderColor: "rgba(197,161,72,0.3)", color: "var(--greek-blue)" }}>
                  Lier
                </button>
              )}
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              <Bell className="w-5 h-5 text-[var(--greek-gold)]" />
              Notifications
            </h2>
            <div className="space-y-4">
              {([
                { key: "notif_weekly_reports", label: "Rapports de progression",  desc: "Recevoir un résumé hebdomadaire" },
                { key: "notif_offers_news",    label: "Offres et nouveautés",      desc: "Actualités et promotions Educalcul" },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifications[key]}
                      onChange={async () => {
                        const upd = { ...notifications, [key]: !notifications[key] };
                        setNotifications(upd);
                        const { data: { user: au } } = await supabase.auth.getUser();
                        if (au) supabase.from("users").update({ [key]: upd[key] }).eq("auth_id", au.id).then(() => {});
                      }} />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--greek-blue)]" />
                  </label>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        <TwoFactorToggle />

        {/* ── Danger zone ── */}
        <div className="rounded-2xl p-6 border border-red-200 bg-red-50">
          <h2 className="text-base font-bold text-red-700 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Zone de danger</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-red-800 text-sm">Supprimer mon compte</p>
              <p className="text-xs text-red-600">Action irréversible — toutes tes données seront perdues.</p>
            </div>
            <button onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
              Supprimer mon compte
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modale suppression */}
    {showDeleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.5)", backdropFilter: "blur(4px)" }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-red-600 px-6 py-4 text-white">
            <h3 className="text-lg font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" />
              {deleteStep === 1 ? "Supprimer mon compte" : "Dernière confirmation"}
            </h3>
          </div>
          <div className="p-6">
            {deleteStep === 1 ? (
              <>
                <p className="text-gray-700 mb-4 text-sm">Es-tu sûr(e) de vouloir supprimer définitivement ton compte ?</p>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-1">
                  <p>• Toutes tes données de progression seront perdues</p>
                  <p>• Tes badges et trophées seront supprimés</p>
                  <p>• Cette action est irréversible</p>
                </div>
              </>
            ) : (
              <p className="text-gray-700 text-sm font-semibold">Es-tu absolument certain(e) ? Il n'y a aucun moyen de récupérer tes données.</p>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3 justify-end">
            <button onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }} className="px-5 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm font-semibold hover:bg-gray-50">Annuler</button>
            {deleteStep === 1 ? (
              <button onClick={() => setDeleteStep(2)} className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600">Continuer</button>
            ) : (
              <button onClick={handleDeleteAccount} disabled={saving} className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
