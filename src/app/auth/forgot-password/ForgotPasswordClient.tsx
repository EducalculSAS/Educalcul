"use client";

import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(`Erreur: ${data.error}`);
        return;
      }

      setStatus("success");
      setMessage("Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.");
    } catch (err: any) {
      setStatus("error");
      setMessage("Une erreur de connexion est survenue. Veuillez réessayer.");
    }
  };

  return (
    <div className="w-full max-w-md">
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-8 w-full">
          <div className="text-center mb-8">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-2xl mb-2">
              Mot de passe oublié ?
            </h1>
            <p className="text-gray-600 text-sm">
              Entrez votre adresse email pour recevoir les instructions de
              réinitialisation.
            </p>
          </div>

          {status === "success" ? (
            <div className="text-center animate-fade-bounce">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(197,161,72,0.15)" }}>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--greek-gold)" }} />
              </div>
              <p className="text-gray-800 mb-6">{message}</p>
              <GlassButton href="/auth/connexion" variant="gold" fullWidth>
                Retour à la connexion
              </GlassButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {status === "error" && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm" style={{ background: "var(--greek-blue)", borderColor: "rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.9)" }}>
                  <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
                  {message}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-[var(--greek-blue)] font-bold mb-2 text-sm"
                >
                  Adresse email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 transition-colors"
                    placeholder="votre@email.com"
                    required
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              <GlassButton
                onClick={() => handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
                variant="gold"
                fullWidth
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Envoi en cours...
                  </>
                ) : (
                  "Envoyer le lien"
                )}
              </GlassButton>

              <div className="text-center mt-4">
                <GlassButton href="/auth/connexion" variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </GlassButton>
              </div>
            </form>
          )}
        </div>
    </div>
  );
}
