"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle, BookOpen, Users, GraduationCap } from "lucide-react";
import PasswordStrength from "@/components/PasswordStrength";

const LYCEE_FILIERES: Record<string, string[]> = {
  "Seconde":   ["Seconde GT", "Seconde Pro"],
  "Première":  ["1ère Générale", "1ère STMG", "1ère STI2D", "1ère ST2S", "1ère STL", "1ère STD2A", "1ère Bac Pro"],
  "Terminale": ["Terminale Générale", "Terminale STMG", "Terminale STI2D", "Terminale ST2S", "Terminale STL", "Terminale STD2A", "Terminale Bac Pro"],
};
const LYCEE_ANNEES = Object.keys(LYCEE_FILIERES) as ("Seconde" | "Première" | "Terminale")[];

export default function CompleteGoogleProfile() {
  const router = useRouter();
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  /* Commun */
  const [firstName, setFirstName]           = useState("");
  const [lastName, setLastName]             = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole]                     = useState<"parent" | "child" | "">("");

  /* Enfant */
  const [childUsername, setChildUsername]   = useState("");
  const [childAnnee, setChildAnnee]         = useState<"Seconde" | "Première" | "Terminale" | "">("");
  const [childLevel, setChildLevel]         = useState("");
  const [parentEmail, setParentEmail]       = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/inscription"); return; }

      // Compte déjà complet → dashboard
      const { data: existing } = await supabase
        .from("users").select("role, first_name").eq("auth_id", session.user.id).maybeSingle();
      if (existing?.role && existing.role !== "user" && existing.first_name) {
        router.push("/dashboard"); return;
      }

      // Pré-remplir depuis Google
      const meta = session.user.user_metadata;
      const fullName = meta?.full_name || meta?.name || "";
      const parts = fullName.trim().split(" ");
      setFirstName(meta?.given_name || parts[0] || "");
      setLastName(meta?.family_name || parts.slice(1).join(" ") || "");
      setEmail(session.user.email || "");

      // Récupérer rôle + données pré-remplies depuis l'inscription
      try {
        const stored = sessionStorage.getItem("educalcul_signup_data");
        const pendingRole = sessionStorage.getItem("educalcul_pending_role");
        // Pré-sélectionner si déjà choisi avant Google, sinon laisser vide (choix dans cette page)
        if (pendingRole === "child" || pendingRole === "parent") setRole(pendingRole);

        if (stored) {
          const d = JSON.parse(stored);
          if (d.firstName)   setFirstName(v => v || d.firstName);
          if (d.lastName)    setLastName(v => v || d.lastName);
          if (d.childAnnee)  setChildAnnee(d.childAnnee);
          if (d.childLevel)  setChildLevel(d.childLevel);
        }
      } catch {}

      setLoading(false);
    };
    init();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Veuillez sélectionner votre profil (Parent ou Élève)."); return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("Prénom et nom sont obligatoires."); return;
    }
    if (role === "child") {
      if (!childUsername.trim()) { setError("Veuillez choisir un pseudo."); return; }
      if (!childLevel)           { setError("Veuillez sélectionner ta filière."); return; }
    }
    if (!password) { setError("Le mot de passe est obligatoire."); return; }
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }

    setSaving(true);

    // Ajouter le mot de passe au compte Google
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      setError("Impossible de définir le mot de passe : " + pwErr.message);
      setSaving(false); return;
    }

    // Email de sécurité
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch("/api/auth/security-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ event: "method_linked", method: "Email + Mot de passe" }),
      }).catch(console.error);
    }

    const signupData = {
      role: role as "parent" | "child",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password,
      childUsername: role === "child" ? childUsername.trim() : null,
      childLevel:    role === "child" ? childLevel : null,
      parentEmail:   role === "child" && parentEmail ? parentEmail.trim() : null,
      referralCode: null,
      referralStatus: "idle",
    };
    sessionStorage.setItem("educalcul_signup_data", JSON.stringify(signupData));
    sessionStorage.setItem("educalcul_signup_mode", "google");
    sessionStorage.setItem("educalcul_pending_role", role);

    router.push("/auth/inscription/select-plan");
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--greek-blue)" }} />
    </div>
  );

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="font-bold mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", color: "var(--greek-blue)" }}>
          Complétez votre profil
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Connecté avec Google · Finalisez votre inscription
        </p>
      </div>

      <div className="rounded-3xl p-7" style={{ background: "#fff", boxShadow: "0 8px 48px rgba(15,30,58,0.10)", border: "1px solid rgba(197,161,72,0.18)" }}>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 mb-5 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Choix rôle */}
          <div>
            <p className="text-xs font-bold mb-2 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>Je suis…</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { v: "parent", label: "Parent",      Icon: Users,         desc: "Responsable légal" },
                { v: "child",  label: "Élève lycée",  Icon: GraduationCap, desc: "Seconde · Première · Terminale" },
              ] as const).map(({ v, label, Icon, desc }) => (
                <button key={v} type="button"
                  onClick={() => { setRole(v); setChildLevel(""); setChildAnnee(""); }}
                  className="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl text-sm font-bold transition-all duration-200"
                  style={{
                    background: role === v ? (v === "parent" ? "var(--greek-blue)" : "var(--greek-gold)") : "var(--greek-cream)",
                    border: `2px solid ${role === v ? (v === "parent" ? "var(--greek-blue)" : "var(--greek-gold)") : "rgba(197,161,72,0.25)"}`,
                    color: role === v ? "#fff" : "var(--greek-blue)",
                    transform: role === v ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                  <span className="text-[10px] font-normal opacity-70">{desc}</span>
                  {role === v && <span className="absolute top-2 right-2"><CheckCircle className="w-3.5 h-3.5" /></span>}
                </button>
              ))}
            </div>
            <div
              style={{
                overflow: "hidden",
                maxHeight: role === "child" ? "60px" : "0px",
                opacity: role === "child" ? 1 : 0,
                transform: role === "child" ? "translateY(0)" : "translateY(-6px)",
                transition: "max-height 0.35s ease, opacity 0.28s ease, transform 0.28s ease",
                marginTop: role === "child" ? "8px" : "0px",
              }}
            >
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(197,161,72,0.08)", border: "1px solid rgba(197,161,72,0.2)", color: "var(--text-muted)" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--greek-gold)" }} />
                <span>Primaire et collège : inscription uniquement via un <strong style={{ color: "var(--greek-blue)" }}>compte parent</strong>.</span>
              </div>
            </div>
          </div>

          {/* Email (lecture seule) */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="email" value={email} readOnly
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.2)", color: "var(--text-muted)", cursor: "not-allowed" }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Fourni par Google, non modifiable</p>
          </div>

          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            {(["Prénom", "Nom"] as const).map((label, i) => (
              <div key={label}>
                <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>{label}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={i === 0 ? firstName : lastName}
                    onChange={e => i === 0 ? setFirstName(e.target.value) : setLastName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                    placeholder={i === 0 ? "Marie" : "Dupont"} required
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Champs spécifiques enfant */}
          {role === "child" && (
            <div className="space-y-4 pt-1">
              {/* Pseudo */}
              <div>
                <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>Pseudo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text" value={childUsername} onChange={e => setChildUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                    placeholder="chouette123" required
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                  />
                </div>
              </div>

              {/* Filière */}
              <div>
                <label className="block text-xs font-bold mb-2 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
                  <BookOpen className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Ta classe
                </label>
                <div className="flex gap-2 mb-2">
                  {LYCEE_ANNEES.map(annee => (
                    <button key={annee} type="button"
                      onClick={() => { setChildAnnee(annee); setChildLevel(""); }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: childAnnee === annee ? "var(--greek-blue)" : "var(--greek-cream)",
                        color:      childAnnee === annee ? "#fff" : "var(--greek-blue)",
                        border:     `1.5px solid ${childAnnee === annee ? "var(--greek-blue)" : "rgba(197,161,72,0.25)"}`,
                      }}
                    >{annee}</button>
                  ))}
                </div>
                {childAnnee && (
                  <div className="flex flex-wrap gap-2">
                    {LYCEE_FILIERES[childAnnee].map(f => (
                      <button key={f} type="button" onClick={() => setChildLevel(f)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: childLevel === f ? "var(--greek-gold)" : "var(--greek-cream)",
                          color:      childLevel === f ? "#fff" : "var(--greek-blue)",
                          border:     `1.5px solid ${childLevel === f ? "var(--greek-gold)" : "rgba(197,161,72,0.25)"}`,
                        }}
                      >{f}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Email parent (optionnel) */}
              <div>
                <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
                  Email d'un parent <span className="font-normal opacity-50">(optionnel)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                    placeholder="parent@exemple.com"
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mot de passe */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase" style={{ color: "var(--greek-blue)" }}>
                <Lock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Mot de passe
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                Permet de se connecter avec email + mot de passe en plus de Google.
              </p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                  placeholder="6 caractères minimum" required
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
                />
              </div>
              <PasswordStrength password={password} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)", color: "var(--greek-blue)" }}
                placeholder="Confirmer le mot de passe" required
                onFocus={e => (e.currentTarget.style.borderColor = "var(--greek-blue)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(197,161,72,0.25)")}
              />
            </div>
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ background: "var(--greek-blue)", boxShadow: "0 4px 16px rgba(15,30,58,0.25)" }}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</>
              : <><CheckCircle className="w-4 h-4" /> Choisir un abonnement</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
