"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2, Eye, Heart, Lock, Megaphone, MessageCircle, MessagesSquare, Pin, Plus, Search, Settings2, Sparkles, X,
} from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { relativeTime } from "@/lib/relativeTime";
import {
  AUDIENCE_LABELS, type ForumCategory, type ForumFilter, type ForumPostSummary, type ForumRole, type ForumSort,
} from "@/lib/forumTypes";
import { forumApi } from "./forumApi";
import { AuthorLine, CategoryPill } from "./ForumBits";
import ForumThreadView from "./ForumThreadView";
import NewTopicDialog from "./NewTopicDialog";
import CategoryManager from "./CategoryManager";

export type { ForumRole };

const FILTERS: { id: ForumFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "following", label: "Suivis" },
  { id: "mine", label: "Mes sujets" },
  { id: "unanswered", label: "Sans réponse" },
  { id: "solved", label: "Résolus" },
];

const SORTS: { id: ForumSort; label: string }[] = [
  { id: "activity", label: "Activité récente" },
  { id: "new", label: "Nouveaux sujets" },
  { id: "popular", label: "Populaires" },
];

/**
 * Forum — un seul composant pour les trois espaces (élève, parent, admin).
 * Tout l'état de navigation vit dans l'URL (`?t=` sujet, `?c=` catégorie,
 * `?q=` recherche, `?f=` filtre, `?s=` tri) : chaque vue a son lien, le
 * bouton retour du navigateur marche, et les notifications ouvrent le bon
 * sujet. Les anciens liens (`?view=thread&postId=`) restent compris.
 */
