"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserCog,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import { AVATARS } from "@/lib/constants";

const GRADE_LEVELS = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
];

export default function EditChildPage() {
  const router = useRouter();
  const params = useParams();
  const childId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [originalUsername, setOriginalUsername] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "", // Optional
    gradeLevel: "CP",
    avatar: "avatar1.png",
  });

  useEffect(() => {
    const init = async () => {
      // 1. Check Parent
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/connexion");
        return;
      }

      const { data: parentData } = await supabase
        .from("users")
        .select("id, role")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!parentData || parentData.role !== "parent") {
        router.push("/dashboard");
        return;
      }
      setParentId(parentData.id);

      // 2. Fetch Child Data
      const { data: childData, error: childError } = await supabase
        .from("users")
        .select("*")
        .eq("id", childId)
        .eq("parent_id", parentData.id) // Security check
        .single();

      if (childError || !childData) {
        setError("Enfant introuvable ou non autorisé.");
        setLoading(false);
        return;
      }

      setOriginalUsername(childData.child_username || "");
      setFormData({
        firstName: childData.first_name,
        lastName: childData.last_name,
        username: childData.child_username,
        password: "", // Don't show existing password
        gradeLevel: childData.grade_level || "CP",
        avatar: childData.avatar || "avatar1.png",
      });
      setLoading(false);
    };
    init();
  }, [childId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Check username uniqueness if changed
      // (Implementation skipped for brevity, ideally check if username changed and exists)

      const updateData: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        child_username: formData.username,
        grade_level: formData.gradeLevel,
        avatar: formData.avatar,
      };

      // Only update password if provided
      // Note: This only updates the 'password_hash' (if we had one) or triggers a password update logic.
      // Since we are moving to Auth Users, we might need a server-side function to update the Auth user's password.
      // For now, we update public.users. If we implement the RPC for auth, we should update that too.
      // We'll leave the password update for later or use the RPC if we create it.

      const { error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", childId)
        .eq("parent_id", parentId); // Security double-check

      if (updateError) throw updateError;

      // Handle Password Update / Username (auth email) change / Auth Creation via API
      const usernameChanged = formData.username !== originalUsername;
      if ((formData.password && formData.password.length > 0) || usernameChanged) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const response = await fetch("/api/update-child-auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            childId,
            password: formData.password || undefined,
            newUsername: usernameChanged ? formData.username : undefined,
            parentAuthId: user?.id,
          }),
        });

        const authResult = await response.json();
        if (!response.ok) {
          throw new Error(
            authResult.error || "Erreur lors de la mise à jour du compte."
          );
        }
      }

      setSuccess("Profil mis à jour avec succès !");
      setTimeout(() => {
        router.push("/parent/children");
      }, 1500);
    } catch (err: any) {
      console.error("Error updating child:", err);
      setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Link href="/parent/children" className="inline-flex items-center gap-2 text-[var(--greek-blue)]/70 hover:text-[var(--greek-blue)] mb-6 transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> Mes enfants
      </Link>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <UserCog className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Modifier le Profil
        </h1>
        <p className="text-gray-600 text-lg">
          Mettez à jour les informations de {formData.firstName}
        </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur (Pseudo)
              </label>
              <input
                type="text"
                disabled
                title="Le nom d'utilisateur ne peut pas être modifié"
                value={formData.username}
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Le nom d'utilisateur ne peut pas être modifié.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe de connexion
              </label>
              <input
                type="password"
                placeholder="Laisser vide pour ne pas changer"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Remplissez ce champ pour définir ou modifier le mot de passe de
                l'enfant. Cela créera automatiquement l'accès si ce n'est pas
                déjà fait.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau scolaire
              </label>
              <select
                value={formData.gradeLevel}
                onChange={(e) =>
                  setFormData({ ...formData, gradeLevel: e.target.value })
                }
                className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
              >
                {GRADE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Avatar
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                {AVATARS.map((avatar) => (
                  <div
                    key={avatar}
                    onClick={() => setFormData({ ...formData, avatar })}
                    className={`cursor-pointer rounded-full p-1 border-2 transition-all duration-200 ${
                      formData.avatar === avatar
                        ? "border-[var(--greek-gold)] scale-110 shadow-md"
                        : "border-transparent hover:border-[rgba(197,161,72,0.25)] hover:scale-105"
                    }`}
                  >
                    <img
                      src={`/avatars/${avatar}`}
                      alt="Avatar"
                      className="w-full h-full rounded-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center px-8 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-[#2c5282] transition-colors shadow-md font-bold disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Enregistrer les modifications
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


