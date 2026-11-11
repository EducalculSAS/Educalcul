"use client";

import { useState } from "react";
import LoaderDots from "@/components/LoaderDots";
import { Mail } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import Emblem3D from "@/components/Emblem3D";
import { supabase } from "@/lib/supabaseClient";

/** Espace parent fermé tant que l'adresse e-mail n'est pas confirmée (voir src/lib/emailVerification.ts). */
export default function VerifyEmailGate({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    setState("sending");
    setMessage(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data?.alreadyVerified) { window.location.reload(); return; }
    if (res?.ok) { setState("sent"); return; }
    setState("error");
    setMessage(data?.error || "L'e-mail n'a pas pu être envoyé.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- déconnexion : rechargement complet pour repartir d'un état vide
    window.location.href = "/auth/connexion";
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-[var(--greek-cream)]">
      <div className="bg-white rounded-[20px] p-8 shadow-sm border border-[rgba(197,161,72,0.25)] max-w-lg w-full text-center">
        <div className="flex justify-center mb-4"><Emblem3D kind="mail" size={104} /></div>
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2">Confirmez votre adresse e-mail</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Nous avons envoyé un lien de confirmation à <strong className="text-[var(--greek-blue)]">{email}</strong>.
          Cliquez dessus pour ouvrir votre espace parent. Pensez à regarder dans les courriers indésirables.
        </p>
        {state === "sent" && <p role="status" className="mt-4 text-sm font-semibold text-green-700">Un nouveau lien vient de partir.</p>}
        {state === "error" && message && <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{message}</p>}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <GlassButton onClick={resend} variant="navy" disabled={state === "sending" || state === "sent"}>
            {state === "sending" ? <LoaderDots /> : <Mail className="w-4 h-4" />}
            Renvoyer le lien
          </GlassButton>
          <GlassButton onClick={logout} variant="ghost">Changer de compte</GlassButton>
        </div>
        <p className="text-xs text-gray-500 mt-6">Adresse erronée ? Créez un nouveau compte avec la bonne adresse, ou écrivez-nous à contact@educalcul.com.</p>
      </div>
    </div>
  );
}
