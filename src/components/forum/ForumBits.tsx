"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Eye, Keyboard, PenLine } from "lucide-react";
import AvatarWithBorder, { type AvatarSize } from "@/components/AvatarWithBorder";
import BadgeMinis from "@/components/BadgeMinis";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassIconButton from "@/components/ui/GlassIconButton";
import ForumKeyboard from "./ForumKeyboard";
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
function profileHref(viewerRole: ForumRole, authorId: number | undefined, returnTo: string): string | null {
  if (!authorId) return null;
  return viewerRole === "admin"
    ? `/admin/users/detail?id=${authorId}`
    : `/u/${authorId}?returnTo=${encodeURIComponent(returnTo)}`;
}

function RoleBadge({ role }: { role: string | undefined }) {
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
        <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap min-w-0">
          {href ? (
            <Link href={href} className={`font-semibold text-sm no-underline hover:underline whitespace-nowrap ${nameCls}`}>{name}</Link>
          ) : (
            <span className="font-semibold text-sm text-gray-500 truncate max-w-full">{name}</span>
          )}
          <RoleBadge role={author?.role} />
          {!!author?.featuredBadges?.length && <BadgeMinis badgeIds={author.featuredBadges} />}
          {extra}
        </div>
        <p className="text-xs text-[var(--text-muted)]" title={new Date(date).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}>
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
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border max-w-full"
      style={{
        color: color || "var(--greek-bronze)",
        borderColor: `${color || "#c5a148"}40`,
        background: `${color || "#c5a148"}12`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color || "var(--greek-gold)" }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Boîte de dialogue du forum : le composant partagé du site. */
export { default as ForumDialog } from "@/components/ui/GlassDialog";

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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
        <div className="flex items-center gap-2">
          <span className={`text-[11px] tabular-nums ${value.length > max * 0.9 ? "text-orange-600" : "text-[var(--text-muted)]"}`}>
            {value.length}/{max}
          </span>
          <GlassIconButton
            icon={Keyboard}
            color={keyboardOpen ? "gold" : "navy"}
            size="sm"
            onClick={() => {
              setMode("write");
              setKeyboardOpen((v) => !v);
              requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
            }}
            aria-label={keyboardOpen ? "Fermer le clavier" : "Ouvrir le clavier (formules et symboles)"}
          />
        </div>
      </div>
      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          id={id}
          // Clavier du site ouvert : pas de clavier du téléphone par-dessus.
          inputMode={keyboardOpen ? "none" : undefined}
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
      <ForumKeyboard
        open={keyboardOpen && mode === "write"}
        onClose={() => setKeyboardOpen(false)}
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
        max={max}
      />
    </div>
  );
}
