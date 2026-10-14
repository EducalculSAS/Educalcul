"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, Brain, Loader2, Plus, Trash2, Save, CheckCircle, AlertCircle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { errMessage } from "@/lib/safeError";

interface Question {
  id: number;
  grade_level: string;
  question: string;
  options: string[];
  correct_index: number;
  notion: string;
  sort_order: number;
}

export default function PlacementQuizPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [level, setLevel] = useState(SCHOOL_LEVELS[0].value);
  const [saving, setSaving] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authHeaders = async (extra?: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token || ""}`, ...extra };
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/placement-quiz", { headers: await authHeaders() });
    const data = await res.json();
    if (res.ok) setQuestions(data);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement déclenché par ce seul changement (load est recréée à chaque rendu)
  useEffect(() => { if (open) load(); }, [open]);

  const flash = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const levelQuestions = questions.filter((q) => q.grade_level === level).sort((a, b) => a.sort_order - b.sort_order);

  const updateLocal = (id: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const saveQuestion = async (q: Question) => {
    setSaving(q.id);
    try {
      const res = await fetch("/api/admin/placement-quiz", {
        method: "PUT",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: q.id, grade_level: q.grade_level, question: q.question, options: q.options, correct_index: q.correct_index, notion: q.notion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash("success", "Question enregistrée.");
    } catch (err: unknown) {
      flash("error", errMessage(err) || "Erreur.");
    } finally {
      setSaving(null);
    }
  };

  const addQuestion = async () => {
    setSaving("new");
    try {
      const res = await fetch("/api/admin/placement-quiz", {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ grade_level: level, question: "Nouvelle question", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct_index: 0, notion: "notion" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions((qs) => [...qs, data]);
    } catch (err: unknown) {
      flash("error", errMessage(err) || "Erreur.");
    } finally {
      setSaving(null);
    }
  };

  const deleteQuestion = async (id: number) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/placement-quiz?id=${id}`, { method: "DELETE", headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions((qs) => qs.filter((q) => q.id !== id));
    } catch (err: unknown) {
      flash("error", errMessage(err) || "Erreur.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-bold text-[var(--greek-blue)]">
          <Brain className="w-5 h-5" />
          QCM de placement (par niveau)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-[rgba(197,161,72,0.15)] pt-4">
          <p className="text-sm text-gray-600 mb-4">
            Ces questions sont posées à chaque élève lors de sa toute première connexion (mini-test de niveau), pour adapter le message affiché en fin d&apos;onboarding. 3 questions par niveau minimum recommandé.
          </p>

          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {message.text}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Niveau</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
            >
              {SCHOOL_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <div className="space-y-4">
              {levelQuestions.length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucune question pour ce niveau, les élèves de ce niveau n&apos;auront pas de mini-test.</p>
              )}
              {levelQuestions.map((q) => (
                <div key={q.id} className="border border-[rgba(197,161,72,0.2)] rounded-xl p-4">
                  <input
                    value={q.question}
                    onChange={(e) => updateLocal(q.id, { question: e.target.value })}
                    className="w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm font-semibold mb-3"
                    placeholder="Énoncé de la question"
                  />
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correct_index === i}
                          onChange={() => updateLocal(q.id, { correct_index: i })}
                          className="shrink-0"
                        />
                        <input
                          value={opt}
                          onChange={(e) => {
                            const options = [...q.options];
                            options[i] = e.target.value;
                            updateLocal(q.id, { options });
                          }}
                          className="flex-1 px-2 py-1.5 border border-[rgba(197,161,72,0.2)] rounded-lg text-sm"
                          placeholder={`Réponse ${i + 1}`}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Notion (utilisée pour la mémoire pédagogique de Calia, courte, ex: &quot;fractions&quot;)
                    </label>
                    <input
                      value={q.notion}
                      onChange={(e) => updateLocal(q.id, { notion: e.target.value })}
                      className="w-full px-3 py-1.5 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                      placeholder="ex: fractions"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <GlassButton size="sm" variant="ghost" disabled={saving === q.id} onClick={() => deleteQuestion(q.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </GlassButton>
                    <GlassButton size="sm" variant="navy" disabled={saving === q.id} onClick={() => saveQuestion(q)}>
                      <Save className="w-3.5 h-3.5" /> {saving === q.id ? "Enregistrement..." : "Enregistrer"}
                    </GlassButton>
                  </div>
                </div>
              ))}
              <GlassButton size="sm" variant="ghost" disabled={saving === "new"} onClick={addQuestion}>
                <Plus className="w-3.5 h-3.5" /> Ajouter une question
              </GlassButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
