"use client";

import AvatarWithBorder from "@/components/AvatarWithBorder";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import { User, Save, Eye, Crown, Shield, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminTotpCard from "@/components/admin/AdminTotpCard";
import WebAuthnCard from "@/components/WebAuthnCard";
import ThemeToggle from "@/components/ThemeToggle";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { errMessage } from "@/lib/safeError";
import { getNameColor } from "@/lib/badgeStyles";

const ADMIN_AVATAR = "/logo.png";

/** Profil public admin : les données initiales arrivent déjà chargées du
 * serveur ; la sauvegarde reste un aller-retour client, comme avant. */
export default function AdminProfileClient({ initialFormData }: {
  initialFormData: {
    first_name: string;
    last_name: string;
    child_username: string;
    email: string;
    avatar: string;
    equipped_border: string;
    name_color: string;
  };
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const refetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const data = await getMyProfile<{ first_name?: string; last_name?: string; child_username?: string; email?: string; equipped_border?: string; name_color?: string }>();
    if (data) {
      setFormData((prev) => ({
        ...prev,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        child_username: data.child_username || "",
        email: data.email || session.user.email || "",
        equipped_border: data.equipped_border || "none",
        name_color: data.name_color || "default",
      }));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_id: session.user.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          child_username: formData.child_username,
          email: formData.email,
        }),
      });

      const result = await response.json();

      if (!response.ok)
        throw new Error(result.error || "Failed to update profile");

      setMessage({ text: "Profil public mis à jour avec succès !", type: "success" });
      refetchProfile();
    } catch (error: unknown) {
      console.error("Error updating profile:", error);
      setMessage({
        text: errMessage(error) || "Erreur lors de la mise à jour.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="mb-8">
        <AdminPageHeader
          icon={Crown}
          title="Mon Profil Admin"
          subtitle="Gérez votre apparence publique sur la plateforme."
        />
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-xl shadow-sm ${message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
            } flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 font-medium">
            {message.type === "success" ? (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500" />
            )}
            {message.text}
          </span>
          <GlassIconButton
            icon={X}
            onClick={() => setMessage(null)}
            color="gray"
            size="sm"
            aria-label="Fermer"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column - Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info Card */}
          <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
            <div className="bg-[var(--greek-blue)]/5 px-8 py-6 border-b border-[rgba(197,161,72,0.25)] flex items-center gap-3">
              <User className="text-[var(--greek-blue)]" size={24} />
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                Profil public
              </h2>
            </div>
            <div className="p-8">
              <form onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pseudo public *
                    </label>
                    <input
                      type="text"
                      value={formData.child_username}
                      onChange={(e) =>
                        setFormData({ ...formData, child_username: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all font-bold"
                      placeholder="Ex: Admin Educalcul"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email de Contact
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50 text-gray-400 outline-none cursor-not-allowed"
                      disabled
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                  Les contours et les titres s&apos;obtiennent comme pour tout le monde (missions ou abonnement) et se choisissent dans{" "}
                  <a href="/child/badges" className="font-semibold text-[var(--greek-blue)] underline">Mes trophées</a>.
                  Il n&apos;existe aucun contour ni titre réservé aux administrateurs.
                </p>

                <GlassButton
                  size="sm"
                  variant="navy"
                  disabled={saving}
                  type="submit"
                >
                  <Save size={20} />
                  {saving ? "Enregistrement..." : "Sauvegarder"}
                </GlassButton>
              </form>
            </div>
          </div>

          <div className="mt-6">
            <ThemeToggle />
          </div>

          <div className="mt-6">
            <AdminTotpCard />
          </div>

          <div className="mt-6">
            <WebAuthnCard />
          </div>
        </div>

        {/* Sidebar - Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white/95 border-2 border-[var(--greek-gold)] rounded-2xl shadow-xl overflow-hidden sticky top-6">
            <div className="bg-[var(--greek-cream)] border-b-2 border-[var(--greek-gold)] p-4 font-serif font-bold text-[var(--greek-bronze)] flex items-center gap-2 text-xl">
              <Eye size={20} />
              Aperçu du Profil
            </div>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-8 relative">
                <AvatarWithBorder
                  avatar={ADMIN_AVATAR}
                  equippedBorder={formData.equipped_border}
                  name={formData.child_username || "Admin"}
                  size="2xl"
                />
              </div>

              <h4
                className={`text-2xl mb-4 transition-all duration-300 font-bold ${getNameColor(formData.name_color).cls}`}
              >
                {formData.child_username || "Pseudo admin"}
              </h4>

              <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--greek-gold)] rounded-lg bg-[var(--greek-cream)] shadow-sm">
                <Shield className="text-[var(--greek-blue)] w-5 h-5" />
                <span className="font-serif font-bold text-[var(--greek-bronze)] text-sm">
                  Administrateur
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
