"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Eye, PenLine, Sigma } from "lucide-react";
import AvatarWithBorder, { type AvatarSize } from "@/components/AvatarWithBorder";
import BadgeMinis from "@/components/BadgeMinis";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { getNameColor } from "@/lib/badgeStyles";
import { relativeTime } from "@/lib/relativeTime";
import type { ForumAuthor, ForumRole } from "@/lib/forumTypes";
import ForumText from "./ForumText";

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Équipe", cls: "bg-[var(--greek-blue)] text-white" },
  parent: { label: "Parent", cls: "bg-[rgba(197,161,72,0.18)] text-[var(--greek-bronze)]" },
  child: { label: "Élève", cls: "bg-[rgba(15,30,58,0.07)] text-[var(--greek-blue)]" },
};

/** Lien vers le profil d'un auteur, selon l'espace de celui qui regarde. */
export function profileHref(viewerRole: ForumRole, authorId: number | undefined, returnTo: string): string | null {
  if (!authorId) return null;
  return viewerRole === "admin"
    ? `/admin/users/detail?id=${authorId}`
    : `/u/${authorId}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function RoleBadge({ role }: { role: string | undefined }) {
  const b = ROLE_BADGE[role || ""];
  if (!b) return null;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>;
}

/** Avatar + nom (couleur équipée) + rôle + date : même en-tête partout. */
export function AuthorLine({
  author, date, edited, viewerRole, returnTo, size = "sm", extra,
}: {
  author: ForumAuthor | null;
  date: string;
  edited?: boolean;
  viewerRole: ForumRole;
  returnTo: string;
  size?: AvatarSize;
  extra?: ReactNode;
}) {
  const name = author?.displayName ?? "Compte supprimé";
  const href = profileHref(viewerRole, author?.id, returnTo);
  const nameCls = getNameColor(author?.nameColor || "default").cls;
  const avatar = (
    <AvatarWithBorder avatar={author?.avatar} equippedBorder={author?.equippedBorder} name={name} size={size} label="" />
  );
  return (
    <div className="flex items-center gap-3 min-w-0">
      {href ? <Link href={href} className="shrink-0 hover:opacity-85 transition-opacity" aria-label={`Profil de ${name}`}>{avatar}</Link> : avatar}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {href ? (
            <Link href={href} className={`font-semibold text-sm no-underline hover:underline truncate ${nameCls}`}>{name}</Link>
          ) : (
            <span className="font-semibold text-sm text-gray-500">{name}</span>
          )}
          <RoleBadge role={author?.role} />
          {!!author?.featuredBadges?.length && <BadgeMinis badgeIds={author.featuredBadges} />}
          {extra}
        </div>
        <p className="text-xs text-[var(--text-muted)]" title={new Date(date).toLocaleString("fr-FR")}>
          {relativeTime(date)}
          {edited && <span className="italic"> · modifié</span>}
        </p>
      </div>
    </div>
  );
}

export function CategoryPill({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{
        color: color || "var(--greek-bronze)",
        borderColor: `${color || "#c5a148"}40`,
        background: `${color || "#c5a148"}12`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color || "var(--greek-gold)" }} />
      {name}
    </span>
  );
}

/** Boîte de dialogue du forum (nouveau sujet, signalement, catégories). */
export function ForumDialog({
  title, onClose, children, footer, wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[rgba(197,161,72,0.3)] bg-white/95 backdrop-blur-[24px] shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)]">{title}</h2>
          <GlassCloseButton onClick={onClose} variant="dark" size="sm" />
        </div>
        <div className="px-6 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[rgba(197,161,72,0.2)] flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Zone de saisie avec aperçu du rendu (formules $…$ comprises). */
export function Composer({
  value, onChange, placeholder, max, minRows = 5, autoFocus = false, label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  max: number;
  minRows?: number;
  autoFocus?: boolean;
  label: string;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const id = useId();
  return (
    <div className="rounded-2xl border border-[rgba(197,161,72,0.3)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--greek-blue)]/25">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <GlassSegmentedControl
          size="sm"
          value={mode}
          onChange={(v) => setMode(v as "write" | "preview")}
          options={[
            { id: "write", label: <span className="inline-flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5" /> Écrire</span> },
            { id: "preview", label: <span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Aperçu</span> },
          ]}
        />
        <span className={`text-[11px] tabular-nums ${value.length > max * 0.9 ? "text-orange-600" : "text-[var(--text-muted)]"}`}>
          {value.length}/{max}
        </span>
      </div>
      {mode === "write" ? (
        <textarea
          id={id}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          placeholder={placeholder}
          rows={minRows}
          autoFocus={autoFocus}
          className="w-full px-4 py-3 text-[15px] leading-relaxed resize-y outline-none bg-transparent placeholder:text-gray-400"
        />
      ) : (
        <div className="px-4 py-3 min-h-[7rem]">
          {value.trim() ? <ForumText text={value} /> : <p className="text-sm text-gray-400 italic">Rien à prévisualiser.</p>}
        </div>
      )}
      <p className="px-4 pb-2 text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
        <Sigma className="w-3 h-3" aria-hidden="true" />
        Formules entre $ : <code className="px-1 rounded bg-gray-100">$\frac{"{"}1{"}"}{"{"}2{"}"}$</code> · gras : <code className="px-1 rounded bg-gray-100">**texte**</code>
      </p>
    </div>
  );
}
