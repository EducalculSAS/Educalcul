"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import ThemeToggle from "@/components/ThemeToggle";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import AvatarPicker from "@/components/AvatarPicker";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  User,
  Lock,
  Mail,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
  Camera,
  Bell,
  Phone,
  Download,
} from "lucide-react";
import { validatePassword } from "@/lib/validation";
import { updateMyProfile } from "@/lib/updateMyProfile";
import TwoFactorToggle from "@/components/TwoFactorToggle";
import WebAuthnCard from "@/components/WebAuthnCard";
import UserSessionsList from "@/components/UserSessionsList";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

/** Réglages du profil parent : informations, sécurité, notifications, comptes
 * liés, export RGPD et suppression de compte — toutes des mutations, donc
 * client island. Les données initiales (profil, googleLinked, abonnement
 * actif, nombre d'enfants) arrivent déjà chargées du serveur. */
export default function ParentProfileSettings({
  initialFormData,
  equippedBorder = null,
  initialNotifications,
  initialGoogleLinked,
  initialHasActiveSubscription,
  initialChildrenCount,
}: {
  initialFormData: { firstName: string; lastName: string; email: string; phone: string; avatar: string };
  equippedBorder?: string | null;
  initialNotifications: { notif_weekly_reports: boolean; notif_offers_news: boolean };
  initialGoogleLinked: boolean;
  initialHasActiveSubscription: boolean;
  initialChildrenCount: number;
}) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [hasActiveSubscription] = useState(initialHasActiveSubscription);
  const [childrenCount] = useState(initialChildrenCount);
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(initialGoogleLinked);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState(initialFormData);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Uniquement les avatars proposés par le site (plus d'envoi de photo).
  const handleAvatarChange = async (avatar: string) => {
    const previous = formData.avatar;
    setFormData({ ...formData, avatar });
    setAvatarPickerOpen(false);
    const r = await updateMyProfile({ avatar });
    if (!r.ok) setFormData((f) => ({ ...f, avatar: previous }));
    setMessage(r.ok ? { type: "success", text: "Avatar mis à jour." } : { type: "error", text: r.error || "Échec de la mise à jour." });
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    setShowDeleteModal(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expirée");

      const response = await fetch("/api/parent/delete-account", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erreur lors de la suppression");

      await supabase.auth.signOut();
      sessionStorage.clear();
      localStorage.clear();
      router.push("/");
    } catch (error: any) {
      console.error("Delete account error:", error);
      setMessage({ type: "error", text: error.message || "Erreur lors de la suppression." });
      setSaving(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { ok, error: dbError } = await updateMyProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
      });
      if (!ok) throw new Error(dbError || "Aucune modification n'a été effectuée.");

      if (formData.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email,
        });
        if (authError) throw authError;
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (sess) {
          fetch("/api/auth/security-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.access_token}` },
            body: JSON.stringify({ event: "email_changed", newEmail: formData.email }),
          }).catch(console.error);
        }
        setMessage({
          type: "success",
          text: "Profil mis à jour. Vérifiez votre nouvelle adresse email.",
        });
      } else {
        setMessage({ type: "success", text: "Profil mis à jour avec succès." });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLinkGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la liaison avec Google.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Non connecté");

      const identity = user.identities?.find((id: any) => id.provider === "google");

      if (!identity) {
        throw new Error("Aucun compte Google lié trouvé.");
      }

      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;

      setGoogleLinked(false);
      setMessage({
        type: "success",
        text: "Compte Google délié avec succès.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la dissociation du compte.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!passwordData.currentPassword) {
      setMessage({ type: "error", text: "Entrez votre mot de passe actuel." });
      setSaving(false);
      return;
    }

    const pwError = validatePassword(passwordData.newPassword);
    if (pwError) {
      setMessage({ type: "error", text: pwError });
      setSaving(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({
        type: "error",
        text: "Les mots de passe ne correspondent pas.",
      });
      setSaving(false);
      return;
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) throw new Error("Session invalide.");

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: passwordData.currentPassword,
      });
      if (verifyError) {
        setMessage({ type: "error", text: "Mot de passe actuel incorrect." });
        setSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch("/api/auth/security-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ event: "password_changed" }),
        }).catch(console.error);
      }

      setMessage({
        type: "success",
        text: "Mot de passe mis à jour avec succès.",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour du mot de passe.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 pb-12 max-w-4xl">
        {message && (
          <div
            className={`mb-8 p-4 rounded-xl shadow-sm flex items-center ${message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
              }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-6 h-6 mr-3" />
            ) : (
              <AlertCircle className="w-6 h-6 mr-3" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[rgba(197,161,72,0.25)] p-8">
            <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-6 pb-4 border-b border-[rgba(197,161,72,0.25)] flex items-center font-[family-name:var(--font-display)]">
              <User className="w-6 h-6 mr-3 text-[var(--greek-gold)]" />
              Informations Personnelles
            </h2>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-3">
                  <AvatarWithBorder
                    avatar={formData.avatar}
                    equippedBorder={equippedBorder}
                    name={`${formData.firstName} ${formData.lastName}`}
                    size="xl"
                  />
                  <span className="absolute -bottom-1 -right-1">
                    <GlassIconButton
                      icon={Camera}
                      color="navy"
                      onClick={() => setAvatarPickerOpen((v) => !v)}
                      aria-label="Choisir un avatar"
                    />
                  </span>
                </div>
                {avatarPickerOpen ? (
                  <div className="w-full mt-2">
                    <AvatarPicker value={formData.avatar} onChange={handleAvatarChange} disabled={saving} columns={4} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Touchez l&apos;icône pour choisir un avatar</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone (Optionnel)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full pl-10 pr-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Utilisé pour la connexion et les notifications.
                </p>
              </div>

              <div className="pt-2 text-right">
                <GlassButton
                  type="submit"
                  variant="navy"
                  size="sm"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Mettre à jour
                </GlassButton>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
              <Lock className="w-5 h-5 mr-2" />
              Sécurité
            </h2>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Votre mot de passe actuel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Au moins 10 caractères"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Retapez le nouveau mot de passe"
                />
              </div>

              <div className="pt-4 text-right">
                <GlassButton
                  type="submit"
                  variant="navy"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                  Changer le mot de passe
                </GlassButton>
              </div>
            </form>
          </div>

          <TwoFactorToggle />

          <WebAuthnCard />

          <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
            <UserSessionsList />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </h2>

            <div className="space-y-4">
              {([
                { key: "notif_weekly_reports", label: "Rapports hebdomadaires", desc: "Recevoir le résumé des progrès de vos enfants" },
                { key: "notif_offers_news", label: "Offres et nouveautés", desc: "Recevoir nos actualités et promotions" },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                  <GlassSwitch
                    checked={notifications[key]}
                    label={label}
                    onChange={(next) => {
                      setNotifications({ ...notifications, [key]: next });
                      void updateMyProfile({ [key]: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <ThemeToggle />

          <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Comptes liés
            </h2>

            <div className="flex items-center justify-between p-4 border border-[rgba(197,161,72,0.25)] rounded-lg bg-gray-50">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mr-4">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Google</p>
                  <p className="text-sm text-gray-500">
                    {googleLinked
                      ? "Votre compte est lié à Google"
                      : "Lier votre compte Google pour vous connecter plus facilement"}
                  </p>
                </div>
              </div>
              {googleLinked ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Lié
                  </span>
                  <GlassIconButton
                    icon={Trash2}
                    onClick={handleUnlinkGoogle}
                    color="red"
                    size="sm"
                    aria-label="Délier le compte Google"
                  />
                </div>
              ) : (
                <GlassButton onClick={handleLinkGoogle} variant="outline" size="sm">
                  Lier le compte
                </GlassButton>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center">
              <Download className="w-5 h-5 mr-2" />
              Mes données
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-600">Reçois par email un lien pour télécharger une copie de tes données et de celles de tes enfants (format JSON, lien valable 24h).</p>
              <GlassButton
                onClick={async () => {
                  setExportingData(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    const res = await fetch("/api/parent/export-data", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    setMessage({ type: "success", text: "Un email avec le lien de téléchargement vient de t'être envoyé." });
                  } catch (err: any) {
                    setMessage({ type: "error", text: err.message || "Erreur lors de l'envoi." });
                  } finally {
                    setExportingData(false);
                  }
                }}
                variant="navy"
                size="sm"
                disabled={exportingData}
                className="shrink-0"
              >
                {exportingData ? "Envoi..." : "Demander mes données"}
              </GlassButton>
            </div>
          </div>

          <div className="bg-red-50 rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6 md:col-span-2 mt-4">
            <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Zone de danger
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-medium text-red-800">Supprimer mon compte</p>
                <p className="text-sm text-red-600">Cette action est irréversible et supprimera toutes vos données.</p>
              </div>
              <GlassButton onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }} variant="danger" size="sm">
                Supprimer mon compte
              </GlassButton>
            </div>
          </div>
        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {hasActiveSubscription ? (
              <>
                <div className="bg-amber-500 px-6 py-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Action requise
                  </h3>
                </div>
                <div className="px-6 py-6">
                  <p className="text-gray-700 mb-4 font-semibold">
                    Vous avez un abonnement actif.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    Vous devez d'abord <strong>annuler votre abonnement</strong> depuis la page Abonnement avant de pouvoir supprimer votre compte.
                  </div>
                </div>
                <div className="px-6 pb-6 flex gap-3 justify-end">
                  <GlassButton onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }} variant="ghost" size="sm">
                    Fermer
                  </GlassButton>
                  <GlassButton href="/parent/subscription" variant="navy" size="sm">
                    Gérer l'abonnement
                  </GlassButton>
                </div>
              </>
            ) : (
              <>
                <div className="bg-red-600 px-6 py-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {deleteStep === 1 ? "Supprimer mon compte" : "Dernière confirmation"}
                  </h3>
                </div>
                <div className="px-6 py-6">
                  {deleteStep === 1 ? (
                    <>
                      <p className="text-gray-700 mb-4">
                        Êtes-vous sûr de vouloir supprimer définitivement votre compte ?
                      </p>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1.5">
                        <p>• Votre compte parent sera supprimé</p>
                        {childrenCount > 0 && (
                          <p className="font-semibold">• {childrenCount} compte{childrenCount > 1 ? "s" : ""} enfant{childrenCount > 1 ? "s" : ""} associé{childrenCount > 1 ? "s" : ""} sera{childrenCount > 1 ? "ont" : ""} supprimé{childrenCount > 1 ? "s" : ""}</p>
                        )}
                        <p>• Toutes les données de progression seront perdues</p>
                        <p>• Cette action est irréversible</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-700 mb-3 font-semibold">
                        Cette action est irréversible. Êtes-vous absolument certain ?
                      </p>
                      {childrenCount > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-3">
                          Les {childrenCount} compte{childrenCount > 1 ? "s" : ""} enfant{childrenCount > 1 ? "s" : ""} seront définitivement supprimés.
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        Il n'y a aucun moyen de récupérer vos données après la suppression.
                      </p>
                    </>
                  )}
                </div>
                <div className="px-6 pb-6 flex gap-3 justify-end">
                  <GlassButton onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }} variant="ghost" size="sm">
                    Annuler
                  </GlassButton>
                  {deleteStep === 1 ? (
                    <GlassButton onClick={() => setDeleteStep(2)} variant="danger" size="sm">
                      Continuer
                    </GlassButton>
                  ) : (
                    <GlassButton
                      onClick={handleDeleteAccount}
                      variant="danger"
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Supprimer définitivement
                    </GlassButton>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
