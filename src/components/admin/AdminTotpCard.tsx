"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, CheckCircle } from "lucide-react";

/** Carte "Authentification à deux facteurs" du profil admin — lecture seule. */
export default function AdminTotpCard() {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch("/api/auth/2fa/totp/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setConfirmed(!!data.confirmed);
      setLoading(false);
    })();
  }, []);

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
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold flex items-center gap-1.5 ${confirmed ? "text-green-700" : "text-gray-500"}`}>
          {confirmed && <CheckCircle className="w-4 h-4" />}
          {confirmed ? "Activée" : "Désactivée"}
        </span>
        {!confirmed && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">Configuration requise</span>
        )}
      </div>
    </div>
  );
}
