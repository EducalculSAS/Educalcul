"use client";
/* eslint-disable @next/next/no-img-element -- images à adresse libre ou data: saisies par l'admin (miniatures, aperçus, énoncés) : next/image ne peut pas les optimiser */

import Emblem3D from "@/components/Emblem3D";
import GlassCheckbox from "@/components/ui/GlassCheckbox";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, AlertCircle, Copy, Check } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { errMessage } from "@/lib/safeError";

/**
 * Popup obligatoire forçant tout admin sans TOTP configuré à en configurer
 * un avant de pouvoir continuer. Se ferme définitivement (plus jamais
 * affiché) une fois la config confirmée — pas de "plus tard".
 */
export default function AdminTotpSetupModal({ onComplete }: { onComplete?: () => void } = {}) {
  const [checked, setChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setChecked(true); return; }
        const res = await fetch("/api/auth/security/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && data.role === "admin" && !data.totpConfirmed) {
          setNeedsSetup(true);
        }
      } catch {
        // silencieux : mieux vaut ne pas bloquer l'admin si le check échoue
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  const startSetup = async () => {
    setLoadingSecret(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setSecret(data.secret);
      const dataUrl = await QRCode.toDataURL(data.otpauthUrl, { width: 220, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (err: unknown) {
      setError(errMessage(err) || "Une erreur est survenue.");
    } finally {
      setLoadingSecret(false);
    }
  };

  useEffect(() => {
    if (needsSetup && !secret) startSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSetup]);

  const confirmCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code incorrect.");
      // Jeton posé par le serveur via cookie httpOnly (Set-Cookie), rien à stocker ici.
      setBackupCodes(data.backupCodes || null);
    } catch (err: unknown) {
      setError(errMessage(err) || "Une erreur est survenue.");
    } finally {
      setConfirming(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!checked || !needsSetup) return null;

  if (backupCodes) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.55)" }}>
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 border border-[rgba(197,161,72,0.25)]">
          <div className="flex items-center gap-3 mb-2">
            <Emblem3D kind="key" size={40} float={false} className="shrink-0" />
            <h2 className="text-xl font-bold text-[var(--greek-blue)]">Codes de secours</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Note ces codes dans un endroit sûr. Chacun ne peut être utilisé qu&apos;une fois, pour te connecter si tu perds l&apos;accès à ton appareil.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5 p-4 rounded-lg bg-gray-50 border border-gray-200 font-mono text-sm text-gray-700">
            {backupCodes.map(c => <div key={c}>{c}</div>)}
          </div>
          <label className="flex items-center gap-2 mb-4 text-sm text-gray-600">
            <GlassCheckbox checked={savedBackupCodes} onChange={e => setSavedBackupCodes(e.target.checked)} />
            J&apos;ai noté ces codes dans un endroit sûr.
          </label>
          <GlassButton
            fullWidth
            size="sm"
            variant="navy"
            onClick={() => { setNeedsSetup(false); onComplete?.(); }}
            disabled={!savedBackupCodes}
          >
            Terminer
          </GlassButton>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.55)" }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 border border-[rgba(197,161,72,0.25)]">
        <div className="flex items-center gap-3 mb-2">
          <Emblem3D kind="shield" size={40} float={false} className="shrink-0" />
          <h2 className="text-xl font-bold text-[var(--greek-blue)]">Configure la 2FA</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Les comptes administrateur doivent utiliser une application d&apos;authentification (Google Authenticator, Authy…) pour se connecter.
        </p>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm font-medium bg-red-50 text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loadingSecret ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : qrDataUrl && secret ? (
          <>
            <div className="flex justify-center mb-4">
              <img src={qrDataUrl} alt="Code QR pour configurer l'application d'authentification" className="rounded-lg border border-[rgba(197,161,72,0.25)]" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-5 rounded-lg bg-gray-50 border border-gray-200">
              <code className="text-xs font-mono text-gray-600 break-all">{secret}</code>
              <GlassIconButton
                icon={copied ? Check : Copy}
                color={copied ? "green" : "navy"}
                size="sm"
                onClick={copySecret}
                aria-label="Copier le secret"
              />
            </div>

            <form onSubmit={confirmCode} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-lg text-center text-xl tracking-[0.4em] font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="000000"
                aria-label="Code à 6 chiffres"
                required
              />
              <GlassButton
                fullWidth
                size="sm"
                variant="navy"
                onClick={() => confirmCode()}
                disabled={confirming || code.length !== 6}
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer et activer"}
              </GlassButton>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
