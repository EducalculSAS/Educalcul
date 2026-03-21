"use client";

import React, { useEffect, useState } from "react";
import { 
  MessageSquare, 
  Plus, 
  ArrowLeft, 
  Clock, 
  Users, 
  Loader2, 
  Pin, 
  Lock, 
  MessageCircle, 
  Star,
  ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ForumRole } from "./ForumApp";
import { supabase } from "@/lib/supabaseClient";

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  is_locked: boolean;
  author: {
    first_name: string;
    last_name: string;
    child_username?: string;
    avatar: string | null;
    role: string;
  };
  comments: { count: number }[];
}

export default function ForumPosts({ 
  role, 
  categoryId, 
  categoryName, 
  onBack, 
  onSelectPost,
  userAuthId
}: { 
  role: ForumRole, 
  categoryId: number, 
  categoryName: string, 
  onBack: () => void, 
  onSelectPost: (id: number) => void,
  userAuthId: string | null
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");

  useEffect(() => {
    fetchPosts();
  }, [categoryId]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("forum_posts")
        .select(`
          *,
          author:users(first_name, last_name, child_username, avatar, role),
          comments:forum_comments(count)
        `)
        .eq("category_id", categoryId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || !userAuthId) return;

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", userAuthId)
        .single();

      if (!userData) return;

      const { error } = await supabase
        .from("forum_posts")
        .insert({
          category_id: categoryId,
          author_id: userData.id,
          title: newPostTitle,
          content: newPostContent
        });

      if (error) throw error;
      setShowModal(false);
      setNewPostTitle("");
      setNewPostContent("");
      fetchPosts();
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Navigation Sub-Header (Refined Style) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="p-3 bg-white border border-[var(--greek-gold)]/20 text-[var(--greek-blue)] rounded-2xl hover:bg-gray-50 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] tracking-tight">
              {categoryName}
            </h2>
            <div className="h-1.5 w-16 bg-[var(--greek-gold)] rounded-full mt-2 shadow-sm"></div>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 bg-[var(--greek-blue)] text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-800 shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-0"
        >
          <Plus className="w-6 h-6" /> 
          <span className="uppercase">Nouveau sujet</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
          {posts.map((post, idx) => {
            const commentCount = post.comments?.[0]?.count || 0;
            const authorName = post.author?.child_username || `${post.author?.first_name} ${post.author?.last_name || ""}`.trim() || 'Héro';
            
            return (
              <div 
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className={`group cursor-pointer transition-all duration-300 bg-white border border-[var(--card-border-antique)] rounded-[20px] p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 relative overflow-hidden flex items-center justify-between ${post.is_pinned ? 'border-l-8 border-l-[var(--greek-gold)]' : ''}`}
              >
                <div className="flex items-center gap-8 flex-1 min-w-0">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-[var(--greek-blue)]">
                     <Star className="w-24 h-24" />
                  </div>

                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-white shrink-0 overflow-hidden shadow-lg border-2 border-white group-hover:scale-110 transition-all duration-300`}>
                    <div className={`w-full h-full flex items-center justify-center ${
                      post.author?.role === 'admin' ? 'bg-red-500' : post.author?.role === 'parent' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {post.author?.avatar ? (
                        <img src={`/avatars/${post.author.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (authorName.charAt(0).toUpperCase())}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                       {post.is_pinned && <Pin className="w-5 h-5 text-[var(--greek-gold)] fill-current" />}
                       {post.is_locked && <Lock className="w-5 h-5 text-red-500" />}
                       <h3 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] group-hover:text-[var(--greek-gold)] transition-colors truncate">{post.title}</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                       <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${
                         post.author?.role === 'admin' ? 'bg-red-50 text-red-700' : post.author?.role === 'parent' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                       }`}>
                         {post.author?.role === 'admin' ? 'Prof' : post.author?.role === 'parent' ? 'Parent' : 'Héros'}
                       </span>
                       <span className="text-gray-400 font-bold">par <span className="text-gray-600 underline decoration-[var(--greek-gold)] decoration-2 underline-offset-4">{authorName}</span></span>
                       <span className="flex items-center gap-1.5 text-gray-300 font-bold italic"><Clock className="w-4 h-4" /> {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 ml-8">
                  <div className="flex flex-col items-center justify-center gap-1 px-5 py-3 rounded-2xl bg-blue-50 text-[var(--greek-blue)] border border-blue-100/50 group-hover:bg-[var(--greek-gold)]/10 transition-colors">
                     <MessageCircle className="w-6 h-6" />
                     <span className="font-black text-lg">{commentCount}</span>
                  </div>
                  <div className="hidden md:flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all">
                     Lire <ArrowRight className="w-5 h-5 ml-1" />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-[var(--greek-blue)]/60 backdrop-blur-md flex items-center justify-center p-6 z-[60] animate-fade-in">
          <div className="bg-white rounded-[32px] p-10 max-w-2xl w-full shadow-2xl border-4 border-[var(--greek-gold)]/20 animate-scale-up">
            <h2 className="text-3xl font-bold text-[var(--greek-blue)] mb-8 font-[family-name:var(--font-display)] flex items-center gap-4">
               <Plus className="text-[var(--greek-gold)]" size={32} />
               Lancer une Discussion
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-3">Titre du sujet</label>
                <input 
                  type="text" 
                  value={newPostTitle} 
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-[var(--greek-gold)] focus:bg-white transition-all outline-none text-lg font-bold"
                  placeholder="Ex: Comment résoudre cet exercice ?"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-3">Ton message</label>
                <textarea 
                  value={newPostContent} 
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-[var(--greek-gold)] focus:bg-white transition-all outline-none h-48 text-lg font-medium"
                  placeholder="Écris ton message ici..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 px-8 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black hover:bg-gray-50 transition-all uppercase tracking-widest">Annuler</button>
                <button onClick={handleCreatePost} className="flex-1 px-8 py-4 bg-[var(--greek-blue)] text-white rounded-2xl font-black hover:bg-blue-800 shadow-xl transition-all transform hover:-translate-y-1 uppercase tracking-widest">Publier</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
