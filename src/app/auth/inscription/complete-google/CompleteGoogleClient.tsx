"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import PasswordStrength from "@/components/PasswordStrength";
import { validatePassword } from "@/lib/validation";
import { getSignupSession, patchSignupSession } from "@/lib/signupSession";

const ROLE = "parent" as const;

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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/inscription"); return; }

      // Compte déjà complet → dashboard. (getMyProfile renvoie null si le profil
      // public.users n'existe pas encore : on tombe alors sur le pré-remplissage.)
      const existing = await getMyProfile<{ role?: string; first_name?: string }>();
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

      // Récupérer données pré-remplies depuis l'inscription
      const s = await getSignupSession();
      if (s.data) {
        if (s.data.firstName) setFirstName(v => v || s.data.firstName);
        if (s.data.lastName)  setLastName(v => v || s.data.lastName);
      }

      setLoading(false);
    };
    init();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Prénom et nom sont obligatoires."); return;
    }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }

    setSaving(true);

    // Ajouter le mot de passe au compte Google + les métadonnées attendues par
    // le webhook Stripe (qui créera le profil une fois le paiement confirmé —
    // les métadonnées Google brutes ne sont pas dans notre format first_name/
    // last_name/role).
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: { first_name: firstName.trim(), last_name: lastName.trim(), role: ROLE },
    });
    if (pwErr) {
      setError("Impossible de définir le mot de passe : " + pwErr.message);
      setSaving(false); return;
    }

    // updateUser({password}) fait tourner le jeton de session cote Supabase
    // (comportement documente : changer le mot de passe invalide les autres
    // sessions et peut re-emettre celle en cours). getSession() juste apres
    // peut donc encore renvoyer l'ANCIEN access_token le temps que le
    // listener onAuthStateChange du SDK rattrape le changement — provoquant
    // des 401 en cascade sur TOUT appel authentifie qui suit (security-email,
    // create-account...) et laissant un compte Google orphelin (Auth cree,
    // jamais de profil). Constate en test : refreshSession() force la
    // synchronisation avant de continuer.
    await supabase.auth.refreshSession();

    // Email de sécurité
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch("/api/auth/security-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ event: "method_linked", method: "Email + Mot de passe" }),
      }).catch(console.error);
    }

    // Le mot de passe a déjà été appliqué au compte ci-dessus (updateUser) :
    // inutile — et risqué — de le repersister ici, create-checkout-session
    // ne s'en sert jamais pour un compte déjà authentifié via Google.
    const signupData = {
      role: ROLE,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      referralCode: null,
      referralStatus: "idle",
    };
    await patchSignupSession({ mode: "google", pendingRole: ROLE, data: signupData });

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
                  placeholder="10 caractères minimum" required
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
