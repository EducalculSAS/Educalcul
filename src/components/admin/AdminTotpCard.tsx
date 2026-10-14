"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, CheckCircle, KeyRound, Loader2 } from "lucide-react";
import TwoFactorSessions from "@/components/TwoFactorSessions";
import { errMessage } from "@/lib/safeError";

/** Carte "Authentification à deux facteurs" du profil admin. */
export default function AdminTotpCard() {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch("/api/auth/security/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setConfirmed(!!data.totpConfirmed);
      if (data.totpConfirmed) {
        const bcRes = await fetch("/api/auth/2fa/totp/backup-codes");
        if (bcRes.ok) setRemaining((await bcRes.json()).remaining);
      }
      setLoading(false);
    })();
  }, []);

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/totp/backup-codes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setNewCodes(data.backupCodes);
      setRemaining(data.backupCodes.length);
    } catch (err: unknown) {
      setError(errMessage(err) || "Une erreur est survenue.");
    } finally {
      setRegenerating(false);
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
        Ajoute un code de vérification à chaque nouvelle connexion, en plus du mot de passe. Obligatoire pour les comptes administrateur.
      </p>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm font-semibold flex items-center gap-1.5 ${confirmed ? "text-green-700" : "text-gray-500"}`}>
          {confirmed && <CheckCircle className="w-4 h-4" />}
          {confirmed ? "Activée" : "Désactivée"}
        </span>
        {!confirmed && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">Configuration requise</span>
        )}
      </div>

      {confirmed && (
        <div className="pt-4 border-t border-[rgba(197,161,72,0.15)]">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {newCodes ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">Nouveaux codes de secours, note-les, les anciens ne fonctionnent plus :</p>
              <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200 font-mono text-xs text-gray-700">
                {newCodes.map(c => <div key={c}>{c}</div>)}
              </div>
              <button onClick={() => setNewCodes(null)} className="text-xs font-semibold text-[var(--greek-gold)]">J&apos;ai noté les codes</button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                {remaining ?? "…"} code(s) de secours restant(s)
              </span>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="text-xs font-semibold text-[var(--greek-blue)] hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                {regenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                Régénérer
              </button>
            </div>
          )}
        </div>
      )}

      <TwoFactorSessions />
    </div>
  );
}
