"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, AlertCircle, RotateCcw } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { safeRedirectPath } from "@/lib/safeRedirect";

function TwoFactorVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Filtré : jamais une URL externe ni un schéma javascript: (voir safeRedirect.ts).
  const redirect = safeRedirectPath(searchParams.get("redirect"));

  const [method, setMethod] = useState<"email" | "totp" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  const sendCode = async (knownToken?: string) => {
    setSending(true);
    setError(null);
    try {
      let token = knownToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/auth/connexion"); return; }
        token = session.access_token;
      }
      const res = await fetch("/api/auth/2fa/send-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le code.");
      setSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  };

  // Décoy pour les comptes admin (2FA par application, jamais par email) :
  // l'écran doit rester indiscernable du flux email pour quiconque tenterait
  // de se connecter à un compte admin — aucun email n'est réellement envoyé.
  const fakeResend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setCooldown(60);
    }, 600);
  };

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }
      const res = await fetch("/api/auth/security/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && data.role === "admin" && data.totpConfirmed) {
        setMethod("totp");
        setSent(true); // pas d'envoi réel, mais l'écran reste identique au flux email
      } else {
        setMethod("email");
        // Réutilise le jeton déjà lu : un second getSession() rallongeait
        // l'attente avant l'envoi de l'email.
        void sendCode(session.access_token);
      }
    })();
    // Précharge la page d'arrivée pendant que l'élève lit son code.
    router.prefetch(redirect);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }
      const endpoint = method === "totp" ? "/api/auth/2fa/totp/verify" : "/api/auth/2fa/verify-code";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code incorrect.");
      // Le serveur pose désormais le jeton 2FA lui-même via un cookie
      // httpOnly (Set-Cookie sur cette même réponse) — rien à stocker ici.
      // Navigation complète (pas router.push) : le Router Cache de Next.js
      // peut avoir mis en cache /admin/dashboard depuis avant la validation
      // 2FA (ex: tentative précédente), et le resservir tel quel sans
      // relire le cookie edu_2fa qu'on vient de poser — l'admin retombait
      // alors en boucle sur cette page malgré un code correct.
      //
      // Le bouton RESTE en chargement jusqu'à l'affichage de la page : le
      // relâcher dans un `finally` laissait un écran figé et un bouton
      // inactif pendant le rechargement — c'était le « gel » après la 2FA.
      window.location.replace(redirect);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(197,161,72,0.12)" }}>
          <ShieldCheck className="w-7 h-7" style={{ color: "var(--greek-gold)" }} />
        </div>
        <h1 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--greek-blue)" }}>
          Vérification en deux étapes
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {sent || method === "totp"
            ? "Un code à 6 chiffres a été envoyé par email."
            : error
            ? "Échec de l'envoi du code — voir le message ci-dessous."
            : "Envoi du code en cours…"}
        </p>
      </div>

      <div className="rounded-3xl p-8" style={{ background: "#fff", boxShadow: "0 8px 48px rgba(15,30,58,0.10)", border: "1px solid rgba(197,161,72,0.18)" }}>
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 mb-5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
              Code de vérification
            </label>
            <input
              type="text"
              inputMode="text"
              autoFocus
              maxLength={11}
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, "").toUpperCase())}
              className="w-full px-4 py-3 rounded-xl text-center text-2xl tracking-[0.3em] font-mono transition-all outline-none"
              style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
              placeholder="000000"
              required
            />
          </div>

          <GlassButton
            type="submit"
            variant="navy"
            fullWidth
            disabled={loading || code.length < 6}
          >
            {loading ? "Vérification…" : "Vérifier"}
          </GlassButton>
        </form>

        <button
          type="button"
          onClick={method === "totp" ? fakeResend : () => void sendCode()}
          disabled={sending || cooldown > 0}
          className="w-full flex items-center justify-center gap-2 mt-4 text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{ color: "var(--greek-gold)" }}
        >
          <RotateCcw className="w-3 h-3" />
          {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : sending ? "Envoi…" : "Renvoyer le code"}
        </button>
      </div>
    </div>
  );
}

export default function TwoFactorVerifyPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorVerifyContent />
    </Suspense>
  );
}