export default function ForumApp({ role }: { role: ForumRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const threadId = Number(sp.get("t") || sp.get("postId")) || null;
  const categoryId = Number(sp.get("c") || sp.get("categoryId")) || null;
  const q = sp.get("q") || "";
  const filter = (FILTERS.some((f) => f.id === sp.get("f")) ? sp.get("f") : "all") as ForumFilter;
  const sort = (SORTS.some((s) => s.id === sp.get("s")) ? sp.get("s") : "activity") as ForumSort;

  const setParams = useCallback(
    (patch: Record<string, string | number | null>, { replace = false } = {}) => {
      const next = new URLSearchParams(sp.toString());
      ["view", "postId", "categoryId", "categoryName"].forEach((k) => next.delete(k));
      Object.entries(patch).forEach(([k, v]) => (v === null || v === "" ? next.delete(k) : next.set(k, String(v))));
      const url = next.toString() ? `${pathname}?${next}` : pathname;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, sp],
  );

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [items, setItems] = useState<ForumPostSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [composerOpen, setComposerOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const requestRef = useRef(0);

  const loadCategories = useCallback(() => {
    forumApi.categories().then(setCategories).catch(() => {});
  }, []);
  useEffect(loadCategories, [loadCategories]);

  // Liste : rechargée à chaque changement de catégorie / recherche / filtre /
  // tri. Un compteur de requête ignore les réponses arrivées dans le désordre.
  const loadList = useCallback(() => {
    const req = ++requestRef.current;
    setLoading(true);
    setError(null);
    forumApi
      .list({ category: categoryId, q, filter, sort })
      .then((r) => {
        if (req !== requestRef.current) return;
        setItems(r.items);
        setHasMore(r.hasMore);
      })
      .catch((e) => req === requestRef.current && setError(e.message))
      .finally(() => req === requestRef.current && setLoading(false));
  }, [categoryId, q, filter, sort]);
  useEffect(() => {
    if (!threadId) loadList();
  }, [loadList, threadId]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await forumApi.list({ category: categoryId, q, filter, sort, offset: items.length });
      setItems((prev) => [...prev, ...r.items.filter((i) => !prev.some((p) => p.id === i.id))]);
      setHasMore(r.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Recherche : appliquée 350 ms après la dernière frappe.
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null }, { replace: true }), 350);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const currentCategory = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const totalPosts = useMemo(() => categories.reduce((n, c) => n + c.post_count, 0), [categories]);
  const returnTo = useMemo(() => (sp.toString() ? `${pathname}?${sp}` : pathname), [pathname, sp]);

  if (threadId) {
    return (
      <ForumThreadView
        role={role}
        postId={threadId}
        returnTo={returnTo}
        onBack={() => (window.history.length > 1 ? router.back() : setParams({ t: null }))}
        onDeleted={() => {
          setParams({ t: null }, { replace: true });
          loadCategories();
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
      {/* ── Catégories ── */}
      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--nav-h)+1rem)]">
        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-3">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--greek-bronze)]">Catégories</p>
            {role === "admin" && (
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                className="text-xs font-semibold text-[var(--greek-blue)] hover:underline inline-flex items-center gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" /> Gérer
              </button>
            )}
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1" aria-label="Catégories du forum">
            <CategoryButton active={!categoryId} onClick={() => setParams({ c: null })} label="Tous les sujets" count={totalPosts} color={null} />
            {categories.map((c) => (
              <CategoryButton
                key={c.id}
                active={categoryId === c.id}
                onClick={() => setParams({ c: c.id })}
                label={c.name}
                count={c.post_count}
                color={c.color}
                locked={c.admin_only}
                audience={role === "admin" && c.audience !== "tous" ? AUDIENCE_LABELS[c.audience] : undefined}
              />
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Sujets ── */}
      <section className="min-w-0 space-y-4">
        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Rechercher dans le forum</span>
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un sujet, une notion…"
                className="w-full pl-10 pr-9 py-2.5 rounded-full border border-[rgba(197,161,72,0.3)] bg-[var(--greek-cream)]/60 text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </label>
            <GlassButton variant="navy" size="sm" onClick={() => setComposerOpen(true)}>
              <Plus className="w-4 h-4" /> Nouveau sujet
            </GlassButton>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <GlassSegmentedControl
              size="sm"
              nowrap
              value={filter}
              onChange={(v) => setParams({ f: v === "all" ? null : v })}
              options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
            />
            <select
              aria-label="Trier les sujets"
              value={sort}
              onChange={(e) => setParams({ s: e.target.value === "activity" ? null : e.target.value })}
              className="text-sm py-2 pl-3 pr-9 rounded-full md:w-48"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {currentCategory?.description && (
          <p className="text-sm text-[var(--text-muted)] px-2">{currentCategory.description}</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3">
            {error}
            <GlassButton variant="ghost" size="sm" onClick={loadList}>Réessayer</GlassButton>
          </div>
        )}

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Chargement des sujets">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-[rgba(197,161,72,0.2)] p-5 animate-pulse">
                <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
                <div className="h-3 w-full bg-gray-100 rounded mb-2" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState filter={filter} q={q} onCreate={() => setComposerOpen(true)} />
        ) : (
          <ul className="space-y-3">
            {items.map((p) => (
              <li key={p.id}>
                <TopicCard post={p} role={role} returnTo={returnTo} showCategory={!categoryId} onOpen={() => setParams({ t: p.id })} />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <GlassButton variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Chargement…" : "Voir plus de sujets"}
            </GlassButton>
          </div>
        )}
      </section>

      {composerOpen && (
        <NewTopicDialog
          role={role}
          categories={categories}
          defaultCategoryId={categoryId}
          onClose={() => setComposerOpen(false)}
          onCreated={(id) => {
            setComposerOpen(false);
            loadCategories();
            setParams({ t: id });
          }}
        />
      )}
      {managerOpen && (
        <CategoryManager
          categories={categories}
          onClose={() => setManagerOpen(false)}
          onChanged={loadCategories}
        />
      )}
    </div>
  );
}

function CategoryButton({
  active, onClick, label, count, color, locked, audience,
}: {
  active: boolean; onClick: () => void; label: string; count: number; color: string | null; locked?: boolean; audience?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 lg:w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-sm text-left transition-colors ${
        active ? "bg-[var(--greek-cream)] ring-1 ring-[var(--greek-gold)] text-[var(--greek-blue)] font-semibold" : "text-[var(--greek-blue)] hover:bg-[var(--greek-cream)]/70"
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color || "var(--greek-gold)" }} />
      <span className="flex-1 font-medium whitespace-nowrap lg:whitespace-normal">{label}</span>
      {locked && <Megaphone className="w-3.5 h-3.5 shrink-0 text-[var(--greek-bronze)]" aria-label="Publication réservée à l'équipe" />}
      {audience && <span className="text-[10px] font-semibold shrink-0 text-[var(--text-muted)]">{audience}</span>}
      <span className="text-xs tabular-nums shrink-0 text-[var(--text-muted)]">{count}</span>
    </button>
  );
}

function TopicCard({
  post, role, returnTo, showCategory, onOpen,
}: {
  post: ForumPostSummary; role: ForumRole; returnTo: string; showCategory: boolean; onOpen: () => void;
}) {
  return (
    <article
      className={`group bg-white rounded-3xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 cursor-pointer ${
        post.is_pinned ? "border-[var(--greek-gold)]/60" : "border-[rgba(197,161,72,0.22)]"
      }`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {post.is_pinned && <StatusTag icon={Pin} label="Épinglé" tone="gold" />}
          {post.solved && <StatusTag icon={CheckCircle2} label="Résolu" tone="green" />}
          {post.is_locked && <StatusTag icon={Lock} label="Verrouillé" tone="gray" />}
          {showCategory && post.category && <CategoryPill name={post.category.name} color={post.category.color} />}
        </div>
        <span className="text-xs text-[var(--text-muted)] shrink-0" title="Dernière activité">{relativeTime(post.last_activity_at)}</span>
      </div>
      <h3 className="font-bold text-[var(--greek-blue)] text-lg leading-snug mb-1 group-hover:underline decoration-[var(--greek-gold)] underline-offset-4">
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="text-left">
          {post.title}
        </button>
      </h3>
      {post.excerpt && <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-4">{post.excerpt}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <AuthorLine author={post.author} date={post.created_at} viewerRole={role} returnTo={returnTo} size="xs" />
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <Stat icon={MessageCircle} value={post.comment_count} label="réponses" highlight={post.comment_count === 0 ? "Sans réponse" : undefined} />
          <Stat icon={Heart} value={post.like_count} label="j'aime" />
          <Stat icon={Eye} value={post.view_count} label="vues" />
        </div>
      </div>
    </article>
  );
}

function StatusTag({ icon: Icon, label, tone }: { icon: typeof Pin; label: string; tone: "gold" | "green" | "gray" }) {
  const cls = {
    gold: "bg-[rgba(197,161,72,0.15)] text-[var(--greek-bronze)]",
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-600",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" aria-hidden="true" /> {label}
    </span>
  );
}

function Stat({ icon: Icon, value, label, highlight }: { icon: typeof Pin; value: number; label: string; highlight?: string }) {
  if (highlight) {
    return <span className="inline-flex items-center gap-1 font-semibold text-[var(--greek-bronze)]"><Sparkles className="w-3.5 h-3.5" /> {highlight}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={`${value} ${label}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {value}
    </span>
  );
}

function EmptyState({ filter, q, onCreate }: { filter: ForumFilter; q: string; onCreate: () => void }) {
  const text = q
    ? `Aucun sujet ne correspond à « ${q} ».`
    : filter === "following"
      ? "Tu ne suis encore aucun sujet. Ouvre un sujet et clique sur « Suivre » pour être prévenu des réponses."
      : filter === "mine"
        ? "Tu n'as pas encore créé de sujet."
        : filter === "unanswered"
          ? "Tous les sujets ont reçu une réponse."
          : filter === "solved"
            ? "Aucun sujet résolu pour l'instant."
            : "Aucun sujet ici pour l'instant. Lance la discussion !";
  return (
    <div className="bg-white rounded-3xl border border-dashed border-[rgba(197,161,72,0.4)] p-10 text-center">
      <MessagesSquare className="w-10 h-10 mx-auto mb-3 text-[var(--greek-gold)]" aria-hidden="true" />
      <p className="text-[var(--text-muted)] mb-5 max-w-md mx-auto">{text}</p>
      <GlassButton variant="navy" size="sm" onClick={onCreate}>
        <Plus className="w-4 h-4" /> Créer un sujet
      </GlassButton>
    </div>
  );
}
