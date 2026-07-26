"use client";

import { useEffect, useRef, useState } from "react";
import { UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Espace élève/parent : une session qui a traîné trop longtemps dans l'onglet
 * ne doit jamais déconnecter de force au milieu d'une action (contrairement à
 * l'admin, voir supabaseClient.ts). On se contente de vérifier la présence de
 * l'utilisateur et de rafraîchir la session Supabase en arrière-plan.
 */
export default function SessionStillHereModal() {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastShownRef = useRef(0);

  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      // Évite d'ouvrir la modale en rafale si plusieurs appels échouent à la suite.
      if (now - lastShownRef.current < 30_000) return;
      lastShownRef.current = now;
      setOpen(true);
    };
    window.addEventListener("edu:session-check-needed", handler);
    return () => window.removeEventListener("edu:session-check-needed", handler);
  }, []);

  const confirmStillHere = async () => {
    setRefreshing(true);
    try {
      await supabase.auth.refreshSession();
    } finally {
      setRefreshing(false);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-[var(--greek-blue)]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Toujours là ?</h2>
          <p className="text-sm text-slate-600">
            Ta session est restée ouverte un moment. Confirme que tu es toujours là pour continuer.
          </p>
          <button
            type="button"
            onClick={confirmStillHere}
            disabled={refreshing}
            className="mt-2 w-full rounded-full bg-[var(--greek-blue)] text-white font-semibold py-2.5 disabled:opacity-60"
          >
            {refreshing ? "Un instant..." : "Oui, je suis toujours là"}
          </button>
        </div>
      </div>
    </div>
  );
}
