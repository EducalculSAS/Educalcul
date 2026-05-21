"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import { LogIn, Mail, Lock, AlertCircle, User } from "lucide-react";

export default function Connexion() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""); // Email or Username
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const siteUrl = getSiteUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Erreur lors de la connexion avec Google");
    }
  };

  // Auto-redirect if already logged in (e.g. from email confirmation)
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // Check for pending role from registration
        const pendingRole = localStorage.getItem("educalcul_pending_role");

        // Fetch user role to redirect correctly
        // Poll for user row creation if it doesn't exist (e.g. fresh signup via Google)
        let attempts = 0;
        let userData = null;

        while (attempts < 5 && !userData) {
          const { data } = await supabase
            .from("users")
            .select("role")
            .eq("auth_id", session.user.id)
            .single();

          if (data) {
            userData = data;
          } else {
            await new Promise((r) => setTimeout(r, 500));
            attempts++;
          }
        }

        let currentRole = userData?.role;

        // If we have a pending role and the user has no role (or we want to enforce it for new users)
        // Note: The trigger might have set a default, or it might be null.
        // We only update if we have a pending role and the current role is not set or we just signed up.
        if (pendingRole && (!currentRole || currentRole === "user")) {
          // assuming 'user' might be a default or null
          await supabase
            .from("users")
            .update({ role: pendingRole })
            .eq("auth_id", session.user.id);

          localStorage.removeItem("educalcul_pending_role");

          // Refresh user data to get the new role
          const { data: newUserData } = await supabase
            .from("users")
            .select("role")
            .eq("auth_id", session.user.id)
            .single();

          if (newUserData) currentRole = newUserData.role;
        }

        let redirectPath = "/dashboard";
        const finalRole = currentRole || pendingRole; // Fallback to pendingRole if userData update hasn't reflected yet (unlikely with await)

        if (finalRole === "parent") redirectPath = "/parent/dashboard";
        else if (finalRole === "child") redirectPath = "/child/dashboard";
        else if (finalRole === "admin") redirectPath = "/admin/dashboard";

        router.push(redirectPath);
      }
    };
    checkSession();

    // Listen for auth changes (e.g. after email confirmation redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "SIGNED_IN" && session) {
        checkSession();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let email = identifier.trim();

      // Determine if identifier is email or username
      // Simple check: if no '@', assume username and append domain suffix
      if (!email.includes("@")) {
        email = `${email}@educalcul.user`;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email,
          password: password,
        }
      );

      if (authError) {
        throw authError;
      }

      if (data.user) {
        // Fetch user role from public.users table to redirect correctly
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("auth_id", data.user.id)
          .maybeSingle();

        if (userError) {
          console.error("Error fetching user role:", userError);
        }

        // Default redirect if role not found or generic
        let redirectPath = "/dashboard";

        if (userData?.role === "parent") {
          redirectPath = "/parent/dashboard";
        } else if (userData?.role === "child") {
          redirectPath = "/child/dashboard";
        } else if (userData?.role === "admin") {
          redirectPath = "/admin/dashboard";
        }

        router.push(redirectPath);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--greek-gold)] p-8">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Connexion
          </h1>
          <p className="text-gray-600">Heureux de vous revoir sur Educalcul</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              className="block text-[var(--greek-blue)] font-bold mb-2 text-sm"
              htmlFor="identifier"
            >
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
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors"
                placeholder="votre@email.com ou pseudo"
                required
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[var(--greek-blue)] font-bold mb-2 text-sm"
              htmlFor="password"
            >
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
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex justify-end mt-2">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[var(--greek-gold)] hover:text-[var(--greek-gold)] transition-colors"
              >
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

          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <span className="relative bg-white px-4 text-sm text-gray-500">
              Ou continuer avec
            </span>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-700 font-bold py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 shadow-sm flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-600">
            Pas encore de compte ?{" "}
            <Link
              href="/auth/inscription"
              className="text-[var(--greek-blue)] font-bold hover:underline"
            >
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
