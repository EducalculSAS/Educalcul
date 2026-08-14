"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Send, Trash2, Pin, Lock, ExternalLink, Flag, X, AlertTriangle } from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
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
import { useConfirm } from "@/components/ConfirmDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

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
  const confirm = useConfirm();
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
      .select(`*, author:user_public_profiles(id, first_name, last_name, child_username, avatar, role, equipped_border, name_color, featured_badges), category:forum_categories(name), comments:forum_comments(id, content, created_at, author:user_public_profiles(id, first_name, last_name, child_username, avatar, role, equipped_border, name_color, featured_badges))`)
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
    if (!(await confirm("Supprimer ce commentaire ?"))) return;
    await supabase.from("forum_comments").delete().eq("id", id);
    fetchThread();
  };

  const deletePost = async () => {
    if (!(await confirm("Supprimer ce sujet et tous les commentaires ?"))) return;
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

  if (loading || !post) return <div className="p-12 flex justify-center"><AppAdminLoader /></div>;

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
          <GlassIconButton icon={ArrowLeft} onClick={onBack} color="navy" aria-label="Retour" />
          <span className="text-sm text-gray-400">{post.category?.name}</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <GlassButton onClick={togglePin} variant={post.is_pinned ? "navy" : "outline"} size="sm">
              <Pin className="w-3.5 h-3.5" />{post.is_pinned ? "Épinglé" : "Épingler"}
            </GlassButton>
            <GlassButton onClick={toggleLock} variant={post.is_locked ? "danger" : "outline"} size="sm">
              <Lock className="w-3.5 h-3.5" />{post.is_locked ? "Verrouillé" : "Verrouiller"}
            </GlassButton>
            <GlassButton onClick={deletePost} variant="danger" size="sm">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </GlassButton>
          </div>
        )}
      </div>

      {/* Original post */}
      <div className="bg-white border border-[rgba(197,161,72,0.25)] rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <AuthorChip a={post.author} />
          <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-4">{post.title}</h1>
        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {!isAdmin && (
          <div className="flex justify-end mt-3">
            <GlassButton onClick={() => setReportModal({ type: "post", targetId: post.id, targetUserId: post.author?.id })} variant="ghost" size="sm">
              <Flag className="w-3.5 h-3.5" /> Signaler
            </GlassButton>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Réponses</h3>
          <span className="bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] px-2 py-0.5 rounded-full text-xs font-bold">{post.comments?.length || 0}</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        {post.comments?.map((comment) => (
          <div key={comment.id} className="group flex gap-4 bg-white border border-[rgba(197,161,72,0.25)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
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
                    <GlassIconButton icon={ExternalLink} href={`/admin/users/${comment.author.id}`} color="gray" size="sm" aria-label="Voir le profil admin" />
                  )}
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</span>
                </div>
                {(isAdmin || (userDbId !== null && comment.author?.id === userDbId)) && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <GlassIconButton icon={Trash2} onClick={() => deleteComment(comment.id)} color="red" size="sm" aria-label="Supprimer le commentaire" />
                  </div>
                )}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{comment.content}</p>
              {!isAdmin && (
                <div className="flex justify-end mt-1">
                  <GlassButton onClick={() => setReportModal({ type: "comment", targetId: comment.id, targetUserId: comment.author?.id })} variant="ghost" size="sm">
                    <Flag className="w-3.5 h-3.5" /> Signaler
                  </GlassButton>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Reply box */}
        {post.is_locked ? (
          <div className="flex items-center justify-center gap-2 py-6 text-red-500 bg-white border border-[rgba(197,161,72,0.25)] rounded-2xl">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-semibold">Discussion verrouillée</span>
          </div>
        ) : (
          <div className="bg-white border border-[rgba(197,161,72,0.25)] rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Répondre</h4>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-[rgba(197,161,72,0.25)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--greek-blue)] focus:bg-white text-sm h-24 resize-none transition-all"
              placeholder="Écris ta réponse..."
              aria-label="Ajouter un commentaire"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) postComment(); }}
            />
            <div className="flex justify-end mt-3">
              <GlassButton onClick={postComment} variant="navy" size="sm">
                Envoyer <Send className="w-4 h-4" />
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      {/* Modal signalement */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[var(--greek-gold)]">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Signaler ce {reportModal.type === "post" ? "sujet" : "message"}
              </h2>
              <GlassIconButton icon={X} onClick={() => { setReportModal(null); setReportReason(""); }} color="gray" size="sm" aria-label="Fermer" />
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Explique pourquoi tu signales ce contenu. Ton signalement sera examiné par un modérateur.</p>
              <div>
                <label htmlFor="report-reason" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Raison *</label>
                <textarea
                  id="report-reason"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Ex : contenu inapproprié, harcèlement, spam..."
                  aria-label="Raison du signalement"
                  className="w-full px-3 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 h-24 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <GlassButton onClick={() => { setReportModal(null); setReportReason(""); }} variant="ghost" size="sm">Annuler</GlassButton>
                <GlassButton onClick={submitReport} variant="danger" size="sm" disabled={!reportReason.trim()}>
                  <Flag className="w-3.5 h-3.5" /> Signaler
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
