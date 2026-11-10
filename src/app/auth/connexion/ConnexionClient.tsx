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
import { errMessage } from "@/lib/safeError";

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
    // Retour du lien de vérification d'adresse (/api/auth/verify-email).
    const v = searchParams.get("email");
    if (v === "lien-expire") return "Ce lien de confirmation a expiré. Connectez-vous : vous pourrez en recevoir un nouveau.";
    if (v === "lien-invalide") return "Ce lien de confirmation n'est plus valable (déjà utilisé ?). Connectez-vous pour continuer.";
    if (v === "trop-de-tentatives") return "Trop de tentatives. Réessayez dans une heure.";
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Précharge les écrans qui suivent une connexion réussie pendant que
    // l'utilisateur tape : la navigation qui suit ne télécharge plus rien.
    router.prefetch("/auth/2fa-verify");
    router.prefetch("/child/dashboard");
    router.prefetch("/parent/dashboard");
  }, [router]);

  // Second facteur par clé d'accès, APRÈS le mot de passe, pour les comptes
  // qui en ont enregistré une (voir WebAuthnCard). Le serveur émet alors la
  // session 2FA (comme un code e-mail validé) : c'est lui qui l'exige ensuite
  // sur chaque appel, pas seulement cette page. Sans clé (ou navigateur sans
  // WebAuthn), la connexion continue vers la 2FA habituelle / le tableau de bord.
  const verifyPasskeyIfAny = async (accessToken: string, hasPasskey: boolean): Promise<boolean> => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return true;
    if (!hasPasskey) return true;

    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    try {
      const optionsRes = await fetch("/api/auth/webauthn/login/options", { method: "POST", headers });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || "Erreur");

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ response: assertion }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) throw new Error(verifyData.error || "Vérification échouée.");
      return true;
    } catch (err: unknown) {
      // Le compte A une clé d'accès enregistrée : elle devient obligatoire à
      // chaque connexion (comme un second facteur), on ne laisse donc pas
      // passer même en cas d'annulation — on déconnecte pour éviter qu'une
      // session mot-de-passe reste active sans avoir passé ce contrôle.
      await supabase.auth.signOut();
      setError(
        (err instanceof Error ? err.name : "") === "NotAllowedError"
          ? "Vérification par clé d'accès annulée, recommence et confirme avec ton empreinte/Face ID."
          : (errMessage(err) || "Échec de la vérification par clé d'accès.")
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
      // Connexion faite CÔTÉ SERVEUR (/api/auth/password-login) : le pseudo
      // d'un élève y est résolu en e-mail sans que cet e-mail ne revienne
      // jamais au navigateur (l'ancienne route resolve-username le renvoyait
      // à n'importe qui), et la tentative y est journalisée avec son résultat
      // réel. Le serveur ne renvoie une session que si le mot de passe est bon.
      const email = identifier.trim();
      const loginRes = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok || !loginData.access_token) {
        throw new Error(loginData.error || "Email/identifiant ou mot de passe incorrect.");
      }
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
      });
      if (sessionError) throw sessionError;
      if (data.user && data.session) {
        // Les trois contrôles post-connexion sont indépendants : ils partent
        // ENSEMBLE au lieu de s'enchaîner (trois allers-retours réseau en série
        // formaient le « gel » ressenti entre le mot de passe et la 2FA).
        const auth = { Authorization: `Bearer ${data.session.access_token}` };
        const [ipCheck, hasPasskey, firstDest] = await Promise.all([
          // Restriction d'IP éventuelle (admin_allowed_ips). Un échec réseau ne
          // bloque pas : getAuthenticatedUser reste le rempart final sur chaque
          // appel /api/* ensuite.
          fetch("/api/auth/ip-check", { headers: auth })
            .then(async (r) => (r.ok ? ((await r.json()).allowed !== false) : true))
            .catch(() => true),
          fetch("/api/auth/webauthn/status", { headers: auth })
            .then(async (r) => (r.ok ? ((await r.json()).credentials || []).length > 0 : false))
            .catch(() => false),
          resolveAuthDestination(data.session.access_token),
        ]);

        // Un compte restreint connecté depuis une IP hors liste ne doit voir
        // ni OTP ni prompt passkey, juste échouer comme un mot de passe
        // incorrect (aucun indice qu'une restriction existe). Vérifié AVANT
        // d'agir sur quoi que ce soit d'autre.
        if (!ipCheck) {
          await supabase.auth.signOut();
          setError("Email/identifiant ou mot de passe incorrect.");
          setLoading(false);
          return;
        }

        const passkeyOk = await verifyPasskeyIfAny(data.session.access_token, hasPasskey);
        if (!passkeyOk) { setLoading(false); return; }
        // La clé d'accès vient d'ouvrir la session 2FA : la destination calculée
        // avant (page de 2FA) n'est plus la bonne.
        const dest = hasPasskey && window.PublicKeyCredential
          ? await resolveAuthDestination(data.session.access_token)
          : firstDest;

        // Le bouton reste en chargement jusqu'à l'affichage de la page
        // suivante : le relâcher ici laissait un écran figé et un bouton
        // inactif pendant la navigation.
        if (dest === "banned") { router.push("/auth/banned"); return; }
        if (dest === "no_account" || dest === "incomplete") { router.push("/auth/inscription"); return; }
        router.push(dest);
        return;
      }
      setLoading(false);
    } catch (err: unknown) {
      setError(translateAuthError(errMessage(err)));
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
              <Link href="/auth/forgot-password" className="text-xs font-medium hover:underline transition-colors" style={{ color: "var(--greek-gold-text)" }}>
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
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <GlassButton
            type="submit"
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

        {/* Séparateur */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ou</span>
          <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
        </div>

        {/* Bouton Google */}
        <GlassButton onClick={handleGoogleLogin} variant="outline" fullWidth>
          <GoogleIcon />
          Continuer avec Google
        </GlassButton>
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
