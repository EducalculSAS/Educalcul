"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import PasswordStrength from "@/components/PasswordStrength";

export default function CompleteGoogleProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"parent">("parent");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/inscription"); return; }

      // Compte complété = role défini ET first_name rempli par notre flow
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
      setLoading(false);
    };
    init();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Prénom et nom sont obligatoires.");
      return;
    }
    if (!password) {
      setError("Le mot de passe est obligatoire.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);

    // Si un mot de passe est défini, l'ajouter au compte Google via Supabase
    if (password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        setError("Impossible de définir le mot de passe : " + pwErr.message);
        setSaving(false);
        return;
      }
      // Email de sécurité : méthode de connexion ajoutée
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch("/api/auth/security-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ event: "method_linked", method: "Email + Mot de passe" }),
        }).catch(console.error);
      }
    }

    const googleSignupData = {
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password: password || "",
      childUsername: null,
      childAge: null,
      parentEmail: null,
      referralCode: null,
      referralStatus: "idle",
    };
    sessionStorage.setItem("educalcul_signup_data", JSON.stringify(googleSignupData));
    sessionStorage.setItem("educalcul_signup_mode", "google");
    sessionStorage.setItem("educalcul_pending_role", role);

    router.push("/auth/inscription/select-plan");
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" />
    </div>
  );

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 bg-[var(--greek-blue)] rounded-full flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--greek-blue)] font-bold mb-1">
            Complétez votre profil
          </h1>
          <p className="text-gray-500 text-sm">
            Connecté avec Google · Renseignez vos informations
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-xl border text-sm" style={{ background: "var(--greek-blue)", borderColor: "rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.9)" }}>
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email (lecture seule) */}
          <div>
            <label className="block text-[var(--greek-blue)] font-bold mb-1.5 text-sm">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                readOnly
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Email fourni par Google, non modifiable</p>
          </div>

          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-1.5 text-sm">Prénom *</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[rgba(197,161,72,0.3)] rounded-xl focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 text-sm"
                placeholder="Prénom"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--greek-blue)] font-bold mb-1.5 text-sm">Nom *</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[rgba(197,161,72,0.3)] rounded-xl focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 text-sm"
                placeholder="Nom"
                required
              />
            </div>
          </div>

          {/* Mot de passe optionnel */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-[var(--greek-blue)] font-bold mb-1 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Mot de passe *
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Vous pourrez vous connecter avec votre email + ce mot de passe en plus de Google.
            </p>
            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-[rgba(197,161,72,0.3)] rounded-xl focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 text-sm"
                placeholder="6 caractères minimum"
                required
              />
              <PasswordStrength password={password} />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-[rgba(197,161,72,0.3)] rounded-xl focus:outline-none focus:border-[var(--greek-blue)] focus:ring-1 focus:ring-[var(--greek-blue)]/30 text-sm"
                placeholder="Confirmer le mot de passe"
                required
              />
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-[var(--greek-blue)] font-bold mb-1.5 text-sm">Vous êtes *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole("parent")}
                className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-colors border-[var(--greek-blue)] bg-[var(--greek-blue)] text-white"
              >
                Parent
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">L'inscription enfant se fait via le compte parent.</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary-greek w-full flex justify-center items-center gap-2 mt-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
              : <><CheckCircle className="w-4 h-4" /> Choisir un abonnement</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
