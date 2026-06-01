"use client";

import { useState, useEffect, useRef } from "react";
import PasswordStrength from "@/components/PasswordStrength";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  Mail, Lock, User, AlertCircle, CheckCircle,
  Gift, Loader2, ArrowRight, ArrowLeft, Eye, EyeOff,
  Users, GraduationCap, BookOpen,
} from "lucide-react";

/* ── Niveaux scolaires ── */
const LYCEE_FILIERES: Record<string, string[]> = {
  "Seconde": ["Seconde GT", "Seconde Pro"],
  "Première": ["1ère Générale", "1ère STMG", "1ère STI2D", "1ère ST2S", "1ère STL", "1ère STD2A", "1ère Bac Pro"],
  "Terminale": ["Terminale Générale", "Terminale STMG", "Terminale STI2D", "Terminale ST2S", "Terminale STL", "Terminale STD2A", "Terminale Bac Pro"],
};
const LYCEE_ANNEES = Object.keys(LYCEE_FILIERES) as ("Seconde" | "Première" | "Terminale")[];
type ChildLevel = string;

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

export default function Inscription() {
  const router = useRouter();

  /* ── état global ── */
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMinorConsent, setShowMinorConsent] = useState(false);
  const [minorConsentAccepted, setMinorConsentAccepted] = useState(false);

  const [role, setRole] = useState<"parent" | "child" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Step 1 */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [childLevel, setChildLevel] = useState<ChildLevel>("");
  const [childAnnee, setChildAnnee] = useState<"Seconde" | "Première" | "Terminale" | "">("");
  /* Step 2 */
  const [email, setEmail]               = useState("");
  const [childUsername, setChildUsername] = useState("");
  const [parentEmail, setParentEmail]     = useState(""); // optionnel pour lycéen
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
    const stored = sessionStorage.getItem("educalcul_signup_data");
    const mode   = sessionStorage.getItem("educalcul_signup_mode");
    if (stored && mode === "email") {
      try {
        const d = JSON.parse(stored);
        if (d.role === "parent" || d.role === "child") setRole(d.role);
        if (d.firstName)     setFirstName(d.firstName);
        if (d.lastName)      setLastName(d.lastName);
        if (d.email)         setEmail(d.email);
        if (d.childUsername) setChildUsername(d.childUsername);
        if (d.childLevel)    setChildLevel(d.childLevel);
        if (d.parentEmail)   setParentEmail(d.parentEmail);
        if (d.referralCode)  { setReferralCode(d.referralCode); setReferralStatus("valid"); }
      } catch {}
    }
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
      if (!role)             return "Veuillez sélectionner votre profil (Parent ou Élève).";
      if (!firstName.trim()) return "Veuillez entrer votre prénom.";
      if (!lastName.trim())  return "Veuillez entrer votre nom.";
      if (role === "child" && !childAnnee) return "Veuillez sélectionner ta classe (Seconde, Première ou Terminale).";
      if (role === "child" && !childLevel) return "Veuillez sélectionner ta filière.";
    }
    if (s === 1) {
      if (role === "parent" && !email.trim()) return "Veuillez entrer votre email.";
      if (role === "child") {
        if (!childUsername.trim()) return "Veuillez choisir un pseudo.";
        if (!email.trim())         return "Veuillez entrer ton adresse email.";
      }
      if (!password)              return "Veuillez choisir un mot de passe.";
      if (password.length < 6)   return "Le mot de passe doit contenir au moins 6 caractères.";
      if (password !== confirmPassword) return "Les mots de passe ne correspondent pas.";
    }
    return null;
  };

  const handleNext = () => {
    // Cas collégien : on ne bloque pas avec une erreur, on laisse l'UI afficher le panel
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    // Lycéen → popup consentement parental (mineur)
    if (step === 1 && role === "child" && !minorConsentAccepted) {
      setShowMinorConsent(true);
      return;
    }
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
    sessionStorage.setItem("educalcul_signup_mode", "google");
    // Si un rôle est déjà sélectionné, on le pré-remplit dans complete-google
    if (role) sessionStorage.setItem("educalcul_pending_role", role);
    else sessionStorage.removeItem("educalcul_pending_role");
    sessionStorage.setItem("educalcul_signup_data", JSON.stringify({
      role: role || null,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      childAnnee: childAnnee || null,
      childLevel: childLevel || null,
    }));
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteUrl()}/auth/callback` } });
      if (error) throw error;
    } catch (err: any) { setError(err.message || "Erreur lors de l'inscription avec Google"); }
  };

  /* ── Soumission finale ── */
  const handleRegister = async () => {
    if (!cguAccepted) { setError("Vous devez accepter les CGU pour continuer."); return; }
    setError(null);
    setLoading(true);
    try {
      const checkRes  = await fetch("/api/auth/validate-signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role, childUsername: childUsername.trim() || null }) });
      const checkData = await checkRes.json();
      if (!checkData.valid) { setError(checkData.error || "Email ou pseudo déjà utilisé."); setLoading(false); return; }

      sessionStorage.setItem("educalcul_signup_data", JSON.stringify({
        role, firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim(), password,
        childUsername: childUsername.trim() || null,
        childLevel: childLevel || null,
        parentEmail: parentEmail.trim() || null,
        referralCode: referralCode.trim() || null,
        referralStatus, cguAcceptedAt: new Date().toISOString(),
      }));
      sessionStorage.setItem("educalcul_signup_mode", "email");
      router.push("/auth/inscription/select-plan");
    } catch (err: any) { setError(err.message || "Une erreur est survenue."); }
    finally { setLoading(false); }
  };

  /* ── Niveau lycée ou collège ── */
  const isLycee = !!childLevel; // toutes les options proposées sont lycée

  /* ── Couleur selon rôle ── */
  const accent = role === "child" ? "var(--greek-gold)" : "var(--greek-blue)";

  const stepContent = [
    /* ── ÉTAPE 1 : Profil ── */
    <div key="s0" className="space-y-5">
      {/* Choix rôle */}
      <div>
        <p className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>Je suis…</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { v: "parent", label: "Parent",     Icon: Users,          desc: "Je suis responsable légal" },
            { v: "child",  label: "Élève lycée", Icon: GraduationCap,  desc: "Seconde · Première · Terminale" },
          ] as const).map(({ v, label, Icon, desc }) => (
            <button
              key={v}
              type="button"
              onClick={() => { setRole(v); setChildLevel(""); setChildAnnee(""); }}
              className="relative flex flex-col items-center gap-2 p-4 rounded-2xl text-sm font-bold transition-all duration-200"
              style={{
                background: role === v ? (v === "parent" ? "var(--greek-blue)" : "var(--greek-gold)") : "var(--greek-cream)",
                border: `2px solid ${role === v ? (v === "parent" ? "var(--greek-blue)" : "var(--greek-gold)") : "rgba(197,161,72,0.25)"}`,
                color: role === v ? "#fff" : "var(--greek-blue)",
                transform: role === v ? "scale(1.02)" : "scale(1)",
                boxShadow: role === v ? "0 6px 24px rgba(15,30,58,0.2)" : "none",
              }}
            >
              <Icon className="w-6 h-6" />
              <span>{label}</span>
              <span className="text-[10px] font-normal opacity-70">{desc}</span>
              {role === v && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
                  <CheckCircle className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>

      </div>

      {/* Warning primaire / collège — visible uniquement si Élève sélectionné, animé */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: role === "child" ? "80px" : "0px",
          opacity: role === "child" ? 1 : 0,
          transform: role === "child" ? "translateY(0)" : "translateY(-6px)",
          transition: "max-height 0.35s ease, opacity 0.28s ease, transform 0.28s ease",
          marginTop: role === "child" ? "4px" : "0px",
        }}
      >
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(197,161,72,0.08)", border: "1px solid rgba(197,161,72,0.2)", color: "var(--text-muted)" }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--greek-gold)" }} />
          <span>Les élèves de <strong style={{ color: "var(--greek-blue)" }}>primaire et collège</strong> doivent obligatoirement passer par un <strong style={{ color: "var(--greek-blue)" }}>compte parent</strong>.</span>
        </div>
      </div>

      {/* Sélecteur de niveau — uniquement pour les élèves */}
      {role === "child" && (
        <div style={{ animation: "stepFadeUp 0.3s ease forwards" }}>
          <p className="text-xs font-bold mb-2 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
            <BookOpen className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Ta classe
          </p>

          {/* Choix de l'année */}
          <div className="flex gap-2 mb-3">
            {LYCEE_ANNEES.map(annee => (
              <button
                key={annee}
                type="button"
                onClick={() => { setChildAnnee(annee); setChildLevel(""); }}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                style={{
                  background: childAnnee === annee ? "var(--greek-blue)" : "var(--greek-cream)",
                  color:      childAnnee === annee ? "#fff" : "var(--greek-blue)",
                  border:     `1.5px solid ${childAnnee === annee ? "var(--greek-blue)" : "rgba(197,161,72,0.25)"}`,
                }}
              >
                {annee}
              </button>
            ))}
          </div>

          {/* Filières selon l'année */}
          {childAnnee && (
            <div className="flex flex-wrap gap-2" style={{ animation: "stepFadeUp 0.25s ease forwards" }}>
              {LYCEE_FILIERES[childAnnee].map(filiere => (
                <button
                  key={filiere}
                  type="button"
                  onClick={() => setChildLevel(filiere)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200"
                  style={{
                    background: childLevel === filiere ? "var(--greek-gold)" : "var(--greek-cream)",
                    color:      childLevel === filiere ? "#fff" : "var(--greek-blue)",
                    border:     `1.5px solid ${childLevel === filiere ? "var(--greek-gold)" : "rgba(197,161,72,0.25)"}`,
                  }}
                >
                  {filiere}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" icon={<User className="w-4 h-4" />} value={firstName} onChange={setFirstName} placeholder="Marie" required />
        <Field label="Nom"    icon={<User className="w-4 h-4" />} value={lastName}  onChange={setLastName}  placeholder="Dupont" required />
      </div>
    </div>,

    /* ── ÉTAPE 2 : Sécurité ── */
    <div key="s1" className="space-y-4">
      {role === "parent" ? (
        <Field label="Email" icon={<Mail className="w-4 h-4" />} type="email" value={email} onChange={setEmail} placeholder="parent@exemple.com" required />
      ) : (
        <>
          {/* Niveau (affiché en lecture seule — sélectionné à l'étape 1) */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(197,161,72,0.10)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-gold)" }}>
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Niveau : <strong>{childLevel}</strong> — Lycée</span>
          </div>

          <Field label="Pseudo" icon={<User className="w-4 h-4" />} value={childUsername} onChange={setChildUsername} placeholder="chouette123" required />
          <Field label="Ton email" icon={<Mail className="w-4 h-4" />} type="email" value={email} onChange={setEmail} placeholder="toi@exemple.com" required />
          <div>
            <Field label="Email d'un parent" icon={<Mail className="w-4 h-4" />} type="email" value={parentEmail} onChange={setParentEmail} placeholder="parent@exemple.com (optionnel)" />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Optionnel — tes parents pourront suivre ta progression.
            </p>
          </div>
        </>
      )}

      <Field
        label="Mot de passe"
        icon={<Lock className="w-4 h-4" />}
        type={showPwd ? "text" : "password"}
        value={password} onChange={setPassword} placeholder="••••••••" required
        rightEl={
          <button type="button" onClick={() => setShowPwd(v => !v)} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
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
          <button type="button" onClick={() => setShowPwd2(v => !v)} className="opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
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
          <p><span className="opacity-60">Rôle :</span> {role === "parent" ? "Parent" : "Élève"}</p>
          <p><span className="opacity-60">Nom :</span> {firstName} {lastName}</p>
          {role === "parent" && <p><span className="opacity-60">Email :</span> {email}</p>}
          {role === "child"  && <p><span className="opacity-60">Pseudo :</span> {childUsername}</p>}
          {role === "child"  && <p><span className="opacity-60">Niveau :</span> {childLevel}</p>}
          {role === "child"  && <p><span className="opacity-60">Email :</span> {email}</p>}
        </div>
      </div>

      {role === "parent" && (
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
              placeholder="EX: RUBEN3K7P"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {referralValidating && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
              {!referralValidating && referralStatus === "valid"   && <CheckCircle className="w-4 h-4 text-green-500" />}
              {!referralValidating && referralStatus === "invalid" && <AlertCircle className="w-4 h-4 text-red-400" />}
            </span>
          </div>
          {referralStatus === "valid"   && <p className="text-xs text-green-600 font-medium mt-1">✓ Code valide — remise appliquée</p>}
          {referralStatus === "invalid" && <p className="text-xs text-red-400 mt-1">Code invalide ou expiré</p>}
        </div>
      )}

      {/* CGU */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox" checked={cguAccepted}
          onChange={e => setCguAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded shrink-0"
          style={{ accentColor: accent }}
        />
        <span className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          J'accepte les{" "}
          <a href="/cgu" target="_blank" className="font-semibold hover:underline" style={{ color: accent }}>CGU</a>{" "}
          et la{" "}
          <a href="/politique-confidentialite" target="_blank" className="font-semibold hover:underline" style={{ color: accent }}>Politique de confidentialité</a>
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
                <span className="text-xs font-medium hidden sm:block" style={{ color: i === step ? accent : "var(--text-muted)", opacity: i === step ? 1 : 0.6 }}>
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
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--greek-cream)", color: "var(--greek-blue)", border: "1.5px solid rgba(197,161,72,0.25)" }}
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          )}

          {step < TOTAL - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={false}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent, boxShadow: "0 4px 16px rgba(15,30,58,0.2)" }}
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading || !cguAccepted}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: accent, boxShadow: "0 4px 16px rgba(15,30,58,0.2)" }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</> : <>Continuer vers les plans <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>

        {/* Séparateur + Google — uniquement sur l'étape 1 */}
        {step === 0 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>ou s'inscrire avec</span>
              <div className="flex-1 h-px" style={{ background: "rgba(197,161,72,0.15)" }} />
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "var(--greek-blue)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <GoogleIcon />
              S'inscrire avec Google
            </button>
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

      {/* ── Modale consentement mineur ── */}
      {showMinorConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.6)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-sm rounded-3xl p-7"
            style={{ background: "#fff", boxShadow: "0 24px 64px rgba(15,30,58,0.2)", animation: "stepFadeUp 0.3s ease forwards" }}
          >
            {/* Icône */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: "rgba(197,161,72,0.12)", border: "2px solid rgba(197,161,72,0.25)" }}>
                🛡️
              </div>
            </div>

            <h3 className="text-center font-bold text-xl mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--greek-blue)" }}>
              Accord parental requis
            </h3>
            <p className="text-center text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Tu es mineur(e). En créant ce compte, tu confirmes que <strong>tes parents ou tuteurs légaux</strong> sont informés et ont donné leur accord.
            </p>

            <label className="flex items-start gap-3 cursor-pointer mb-6 p-3 rounded-xl" style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.2)" }}>
              <input
                type="checkbox"
                checked={minorConsentAccepted}
                onChange={e => setMinorConsentAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded shrink-0"
                style={{ accentColor: "var(--greek-blue)" }}
              />
              <span className="text-sm leading-relaxed" style={{ color: "var(--greek-blue)" }}>
                Je confirme avoir l'accord de mes parents ou tuteurs légaux pour créer ce compte.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowMinorConsent(false); setMinorConsentAccepted(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: "var(--greek-cream)", color: "var(--greek-blue)", border: "1.5px solid rgba(197,161,72,0.25)" }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!minorConsentAccepted}
                onClick={() => { setShowMinorConsent(false); goTo(step + 1); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--greek-blue)" }}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
