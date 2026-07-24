"use client";

import { useState, useEffect, useRef } from "react";
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
  LogOut,
  Phone,
} from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import { validatePassword } from "@/lib/validation";
import Image from "next/image";
import { avatarUrl } from "@/lib/avatarUrl";

export default function ParentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1|2>(1);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatar: "/avatars/avatar1.png",
  });

  const [notifications, setNotifications] = useState({
    notif_weekly_reports: true,
    notif_offers_news: false,
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/connexion");
        return;
      }

      const { data: profile, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, role, email, avatar, notif_weekly_reports, notif_offers_news")
        .eq("auth_id", user.id)
        .single();

      if (user) {
        const isGoogle = user.identities?.some(
          (id: any) => id.provider === "google"
        );
        setGoogleLinked(!!isGoogle);
      }

      if (error) {
        console.error("Error fetching profile:", error);
      } else if (profile) {
        if (profile.role !== "parent") {
          router.push("/dashboard");
          return;
        }
        setFormData({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || "", // email de public.users, pas l'email Google de auth.users
          phone: "",
          avatar: profile.avatar || "/avatars/avatar1.png",
        });
        setNotifications({
          notif_weekly_reports: profile.notif_weekly_reports ?? true,
          notif_offers_news: profile.notif_offers_news ?? false,
        });
      }
      // Vérifier abonnement actif + nb enfants (pour la modale de suppression)
      if (user && profile?.id) {
        const [subRes, childRes] = await Promise.all([
          // On passe par l'API qui synchronise cancel_at_period_end depuis Stripe
          // (évite le cas où l'user annule via le portail mais la DB n'est pas encore à jour)
          fetch(`/api/parent/subscription-details?userId=${user.id}`).then(r => r.json()).catch(() => ({})),
          supabase.from("users").select("id", { count: "exact", head: true }).eq("parent_id", profile.id).eq("role", "child"),
        ]);
        // Abonnement bloquant = existe, actif, non annulé
        const sub = subRes.subscription;
        setHasActiveSubscription(!!sub && sub.status === 'active' && !sub.cancel_at_period_end);
        setChildrenCount(childRes.count ?? 0);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    setSaving(true);
    try {
      // 1. Upload to Supabase Storage (if configured) or Local API
      // Using Local API for simplicity as per existing upload route
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("folder", "uploads/avatars");

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Upload failed");

      // 2. Update state
      setFormData({ ...formData, avatar: data.url });

      // 3. Update DB immediately for avatar
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("users")
          .update({ avatar: data.url })
          .eq("auth_id", user.id);
      }

      setMessage({ type: "success", text: "Photo de profil mise à jour." });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      setMessage({ type: "error", text: "Erreur lors de l'upload de la photo." });
    } finally {
      setSaving(false);
    }
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
      // Nettoyer tout le sessionStorage pour éviter les résidus lors d'une réinscription
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

      // Update public.users
      const { data: updatedUser, error: dbError } = await supabase
        .from("users")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          // phone_number: formData.phone, // Column does not exist yet
        })
        .eq("auth_id", user.id)
        .select();

      if (dbError) throw dbError;

      if (!updatedUser || updatedUser.length === 0) {
        throw new Error(
          "Aucune modification n'a été effectuée. Vérifiez vos droits d'accès."
        );
      }

      // Update auth.users email if changed (requires email confirmation usually)
      if (formData.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email,
        });
        if (authError) throw authError;
        // Email de sécurité : email modifié
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
      const { data, error } = await supabase.auth.linkIdentity({
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
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      // Email de sécurité : mot de passe modifié
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
      setPasswordData({ newPassword: "", confirmPassword: "" });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <User className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            MON PROFIL
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">COMPTE</span>
            <span>Gérez vos informations personnelles</span>
          </p>
        </div>
      </div>
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
        {/* Personal Info Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[rgba(197,161,72,0.25)] p-8">
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-6 pb-4 border-b border-[rgba(197,161,72,0.25)] flex items-center font-[family-name:var(--font-display)]">
            <User className="w-6 h-6 mr-3 text-[var(--greek-gold)]" />
            Informations Personnelles
          </h2>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-24 h-24 mb-3">
                <Image
                  src={avatarUrl(formData.avatar, "/avatars/avatar1.png")!}
                  alt="Avatar"
                  fill
                  className="rounded-full object-cover border-4 border-white shadow-md"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-[var(--greek-blue)] text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-blue-600 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={saving}
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500">Cliquez sur l'icône pour changer votre photo</p>
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
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-[var(--greek-blue)] transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Mettre à jour
              </button>
            </div>
          </form>
        </div>

        {/* Security Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
          <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Sécurité
          </h2>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
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
                placeholder="••••••"
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
                placeholder="••••••"
              />
            </div>

            <div className="pt-4 text-right">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-6 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-5 h-5 mr-2" />
                )}
                Changer le mot de passe
              </button>
            </div>
          </form>
        </div>

        {/* Linked Accounts Card */}
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
                <button
                  onClick={handleUnlinkGoogle}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Délier le compte"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLinkGoogle}
                className="px-4 py-2 bg-white border border-[rgba(197,161,72,0.25)] rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                Lier le compte
              </button>
            )}
          </div>
        </div>
        {/* Notification Preferences */}
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
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications[key]}
                    onChange={async () => {
                      const updated = { ...notifications, [key]: !notifications[key] };
                      setNotifications(updated);
                      const { data: { user: u } } = await supabase.auth.getUser();
                      if (u) {
                        supabase.from("users").update({ [key]: updated[key] }).eq("auth_id", u.id).then(() => {});
                      }
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[rgba(197,161,72,0.25)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--greek-blue)]"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
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
            <button
              onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }}
              className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium shadow-sm"
            >
              Supprimer mon compte
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
    {/* Modale suppression compte */}
    {showDeleteModal && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {hasActiveSubscription ? (
            /* ── Étape bloquante : abonnement actif ── */
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
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
                <a
                  href="/parent/subscription"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors"
                >
                  Gérer l'abonnement
                </a>
              </div>
            </>
          ) : (
            /* ── Étapes normales de suppression ── */
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
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                {deleteStep === 1 ? (
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Continuer
                  </button>
                ) : (
                  <button
                    onClick={handleDeleteAccount}
                    disabled={saving}
                    className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer définitivement
                  </button>
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



