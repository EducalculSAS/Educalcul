"use client";

import type { AnswerValue } from "@/types/answers";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { parseOrNull } from "@/lib/validate";
import { exerciseProgressSchema, quizProgressSchema } from "@/lib/schemas";
import ExerciseViewer, { type ExerciseViewerProps } from "@/components/viewers/ExerciseViewer";
import QuizViewer, { type QuizViewerProps } from "@/components/viewers/QuizViewer";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" };
}

interface AttemptRow {
  id: string;
  progress_json: Record<string, unknown> | null;
  attempts_history: { detail?: Record<string, unknown>; score?: number; completed_at?: string; total_points?: number }[] | null;
  score: number | null;
  total_points: number | null;
}

/** Écran admin de revue d'une copie — même rendu que la correction vue par
 * l'élève (ExerciseViewer/QuizViewer en reviewMode), avec un sélecteur de
 * tentative au-dessus et adminMode branché pour laisser un commentaire /
 * corriger une réponse par question (voir /api/admin/attempts). */
type ReviewProps = { userId: string; childName: string; itemId: string; attempt: AttemptRow } & (
  | { kind: "exercise"; item: ExerciseViewerProps["exercise"] }
  | { kind: "quiz"; item: QuizViewerProps["quiz"] }
);

export default function AdminAttemptReviewClient(props: ReviewProps) {
  const { userId, childName, kind, itemId, item, attempt } = props;
  const router = useRouter();
  const [attemptData, setAttemptData] = useState(attempt);
  const [selected, setSelected] = useState<"latest" | number>("latest");
  const [saving, setSaving] = useState(false);
  // ExerciseViewer/QuizViewer ne relisent leur `initialProgress` qu'au
  // montage (useState(() => ...)) — sans remontage forcé, un commentaire/une
  // réponse tout juste enregistrés resteraient invisibles tant que la page
  // n'est pas rechargée. On force le remontage à chaque sauvegarde ET à
  // chaque changement de tentative sélectionnée via ce compteur dans `key`.
  const [version, setVersion] = useState(0);

  const history = attemptData.attempts_history || [];
  const rawProgress = selected === "latest" ? attemptData.progress_json : history[selected]?.detail;
  const progressInput = rawProgress
    ? { ...rawProgress, score: (selected === "latest" ? attemptData.score : history[selected]?.score) ?? undefined }
    : null;
  const exerciseProgress = props.kind === "exercise" && progressInput ? parseOrNull(exerciseProgressSchema, progressInput, "progress_json (exercice)") : null;
  const quizProgress = props.kind === "quiz" && progressInput ? parseOrNull(quizProgressSchema, progressInput, "progress_json (quiz)") : null;
  const progress = exerciseProgress ?? quizProgress;

  const refresh = async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/attempts?kind=${kind}&userId=${userId}&itemId=${itemId}`, { headers });
    if (res.ok) {
      const d = await res.json();
      setAttemptData(d.attempt);
      setVersion((v) => v + 1);
    }
  };

  const save = async (key: string, extra: { comment?: string; editedAnswer?: AnswerValue | string[]; verdict?: boolean }) => {
    setSaving(true);
    try {
      const headers = await authHeaders();
      await fetch("/api/admin/attempts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ kind, userId: Number(userId), itemId, attemptRef: selected, key, ...extra }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const adminMode = {
    onComment: (key: string, text: string) => save(key, { comment: text }),
    onEditAnswer: (key: string, value: AnswerValue | string[]) => save(key, { editedAnswer: value }),
    ...(kind === "exercise" ? { onVerdict: (key: string, correct: boolean) => save(key, { verdict: correct }) } : {}),
    saving,
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
        <GlassIconButton
            icon={ArrowLeft}
            onClick={() => router.push(`/admin/users/detail?id=${userId}`)}
            color="white"
            className="flex-shrink-0"
            aria-label="Retour à la fiche"
          />
        <h1 className="text-lg font-bold truncate flex-1">
          Correction : {item.title} · {childName}
        </h1>
      </div>

      {history.length > 0 && (
        <div className="p-3 border-b border-gray-100 overflow-x-auto shrink-0">
          <div className="flex gap-2 w-fit">
            <button
              onClick={() => setSelected("latest")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                selected === "latest" ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "text-gray-600 border-gray-200 hover:border-[var(--greek-blue)]"
              }`}
            >
              Dernière tentative ({attemptData.score}/{attemptData.total_points})
            </button>
            {history.map((h, i: number) => {
              const disabled = !h.detail;
              const label = `${new Date(h.completed_at ?? 0).toLocaleDateString("fr-FR")} : ${h.score}/${h.total_points}${disabled ? " (résumé seulement)" : ""}`;
              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => setSelected(i)}
                  title={disabled ? "Détail non disponible pour cette tentative (antérieure à cette fonctionnalité)" : undefined}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                    selected === i
                      ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]"
                      : disabled
                      ? "text-gray-300 border-gray-100 cursor-not-allowed"
                      : "text-gray-600 border-gray-200 hover:border-[var(--greek-blue)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {!progress ? (
          <div className="p-8 text-center text-gray-400">Détail non disponible pour cette tentative.</div>
        ) : props.kind === "exercise" ? (
          <ExerciseViewer key={`${selected}-${version}`} exercise={props.item} reviewMode initialProgress={exerciseProgress} adminMode={adminMode} />
        ) : (
          <QuizViewer key={`${selected}-${version}`} quiz={props.item} reviewMode initialProgress={quizProgress} adminMode={adminMode} />
        )}
      </div>
    </div>
  );
}
