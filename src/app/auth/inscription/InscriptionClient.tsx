"use client";

import GlassCheckbox from "@/components/ui/GlassCheckbox";
import LoaderDots from "@/components/LoaderDots";
import { useState, useEffect } from "react";
import PasswordStrength from "@/components/PasswordStrength";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSiteUrl } from "@/lib/siteUrl";
import { setPendingSignupPassword } from "@/lib/pendingSignupPassword";
import { getSignupSession, patchSignupSession } from "@/lib/signupSession";
import { validatePassword, isValidEmail } from "@/lib/validation";
import { Mail, Lock, User, AlertCircle, CheckCircle, Gift, ArrowRight, ArrowLeft, Eye, EyeOff, Check } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { errMessage } from "@/lib/safeError";

/* ── Google SVG ── */
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

/* ── Input helper ── */
function Field({
  label, icon, type = "text", value, onChange, placeholder, required, children, rightEl,
}: {
  label: string; icon: React.ReactNode; type?: string;
  value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
  children?: React.ReactNode; rightEl?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }}>{icon}</span>
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
          style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
          placeholder={placeholder} required={required}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
        />
        {rightEl && <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</span>}
      </div>
      {children}
    </div>
  );
}

const STEPS = ["Profil", "Sécurité", "Finalisation"];
const TOTAL = STEPS.length;
const ROLE = "parent" as const;

