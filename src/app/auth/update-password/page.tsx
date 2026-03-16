"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check if we have a session, if not redirect to login
    // The password reset link should sign the user in automatically
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/connexion");
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      setStatus("error");
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
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
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px] flex items-center justify-center p-4">
        <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--card-border-antique)] p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-2xl mb-2">
              Nouveau mot de passe
            </h1>
            <p className="text-gray-600 text-sm">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          {status === "success" ? (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-800 mb-6">{message}</p>
              <p className="text-sm text-gray-500">
                Redirection vers l'accueil...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {status === "error" && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors"
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-primary-greek w-full flex justify-center items-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Mise à jour...
                  </>
                ) : (
                  "Mettre à jour le mot de passe"
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
