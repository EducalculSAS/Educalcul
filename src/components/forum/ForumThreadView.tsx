"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Bell, BellOff, CheckCircle2, Flag, Heart, Link2, Loader2, Lock, LockOpen, MessageCircle,
  Pencil, Pin, PinOff, Quote, Reply, Send, Trash2, Eye,
} from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ForumComment, ForumRole, ForumThread } from "@/lib/forumTypes";
import { forumApi } from "./forumApi";
import { AuthorLine, CategoryPill, Composer, ForumDialog } from "./ForumBits";
import ForumText from "./ForumText";

const COMMENT_MAX = 3000;
const CONTENT_MAX = 5000;

export default function ForumThreadView({
  role, postId, returnTo, onBack, onDeleted,
}: {
  role: ForumRole;
  postId: number;
  returnTo: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [quote, setQuote] = useState<ForumComment | null>(null);
  const [sending, setSending] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [report, setReport] = useState<{ type: "post" | "comment"; id: number } | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setThread(await forumApi.thread(postId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [postId]);

  // Autre sujet ouvert : on repart d'un écran de chargement (ajusté pendant le
  // rendu plutôt que dans l'effet, pour éviter un rendu intermédiaire).
  const [shownId, setShownId] = useState(postId);
  if (shownId !== postId) {
    setShownId(postId);
    setThread(null);
  }

  useEffect(() => {
    let cancelled = false;
    forumApi
      .thread(postId)
      .then((t) => {
        if (cancelled) return;
        setThread(t);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    forumApi.view(postId);
    window.scrollTo({ top: 0 });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const patchThread = (patch: Partial<ForumThread>) => setThread((t) => (t ? { ...t, ...patch } : t));
  const patchComment = (id: number, patch: Partial<ForumComment>) =>
    setThread((t) => (t ? { ...t, comments: t.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : t));

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  // J'aime : affiché tout de suite, corrigé par la réponse du serveur.
  const toggleLike = async (target: { postId?: number; commentId?: number }) => {
    if (!thread) return;
    const current = target.postId ? thread : thread.comments.find((c) => c.id === target.commentId);
    if (!current) return;
    const optimistic = { liked: !current.liked, like_count: current.like_count + (current.liked ? -1 : 1) };
    if (target.postId) patchThread(optimistic);
    else patchComment(target.commentId!, optimistic);
    try {
      const r = await forumApi.like(target);
      if (target.postId) patchThread(r);
      else patchComment(target.commentId!, r);
    } catch (e) {
      if (target.postId) patchThread({ liked: current.liked, like_count: current.like_count });
      else patchComment(target.commentId!, { liked: current.liked, like_count: current.like_count });
      toast.error((e as Error).message);
    }
  };

  const toggleFollow = async () => {
    if (!thread) return;
    try {
      const r = await forumApi.follow(thread.id);
      patchThread(r);
      toast.success(r.following ? "Tu seras prévenu des nouvelles réponses." : "Tu ne suis plus ce sujet.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?t=${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié.");
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    const ok = await run(() => forumApi.reply({ postId, content: reply.trim(), quotedCommentId: quote?.id ?? null }), "Réponse publiée.");
    if (ok) {
      setReply("");
      setQuote(null);
      await load();
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    }
    setSending(false);
  };

  const quoteComment = (c: ForumComment) => {
    setQuote(c);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const deletePost = async () => {
    if (!(await confirm("Le sujet et toutes ses réponses seront supprimés.", { title: "Supprimer le sujet ?", confirmLabel: "Supprimer" }))) return;
    if (await run(() => forumApi.deletePost(postId), "Sujet supprimé.")) onDeleted();
  };

  const deleteComment = async (id: number) => {
    if (!(await confirm("Cette réponse sera supprimée.", { title: "Supprimer la réponse ?", confirmLabel: "Supprimer" }))) return;
    if (await run(() => forumApi.deleteComment(id), "Réponse supprimée.")) load();
  };

  const setSolution = async (commentId: number | null) => {
    if (await run(() => forumApi.updatePost(postId, { solved_comment_id: commentId }), commentId ? "Réponse marquée comme solution." : "Solution retirée.")) {
      patchThread({ solved_comment_id: commentId });
    }
  };

  const moderate = async (patch: { is_pinned?: boolean; is_locked?: boolean }) => {
    if (await run(() => forumApi.updatePost(postId, patch))) patchThread(patch);
  };

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] p-10 text-center">
        <p className="text-[var(--text-muted)] mb-5">{error}</p>
        <GlassButton variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Retour au forum</GlassButton>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Chargement du sujet">
        <div className="h-9 w-32 bg-white rounded-full" />
        <div className="bg-white rounded-3xl p-6 space-y-3">
          <div className="h-6 w-2/3 bg-gray-100 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-3 w-5/6 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const solution = thread.solved_comment_id ? thread.comments.find((c) => c.id === thread.solved_comment_id) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <GlassButton variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Forum
        </GlassButton>
        {thread.canModerate && (
          <div className="flex gap-2">
            <GlassButton variant="ghost" size="sm" onClick={() => moderate({ is_pinned: !thread.is_pinned })}>
              {thread.is_pinned ? <><PinOff className="w-4 h-4" /> Désépingler</> : <><Pin className="w-4 h-4" /> Épingler</>}
            </GlassButton>
            <GlassButton variant="ghost" size="sm" onClick={() => moderate({ is_locked: !thread.is_locked })}>
              {thread.is_locked ? <><LockOpen className="w-4 h-4" /> Déverrouiller</> : <><Lock className="w-4 h-4" /> Verrouiller</>}
            </GlassButton>
          </div>
        )}
      </div>

      {/* ── Sujet ── */}
      <article className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {thread.category && <CategoryPill name={thread.category.name} color={thread.category.color} />}
          {thread.is_pinned && <Tag icon={Pin} label="Épinglé" cls="bg-[rgba(197,161,72,0.15)] text-[var(--greek-bronze)]" />}
          {thread.solved_comment_id && <Tag icon={CheckCircle2} label="Résolu" cls="bg-emerald-50 text-emerald-700" />}
          {thread.is_locked && <Tag icon={Lock} label="Verrouillé" cls="bg-gray-100 text-gray-600" />}
        </div>

        {editingPost ? (
          <EditPost
            thread={thread}
            onCancel={() => setEditingPost(false)}
            onSaved={(t) => {
              patchThread({ ...t, updated_at: new Date().toISOString() });
              setEditingPost(false);
            }}
          />
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display)] font-bold text-2xl md:text-3xl text-[var(--greek-blue)] leading-tight mb-5 break-words">
              {thread.title}
            </h1>
            <AuthorLine author={thread.author} date={thread.created_at} edited={!!thread.updated_at} viewerRole={role} returnTo={returnTo} size="md" />
            <ForumText text={thread.content} className="mt-5" />
          </>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap mt-6 pt-4 border-t border-[rgba(197,161,72,0.18)]">
          <div className="flex items-center gap-2 flex-wrap">
            <LikeButton liked={thread.liked} count={thread.like_count} onClick={() => toggleLike({ postId: thread.id })} />
            <GlassButton variant={thread.following ? "navy" : "outline"} size="sm" onClick={toggleFollow}>
              {thread.following ? <><BellOff className="w-4 h-4" /> Ne plus suivre</> : <><Bell className="w-4 h-4" /> Suivre</>}
            </GlassButton>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums px-2">
              <Eye className="w-3.5 h-3.5" /> {thread.view_count} vues
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <GlassIconButton icon={Link2} color="gray" size="sm" onClick={copyLink} aria-label="Copier le lien du sujet" />
            {!thread.canEdit && (
              <GlassIconButton icon={Flag} color="orange" size="sm" onClick={() => setReport({ type: "post", id: thread.id })} aria-label="Signaler ce sujet" />
            )}
            {thread.canEdit && !editingPost && (
              <GlassIconButton icon={Pencil} color="navy" size="sm" onClick={() => setEditingPost(true)} aria-label="Modifier le sujet" />
            )}
            {thread.canEdit && (
              <GlassIconButton icon={Trash2} color="red" size="sm" onClick={deletePost} aria-label="Supprimer le sujet" />
            )}
          </div>
        </div>
      </article>

      {/* ── Meilleure réponse, remontée en tête ── */}
      {solution && (
        <div className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-4 h-4" /> Meilleure réponse
          </p>
          <AuthorLine author={solution.author} date={solution.created_at} viewerRole={role} returnTo={returnTo} size="xs" />
          <ForumText text={solution.content} className="mt-3" />
          <a href={`#reponse-${solution.id}`} className="inline-block mt-3 text-xs font-semibold text-emerald-700 hover:underline">
            Voir dans la discussion
          </a>
        </div>
      )}

      {/* ── Réponses ── */}
      <section aria-label="Réponses">
        <h2 className="flex items-center gap-2 font-bold text-[var(--greek-blue)] mb-3 px-1">
          <MessageCircle className="w-5 h-5 text-[var(--greek-gold)]" />
          {thread.comments.length === 0 ? "Aucune réponse pour l'instant" : `${thread.comments.length} réponse${thread.comments.length > 1 ? "s" : ""}`}
        </h2>
        <ol className="space-y-3">
          {thread.comments.map((c) => (
            <li key={c.id} id={`reponse-${c.id}`} className="scroll-mt-[calc(var(--nav-h)+1rem)]">
              <CommentCard
                comment={c}
                role={role}
                returnTo={returnTo}
                isSolution={thread.solved_comment_id === c.id}
                isOp={!!c.author && c.author.id === thread.author?.id}
                canMarkSolution={thread.canMarkSolution}
                locked={thread.is_locked && !thread.canModerate}
                onLike={() => toggleLike({ commentId: c.id })}
                onQuote={() => quoteComment(c)}
                onReport={() => setReport({ type: "comment", id: c.id })}
                onDelete={() => deleteComment(c.id)}
                onSolution={() => setSolution(thread.solved_comment_id === c.id ? null : c.id)}
                onEdited={(content) => patchComment(c.id, { content, updated_at: new Date().toISOString() })}
              />
            </li>
          ))}
        </ol>
      </section>

      {/* ── Répondre ── */}
      <div ref={composerRef} className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
        {thread.is_locked && !thread.canModerate ? (
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
            <Lock className="w-4 h-4" /> Ce sujet est verrouillé : on ne peut plus y répondre.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2"><Reply className="w-4 h-4 text-[var(--greek-gold)]" /> Ta réponse</h2>
            {quote && (
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--greek-cream)] border-l-4 border-[var(--greek-gold)] px-4 py-2">
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                  <span className="font-semibold text-[var(--greek-blue)]">{quote.author?.displayName ?? "Utilisateur"} : </span>
                  {quote.content}
                </p>
                <button type="button" onClick={() => setQuote(null)} className="text-xs font-semibold text-[var(--greek-blue)] hover:underline shrink-0">Retirer</button>
              </div>
            )}
            <Composer label="Ta réponse" value={reply} onChange={setReply} max={COMMENT_MAX} placeholder="Aide, explique, pose une question…" minRows={4} />
            <div className="flex justify-end">
              <GlassButton variant="navy" size="sm" onClick={sendReply} disabled={!reply.trim() || sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publier la réponse
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      {report && <ReportDialog target={report} onClose={() => setReport(null)} />}
    </div>
  );
}

function Tag({ icon: Icon, label, cls }: { icon: typeof Pin; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" aria-hidden="true" /> {label}
    </span>
  );
}

function LikeButton({ liked, count, onClick, small = false }: { liked: boolean; count: number; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? "Je n'aime plus" : "J'aime"}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tabular-nums transition-all active:scale-90 ${
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${liked ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-[rgba(15,30,58,0.14)] text-[var(--text-muted)] hover:text-rose-600 hover:border-rose-200"}`}
    >
      <Heart className={`${small ? "w-3.5 h-3.5" : "w-4 h-4"} transition-transform ${liked ? "fill-current scale-110" : ""}`} aria-hidden="true" />
      {count}
    </button>
  );
}

function CommentCard({
  comment, role, returnTo, isSolution, isOp, canMarkSolution, locked,
  onLike, onQuote, onReport, onDelete, onSolution, onEdited,
}: {
  comment: ForumComment; role: ForumRole; returnTo: string; isSolution: boolean; isOp: boolean;
  canMarkSolution: boolean; locked: boolean;
  onLike: () => void; onQuote: () => void; onReport: () => void; onDelete: () => void; onSolution: () => void;
  onEdited: (content: string) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await forumApi.updateComment(comment.id, draft.trim());
      onEdited(draft.trim());
      setEditing(false);
      toast.success("Réponse modifiée.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white rounded-3xl border shadow-sm p-5 ${isSolution ? "border-emerald-300 ring-1 ring-emerald-200" : "border-[rgba(197,161,72,0.22)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <AuthorLine
          author={comment.author}
          date={comment.created_at}
          edited={!!comment.updated_at}
          viewerRole={role}
          returnTo={returnTo}
          size="sm"
          extra={isOp ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--greek-cream)] text-[var(--greek-bronze)] border border-[rgba(197,161,72,0.3)]">Auteur du sujet</span> : undefined}
        />
        {isSolution && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Solution
          </span>
        )}
      </div>

      {comment.quoted && (
        <a href={`#reponse-${comment.quoted.id}`} className="block mt-3 rounded-2xl bg-[var(--greek-cream)] border-l-4 border-[var(--greek-gold)] px-4 py-2 no-underline hover:bg-[var(--greek-cream-dark)] transition-colors">
          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
            <Quote className="w-3 h-3 inline -mt-0.5 mr-1 text-[var(--greek-gold)]" />
            <span className="font-semibold text-[var(--greek-blue)]">{comment.quoted.authorName} : </span>
            {comment.quoted.excerpt}
          </p>
        </a>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <Composer label="Modifier la réponse" value={draft} onChange={setDraft} max={COMMENT_MAX} placeholder="" minRows={3} autoFocus />
          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" size="sm" onClick={() => { setDraft(comment.content); setEditing(false); }}>Annuler</GlassButton>
            <GlassButton variant="navy" size="sm" onClick={save} disabled={saving || !draft.trim()}>Enregistrer</GlassButton>
          </div>
        </div>
      ) : (
        <ForumText text={comment.content} className="mt-3" />
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <LikeButton small liked={comment.liked} count={comment.like_count} onClick={onLike} />
          {!locked && (
            <GlassButton variant="ghost" size="sm" onClick={onQuote}><Quote className="w-3.5 h-3.5" /> Citer</GlassButton>
          )}
          {canMarkSolution && (
            <GlassButton variant={isSolution ? "outline" : "ghost"} size="sm" onClick={onSolution}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {isSolution ? "Retirer la solution" : "Marquer comme solution"}
            </GlassButton>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!comment.canEdit && <GlassIconButton icon={Flag} color="orange" size="sm" onClick={onReport} aria-label="Signaler cette réponse" />}
          {comment.canEdit && !editing && <GlassIconButton icon={Pencil} color="navy" size="sm" onClick={() => setEditing(true)} aria-label="Modifier la réponse" />}
          {comment.canEdit && <GlassIconButton icon={Trash2} color="red" size="sm" onClick={onDelete} aria-label="Supprimer la réponse" />}
        </div>
      </div>
    </div>
  );
}

function EditPost({
  thread, onCancel, onSaved,
}: {
  thread: ForumThread; onCancel: () => void; onSaved: (t: { title: string; content: string }) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(thread.title);
  const [content, setContent] = useState(thread.content);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await forumApi.updatePost(thread.id, { title: title.trim(), content: content.trim() });
      onSaved({ title: title.trim(), content: content.trim() });
      toast.success("Sujet modifié.");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };
  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 150))}
        aria-label="Titre du sujet"
        className="w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] text-lg font-semibold text-[var(--greek-blue)] outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
      />
      <Composer label="Message du sujet" value={content} onChange={setContent} max={CONTENT_MAX} placeholder="" minRows={6} />
      <div className="flex justify-end gap-2">
        <GlassButton variant="ghost" size="sm" onClick={onCancel}>Annuler</GlassButton>
        <GlassButton variant="navy" size="sm" onClick={save} disabled={saving || title.trim().length < 5 || !content.trim()}>Enregistrer</GlassButton>
      </div>
    </div>
  );
}

const REASONS = ["Propos blessants ou irrespectueux", "Spam ou publicité", "Informations personnelles", "Hors sujet", "Autre"];

function ReportDialog({ target, onClose }: { target: { type: "post" | "comment"; id: number }; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      await forumApi.report({ type: target.type, targetId: target.id, reason: details.trim() ? `${reason} : ${details.trim()}` : reason });
      toast.success("Merci, l'équipe va examiner ce signalement.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setSending(false);
    }
  };
  return (
    <ForumDialog
      title={target.type === "post" ? "Signaler ce sujet" : "Signaler cette réponse"}
      onClose={onClose}
      footer={
        <>
          <GlassButton variant="ghost" size="sm" onClick={onClose}>Annuler</GlassButton>
          <GlassButton variant="danger" size="sm" onClick={send} disabled={sending}><Flag className="w-4 h-4" /> Signaler</GlassButton>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[var(--greek-blue)] mb-2">Pourquoi ?</legend>
        {REASONS.map((r) => (
          <label key={r} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border cursor-pointer text-sm transition-colors ${reason === r ? "border-[var(--greek-blue)] bg-[rgba(15,30,58,0.04)]" : "border-[rgba(197,161,72,0.25)] hover:bg-[var(--greek-cream)]"}`}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--greek-blue)]" />
            {r}
          </label>
        ))}
      </fieldset>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 500))}
        placeholder="Précisions (facultatif)"
        rows={3}
        className="mt-4 w-full px-4 py-3 rounded-2xl border border-[rgba(197,161,72,0.3)] text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
      />
    </ForumDialog>
  );
}
