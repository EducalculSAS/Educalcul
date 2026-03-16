"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Users, Trash2, Edit, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import MathLoader from "@/components/MathLoader";

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  child_username: string;
  avatar?: string;
}

export default function ManageChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: parentRecord } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .eq("role", "parent")
        .maybeSingle();

      if (!parentRecord) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("parent_id", parentRecord.id)
        .eq("role", "child")
        .order("first_name");

      setChildren(data || []);
    } catch (error) {
      console.error("Error fetching children:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (childId: string) => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer ce profil enfant ? Cette action est irréversible."
      )
    ) {
      return;
    }

    setDeleteLoading(childId);
    try {
      const { error } = await supabase.from("users").delete().eq("id", childId);

      if (error) throw error;

      setChildren(children.filter((c) => c.id !== childId));
    } catch (error) {
      console.error("Error deleting child:", error);
      alert("Une erreur est survenue lors de la suppression.");
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <Users className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Mes Enfants
        </h1>
        <p className="text-gray-600 text-lg mb-8">
          Gérez les profils et les accès de vos enfants
        </p>
        <div className="flex justify-center">
          <Link
            href="/parent/add-child"
            className="flex items-center bg-[var(--greek-blue)] text-white px-6 py-3 rounded-xl hover:bg-[var(--greek-blue)] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-bold"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Ajouter un enfant
          </Link>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-12 text-center border border-white/50 max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[var(--greek-cream)] rounded-full">
              <Users className="w-16 h-16 text-[var(--greek-blue)]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)]">
            Aucun enfant ajouté
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Commencez par ajouter un profil pour votre enfant afin de suivre ses
            progrès et lui donner accès aux cours.
          </p>
          <Link
            href="/parent/add-child"
            className="inline-flex items-center text-[var(--greek-blue)] font-bold hover:text-[var(--greek-gold)] transition-colors"
          >
            Ajouter mon premier enfant
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <div
              key={child.id}
              className="bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center text-[var(--greek-blue)] font-bold text-xl mr-4 group-hover:scale-110 transition-transform overflow-hidden border-2 border-[var(--greek-gold)]/20">
                      {child.avatar ? (
                        <img
                          src={`/avatars/${child.avatar}`}
                          alt={child.first_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        child.first_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                        {child.first_name} {child.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        @{child.child_username}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] text-xs rounded-md font-medium border border-[var(--greek-blue)]/20">
                    {child.grade_level}
                  </span>
                </div>

                <div className="pt-4 border-t border-[rgba(52,73,94,0.1)] flex justify-between items-center">
                  <Link
                    href={`/parent/child/${child.id}`}
                    className="text-sm font-medium text-[var(--greek-blue)] hover:text-[var(--greek-gold)] transition-colors"
                  >
                    Voir le rapport
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      href={`/parent/edit-child/${child.id}`}
                      className="p-2 text-gray-400 hover:text-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/10 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(child.id)}
                      disabled={deleteLoading === child.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      {deleteLoading === child.id ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-[var(--greek-blue)] border-t-transparent" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
