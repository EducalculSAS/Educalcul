"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { ForumRole } from "./ForumApp";
import { supabase } from "@/lib/supabaseClient";
import { useConfirm } from "@/components/ConfirmDialog";
import AppAdminLoader from "@/components/AppAdminLoader";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  forum_posts: { count: number }[];
}

export default function ForumCategories({ role, onSelectCategory }: { role: ForumRole; onSelectCategory: (id: number, name: string) => void }) {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/forum/categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreateCategory = async () => {
    if (!newCatName) return;
    await fetch("/api/forum/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName, description: newCatDesc }),
    });
    setShowModal(false);
    setNewCatName("");
    setNewCatDesc("");
    fetchCategories();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!(await confirm("Supprimer cette catégorie et tous ses sujets ?"))) return;
    await supabase.from("forum_posts").delete().eq("category_id", id);
    await supabase.from("forum_categories").delete().eq("id", id);
    fetchCategories();
  };

  if (loading) return <div className="p-12 flex justify-center"><AppAdminLoader /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Catégories</h2>
        {role === "admin" && (
          <GlassButton onClick={() => setShowModal(true)} variant="navy" size="sm">
            <Plus className="w-4 h-4" /> Nouvelle catégorie
          </GlassButton>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const count = cat.forum_posts?.[0]?.count || 0;
          return (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.id, cat.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectCategory(cat.id, cat.name);
                }
              }}
              className="group cursor-pointer bg-white border border-[rgba(197,161,72,0.25)] rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col relative"
            >
              {role === "admin" && (
                <button
                  onClick={(e) => handleDelete(e, cat.id)}
                  aria-label="Supprimer la catégorie"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="w-12 h-12 bg-blue-50 text-[var(--greek-blue)] rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-1">{cat.name}</h3>
              <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">{cat.description}</p>
              <div className="text-xs text-gray-400 font-semibold pt-3 border-t border-[rgba(197,161,72,0.25)]">
                {count} sujet{count !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            Aucune catégorie pour le moment.
          </div>
        )}
      </div>

      {showModal && role === "admin" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-[var(--greek-gold)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouvelle catégorie</h2>
              <GlassCloseButton onClick={() => setShowModal(false)} variant="light" />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateCategory(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nom *</label>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] text-sm h-24 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <div className="flex-1"><GlassButton onClick={() => setShowModal(false)} variant="ghost" fullWidth>Annuler</GlassButton></div>
                <div className="flex-1"><GlassButton onClick={handleCreateCategory} variant="navy" fullWidth>Créer</GlassButton></div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
