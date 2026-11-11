"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import LoaderDots from "@/components/LoaderDots";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import { ShieldCheck, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import TwoFactorSessions from "@/components/TwoFactorSessions";
import GlassButton from "@/components/ui/GlassButton";
import { errMessage } from "@/lib/safeError";

/** Section "Authentification à deux facteurs" — utilisée dans les 3 pages profil.
 * `mandatory` verrouille pour les comptes admin (TOTP toujours actif) ; pour un
 * compte enfant, le verrouillage vient plutôt de `two_factor_locked_by_parent`
 * en base — lu automatiquement ici, pas besoin de le passer en prop. */
export default function TwoFactorToggle({ mandatory = false }: { mandatory?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [lockedByParent, setLockedByParent] = useState(false);
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [pendingAction, setPendingAction] = useState<boolean | null>(null); // valeur cible (true = activer)
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getMyProfile<{ two_factor_enabled?: boolean; two_factor_locked_by_parent?: boolean }>();
      setEnabled(mandatory || !!data?.two_factor_enabled);
      setLockedByParent(!!data?.two_factor_locked_by_parent);
      setLoading(false);
    })();
  }, [mandatory]);

  const locked = mandatory || lockedByParent;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/auth/2fa/send-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le code.");
      setCooldown(60);
    } catch (err: unknown) {
      setMessage({ type: "error", text: errMessage(err) || "Une erreur est survenue." });
    } finally {
      setSending(false);
    }
  };

  const startFlow = (target: boolean) => {
    if (locked) return;
    setPendingAction(target);
    setStep("code");
    setCode("");
    setMessage(null);
    sendCode();
  };

  const cancelFlow = () => {
    setStep("idle");
    setPendingAction(null);
    setCode("");
    setMessage(null);
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction === null) return;
    setVerifying(true);
    setMessage(null);
    try {
      const verifyRes = await fetch("/api/auth/2fa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Code incorrect.");
      // Jeton posé par le serveur via cookie httpOnly (Set-Cookie), rien à stocker ici.

      const toggleRes = await fetch("/api/auth/2fa/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: pendingAction }),
      });
      const toggleData = await toggleRes.json();
      if (!toggleRes.ok) throw new Error(toggleData.error || "Erreur");

      setEnabled(pendingAction);
      setStep("idle");
      setPendingAction(null);
      setCode("");
      setMessage({ type: "success", text: pendingAction ? "Authentification à deux facteurs activée." : "Authentification à deux facteurs désactivée." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: errMessage(err) || "Une erreur est survenue." });
    } finally {
      setVerifying(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
        <ShieldCheck className="w-5 h-5 mr-2" />
        Authentification à deux facteurs
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        {mandatory
          ? "Obligatoire pour les comptes administrateur : un code envoyé par email est requis à chaque nouvelle connexion (toutes les 4h)."
          : lockedByParent
            ? "Activée et imposée par un parent : un code envoyé par email est requis à chaque connexion. Seul un parent peut la désactiver, depuis la fiche de ton compte."
            : "Ajoute un code envoyé par email à chaque nouvelle connexion, en plus du mot de passe."}
      </p>

      {message && (
        <div className={`flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {step === "idle" ? (
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${enabled ? "text-green-700" : "text-gray-500"}`}>
            {enabled ? "Activée" : "Désactivée"}
          </span>
          {locked ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">
              {mandatory ? "Toujours activée" : "Activée par un parent"}
            </span>
          ) : (
            <GlassSwitch checked={enabled} onChange={(next) => startFlow(next)} label="Double authentification" />
          )}
        </div>
      ) : (
        <form onSubmit={confirmCode} className="space-y-3">
          <p className="text-sm text-gray-600">
            Entre le code à 6 chiffres envoyé par email pour {pendingAction ? "activer" : "désactiver"} la 2FA.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-lg text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="000000"
            required
          />
          <div className="flex items-center gap-2">
            <GlassButton
              type="submit"
              variant="navy"
              size="sm"
              fullWidth
              disabled={verifying || code.length !== 6}
            >
              {verifying ? <LoaderDots /> : "Confirmer"}
            </GlassButton>
            <GlassButton
              onClick={cancelFlow}
              disabled={verifying}
              variant="ghost"
              size="sm"
            >
              Annuler
            </GlassButton>
          </div>
          <GlassButton
            onClick={sendCode}
            disabled={sending || cooldown > 0}
            variant="ghost"
            size="sm"
            fullWidth
          >
            <RotateCcw className="w-3 h-3" />
            {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : sending ? "Envoi…" : "Renvoyer le code"}
          </GlassButton>
        </form>
      )}

      <TwoFactorSessions />
    </div>
  );
}
