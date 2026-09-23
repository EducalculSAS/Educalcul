"use client";

import AvatarPicker from "@/components/AvatarPicker";
import { useState } from "react";
import Image from "next/image";
import { UserPlus, Save, Loader2, AlertCircle, CheckCircle, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { AVATARS, SCHOOL_LEVELS, SCHOOL_LEVEL_GROUPS } from "@/lib/constants";
import { validatePassword, isValidEmail } from "@/lib/validation";
import GlassButton from "@/components/ui/GlassButton";

const SPECIALTY_LEVELS = new Set([
  "2nde", "1ere-generale", "1ere-generale-maths", "1ere-sti2d", "1ere-stmg", "1ere-st2s", "1ere-stl", "1ere-std2a", "1ere-sthr",
  "terminale-generale", "terminale-generale-maths", "terminale-generale-expertes", "terminale-generale-complementaires",
  "terminale-sti2d", "terminale-stmg", "terminale-st2s", "terminale-stl",
]);

/** Formulaire de création d'un profil enfant : entièrement mutations, isolé
 * en client island. Le rattachement au parent est fait côté serveur. */
export default function AddChildForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", username: "",
    password: "", passwordConfirm: "", gradeLevel: "cp", avatar: "avatar1.png",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!isValidEmail(formData.email)) {
      setError("Adresse email invalide.");
      setLoading(false);
      return;
    }

    const pwError = validatePassword(formData.password);
    if (pwError) {
      setError(pwError);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      // Tout est fait côté serveur (/api/create-child) : compte Auth + profil
      // public.users, avec parent_id forcé au parent connecté et unicité du
      // username vérifiée là-bas. Plus aucune écriture directe depuis le client.
      const response = await fetch("/api/create-child", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username || null,
          gradeLevel: formData.gradeLevel,
          avatar: formData.avatar,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la création du compte.");

      setSuccess(`L'enfant ${formData.firstName} a été ajouté avec succès !`);
      setFormData({ firstName: "", lastName: "", email: "", username: "", password: "", passwordConfirm: "", gradeLevel: "cp", avatar: "avatar1.png" });

      setTimeout(() => {
        router.push("/parent/children");
      }, 1500);
    } catch (err: any) {
      console.error("Error adding child:", err);
      setError(err.message || "Une erreur est survenue lors de l'ajout de l'enfant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <UserPlus className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Ajouter un Enfant
        </h1>
        <p className="text-gray-600 text-lg">Créez un profil pour suivre sa progression</p>
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden p-8">
        <div>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center border border-red-200">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6 flex items-center border border-green-200">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input type="text" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input type="text" required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de l'enfant</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              <p className="text-xs text-gray-500 mt-1">Utilisé pour la connexion et pour recevoir les notifications de l'enfant.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur (Pseudo) — optionnel</label>
              <input type="text" pattern="[a-zA-Z0-9_]+" title="Lettres, chiffres et underscores uniquement" value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              <p className="text-xs text-gray-500 mt-1">Permet aussi de se connecter avec ce pseudo en plus de l'email.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                <input type="password" required minLength={6} value={formData.passwordConfirm} onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire & voie</label>
              <select value={formData.gradeLevel} onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]">
                {SCHOOL_LEVEL_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.levels.map((val) => {
                      const found = SCHOOL_LEVELS.find((l) => l.value === val);
                      return found ? <option key={found.value} value={found.value}>{found.label}</option> : null;
                    })}
                  </optgroup>
                ))}
              </select>
              {SPECIALTY_LEVELS.has(formData.gradeLevel) && (
                <p className="text-xs text-[var(--greek-bronze)] mt-1.5 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> La filière sélectionnée sera utilisée pour adapter les contenus au programme officiel.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Avatar</label>
              <AvatarPicker value={formData.avatar} onChange={(avatar) => setFormData({ ...formData, avatar })} />
            </div>

            <GlassButton
              onClick={() => handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
              variant="navy"
              fullWidth
              disabled={loading}
              className="!py-4"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              <span className="text-lg">Enregistrer l'enfant</span>
            </GlassButton>
          </form>
        </div>
      </div>
    </div>
  );
}
