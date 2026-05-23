"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import { resolveAuthDestination } from "@/lib/authRedirect";
import { LogIn, Lock, AlertCircle, User } from "lucide-react";

export default function ConnexionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const e = searchParams.get("error");
    if (e === "no_account") return "Aucun compte trouvé avec ce compte Google. Veuillez vous inscrire d'abord.";
    if (e === "oauth") return searchParams.get("message") || "Erreur de connexion Google. Réessayez ou créez un compte.";
    return null;
  });
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    sessionStorage.removeItem("educalcul_signup_mode");
    sessionStorage.removeItem("educalcul_pending_role");
    sessionStorage.removeItem("educalcul_signup_data");
    sessionStorage.setItem("educalcul_auth_intent", "login");
    try {
      const siteUrl = getSiteUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${siteUrl}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Erreur lors de la connexion avec Google");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let email = identifier.trim();
      if (!email.includes("@")) {
        email = `${email}@educalcul.user`;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      if (data.user) {
        const dest = await resolveAuthDestination(supabase, data.user.id);
        if (dest === "banned") { router.push("/auth/banned"); return; }
        if (dest === "no_account" || dest === "incomplete") { router.push("/auth/inscription"); return; }
        router.push(dest);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[rgba(197,161,72,0.25)] p-8">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Connexion
          </h1>
          <p className="text-gray-600">Heureux de vous revoir sur Educalcul</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-xl border text-sm" style={{ background: "var(--greek-blue)", borderColor: "rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.9)" }}>
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm" htmlFor="identifier">
              Email ou Nom d'utilisateur
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 transition-colors"
                placeholder="votre@email.com ou pseudo"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex justify-end mt-2">
              <Link href="/auth/forgot-password" className="text-sm text-[var(--greek-gold)] hover:underline transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-greek w-full flex items-center justify-center"
          >
            {loading ? (
              <span className="animate-pulse">Connexion en cours...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" /> Se connecter
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "rgba(197,161,72,0.2)" }}></div>
            </div>
            <span className="relative bg-white px-4 text-sm text-gray-500">Ou continuer avec</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white font-bold py-3 px-4 rounded-lg border transition-colors duration-200 shadow-sm flex items-center justify-center hover:-translate-y-[1px] hover:shadow-md" style={{ borderColor: "rgba(197,161,72,0.3)", color: "var(--greek-blue)" }}
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuer avec Google
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-600">
            Pas encore de compte ?{" "}
            <Link href="/auth/inscription" className="text-[var(--greek-blue)] font-bold hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
