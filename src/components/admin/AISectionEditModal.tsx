"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import PageLoader from "@/components/PageLoader";
import { useSmoothPercent } from "./useSmoothPercent";
import { errMessage } from "@/lib/safeError";

/**
 * Modale d'édition IA CIBLÉE : ne modifie qu'une seule leçon ou qu'un seul
 * chapitre. On n'envoie que cette section à l'IA (beaucoup plus rapide et
 * précis que de renvoyer tout le cours), et elle renvoie la section modifiée.
 */
// Pour les éléments "parents" (qui contiennent un tableau d'enfants), on
// applique un filet de sécurité pour ne pas perdre d'enfants oubliés par l'IA.
const CHILD_KEY: Record<string, string> = { chapter: "lessons", page: "blocks" };
const SCOPE_LABELS: Record<string, { article: string; noun: string }> = {
  lesson: { article: "la leçon", noun: "cette leçon" },
  chapter: { article: "le chapitre", noun: "ce chapitre" },
  page: { article: "la page", noun: "cette page" },
  block: { article: "le bloc", noun: "ce bloc" },
  question: { article: "la question", noun: "cette question" },
};

export default function AISectionEditModal({
  scope,
  level,
  section,
  onApply,
  onClose,
}: {
  scope: "lesson" | "chapter" | "page" | "block" | "question";
  level?: string;
  section: any;
  onApply: (updated: any) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Remplissage fluide : avance jusqu'à ~95 % pendant l'écriture, 100 % à la fin.
  const smoothPct = useSmoothPercent(done ? 1 : 0, 1, loading || done, 9000);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const label = SCOPE_LABELS[scope]?.noun || "cet élément";
  const titleNoun = SCOPE_LABELS[scope]?.article || "l'élément";

  const handleApply = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setDone(false);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/admin/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: scope, instruction, content: section, level }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de modification");
      if (!data.item) throw new Error("Réponse IA invalide");

      let updated: any;
      if (scope === "block" && section.type === "text") {
        // Bloc de texte (énoncé, données) : il reste un bloc de texte, seul son contenu change.
        updated = { ...section, content: data.item.content ?? section.content, id: section.id };
      } else if (scope === "block" || scope === "question") {
        // Une question modifiée REMPLACE l'ancienne en entier (on ne garde que son identifiant et ses points) : fusionner
        // laissait traîner l'ancienne réponse attendue, l'ancienne explication, les anciens indices… et la correction
        // automatique continuait donc de comparer à la question d'origine.
        updated = { ...data.item, id: section.id };
        if (updated.points === undefined && section.points !== undefined) updated.points = section.points;
      } else if (scope === "page") {
        // Page : les questions renvoyées par l'IA remplacent celles de la page, avec des identifiants neufs. L'IA numérote
        // « block-1 », « block-2 »… : réutiliser ces noms ou ré-ajouter les anciennes questions créait des doublons
        // d'identifiant, et la correction retrouvait alors l'ANCIENNE question à la place de la nouvelle.
        updated = {
          ...section,
          ...data.item,
          id: section.id,
          blocks: (Array.isArray(data.item.blocks) ? data.item.blocks : []).map((b: any) => ({ ...b, id: crypto.randomUUID() })),
        };
      } else {
        // On fusionne avec la section existante : tout champ non renvoyé par l'IA est conservé, et on garde l'id d'origine.
        updated = { ...section, ...data.item, id: section.id };
      }

      // Filet de sécurité pour un élément parent (chapitre→leçons) :
      // si l'IA a oublié des enfants existants, on les ré-ajoute.
      const childKey = scope === "page" ? undefined : CHILD_KEY[scope];
      if (childKey && Array.isArray(section[childKey]) && Array.isArray(updated[childKey])) {
        const returned = new Set(updated[childKey].map((c: any) => c?.id));
        const missing = section[childKey].filter((c: any) => !returned.has(c?.id));
        if (missing.length > 0) updated[childKey] = [...updated[childKey], ...missing];
      }

      setDone(true);
      await new Promise((r) => setTimeout(r, 350));
      onApply(updated);
      onClose();
    } catch (e: unknown) {
      if ((e instanceof Error ? e.name : "") === "AbortError") return;
      setError(errMessage(e) || "Erreur de modification");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm modal-overlay">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[var(--greek-blue)] to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Modifier {titleNoun} avec l&apos;IA</h3>
          </div>
          <button onClick={handleClose} className="group text-white/80 hover:text-white transition-colors">
            <X size={20} className="transition-transform group-hover:scale-125" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PageLoader className="h-24 mb-2" />
              <p className="text-sm font-semibold text-gray-700 mb-1">
                {done ? "Terminé !" : "Écriture du contenu modifié..."}
              </p>
              <p className="text-xs text-gray-400 mb-4">{elapsed}s écoulées · {Math.round(smoothPct)}%</p>
              <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, smoothPct)}%`,
                    background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))",
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Décris ce que tu veux changer dans {label} : un détail (un titre, une phrase, une réponse,
                un tableau...) ou quelque chose de plus important.
              </p>
              <p className="text-xs text-gray-400 truncate">
                {titleNoun.charAt(0).toUpperCase() + titleNoun.slice(1)} :{" "}
                <strong>{section?.title || section?.text || "(sans titre)"}</strong>
              </p>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={`Ex : Renomme ${label}... / Corrige l'énoncé... / Ajoute un exemple...`}
                aria-label="Instruction de modification"
                className="w-full min-h-[100px] border border-[rgba(197,161,72,0.25)] rounded-xl text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                disabled={loading}
                autoFocus
              />
            </>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {!loading && (
          <div className="p-4 border-t border-[rgba(197,161,72,0.25)] flex justify-end gap-2">
            <GlassButton
              size="sm"
              variant="navy"
              onClick={handleApply}
              disabled={!instruction.trim()}
              className="gap-2"
            >
              <Sparkles size={16} />
              Appliquer
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}
