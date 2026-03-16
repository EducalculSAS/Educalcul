"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

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
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        }
      );

      if (error) throw error;

      setStatus("success");
      setMessage(
        "Un email de réinitialisation a été envoyé si un compte existe avec cette adresse."
      );
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Une erreur est survenue.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px] flex items-center justify-center p-4">
        <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--card-border-antique)] p-8 max-w-md w-full">
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
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-800 mb-6">{message}</p>
              <Link
                href="/auth/connexion"
                className="btn-primary-greek w-full flex justify-center items-center gap-2"
              >
                Retour à la connexion
              </Link>
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors"
                    placeholder="votre@email.com"
                    required
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
                    Envoi en cours...
                  </>
                ) : (
                  "Envoyer le lien"
                )}
              </button>

              <div className="text-center mt-4">
                <Link
                  href="/auth/connexion"
                  className="text-[var(--greek-blue)] hover:text-[var(--greek-gold)] text-sm font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
