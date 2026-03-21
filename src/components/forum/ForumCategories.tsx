"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Users, Folder, Star, Loader2, ArrowRight } from "lucide-react";
import { ForumRole } from "./ForumApp";

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  forum_posts: { count: number }[];
}

export default function ForumCategories({ role, onSelectCategory }: { role: ForumRole, onSelectCategory: (id: number, name: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/forum/categories");
      const data = await res.json();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await fetch("/api/forum/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });
      setShowModal(false);
      setNewCatName("");
      setNewCatDesc("");
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const isChild = role === "child";
  const isParent = role === "parent";

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-12">
      {/* Header removal (moved to page shell) */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] tracking-tight">
            Toutes les Catégories
          </h2>
          <div className="h-1.5 w-24 bg-[var(--greek-gold)] rounded-full mt-2 shadow-sm"></div>
        </div>
        {role === "admin" && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[var(--greek-gold)] text-[var(--greek-blue)] px-6 py-3 rounded-2xl font-black hover:bg-yellow-500 shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-0">
            <Plus className="w-6 h-6" /> NOUVELLE CATÉGORIE
          </button>
        )}
      </div>

      <div className="p-8 bg-[var(--greek-cream)]/10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((cat, idx) => {
            const count = cat.forum_posts?.[0]?.count || 0;
            return (
              <div 
                key={cat.id}
                onClick={() => onSelectCategory(cat.id, cat.name)}
                className="group cursor-pointer transition-all duration-300 bg-white border border-[var(--card-border-antique)] rounded-[20px] p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 relative overflow-hidden h-full flex flex-col"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-[var(--greek-blue)]">
                   <Star className="w-24 h-24" />
                </div>

                <div className="w-16 h-16 bg-blue-50 text-[var(--greek-blue)] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[var(--greek-gold)]/10 transition-all duration-300">
                  <MessageSquare className="w-8 h-8" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] transition-colors group-hover:text-[var(--greek-gold)]">{cat.name}</h3>
                  <p className="text-gray-500 text-lg mb-8 line-clamp-2 leading-relaxed">{cat.description}</p>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
                   <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-widest">
                      <Users className="w-4 h-4" />
                      <span>{count} {count > 1 ? 'sujets' : 'sujet'}</span>
                   </div>
                   <div className="flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all">
                      Explorer <ArrowRight className="w-5 h-5 ml-1" />
                   </div>
                </div>
              </div>
            );
          })}
      </div>
        
        {categories.length === 0 && (
          <div className="text-center py-24 bg-white/50 rounded-[40px] border-4 border-dashed border-[var(--greek-gold)]/20 text-gray-400 italic font-bold">
            Aucune catégorie pour le moment. L'aventure commence bientôt !
          </div>
        )}
      </div>

      {/* Admin Modal */}
      {showModal && role === "admin" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nouvelle Catégorie</h2>
            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nom de la catégorie" className="p-3 border rounded-lg w-full" required />
              <textarea value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Description" className="p-3 border rounded-lg w-full h-24" />
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
