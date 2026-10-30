"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { DEFAULT_SUBJECT_AREAS, normalizeSubjectAreas } from "@/lib/subjectAreas";

interface Props {
  areas: string[];
  onSaved: (areas: string[]) => void;
  onClose: () => void;
}

/** Édition de la liste des domaines : ajouter, renommer, réordonner, supprimer. Les cours déjà classés gardent leur domaine. */
export default function SubjectAreasEditor({ areas, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>(areas);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length) return;
    const copy = [...draft];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setDraft(copy);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subject-areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areas: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      onSaved(normalizeSubjectAreas(data.areas));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1080] p-4 modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        <div className="px-6 py-4 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Liste des domaines</h2>
            <p className="text-xs text-white/70">Proposés dans les cours et la génération</p>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {draft.map((name, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={name}
                maxLength={40}
                onChange={(e) => setDraft(draft.map((d, k) => (k === i ? e.target.value : d)))}
                className="flex-1 px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                aria-label={`Domaine ${i + 1}`}
              />
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="p-1.5 text-gray-500 hover:text-[var(--greek-blue)] disabled:opacity-30" aria-label="Monter"><ArrowUp size={16} /></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === draft.length - 1} className="p-1.5 text-gray-500 hover:text-[var(--greek-blue)] disabled:opacity-30" aria-label="Descendre"><ArrowDown size={16} /></button>
              <button type="button" onClick={() => setDraft(draft.filter((_, k) => k !== i))} className="p-1.5 text-red-500 hover:text-red-700" aria-label="Supprimer"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setDraft([...draft, ""])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--greek-blue)] hover:underline pt-1">
            <Plus size={14} /> Ajouter un domaine
          </button>
          <p className="text-xs text-gray-500 pt-2">
            Les cours déjà enregistrés gardent leur domaine, même s&apos;il n&apos;est plus dans la liste. Renommer un domaine ne change pas les cours existants.
          </p>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[rgba(197,161,72,0.25)] flex justify-between gap-3 flex-shrink-0">
          <GlassButton variant="ghost" type="button" onClick={() => setDraft([...DEFAULT_SUBJECT_AREAS])}>Valeurs d&apos;origine</GlassButton>
          <div className="flex gap-2">
            <GlassButton variant="ghost" type="button" onClick={onClose}>Annuler</GlassButton>
            <GlassButton variant="navy" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement..." : "Enregistrer"}</GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
