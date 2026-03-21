"use client";

import React, { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  Send, 
  Trash2, 
  Loader2, 
  Pin, 
  Lock, 
  Star, 
  MessageSquare,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ForumRole } from "./ForumApp";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  child_username?: string;
  avatar: string | null;
  role: string;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  author: User;
}

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  is_locked: boolean;
  author: User;
  category: { name: string };
  comments: Comment[];
}

export default function ForumThread({ 
  role, 
  postId, 
  userAuthId, 
  onBack 
}: { 
  role: ForumRole, 
  postId: number, 
  userAuthId: string | null, 
  onBack: () => void 
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const isAdmin = role === "admin";

  useEffect(() => {
    fetchThread();
  }, [postId]);

  const fetchThread = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("forum_posts")
        .select(`
          *,
          author:users(id, first_name, last_name, child_username, avatar, role),
          category:forum_categories(name),
          comments:forum_comments(
            id, content, created_at,
            author:users(id, first_name, last_name, child_username, avatar, role)
          )
        `)
        .eq("id", postId)
        .single();

      if (error) throw error;
      
      // Sort comments by date
      if (data && data.comments) {
        data.comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      
      setPost(data);
    } catch (error) {
      console.error("Error fetching thread:", error);
    } finally {
      setLoading(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !userAuthId || post?.is_locked) return;

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", userAuthId)
        .single();

      if (!userData) return;

      const { error } = await supabase
        .from("forum_comments")
        .insert({
          post_id: postId,
          author_id: userData.id,
          content: newComment
        });

      if (error) throw error;
      setNewComment("");
      fetchThread();
    } catch (error) {
      console.error("Error posting comment:", error);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    try {
      const { error } = await supabase.from("forum_comments").delete().eq("id", commentId);
      if (error) throw error;
      fetchThread();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const deletePost = async () => {
    if (!confirm("Supprimer ce sujet et tous les commentaires ?")) return;
    try {
      const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
      if (error) throw error;
      onBack();
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const togglePin = async () => {
    if (!post) return;
    try {
      const { error } = await supabase.from("forum_posts").update({ is_pinned: !post.is_pinned }).eq("id", postId);
      if (error) throw error;
      fetchThread();
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const toggleLock = async () => {
    if (!post) return;
    try {
      const { error } = await supabase.from("forum_posts").update({ is_locked: !post.is_locked }).eq("id", postId);
      if (error) throw error;
      fetchThread();
    } catch (error) {
      console.error("Error toggling lock:", error);
    }
  };

  if (loading || !post) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  const getAuthorName = (a: any) => a.child_username || `${a.first_name || ""} ${a.last_name || ""}`.trim() || 'Héro';

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="p-3 bg-white border border-[var(--greek-gold)]/20 text-[var(--greek-blue)] rounded-2xl hover:bg-gray-50 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] tracking-tight">
              Discussion
            </h2>
            <div className="h-1.5 w-16 bg-[var(--greek-gold)] rounded-full mt-2 shadow-sm"></div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <button 
              onClick={togglePin} 
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 ${
                post.is_pinned 
                ? 'bg-[var(--greek-gold)] text-[var(--greek-blue)] shadow-lg' 
                : 'bg-white border border-gray-200 text-gray-400 hover:border-[var(--greek-gold)] hover:text-[var(--greek-gold)]'
              }`}
            >
              <Pin className="w-4 h-4" />
              {post.is_pinned ? 'Épinglé' : 'Épingler'}
            </button>
            <button 
              onClick={toggleLock} 
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 ${
                post.is_locked 
                ? 'bg-red-500 text-white shadow-lg' 
                : 'bg-white border border-gray-200 text-gray-400 hover:border-red-500 hover:text-red-500'
              }`}
            >
              <Lock className="w-4 h-4" />
              {post.is_locked ? 'Verrouillé' : 'Verrouiller'}
            </button>
            <button 
              onClick={deletePost} 
              className="px-5 py-2.5 text-xs font-black bg-white border border-red-100 text-red-300 hover:bg-red-500 hover:text-white rounded-xl transition-all uppercase tracking-widest"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {/* Original Post */}
        <div className="bg-white border border-[var(--card-border-antique)] rounded-[20px] p-10 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-[var(--greek-blue)]">
             <MessageSquare className="w-48 h-48" />
          </div>

          <div className="flex items-start gap-8 relative z-10">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-xl border-4 border-white transition-transform duration-500`}>
              <div className={`w-full h-full flex items-center justify-center ${
                post.author?.role === 'admin' ? 'bg-red-500' : post.author?.role === 'parent' ? 'bg-blue-500' : 'bg-green-500'
              }`}>
                {post.author?.avatar ? (
                  <img src={`/avatars/${post.author.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (getAuthorName(post.author || {}).charAt(0).toUpperCase())}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                 <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${
                   post.author?.role === 'admin' ? 'bg-red-50 text-red-700' : post.author?.role === 'parent' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                 }`}>
                   {post.author?.role === 'admin' ? 'Prof' : post.author?.role === 'parent' ? 'Parent' : 'Héros'}
                 </span>
                 <span className="text-[var(--greek-blue)] font-bold">par <span className="text-gray-900 underline decoration-[var(--greek-gold)] decoration-2 underline-offset-4">{getAuthorName(post.author || {})}</span></span>
                 <span className="text-gray-300 font-bold italic text-sm">• {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
              </div>
              
              <h1 className="text-4xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-6 tracking-tight leading-tight">{post.title}</h1>
              
              <div className="text-gray-600 text-xl leading-relaxed whitespace-pre-wrap mb-10 border-l-4 border-gray-100 pl-8">
                 {post.content}
              </div>

              <div className="flex items-center gap-2 text-gray-300 font-black text-[10px] uppercase tracking-[0.3em]">
                 <Star className="w-3 h-3 text-[var(--greek-gold)] fill-current" />
                 <span>Fin du message</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
             <h3 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Commentaires</h3>
             <div className="h-0.5 flex-1 bg-gray-100 rounded-full"></div>
             <div className="bg-blue-50 text-[var(--greek-blue)] px-3 py-1 rounded-full text-sm font-black">{post.comments?.length || 0}</div>
          </div>

          <div className="space-y-6">
            {post.comments?.map((comment) => (
              <div key={comment.id} className="group flex gap-6 bg-white border border-gray-100 rounded-[20px] p-8 shadow-sm hover:shadow-md transition-all relative">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-md border-2 border-white`}>
                  <div className={`w-full h-full flex items-center justify-center ${
                    comment.author?.role === 'admin' ? 'bg-red-500' : comment.author?.role === 'parent' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {comment.author?.avatar ? (
                      <img src={`/avatars/${comment.author.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (getAuthorName(comment.author || {}).charAt(0).toUpperCase())}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                       <span className="text-[var(--greek-blue)] font-black text-lg">{getAuthorName(comment.author || {})}</span>
                       <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${
                         comment.author?.role === 'admin' ? 'bg-red-50 text-red-600' : comment.author?.role === 'parent' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                       }`}>
                         {comment.author?.role === 'admin' ? 'Prof' : comment.author?.role === 'parent' ? 'Parent' : 'Héros'}
                       </span>
                       <span className="text-gray-300 font-bold italic text-xs">• {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</span>
                    </div>
                    {(isAdmin || comment.author?.id === userAuthId || comment.author?.role === role) && (
                      <button onClick={() => deleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-xl transition-all shadow-sm">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <p className="text-gray-600 text-lg leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          <div className={`mt-10 bg-white border-2 border-[var(--greek-gold)]/20 rounded-[24px] p-8 shadow-2xl ${post.is_locked ? 'opacity-60 grayscale' : ''}`}>
            {post.is_locked ? (
              <div className="text-center py-6">
                <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-500 font-black uppercase tracking-widest">Cette discussion est verrouillée par le professeur.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
                     <div className="w-2 h-2 bg-[var(--greek-gold)] rounded-full"></div>
                     Rédiger une réponse
                  </h4>
                </div>
                <div className="relative">
                  <textarea 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full p-6 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-[var(--greek-gold)] focus:bg-white transition-all outline-none h-32 text-lg font-medium shadow-inner"
                    placeholder="Participe à la discussion..."
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-gray-300 font-bold">Appuie sur Envoyer</div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={postComment}
                    className="flex items-center gap-3 bg-[var(--greek-blue)] text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-800 shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest group"
                  >
                    Envoyer <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