export default function Inscription() {
  const router = useRouter();

  /* ── état global ── */
  const [step, setStep] = useState(0);
  const [, setDir] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Step 1 */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  /* Step 2 */
  const [email, setEmail]               = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  /* Step 3 */
  const [referralCode, setReferralCode]     = useState("");
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [cguAccepted, setCguAccepted]       = useState(false);

  useEffect(() => {
    setMounted(true);
    (async () => {
      const s = await getSignupSession();
      if (s.data && s.mode === "email") {
        const d = s.data;
        if (d.firstName)     setFirstName(d.firstName);
        if (d.lastName)      setLastName(d.lastName);
        if (d.email)         setEmail(d.email);
        if (d.referralCode)  { setReferralCode(d.referralCode); setReferralStatus("valid"); }
      }
    })();
  }, []);

  /* ── Navigation entre étapes ── */
  const goTo = (next: number) => {
    if (animating) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 350);
  };

  /* ── Validation par étape ── */
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!firstName.trim()) return "Veuillez entrer votre prénom.";
      if (!lastName.trim())  return "Veuillez entrer votre nom.";
    }
    if (s === 1) {
      if (!email.trim())          return "Veuillez entrer votre email.";
      if (!isValidEmail(email.trim())) return "Adresse email invalide.";
      const pwError = validatePassword(password);
      if (pwError) return pwError;
      if (password !== confirmPassword) return "Les mots de passe ne correspondent pas.";
    }
    return null;
  };

  const handleNext = async () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    // Sauvegarde incrémentale à chaque étape validée (jamais le mot de passe,
    // voir pendingSignupPassword.ts) : un refresh ou un retour plus tard
    // reprend exactement là où on s'était arrêté.
    patchSignupSession({
      mode: "email",
      data: { role: ROLE, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null },
    });
    if (step < TOTAL - 1) goTo(step + 1);
  };

  const handleBack = () => { if (step > 0) goTo(step - 1); };

  /* ── Validation code parrainage ── */
  const validateReferral = async (code: string) => {
    if (!code.trim()) { setReferralStatus("idle"); return; }
    setReferralValidating(true);
    try {
      const res  = await fetch("/api/parent/validate-referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json();
      setReferralStatus(data.valid ? "valid" : "invalid");
    } catch { setReferralStatus("invalid"); }
    finally { setReferralValidating(false); }
  };

  /* ── Google ── */
  const handleGoogleLogin = async () => {
    await patchSignupSession({
      mode: "google",
      pendingRole: ROLE,
      data: {
        role: ROLE,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      },
    });

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

  /* ── Soumission finale ── */
  const handleRegister = async () => {
    if (!cguAccepted) { setError("Vous devez accepter les CGU pour continuer."); return; }
    setError(null);
    setLoading(true);
    try {
      const checkRes  = await fetch("/api/auth/validate-signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role: ROLE, password }) });
      const checkData = await checkRes.json();
      if (!checkData.valid) { setError(checkData.error || "Email déjà utilisé."); setLoading(false); return; }

      // Le mot de passe ne va jamais côté serveur ni dans du stockage
      // navigateur : il reste en mémoire JS le temps de la navigation vers
      // select-plan, qui l'utilise pour créer le compte.
      setPendingSignupPassword(password);
      await patchSignupSession({
        mode: "email",
        data: {
          role: ROLE, firstName: firstName.trim(), lastName: lastName.trim(),
          email: email.trim(),
          referralCode: referralCode.trim() || null,
          referralStatus, cguAcceptedAt: new Date().toISOString(),
        },
      });
      router.push("/auth/inscription/select-plan");
    } catch (err: unknown) { setError(errMessage(err) || "Une erreur est survenue."); }
    finally { setLoading(false); }
  };

  const accent = "var(--greek-blue)";

  const stepContent = [
    /* ── ÉTAPE 1 : Profil ── */
    <div key="s0" className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" icon={<User className="w-4 h-4" />} value={firstName} onChange={setFirstName} placeholder="Marie" required />
        <Field label="Nom"    icon={<User className="w-4 h-4" />} value={lastName}  onChange={setLastName}  placeholder="Dupont" required />
      </div>
    </div>,

    /* ── ÉTAPE 2 : Sécurité ── */
    <div key="s1" className="space-y-4">
      <Field label="Email" icon={<Mail className="w-4 h-4" />} type="email" value={email} onChange={setEmail} placeholder="parent@exemple.com" required />

      <Field
        label="Mot de passe"
        icon={<Lock className="w-4 h-4" />}
        type={showPwd ? "text" : "password"}
        value={password} onChange={setPassword} placeholder="••••••••" required
        rightEl={
          <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPwd} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      >
        <PasswordStrength password={password} />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        icon={<Lock className="w-4 h-4" />}
        type={showPwd2 ? "text" : "password"}
        value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" required
        rightEl={
          <button type="button" onClick={() => setShowPwd2(v => !v)} aria-label={showPwd2 ? "Masquer la confirmation" : "Afficher la confirmation"} aria-pressed={showPwd2} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
            {showPwd2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
    </div>,

    /* ── ÉTAPE 3 : Finalisation ── */
    <div key="s2" className="space-y-5">
      {/* Récap */}
      <div className="rounded-2xl p-4" style={{ background: "var(--greek-cream)", border: "1px solid rgba(197,161,72,0.2)" }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--greek-gold)" }}>Récapitulatif</p>
        <div className="space-y-1 text-sm" style={{ color: "var(--greek-blue)" }}>
          <p><span className="opacity-60">Nom :</span> {firstName} {lastName}</p>
          <p><span className="opacity-60">Email :</span> {email}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
          Code de parrainage <span className="font-normal opacity-50">(optionnel)</span>
        </label>
        <div className="relative">
          <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={referralCode}
            onChange={e => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus("idle"); }}
            onBlur={() => validateReferral(referralCode)}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none font-mono tracking-widest uppercase transition-all"
            style={{
              background: "var(--greek-cream)",
              border: `1.5px solid ${referralStatus === "valid" ? "var(--greek-gold)" : referralStatus === "invalid" ? "rgba(239,68,68,0.4)" : "rgba(197,161,72,0.25)"}`,
              color: "var(--greek-blue)",
            }}
            placeholder="EX: ABCD1234"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {referralValidating && <LoaderDots />}
            {!referralValidating && referralStatus === "valid"   && <CheckCircle className="w-4 h-4 text-green-500" />}
            {!referralValidating && referralStatus === "invalid" && <AlertCircle className="w-4 h-4 text-red-400" />}
          </span>
        </div>
        {referralStatus === "valid"   && <p className="text-xs text-green-600 font-medium mt-1"><Check className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Code valide : une semaine gratuite en plus de l&apos;essai</p>}
        {referralStatus === "invalid" && <p className="text-xs text-red-400 mt-1">Code invalide ou expiré</p>}
      </div>

      {/* CGU */}
      <label className="flex items-start gap-3 cursor-pointer">
        <GlassCheckbox checked={cguAccepted}
          onChange={e => setCguAccepted(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <span className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          J&apos;accepte les{" "}
          <a href="/cgu" target="_blank" className="font-semibold hover:underline" style={{ color: accent }}>CGU</a>,{" "}
          les{" "}
          <a href="/cgv" target="_blank" className="font-semibold hover:underline" style={{ color: accent }}>CGV</a>{" "}
          et la{" "}
          <a href="/politique-confidentialite" target="_blank" className="font-semibold hover:underline" style={{ color: accent }}>Politique de confidentialité</a>
          . Je certifie être majeur et, pour les enfants que j&apos;inscris, titulaire de l&apos;autorité parentale : je consens au traitement de leurs données tel que décrit dans la Politique de confidentialité.
        </span>
      </label>
    </div>,
  ];

  return (
    <div
      className="w-full max-w-md"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-bold mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", color: "var(--greek-blue)" }}>
          Créer un compte
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Rejoignez la communauté Educalcul</p>
      </div>

      {/* Card */}
      <div
        className="rounded-3xl p-7"
        style={{ background: "#fff", boxShadow: "0 8px 48px rgba(15,30,58,0.10)", border: "1px solid rgba(197,161,72,0.18)" }}
      >
        {/* Barre de progression */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={{
                    background: i <= step ? accent : "var(--greek-cream)",
                    color: i <= step ? "#fff" : "var(--text-muted)",
                    border: `2px solid ${i <= step ? accent : "rgba(197,161,72,0.2)"}`,
                    transform: i === step ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: i === step ? accent : "var(--text-muted)", opacity: i === step ? 1 : 0.9 }}>
                  {s}
                </span>
                {i < TOTAL - 1 && (
                  <div className="flex-1 h-px mx-2 rounded-full overflow-hidden" style={{ background: "rgba(197,161,72,0.15)", width: 32 }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ background: accent, width: i < step ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 mb-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Contenu étape — fade + slide up, même style que connexion */}
        <div
          key={step}
          style={{ animation: "stepFadeUp 0.35s ease forwards" }}
        >
          {stepContent[step]}
        </div>

        <style>{`
          @keyframes stepFadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        `}</style>

        {/* Boutons navigation */}
        <div className={`flex gap-3 mt-6 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <GlassButton onClick={handleBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" /> Retour
            </GlassButton>
          )}

          {step < TOTAL - 1 ? (
            <GlassButton onClick={handleNext} variant="navy" size="sm">
              Suivant <ArrowRight className="w-4 h-4" />
            </GlassButton>
          ) : (
            <GlassButton
              onClick={handleRegister}
              variant="navy"
              size="sm"
              disabled={loading || !cguAccepted}
            >
              {loading ? <><LoaderDots /> Vérification…</> : <>Continuer vers les plans <ArrowRight className="w-4 h-4" /></>}
            </GlassButton>
          )}
        </div>

        {/* Séparateur + Google — uniquement sur l'étape 1 */}
        {step === 0 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ou s&apos;inscrire avec</span>
              <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
            </div>
            <GlassButton onClick={handleGoogleLogin} variant="outline" fullWidth>
              <GoogleIcon />
              S&apos;inscrire avec Google
            </GlassButton>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center mt-5 text-sm" style={{ color: "var(--text-muted)" }}>
        Déjà un compte ?{" "}
        <Link href="/auth/connexion" className="font-bold hover:underline" style={{ color: "var(--greek-blue)" }}>
          Se connecter
        </Link>
      </p>
    </div>
  );
}
