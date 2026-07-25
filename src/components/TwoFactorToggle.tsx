"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Loader2, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import TwoFactorSessions from "@/components/TwoFactorSessions";

/** Section "Authentification à deux facteurs" — utilisée dans les 3 pages profil. */
export default function TwoFactorToggle({ mandatory = false }: { mandatory?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [pendingAction, setPendingAction] = useState<boolean | null>(null); // valeur cible (true = activer)
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("users").select("two_factor_enabled, role").eq("auth_id", user.id).maybeSingle();
      setEnabled(mandatory || !!data?.two_factor_enabled);
      setLoading(false);
    })();
  }, [mandatory]);

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
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Une erreur est survenue." });
    } finally {
      setSending(false);
    }
  };

  const startFlow = (target: boolean) => {
    if (mandatory) return;
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
      window.localStorage.setItem("edu_2fa_token", verifyData.token);

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
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Une erreur est survenue." });
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
          {mandatory ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">Toujours activée</span>
          ) : (
            <button
              type="button"
              onClick={() => startFlow(!enabled)}
              role="switch"
              aria-checked={enabled}
              className="relative w-12 h-6 rounded-full transition-colors bg-gray-300 data-[on=true]:bg-[var(--greek-blue)]"
              data-on={enabled}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                style={{ left: enabled ? "calc(100% - 22px)" : "2px" }}
              />
            </button>
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
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={cancelFlow}
              disabled={verifying}
              className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[var(--greek-gold)] transition-opacity disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" />
            {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : sending ? "Envoi…" : "Renvoyer le code"}
          </button>
        </form>
      )}

      <TwoFactorSessions />
    </div>
  );
}
