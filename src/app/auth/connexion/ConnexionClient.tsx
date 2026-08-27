"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import { resolveAuthDestination } from "@/lib/authRedirect";
import { patchSignupSession } from "@/lib/signupSession";
import { LogIn, Lock, AlertCircle, User, Eye, EyeOff } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

/** Supabase Auth renvoie ses messages d'erreur en anglais quel que soit le
 * paramétrage — le reste de l'interface est en français, donc on traduit
 * les cas courants plutôt que d'exposer le texte brut. */
function translateAuthError(message?: string): string {
  if (!message) return "Une erreur est survenue lors de la connexion.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email/identifiant ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Adresse email non confirmée. Vérifiez votre boîte de réception.";
  if (m.includes("too many requests")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (m.includes("user not found")) return "Aucun compte trouvé avec ces identifiants.";
  return message;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function ConnexionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const e = searchParams.get("error");
    if (e === "no_account") return "Aucun compte trouvé avec ce compte Google. Veuillez vous inscrire d'abord.";
    if (e === "oauth") return searchParams.get("message") || "Erreur de connexion Google. Réessayez ou créez un compte.";
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Vérifie la clé d'accès de ce compte APRÈS le mot de passe, AVANT la 2FA
  // — ce n'est plus une alternative au mot de passe (pas de bouton dédié),
  // mais un facteur supplémentaire pour les comptes qui en ont enregistré
  // une (voir WebAuthnCard). Ne fait rien si le compte n'en a aucune —
  // la connexion continue alors normalement vers la 2FA / le tableau de
  // bord, exactement comme avant l'ajout des clés d'accès.
  const verifyPasskeyIfAny = async (email: string, accessToken: string): Promise<boolean> => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return true;

    const statusRes = await fetch("/api/auth/webauthn/status", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!statusRes.ok) return true; // en cas de doute, ne bloque pas la connexion
    const statusData = await statusRes.json();
    if (!((statusData.credentials || []).length > 0)) return true;

    try {
      const optionsRes = await fetch("/api/auth/webauthn/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || "Erreur");

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response: assertion }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) throw new Error(verifyData.error || "Vérification échouée.");
      return true;
    } catch (err: any) {
      // Le compte A une clé d'accès enregistrée : elle devient obligatoire à
      // chaque connexion (comme un second facteur), on ne laisse donc pas
      // passer même en cas d'annulation — on déconnecte pour éviter qu'une
      // session mot-de-passe reste active sans avoir passé ce contrôle.
      await supabase.auth.signOut();
      setError(
        err?.name === "NotAllowedError"
          ? "Vérification par clé d'accès annulée — recommence et confirme avec ton empreinte/Face ID."
          : (err?.message || "Échec de la vérification par clé d'accès.")
      );
      return false;
    }
  };

  const handleGoogleLogin = async () => {
    await patchSignupSession({ mode: null, pendingRole: null, data: null, authIntent: "login" });

    const redirectUri = `${getSiteUrl()}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let email = identifier.trim();
      if (!email.includes("@")) {
        try {
          const r = await fetch("/api/auth/resolve-username", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: email }),
          });
          if (r.ok) {
            const d = await r.json();
            if (d.email) email = d.email;
          } else {
            email = `${email}@educalcul.user`;
          }
        } catch {
          email = `${email}@educalcul.user`;
        }
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      // Journalise la tentative (réussie ou non) sans bloquer/retarder la
      // connexion — un échec de mot de passe n'était visible nulle part
      // avant ce correctif, y compris en cas d'activité suspecte sur un
      // compte (codes 2FA reçus sans tentative de connexion volontaire).
      fetch("/api/auth/log-login-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, success: !authError }),
      }).catch(() => {});
      if (authError) throw authError;
      if (data.user && data.session) {
        const passkeyOk = await verifyPasskeyIfAny(email, data.session.access_token);
        if (!passkeyOk) return;

        const dest = await resolveAuthDestination(supabase, data.user.id);
        if (dest === "banned") { router.push("/auth/banned"); return; }
        if (dest === "no_account" || dest === "incomplete") { router.push("/auth/inscription"); return; }
        router.push(dest);
      }
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-md"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-bold mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--greek-blue)" }}>
          Connexion
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Heureux de vous revoir sur Educalcul</p>
      </div>

      {/* Card */}
      <div
        className="rounded-3xl p-8"
        style={{ background: "#fff", boxShadow: "0 8px 48px rgba(15,30,58,0.10)", border: "1px solid rgba(197,161,72,0.18)" }}
      >
        {/* Bouton Google */}
        <GlassButton onClick={handleGoogleLogin} variant="outline" fullWidth className="mb-6">
          <GoogleIcon />
          Continuer avec Google
        </GlassButton>

        {/* Séparateur */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ou avec email</span>
          <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
        </div>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 mb-5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Identifiant */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
              Email ou pseudo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                placeholder="votre@email.com ou pseudo"
                onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                required
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>Mot de passe</label>
              <Link href="/auth/forgot-password" className="text-xs font-medium hover:underline transition-colors" style={{ color: "var(--greek-gold)" }}>
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm transition-all outline-none"
                style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                placeholder="••••••••"
                onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <GlassButton
            onClick={() => handleLogin({ preventDefault: () => {} } as unknown as React.FormEvent)}
            variant="navy"
            fullWidth
            className="mt-2"
            disabled={loading}
          >
            {loading ? (
              <span className="animate-pulse">Connexion en cours…</span>
            ) : (
              <><LogIn className="w-4 h-4" /> Se connecter</>
            )}
          </GlassButton>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Pas encore de compte ?{" "}
        <Link href="/auth/inscription" className="font-bold hover:underline transition-colors" style={{ color: "var(--greek-blue)" }}>
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}
