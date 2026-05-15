"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const AVATARS = [
  "avatar1.png",
  "avatar2.png",
  "avatar3.png",
  "avatar4.png",
  "avatar5.png",
  "avatar6.png",
  "avatar7.png",
  "avatar8.png",
];

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

export default function AddChildPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    passwordConfirm: "",
    gradeLevel: "CP",
    avatar: "avatar1.png",
  });

  useEffect(() => {
    const checkParent = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/connexion");
        return;
      }
      // Get parent ID from public.users
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
    };
    checkParent();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!parentId) {
      setError("Erreur d'authentification parent.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      // 1. Create Auth User (This is tricky in client-side Supabase without auto-login)
      // Workaround: We use a secondary 'users' table for child profiles without real Auth for now,
      // OR we assume the parent can create a user.
      // However, creating a user usually logs them in.
      // For this demo, we will insert into public.users and simulate an auth entry if possible,
      // or just rely on the public.users table for the child logic as per the PHP version
      // which seemed to just insert into 'users' table (which might be the public one).

      // Check username uniqueness
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("child_username", formData.username)
        .maybeSingle();

      if (existingUser) {
        setError("Ce nom d'utilisateur est déjà pris.");
        setLoading(false);
        return;
      }

      // Create Auth User via API (server-side to avoid auto-login)
      const email = `${formData.username}@educalcul.user`;

      const response = await fetch("/api/create-child", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: formData.password,
          user_metadata: {
            role: "child",
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte.");
      }

      const newAuthId = data.user.id;

      // Insert into public.users
      const { error: insertError } = await supabase.from("users").insert({
        auth_id: newAuthId, // Link to Auth User
        parent_id: parentId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        child_username: formData.username,
        grade_level: formData.gradeLevel,
        avatar: formData.avatar,
        role: "child",
        status: "active",
      });

      if (insertError) throw insertError;

      setSuccess(`L'enfant ${formData.firstName} a été ajouté avec succès !`);
      setFormData({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        passwordConfirm: "",
        gradeLevel: "CP",
        avatar: "avatar1.png",
      });

      setTimeout(() => {
        router.push("/parent/children");
      }, 1500);
    } catch (err: any) {
      console.error("Error adding child:", err);
      // Detailed error logging
      if (err) {
        console.error("Error code:", err.code);
        console.error("Error message:", err.message);
        console.error("Error details:", err.details);
        console.error("Error hint:", err.hint);
      }
      setError(
        err.message || "Une erreur est survenue lors de l'ajout de l'enfant."
      );
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
        <p className="text-gray-600 text-lg">
          Créez un profil pour suivre sa progression
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden p-8">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur (Pseudo)
              </label>
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9_]+"
                title="Lettres, chiffres et underscores uniquement"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sera utilisé pour la connexion de l'enfant.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.passwordConfirm}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passwordConfirm: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
                />
              </div>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)]"
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
                        : "border-transparent hover:border-gray-200 hover:scale-105"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
              ) : (
                <Save className="w-6 h-6 mr-2" />
              )}
              <span className="text-lg">Enregistrer l'enfant</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
