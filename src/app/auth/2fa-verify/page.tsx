"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, AlertCircle, RotateCcw } from "lucide-react";

function TwoFactorVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [method, setMethod] = useState<"email" | "totp" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }
      const res = await fetch("/api/auth/2fa/send-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }
      const res = await fetch("/api/auth/2fa/totp/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && data.role === "admin" && data.confirmed) {
        setMethod("totp");
      } else {
        setMethod("email");
        sendCode();
      }
    })();
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
      localStorage.setItem("edu_2fa_token", data.token);
      router.push(redirect);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
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
          {method === "totp"
            ? "Entre ton code de vérification à 6 chiffres."
            : sent ? "Un code à 6 chiffres a été envoyé par email." : "Envoi du code en cours…"}
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
              inputMode={method === "totp" ? "text" : "numeric"}
              autoFocus
              maxLength={method === "totp" ? 11 : 6}
              value={code}
              onChange={e => {
                const raw = e.target.value;
                setCode(method === "totp" ? raw.replace(/[^0-9A-Za-z-]/g, "").toUpperCase() : raw.replace(/\D/g, ""));
              }}
              className="w-full px-4 py-3 rounded-xl text-center text-2xl tracking-[0.3em] font-mono transition-all outline-none"
              style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
              placeholder="000000"
              required
            />
            {method === "totp" && (
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                Ou un code de secours (format XXXXX-XXXXX) si tu n'as plus accès à ton appli.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (method === "totp" ? code.length < 6 : code.length !== 6)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--greek-blue)", boxShadow: "0 4px 16px rgba(15,30,58,0.25)" }}
          >
            {loading ? "Vérification…" : "Vérifier"}
          </button>
        </form>

        {method === "email" && (
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 mt-4 text-xs font-semibold transition-opacity disabled:opacity-40"
            style={{ color: "var(--greek-gold)" }}
          >
            <RotateCcw className="w-3 h-3" />
            {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : sending ? "Envoi…" : "Renvoyer le code"}
          </button>
        )}
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
