"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import AvatarPicker from "@/components/AvatarPicker";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  ArrowLeft, UserCog, Save, Loader2, AlertCircle, CheckCircle, RotateCcw,
  Fingerprint, Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";
import { AVATARS, getLevelLabel } from "@/lib/constants";
import { EXPERTES_LEVEL, PREMIERE_TRACKS, TERMINALE_TRACKS, hasSpecialtyChoice, isTerminale } from "@/lib/specialties";
import { isValidEmail } from "@/lib/validation";
import GlassButton from "@/components/ui/GlassButton";
import LevelRequestCard from "@/components/parent/LevelRequestCard";

interface WebauthnCredential {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface InitialChild {
  id: string;
  parentId: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  gradeLevel: string;
  extraLevels: string[];
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

  const [webauthnCreds, setWebauthnCreds] = useState<WebauthnCredential[]>([]);
  const [webauthnLoading, setWebauthnLoading] = useState(true);
  const [webauthnRegistering, setWebauthnRegistering] = useState(false);
  const [webauthnRemovingId, setWebauthnRemovingId] = useState<string | null>(null);
  const [webauthnError, setWebauthnError] = useState<string | null>(null);
  const [webauthnSupported, setWebauthnSupported] = useState(true);

  const [formData, setFormData] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email,
    username: initial.username,
    password: "",
    gradeLevel: initial.gradeLevel,
    avatar: initial.avatar,
  });
  // Voie en maths au lycée : la classe principale (spé, sans spé, complémentaires…)
  // et l'option maths expertes, qui s'ajoute à la spé maths de Terminale.
  const lycee = hasSpecialtyChoice(initial.gradeLevel);
  const [track, setTrack] = useState(initial.gradeLevel === EXPERTES_LEVEL ? "terminale-generale-maths" : initial.gradeLevel);
  const [expertes, setExpertes] = useState(initial.gradeLevel === EXPERTES_LEVEL || initial.extraLevels.includes(EXPERTES_LEVEL));
  const trackOptions = isTerminale(initial.gradeLevel) ? TERMINALE_TRACKS : PREMIERE_TRACKS;

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
      const res = await fetch("/api/parent/edit-child", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          child_username: formData.username,
          avatar: formData.avatar,
          ...(lycee ? { specialties: { track, expertes: track === "terminale-generale-maths" && expertes } } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Modification impossible");
      }

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

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const refetchWebauthn = async () => {
    const res = await fetch(`/api/parent/child-webauthn?childId=${childId}`, { headers: await authHeader() });
    const data = await res.json();
    if (res.ok) setWebauthnCreds(data.credentials || []);
  };

  useEffect(() => {
    setWebauthnSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
    refetchWebauthn().finally(() => setWebauthnLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enregistre une clé d'accès pour l'enfant — la cérémonie s'exécute sur
  // l'appareil qui tient cette page à cet instant : à faire depuis
  // l'appareil que l'enfant utilise réellement pour se connecter.
  const enableWebauthn = async () => {
    setWebauthnError(null);
    setWebauthnRegistering(true);
    try {
      const optionsRes = await fetch("/api/parent/child-webauthn", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ childId, action: "options" }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || "Erreur");

      const attResp = await startRegistration({ optionsJSON: options });

      const deviceLabel =
        typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent)
          ? "iPhone/iPad"
          : typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
            ? "Android"
            : typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent)
              ? "Mac"
              : "Cet appareil";

      const verifyRes = await fetch("/api/parent/child-webauthn", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ childId, action: "verify", response: attResp, deviceLabel }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) throw new Error(verifyData.error || "Vérification échouée");

      await refetchWebauthn();
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        setWebauthnError(err?.message || "Une erreur est survenue.");
      }
    } finally {
      setWebauthnRegistering(false);
    }
  };

  const removeWebauthn = async (credentialId: string) => {
    setWebauthnRemovingId(credentialId);
    setWebauthnError(null);
    try {
      const res = await fetch("/api/parent/child-webauthn", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ childId, credentialId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      setWebauthnCreds((prev) => prev.filter((c) => c.id !== credentialId));
    } catch (err: any) {
      setWebauthnError(err?.message || "Une erreur est survenue.");
    } finally {
      setWebauthnRemovingId(null);
    }
  };

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
      <div className="mb-6">
        <GlassButton href="/parent/children" variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4" /> Mes enfants
        </GlassButton>
      </div>
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
              <input type="text" disabled value={getLevelLabel(formData.gradeLevel)} className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">
                La classe passe automatiquement à la suivante chaque année. En sortie de Seconde et à l&apos;entrée en Terminale, votre enfant choisit ses maths à sa connexion.
              </p>
              {lycee && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Maths au lycée</p>
                  <div className="flex flex-wrap gap-2">
                    {trackOptions.map((t) => (
                      <GlassButton
                        key={t.level}
                        size="sm"
                        variant={track === t.level ? "navy" : "outline"}
                        onClick={() => setTrack(t.level)}
                      >
                        {t.label}
                      </GlassButton>
                    ))}
                  </div>
                  {track === "terminale-generale-maths" && (
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(197,161,72,0.25)] px-4 py-3 cursor-pointer">
                      <span className="text-sm text-gray-700">Option maths expertes (en plus de la spécialité)</span>
                      <GlassSwitch checked={expertes} onChange={setExpertes} label="Option maths expertes" />
                    </label>
                  )}
                </div>
              )}
              <div className="mt-4">
                <LevelRequestCard childId={childId} childName={initial.firstName} gradeLevel={initial.gradeLevel} extraLevels={initial.extraLevels} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Avatar</label>
              <AvatarPicker value={formData.avatar} onChange={(avatar) => setFormData({ ...formData, avatar })} />
            </div>

            <div className="p-4 border border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
              {twoFAStep === "idle" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Authentification à deux facteurs</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {twoFAEnabled
                        ? "Activée et imposée par toi, un code par email est requis à chaque connexion, et l'enfant ne peut pas la désactiver lui-même."
                        : "Désactivée, l'enfant peut choisir de l'activer lui-même depuis son propre profil."}
                    </p>
                  </div>
                  <GlassSwitch checked={twoFAEnabled} onChange={() => startTwoFAFlow()} label="Double authentification" />
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
                    <div className="flex-1">
                      <GlassButton
                        onClick={() => confirmTwoFAToggle({ preventDefault: () => {} } as unknown as React.FormEvent)}
                        variant="navy"
                        fullWidth
                        disabled={togglingTwoFA || twoFACode.length !== 6}
                      >
                        {togglingTwoFA ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
                      </GlassButton>
                    </div>
                    <GlassButton onClick={cancelTwoFAFlow} disabled={togglingTwoFA} variant="ghost" size="sm">
                      Annuler
                    </GlassButton>
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

            {!webauthnLoading && (
              <div className="p-4 border border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4" />
                    Clé d&apos;accès (empreinte / Face ID)
                  </p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${webauthnCreds.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                    {webauthnCreds.length > 0 ? "Activée" : "Désactivée"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  À faire depuis l&apos;appareil que {formData.firstName} utilise pour se connecter : clique sur
                  « Ajouter », puis confirme avec l&apos;empreinte, Face ID ou le code de cet appareil.
                </p>

                {!webauthnSupported && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                    Cet appareil ou ce navigateur ne prend pas en charge les clés d&apos;accès.
                  </p>
                )}
                {webauthnError && <p className="text-xs text-red-600 mb-2">{webauthnError}</p>}

                {webauthnCreds.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {webauthnCreds.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-gray-700">{c.device_label || "Appareil"}</p>
                          <p className="text-xs text-gray-400">
                            Ajoutée le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                            {c.last_used_at ? ` · utilisée le ${new Date(c.last_used_at).toLocaleDateString("fr-FR")}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWebauthn(c.id)}
                          disabled={webauthnRemovingId === c.id}
                          aria-label="Supprimer cette clé"
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {webauthnRemovingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={enableWebauthn}
                  disabled={!webauthnSupported || webauthnRegistering}
                  className="text-xs font-semibold text-[var(--greek-blue)] hover:underline disabled:opacity-50"
                >
                  {webauthnRegistering ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : `+ Ajouter ${webauthnCreds.length > 0 ? "un autre appareil" : "une clé d'accès"}`}
                </button>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <GlassButton
                type="submit"
                variant="navy"
                disabled={saving}
              >
                {saving ? (<><Loader2 className="w-5 h-5 animate-spin" />Enregistrement...</>) : (<><Save className="w-5 h-5" />Enregistrer les modifications</>)}
              </GlassButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
