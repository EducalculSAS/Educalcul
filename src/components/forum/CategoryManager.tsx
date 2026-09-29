"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import { useState } from "react";
import { ArrowDown, ArrowUp, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { AUDIENCE_LABELS, type ForumAudience, type ForumCategory } from "@/lib/forumTypes";
import { forumApi } from "./forumApi";
import { ForumDialog } from "./ForumBits";

const COLORS = ["#0f1e3a", "#c5a148", "#2563eb", "#0d9488", "#16a34a", "#ea580c", "#dc2626", "#9333ea"];

interface Draft {
  id: number | null;
  name: string;
  description: string;
  color: string;
  audience: ForumAudience;
  admin_only: boolean;
}

/** Catégories du forum : créer, modifier (public, couleur, publication
 * réservée à l'équipe), réordonner, supprimer. */
export default function CategoryManager({
  categories, onClose, onChanged,
}: {
  categories: ForumCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (c?: ForumCategory) =>
    setDraft(
      c
        ? { id: c.id, name: c.name, description: c.description ?? "", color: c.color ?? COLORS[1], audience: c.audience, admin_only: c.admin_only }
        : { id: null, name: "", description: "", color: COLORS[1], audience: "tous", admin_only: false },
    );

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await forumApi.saveCategory(draft.id, {
        name: draft.name,
        description: draft.description,
        color: draft.color,
        audience: draft.audience,
        admin_only: draft.admin_only,
        ...(draft.id ? {} : { order_index: (categories.at(-1)?.order_index ?? 0) + 1 }),
      });
      toast.success(draft.id ? "Catégorie modifiée." : "Catégorie créée.");
      setDraft(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ForumCategory) => {
    const ok = await confirm(
      c.post_count > 0 ? `Ses ${c.post_count} sujet(s) et leurs réponses seront supprimés définitivement.` : "La catégorie est vide.",
      { title: `Supprimer « ${c.name} » ?`, confirmLabel: "Supprimer" },
    );
    if (!ok) return;
    try {
      await forumApi.deleteCategory(c.id);
      toast.success("Catégorie supprimée.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Échange l'ordre de deux catégories voisines.
  const move = async (index: number, dir: -1 | 1) => {
    const a = categories[index];
    const b = categories[index + dir];
    if (!a || !b) return;
    setBusy(true);
    try {
      const orderA = a.order_index === b.order_index ? a.order_index + dir : b.order_index;
      await Promise.all([
        forumApi.saveCategory(a.id, { order_index: orderA }),
        forumApi.saveCategory(b.id, { order_index: a.order_index }),
      ]);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ForumDialog
      title={draft ? (draft.id ? "Modifier la catégorie" : "Nouvelle catégorie") : "Catégories du forum"}
      onClose={draft ? () => setDraft(null) : onClose}
      wide
      footer={
        draft ? (
          <>
            <GlassButton variant="ghost" size="sm" onClick={() => setDraft(null)}>Retour</GlassButton>
            <GlassButton variant="navy" size="sm" onClick={save} disabled={busy || draft.name.trim().length < 2}>Enregistrer</GlassButton>
          </>
        ) : (
          <GlassButton variant="navy" size="sm" onClick={() => edit()}><Plus className="w-4 h-4" /> Nouvelle catégorie</GlassButton>
        )
      }
    >
      {draft ? (
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Nom</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 60) })} autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Description</span>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value.slice(0, 200) })}
              className="w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Visible par</span>
            <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as ForumAudience })} className="w-full py-2.5 px-3 rounded-xl text-sm">
              {(Object.keys(AUDIENCE_LABELS) as ForumAudience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
            </select>
            <span className="block text-xs text-[var(--text-muted)] mt-1">Une catégorie « Élèves » est invisible pour les parents, et inversement.</span>
          </label>
          <div>
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Couleur</span>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })} aria-label={`Couleur ${c}`} aria-pressed={draft.color === c}
                  className={`w-8 h-8 rounded-full transition-transform ${draft.color === c ? "ring-2 ring-offset-2 ring-[var(--greek-blue)] scale-110" : "hover:scale-105"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <GlassSwitch checked={draft.admin_only} onChange={(next) => setDraft({ ...draft, admin_only: next })} label="Réservé à l'équipe" />
            Seule l&apos;équipe peut y publier (annonces), tout le monde peut répondre
          </label>
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[rgba(197,161,72,0.25)]">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color || "var(--greek-gold)" }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--greek-blue)] flex items-center gap-2">
                  {c.name}
                  {c.admin_only && <Megaphone className="w-3.5 h-3.5 text-[var(--greek-bronze)]" aria-label="Publication réservée à l'équipe" />}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{AUDIENCE_LABELS[c.audience]} · {c.post_count} sujet{c.post_count > 1 ? "s" : ""}</p>
              </div>
              <GlassIconButton icon={ArrowUp} color="gray" size="sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Monter" />
              <GlassIconButton icon={ArrowDown} color="gray" size="sm" disabled={busy || i === categories.length - 1} onClick={() => move(i, 1)} aria-label="Descendre" />
              <GlassIconButton icon={Pencil} color="navy" size="sm" onClick={() => edit(c)} aria-label={`Modifier ${c.name}`} />
              <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => remove(c)} aria-label={`Supprimer ${c.name}`} />
            </li>
          ))}
        </ul>
      )}
    </ForumDialog>
  );
}
