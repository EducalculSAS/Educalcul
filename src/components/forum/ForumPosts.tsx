"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquare, Plus, ArrowLeft, Clock, Pin, Lock, MessageCircle, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ForumRole } from "./ForumApp";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import { avatarUrl } from "@/lib/avatarUrl";
import { getNameColor } from "@/lib/badgeStyles";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { useConfirm } from "@/components/ConfirmDialog";

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  is_locked: boolean;
  author: { id: string; first_name: string; last_name: string; child_username?: string; avatar: string | null; role: string; equipped_border?: string | null; name_color?: string | null; };
  comments: { count: number }[];
}

const roleLabel = (r: string) => r === "admin" ? "Admin" : r === "parent" ? "Parent" : "Élève";
const roleBadge = (r: string) => r === "admin" ? "bg-red-50 text-red-700" : r === "parent" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700";
const roleAvatar = (r: string) => r === "admin" ? "bg-red-500" : r === "parent" ? "bg-blue-500" : "bg-green-500";
const authorName = (a: any) => a?.child_username || `${a?.first_name || ""} ${a?.last_name || ""}`.trim() || "Utilisateur";

export default function ForumPosts({ role, categoryId, categoryName, onBack, onSelectPost, userAuthId }: {
  role: ForumRole; categoryId: number; categoryName: string;
  onBack: () => void; onSelectPost: (id: number) => void; userAuthId: string | null;
}) {
  const confirm = useConfirm();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => { fetchPosts(); }, [categoryId]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forum_posts")
      .select("*, author:user_public_profiles(id, first_name, last_name, child_username, avatar, role, equipped_border, name_color), comments:forum_comments(count)")
      .eq("category_id", categoryId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || !userAuthId) return;
    const { data: u } = await supabase.from("users").select("id").eq("auth_id", userAuthId).single();
    if (!u) return;
    await supabase.from("forum_posts").insert({ category_id: categoryId, author_id: u.id, title: newPostTitle, content: newPostContent });
    setShowModal(false);
    setNewPostTitle("");
    setNewPostContent("");
    fetchPosts();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!(await confirm("Supprimer ce sujet et ses commentaires ?"))) return;
    await supabase.from("forum_posts").delete().eq("id", id);
    fetchPosts();
  };

  const buildProfileHref = (userId: string | number | undefined | null) => {
    if (!userId) return "#";
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const returnTo = encodeURIComponent(currentUrl);
    return role === "admin" ? `/admin/users/detail?id=${userId}` : `/u/${userId}?returnTo=${returnTo}`;
  };

  if (loading) return <div className="p-12 flex justify-center"><AppAdminLoader /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white border border-[rgba(197,161,72,0.25)] text-[var(--greek-blue)] rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">{categoryName}</h2>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[var(--greek-blue)] text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-blue-800 shadow-sm transition-all">
          <Plus className="w-4 h-4" /> Nouveau sujet
        </button>
      </div>

      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] text-gray-400">
            Aucun sujet. Lancez la première discussion !
          </div>
        )}
        {posts.map((post) => {
          const commentCount = post.comments?.[0]?.count || 0;
          const name = authorName(post.author);
          const profileHref = buildProfileHref(post.author?.id);
          return (
            <div
              key={post.id}
              onClick={() => onSelectPost(post.id)}
              className={`group cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-4 ${post.is_pinned ? "border-l-4 border-l-[var(--greek-gold)] border-[rgba(197,161,72,0.25)]" : "border-[rgba(197,161,72,0.25)]"}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Link href={profileHref} title="Voir le profil" className="shrink-0 hover:opacity-80 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <AvatarWithBorder
                    avatar={post.author?.avatar}
                    equippedBorder={post.author?.equipped_border}
                    name={name}
                    size="md"
                    bgClass={roleAvatar(post.author?.role)}
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {post.is_pinned && <Pin className="w-3.5 h-3.5 text-[var(--greek-gold)] fill-current shrink-0" />}
                    {post.is_locked && <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <h3 className="font-bold text-[var(--greek-blue)] truncate">{post.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${roleBadge(post.author?.role)}`}>{roleLabel(post.author?.role)}</span>
                    <Link href={profileHref} className={`no-underline hover:no-underline ${getNameColor(post.author?.name_color || 'default').cls}`} onClick={(e) => e.stopPropagation()}>{name}</Link>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-semibold">{commentCount}</span>
                </div>
                {role === "admin" && (
                  <button onClick={(e) => handleDelete(e, post.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl border border-[var(--greek-gold)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouveau sujet</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Titre *</label>
                <input type="text" value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] text-sm" placeholder="Ex : Comment résoudre cet exercice ?" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Message *</label>
                <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)} className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] text-sm h-40 resize-none" placeholder="Décris ta question ou ton sujet..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[rgba(197,161,72,0.25)] text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
                <button onClick={handleCreatePost} className="flex-1 px-4 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-bold hover:bg-blue-800">Publier</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
