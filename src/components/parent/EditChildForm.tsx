"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, UserCog, Save, Loader2, AlertCircle, CheckCircle, RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AVATARS } from "@/lib/constants";
import { isValidEmail } from "@/lib/validation";

interface InitialChild {
  id: string;
  parentId: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  gradeLevel: string;
  avatar: string;
  twoFactorEnabled: boolean;
}

/** Formulaire de modification d'un profil enfant : entièrement mutations
 * (édition + 2FA), isolé en client island. Les données initiales arrivent
 * déjà chargées du serveur (plus de spinner au montage). */
export default function EditChildForm({ initial }: { initial: InitialChild }) {
  const router = useRouter();
  const childId = initial.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(initial.twoFactorEnabled);
  const [twoFAStep, setTwoFAStep] = useState<"idle" | "code">("idle");
  const [twoFACode, setTwoFACode] = useState("");
  const [sendingTwoFACode, setSendingTwoFACode] = useState(false);
  const [twoFACooldown, setTwoFACooldown] = useState(0);
  const [togglingTwoFA, setTogglingTwoFA] = useState(false);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email,
    username: initial.username,
    password: "",
    gradeLevel: initial.gradeLevel,
    avatar: initial.avatar,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!isValidEmail(formData.email)) {
      setError("Adresse email invalide.");
      setSaving(false);
      return;
    }

    try {
      const updateData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        child_username: formData.username,
        avatar: formData.avatar,
      };

      const { error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", childId)
        .eq("parent_id", initial.parentId);

      if (updateError) throw updateError;

      const emailChanged = formData.email !== initial.email;
      if ((formData.password && formData.password.length > 0) || emailChanged) {
        const { data: { user } } = await supabase.auth.getUser();

        const response = await fetch("/api/update-child-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            childId,
            password: formData.password || undefined,
            newEmail: emailChanged ? formData.email : undefined,
            parentAuthId: user?.id,
          }),
        });

        const authResult = await response.json();
        if (!response.ok) {
          throw new Error(authResult.error || "Erreur lors de la mise à jour du compte.");
        }
      }

      setSuccess("Profil mis à jour avec succès !");
      setTimeout(() => {
        router.push("/parent/children");
      }, 1500);
    } catch (err: any) {
      console.error("Error updating child:", err);
      setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const sendTwoFACode = async () => {
    setSendingTwoFACode(true);
    setTwoFAError(null);
    try {
      const res = await fetch("/api/auth/2fa/send-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le code.");
      setTwoFACooldown(60);
    } catch (err: any) {
      setTwoFAError(err.message || "Une erreur est survenue.");
    } finally {
      setSendingTwoFACode(false);
    }
  };

  const startTwoFAFlow = () => {
    setTwoFAStep("code");
    setTwoFACode("");
    setTwoFAError(null);
    sendTwoFACode();
  };

  const cancelTwoFAFlow = () => {
    setTwoFAStep("idle");
    setTwoFACode("");
    setTwoFAError(null);
  };

  useEffect(() => {
    if (twoFACooldown <= 0) return;
    const t = setTimeout(() => setTwoFACooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [twoFACooldown]);

  const confirmTwoFAToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    setTogglingTwoFA(true);
    setTwoFAError(null);
    try {
      const verifyRes = await fetch("/api/auth/2fa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFACode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Code incorrect.");

      const toggleRes = await fetch("/api/parent/toggle-child-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, verificationToken: verifyData.token }),
      });
      const toggleData = await toggleRes.json();
      if (!toggleRes.ok) throw new Error(toggleData.error || "Erreur");

      setTwoFAEnabled(toggleData.enabled);
      setTwoFAStep("idle");
      setTwoFACode("");
    } catch (err: any) {
      setTwoFAError(err.message || "Une erreur est survenue.");
    } finally {
      setTogglingTwoFA(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Link href="/parent/children" className="inline-flex items-center gap-2 text-[var(--greek-blue)]/70 hover:text-[var(--greek-blue)] mb-6 transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> Mes enfants
      </Link>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <UserCog className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Modifier le Profil
        </h1>
        <p className="text-gray-600 text-lg">Mettez à jour les informations de {formData.firstName}</p>
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden p-8">
        <div>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center border border-red-200">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6 flex items-center border border-green-200">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  type="text" required value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text" required value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de l'enfant</label>
              <input
                type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
              />
              <p className="text-xs text-gray-500 mt-1">Utilisé pour la connexion et pour recevoir les notifications de l'enfant.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur (Pseudo)</label>
              <input
                type="text" disabled title="Le nom d'utilisateur ne peut pas être modifié" value={formData.username}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Le nom d'utilisateur ne peut pas être modifié.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe de connexion</label>
              <input
                type="password" placeholder="Laisser vide pour ne pas changer" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                aria-label="Nouveau mot de passe (laisser vide pour conserver l'actuel)"
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Remplissez ce champ pour définir ou modifier le mot de passe de l'enfant. Cela créera automatiquement l'accès si ce n'est pas déjà fait.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire</label>
              <input type="text" disabled value={formData.gradeLevel} className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">
                Le niveau scolaire passe automatiquement à la classe supérieure chaque année. En sortie de Seconde, un choix de spécialité est nécessaire et sera fait par un administrateur.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Avatar</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                {AVATARS.map((avatar) => (
                  <div
                    key={avatar}
                    onClick={() => setFormData({ ...formData, avatar })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFormData({ ...formData, avatar });
                      }
                    }}
                    className={`relative cursor-pointer rounded-full p-1 border-2 transition-all duration-200 ${
                      formData.avatar === avatar
                        ? "border-[var(--greek-gold)] scale-110 shadow-md"
                        : "border-transparent hover:border-[rgba(197,161,72,0.25)] hover:scale-105"
                    }`}
                  >
                    <Image src={`/avatars/${avatar}`} alt={`Avatar ${avatar}`} width={64} height={64} className="w-full h-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
              {twoFAStep === "idle" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Authentification à deux facteurs</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {twoFAEnabled ? "Activée" : "Désactivée"} — un code sera demandé par email à la connexion de l'enfant.
                    </p>
                  </div>
                  <button
                    type="button" onClick={startTwoFAFlow} role="switch" aria-checked={twoFAEnabled}
                    className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                    style={{ background: twoFAEnabled ? "var(--greek-blue)" : "#d1d5db" }}
                  >
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: twoFAEnabled ? "calc(100% - 22px)" : "2px" }} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Un code à 6 chiffres a été envoyé à ton adresse email (parent). Entre-le pour {twoFAEnabled ? "désactiver" : "activer"} la 2FA de {formData.firstName}.
                  </p>
                  {twoFAError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {twoFAError}
                    </div>
                  )}
                  <input
                    type="text" inputMode="numeric" maxLength={6} value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-lg text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="000000"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button" onClick={confirmTwoFAToggle} disabled={togglingTwoFA || twoFACode.length !== 6}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {togglingTwoFA ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
                    </button>
                    <button type="button" onClick={cancelTwoFAFlow} disabled={togglingTwoFA} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50">
                      Annuler
                    </button>
                  </div>
                  <button
                    type="button" onClick={sendTwoFACode} disabled={sendingTwoFACode || twoFACooldown > 0}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[var(--greek-gold)] transition-opacity disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {twoFACooldown > 0 ? `Renvoyer le code (${twoFACooldown}s)` : sendingTwoFACode ? "Envoi…" : "Renvoyer le code"}
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="flex items-center px-8 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-[#2c5282] transition-colors shadow-md font-bold disabled:opacity-70">
                {saving ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enregistrement...</>) : (<><Save className="w-5 h-5 mr-2" />Enregistrer les modifications</>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
