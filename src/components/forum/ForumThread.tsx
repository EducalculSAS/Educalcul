"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Send, Trash2, Loader2, Pin, Lock, ExternalLink, Flag, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getBorderStyle, getNameColor } from "@/lib/badgeStyles";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import BadgeMinis from "@/components/BadgeMinis";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ForumRole } from "./ForumApp";
import { supabase } from "@/lib/supabaseClient";
import { avatarUrl } from "@/lib/avatarUrl";

interface User { id: number; first_name: string; last_name: string; child_username?: string; avatar: string | null; role: string; equipped_border?: string | null; name_color?: string | null; featured_badges?: any[]; }
interface Comment { id: number; content: string; created_at: string; author: User; }
interface Post { id: number; title: string; content: string; created_at: string; is_pinned: boolean; is_locked: boolean; author: User; category: { name: string }; comments: Comment[]; }

const roleLabel = (r: string) => r === "admin" ? "Admin" : r === "parent" ? "Parent" : "Élève";
const roleBadge = (r: string) => r === "admin" ? "bg-red-50 text-red-700" : r === "parent" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700";
const roleAvatar = (r: string) => r === "admin" ? "bg-red-500" : r === "parent" ? "bg-blue-500" : "bg-green-500";
const authorName = (a: any) => a?.child_username || `${a?.first_name || ""} ${a?.last_name || ""}`.trim() || "Utilisateur";

