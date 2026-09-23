"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { useToast } from "@/components/Toast";
import type { ForumCategory, ForumRole } from "@/lib/forumTypes";
import { forumApi } from "./forumApi";
import { Composer, ForumDialog } from "./ForumBits";

const TITLE_MAX = 150;
const CONTENT_MAX = 5000;

export default function NewTopicDialog({
  role, categories, defaultCategoryId, onClose, onCreated,
}: {
  role: ForumRole;
  categories: ForumCategory[];
  defaultCategoryId: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const toast = useToast();
  // Les catégories réservées à l'équipe (Annonces) ne sont proposées qu'aux admins.
  const allowed = categories.filter((c) => role === "admin" || !c.admin_only);
  const [categoryId, setCategoryId] = useState<number | "">(
    allowed.some((c) => c.id === defaultCategoryId) ? (defaultCategoryId as number) : allowed[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!categoryId && title.trim().length >= 5 && content.trim().length >= 2 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { id } = await forumApi.createPost({ categoryId: Number(categoryId), title: title.trim(), content: content.trim() });
      toast.success("Sujet publié.");
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <ForumDialog
      title="Nouveau sujet"
      onClose={onClose}
      wide
      footer={
        <>
          <GlassButton variant="ghost" size="sm" onClick={onClose}>Annuler</GlassButton>
          <GlassButton variant="navy" size="sm" onClick={submit} disabled={!canSubmit}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publier
          </GlassButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Catégorie</span>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className="w-full py-2.5 px-3 rounded-xl text-sm">
            {allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
            Titre
            <span className="text-[11px] font-normal text-[var(--text-muted)] tabular-nums">{title.length}/{TITLE_MAX}</span>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="Ex. Comment simplifier une fraction ?"
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] text-[15px] outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
          />
        </label>
        <div>
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Message</span>
          <Composer
            label="Message du sujet"
            value={content}
            onChange={setContent}
            max={CONTENT_MAX}
            minRows={7}
            placeholder="Explique ta question ou ton idée. Pour une formule, écris-la entre $ : $x^2 + 1$."
          />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Reste bienveillant et ne partage jamais d&apos;informations personnelles (adresse, téléphone, école…).
        </p>
      </div>
    </ForumDialog>
  );
}
