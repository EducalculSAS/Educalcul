"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { trackLogout } from "@/lib/trackLogout";
import GlassButton from "@/components/ui/GlassButton";

/**
 * Déconnexion sur inactivité (espace élève/parent).
 *  - < IDLE_WARN_MS d'inactivité réelle (souris / clavier / scroll / tactile) :
 *    rien.
 *  - IDLE_WARN_MS : une modale de prévenance s'ouvre, avec un compte à rebours.
 *  - IDLE_LOGOUT_MS : déconnexion + retour à la page de connexion.
 * Toute interaction avant la déconnexion réarme le minuteur et ferme la modale.
 */
const IDLE_WARN_MS = 14 * 60 * 1000; // 14 min → prévenance
const IDLE_LOGOUT_MS = 15 * 60 * 1000; // 15 min → déconnexion

export default function SessionStillHereModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const doLogout = useCallback(async () => {
    try {
      await trackLogout();
      await supabase.auth.signOut();
    } catch {
      /* on redirige quoi qu'il arrive */
    }
    router.replace("/auth/connexion?reason=timeout");
  }, [router]);

  const armTimers = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(countdownTimer.current);
    setOpen(false);

    warnTimer.current = setTimeout(() => {
      setSecondsLeft(Math.round((IDLE_LOGOUT_MS - IDLE_WARN_MS) / 1000));
      setOpen(true);
      countdownTimer.current = setInterval(() => {
        setSecondsLeft((s) => (s > 1 ? s - 1 : 0));
      }, 1000);
    }, IDLE_WARN_MS);

    logoutTimer.current = setTimeout(doLogout, IDLE_LOGOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    armTimers();
    const reset = () => armTimers();
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimeout(warnTimer.current);
      clearTimeout(logoutTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [armTimers]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 modal-overlay">
      <div className="rounded-2xl shadow-2xl w-full max-w-sm border border-[rgba(197,161,72,0.3)] overflow-hidden bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4]">
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-[var(--greek-blue)]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Toujours là ?</h2>
          <p className="text-sm text-slate-600">
            Tu seras déconnecté dans <span className="font-bold text-[var(--greek-blue)]">{secondsLeft}s</span> par
            inactivité. Bouge la souris ou clique pour rester connecté.
          </p>
          <GlassButton onClick={armTimers} variant="navy" fullWidth className="mt-2">
            Je suis toujours là
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