export default function ForumThread({ role, postId, userAuthId, userDbId, onBack }: {
  role: ForumRole; postId: number; userAuthId: string | null; userDbId: number | null; onBack: () => void;
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const isAdmin = role === "admin";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Report modal
  const [reportModal, setReportModal] = useState<{ type: "post" | "comment"; targetId: number; targetUserId: number } | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => { fetchThread(); }, [postId]);

  const fetchThread = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forum_posts")
      .select(`*, author:users(id, first_name, last_name, child_username, avatar, role, equipped_border, name_color, featured_badges), category:forum_categories(name), comments:forum_comments(id, content, created_at, author:users(id, first_name, last_name, child_username, avatar, role, equipped_border, name_color, featured_badges))`)
      .eq("id", postId)
      .single();
    if (data?.comments) data.comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setPost(data);
    setLoading(false);
  };

  const postComment = async () => {
    if (!newComment.trim() || !userAuthId || post?.is_locked) return;
    const { data: u } = await supabase.from("users").select("id").eq("auth_id", userAuthId).single();
    if (!u) return;
    await supabase.from("forum_comments").insert({ post_id: postId, author_id: u.id, content: newComment });
    setNewComment("");
    fetchThread();
  };

  const deleteComment = async (id: number) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await supabase.from("forum_comments").delete().eq("id", id);
    fetchThread();
  };

  const deletePost = async () => {
    if (!confirm("Supprimer ce sujet et tous les commentaires ?")) return;
    await supabase.from("forum_posts").delete().eq("id", postId);
    onBack();
  };

  const togglePin = async () => {
    if (!post) return;
    await supabase.from("forum_posts").update({ is_pinned: !post.is_pinned }).eq("id", postId);
    fetchThread();
  };

  const toggleLock = async () => {
    if (!post) return;
    await supabase.from("forum_posts").update({ is_locked: !post.is_locked }).eq("id", postId);
    fetchThread();
  };

  const submitReport = async () => {
    if (!reportModal || !reportReason.trim()) return;
    const { data: u } = await supabase.from("users").select("id").eq("auth_id", userAuthId!).single();
    await supabase.from("forum_reports").insert({
      reporter_id: u?.id,
      reported_user_id: reportModal.targetUserId,
      ...(reportModal.type === "post" ? { post_id: reportModal.targetId } : { comment_id: reportModal.targetId }),
      reason: reportReason.trim(),
    });
    setReportModal(null);
    setReportReason("");
  };

  const buildProfileHref = (userId: number | undefined | null) => {
    if (!userId) return "#";
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const returnTo = encodeURIComponent(currentUrl);
    return isAdmin ? `/admin/users/detail?id=${userId}` : `/u/${userId}?returnTo=${returnTo}`;
  };

  if (loading || !post) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  const AuthorChip = ({ a }: { a: any }) => {
    const nameCol = getNameColor(a?.name_color || 'default');
    const profileHref = buildProfileHref(a?.id);
    return (
      <div className="flex items-center gap-2">
        <Link href={profileHref} title="Voir le profil" className="shrink-0 hover:opacity-80 transition-opacity">
          <AvatarWithBorder avatar={a?.avatar} equippedBorder={a?.equipped_border} name={authorName(a)} size="sm" bgClass={roleAvatar(a?.role)} />
        </Link>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={profileHref} className={`font-semibold text-sm no-underline hover:no-underline ${nameCol.cls}`}>{authorName(a)}</Link>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${roleBadge(a?.role)}`}>{roleLabel(a?.role)}</span>
            {a?.featured_badges?.length > 0 && <BadgeMinis badgeIds={a.featured_badges} />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white border border-gray-200 text-[var(--greek-blue)] rounded-xl hover:bg-gray-50 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400">{post.category?.name}</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={togglePin} className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${post.is_pinned ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-white border border-gray-200 text-gray-400 hover:border-[var(--greek-gold)] hover:text-[var(--greek-gold)]"}`}>
              <Pin className="w-3.5 h-3.5" />{post.is_pinned ? "Épinglé" : "Épingler"}
            </button>
            <button onClick={toggleLock} className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${post.is_locked ? "bg-red-500 text-white" : "bg-white border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-400"}`}>
              <Lock className="w-3.5 h-3.5" />{post.is_locked ? "Verrouillé" : "Verrouiller"}
            </button>
            <button onClick={deletePost} className="px-3 py-1.5 text-xs font-bold bg-white border border-red-100 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Original post */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <AuthorChip a={post.author} />
          <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-4">{post.title}</h1>
        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {!isAdmin && (
          <div className="flex justify-end mt-3">
            <button onClick={() => setReportModal({ type: "post", targetId: post.id, targetUserId: post.author?.id })} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <Flag className="w-3 h-3" /> Signaler
            </button>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Réponses</h3>
          <span className="bg-blue-50 text-[var(--greek-blue)] px-2 py-0.5 rounded-full text-xs font-bold">{post.comments?.length || 0}</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        {post.comments?.map((comment) => (
          <div key={comment.id} className="group flex gap-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <Link href={buildProfileHref(comment.author?.id)} title="Voir le profil" className="shrink-0 hover:opacity-80 transition-opacity">
              <AvatarWithBorder
                avatar={comment.author?.avatar}
                equippedBorder={comment.author?.equipped_border}
                name={authorName(comment.author)}
                size="sm"
                bgClass={roleAvatar(comment.author?.role)}
              />
            </Link>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link href={buildProfileHref(comment.author?.id)} className={`font-semibold text-sm no-underline hover:no-underline ${getNameColor(comment.author?.name_color || 'default').cls}`} title="Voir le profil">{authorName(comment.author || {})}</Link>
                  {(comment.author?.featured_badges?.length ?? 0) > 0 && <BadgeMinis badgeIds={comment.author?.featured_badges || []} />}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${roleBadge(comment.author?.role)}`}>{roleLabel(comment.author?.role)}</span>
                  {isAdmin && comment.author?.id && (
                    <a href={`/admin/users/${comment.author.id}`} className="text-gray-300 hover:text-[var(--greek-blue)] transition-colors" title="Voir le profil">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</span>
                </div>
                {(isAdmin || (userDbId !== null && comment.author?.id === userDbId)) && (
                  <button onClick={() => deleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{comment.content}</p>
              {!isAdmin && (
                <div className="flex justify-end mt-1">
                  <button onClick={() => setReportModal({ type: "comment", targetId: comment.id, targetUserId: comment.author?.id })} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <Flag className="w-3 h-3" /> Signaler
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Reply box */}
        {post.is_locked ? (
          <div className="flex items-center justify-center gap-2 py-6 text-red-500 bg-white border border-red-100 rounded-2xl">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-semibold">Discussion verrouillée</span>
          </div>
        ) : (
          <div className="bg-white border border-[var(--greek-gold)]/20 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Répondre</h4>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] focus:bg-white text-sm h-24 resize-none transition-all"
              placeholder="Écris ta réponse..."
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) postComment(); }}
            />
            <div className="flex justify-end mt-3">
              <button onClick={postComment} className="flex items-center gap-2 bg-[var(--greek-blue)] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-800 shadow-sm transition-all">
                Envoyer <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal signalement */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Signaler ce {reportModal.type === "post" ? "sujet" : "message"}
              </h2>
              <button onClick={() => { setReportModal(null); setReportReason(""); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Explique pourquoi tu signales ce contenu. Ton signalement sera examiné par un modérateur.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raison *</label>
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Ex : contenu inapproprié, harcèlement, spam..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 h-24 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setReportModal(null); setReportReason(""); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-semibold transition-colors">Annuler</button>
                <button onClick={submitReport} disabled={!reportReason.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50">
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
