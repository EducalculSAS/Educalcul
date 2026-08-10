"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import { validatePassword } from "@/lib/validation";
import GlassButton from "@/components/ui/GlassButton";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Le lien de récupération établit la session à partir du fragment de l'URL
    // (#access_token…) de façon ASYNCHRONE. On écoute l'événement d'auth et on
    // ne redirige vers la connexion qu'après un délai si AUCUNE session n'est
    // détectée — sinon on redirigeait trop tôt (course de chargement).
    let sessionSeen = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) sessionSeen = true;
    });
    const timeout = setTimeout(async () => {
      if (sessionSeen) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/auth/connexion");
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setStatus("error");
      setMessage(pwError);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setStatus("success");
      setMessage("Votre mot de passe a été mis à jour avec succès.");

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (err: any) {
      setStatus("error");
      setMessage(
        err.message ||
          "Une erreur est survenue lors de la mise à jour du mot de passe."
      );
    }
  };

  return (
    <div className="w-full max-w-md">
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-8 w-full">
          <div className="text-center mb-8">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-2xl mb-2">
              Nouveau mot de passe
            </h1>
            <p className="text-gray-600 text-sm">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          {status === "success" ? (
            <div className="text-center animate-fade-bounce">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(197,161,72,0.15)" }}>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--greek-gold)" }} />
              </div>
              <p className="text-gray-800 mb-6">{message}</p>
              <p className="text-sm text-gray-500">
                Redirection vers l'accueil...
              </p>
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
                  htmlFor="password"
                  className="block text-[var(--greek-blue)] font-bold mb-2 text-sm"
                >
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-[var(--greek-blue)] font-bold mb-2 text-sm"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
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
                    Mise à jour...
                  </>
                ) : (
                  "Mettre à jour le mot de passe"
                )}
              </GlassButton>
            </form>
          )}
        </div>
    </div>
  );
}
