"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  Mail,
  Lock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Gift,
  Loader2,
} from "lucide-react";

export default function Inscription() {
  const router = useRouter();
  const [role, setRole] = useState<"parent" | "child">("parent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Child specific
  const [childUsername, setChildUsername] = useState("");
  const [childAge, setChildAge] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  // Referral
  const [referralCode, setReferralCode] = useState("");
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const validateReferral = async (code: string) => {
    if (!code.trim()) { setReferralStatus("idle"); return; }
    setReferralValidating(true);
    try {
      const res = await fetch("/api/parent/validate-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setReferralStatus(data.valid ? "valid" : "invalid");
    } catch {
      setReferralStatus("invalid");
    } finally {
      setReferralValidating(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Save selected role to localStorage so we can assign it after OAuth callback
    localStorage.setItem("educalcul_pending_role", role);

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
      setError(err.message || "Erreur lors de l'inscription avec Google");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    // Validation
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    try {
      let signUpEmail = email.trim();
      let signUpPassword = password;
      let metaData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: role,
        child_username: childUsername.trim() || null,
        child_age: childAge || null,
        parent_email: parentEmail.trim() || null,
      };

      if (role === "child") {
        // Construct email for child (remove spaces and special chars)
        const sanitizedUsername = childUsername
          .trim()
          .replace(/\s+/g, "")
          .toLowerCase();
        signUpEmail = `${sanitizedUsername}@educalcul.user`;
        // Check age logic if needed
      }

      // 1. Sign up with Supabase Auth
      // Note: A Postgres Trigger handles the insertion into public.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: metaData,
          emailRedirectTo: `${window.location.origin}/auth/connexion`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Record referral use if code provided and valid
        if (role === "parent" && referralCode.trim() && referralStatus === "valid") {
          await fetch("/api/auth/use-referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: referralCode.trim(), newUserAuthId: authData.user.id }),
          });
        }

        setSuccess("Compte créé avec succès ! Redirection...");
        setTimeout(() => router.push("/auth/connexion"), 2000);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[var(--greek-gold)] p-8">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-blue)] font-bold mb-2">
            Créer un compte
          </h1>
          <p className="text-gray-600">Rejoignez la communauté Educalcul</p>
        </div>

        {/* Role Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setRole("parent")}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
                role === "parent"
                  ? "bg-[var(--greek-blue)] text-white shadow-md"
                  : "text-gray-500 hover:text-[var(--greek-blue)]"
              }`}
            >
              Parent
            </button>
            <button
              onClick={() => setRole("child")}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
                role === "child"
                  ? "bg-[var(--greek-gold)] text-white shadow-md"
                  : "text-gray-500 hover:text-[var(--greek-gold)]"
              }`}
            >
              Élève
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Prénom
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Nom
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                required
              />
            </div>
          </div>

          {role === "parent" ? (
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                  placeholder="parent@exemple.com"
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                  Nom d'utilisateur
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={childUsername}
                    onChange={(e) => setChildUsername(e.target.value)}
                    className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                    placeholder="pseudo123"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                    Âge
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      min="8"
                      max="17"
                      value={childAge}
                      onChange={(e) => setChildAge(e.target.value)}
                      className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                      placeholder="8-17"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                    Email du parent
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                      placeholder="parent@exemple.com"
                      required
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Confirmer
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--greek-blue)]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          {role === "parent" && (
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-2 text-sm">
                Code de parrainage <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Gift className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setReferralCode(val);
                    setReferralStatus("idle");
                  }}
                  onBlur={() => validateReferral(referralCode)}
                  className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none font-mono tracking-widest uppercase text-sm ${
                    referralStatus === "valid"
                      ? "border-green-400 bg-green-50 focus:border-green-500"
                      : referralStatus === "invalid"
                      ? "border-red-400 bg-red-50 focus:border-red-500"
                      : "border-gray-300 focus:border-[var(--greek-blue)]"
                  }`}
                  placeholder="EX: RUBEN3K7P"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {referralValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  {!referralValidating && referralStatus === "valid" && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {!referralValidating && referralStatus === "invalid" && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {referralStatus === "valid" && (
                <p className="text-xs text-green-600 font-medium mt-1">Code valide — une remise sera appliquée à votre abonnement</p>
              )}
              {referralStatus === "invalid" && (
                <p className="text-xs text-red-500 mt-1">Code invalide ou expiré</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-md flex items-center justify-center hover:-translate-y-[1px] ${
              role === "parent"
                ? "bg-[var(--greek-blue)] hover:bg-[#2c5282]"
                : "bg-[var(--greek-gold)] hover:bg-[var(--greek-gold)]"
            }`}
          >
            {loading ? "Inscription en cours..." : "S'inscrire"}
          </button>

          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <span className="relative bg-white px-4 text-sm text-gray-500">
              Ou s'inscrire avec
            </span>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-700 font-bold py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 shadow-sm flex items-center justify-center hover:-translate-y-[1px] hover:shadow-md"
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
            S'inscrire avec Google
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-600">
            Déjà un compte ?{" "}
            <Link
              href="/auth/connexion"
              className="text-[var(--greek-blue)] font-bold hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
