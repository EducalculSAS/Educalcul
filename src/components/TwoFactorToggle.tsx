"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Loader2, CheckCircle, AlertCircle } from "lucide-react";

/** Section "Authentification à deux facteurs" — utilisée dans les 3 pages profil. */
export default function TwoFactorToggle({ mandatory = false }: { mandatory?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
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

  const toggle = async () => {
    if (mandatory) return;
    setToggling(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/auth/2fa/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEnabled(!enabled);
      setMessage({ type: "success", text: !enabled ? "Authentification à deux facteurs activée." : "Authentification à deux facteurs désactivée." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Une erreur est survenue." });
    } finally {
      setToggling(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4" style={{ color: "var(--greek-blue)" }} />
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Authentification à deux facteurs</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {mandatory
          ? "Obligatoire pour les comptes administrateur : un code envoyé par email est requis à chaque nouvelle connexion (toutes les 4h)."
          : "Ajoute un code envoyé par email à chaque nouvelle connexion, en plus du mot de passe."}
      </p>

      {message && (
        <div className={`flex items-center gap-2 px-3 py-2 mb-3 rounded-xl text-xs font-semibold ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${enabled ? "text-green-700" : "text-gray-500"}`}>
          {enabled ? "Activée" : "Désactivée"}
        </span>
        {mandatory ? (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">Toujours activée</span>
        ) : (
          <button
            type="button"
            onClick={toggle}
            disabled={toggling}
            role="switch"
            aria-checked={enabled}
            className="relative w-12 h-6 rounded-full transition-colors disabled:opacity-50"
            style={{ background: enabled ? "var(--greek-blue)" : "#d1d5db" }}
          >
            {toggling ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            ) : (
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                style={{ left: enabled ? "calc(100% - 22px)" : "2px" }}
              />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
