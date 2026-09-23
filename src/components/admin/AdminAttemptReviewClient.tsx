"use client";

import GlassIconButton from "@/components/ui/GlassIconButton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import QuizViewer from "@/components/viewers/QuizViewer";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" };
}

interface AttemptRow {
  id: string;
  progress_json: any;
  attempts_history: any[] | null;
  score: number | null;
  total_points: number | null;
}

/** Écran admin de revue d'une copie — même rendu que la correction vue par
 * l'élève (ExerciseViewer/QuizViewer en reviewMode), avec un sélecteur de
 * tentative au-dessus et adminMode branché pour laisser un commentaire /
 * corriger une réponse par question (voir /api/admin/attempts). */
export default function AdminAttemptReviewClient({
  userId, childName, kind, itemId, item, attempt,
}: {
  userId: string;
  childName: string;
  kind: "exercise" | "quiz";
  itemId: string;
  item: any;
  attempt: AttemptRow;
}) {
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
  const progress = rawProgress
    ? { ...rawProgress, score: selected === "latest" ? attemptData.score : history[selected]?.score }
    : null;

  const refresh = async () => {
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/attempts?kind=${kind}&userId=${userId}&itemId=${itemId}`, { headers });
    if (res.ok) {
      const d = await res.json();
      setAttemptData(d.attempt);
      setVersion((v) => v + 1);
    }
  };

  const save = async (key: string, extra: { comment?: string; editedAnswer?: any }) => {
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
    onEditAnswer: (key: string, value: any) => save(key, { editedAnswer: value }),
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
          Correction — {item.title} · {childName}
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
            {history.map((h: any, i: number) => {
              const disabled = !h.detail;
              const label = `${new Date(h.completed_at).toLocaleDateString("fr-FR")} — ${h.score}/${h.total_points}${disabled ? " (résumé seulement)" : ""}`;
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
        ) : kind === "exercise" ? (
          <ExerciseViewer key={`${selected}-${version}`} exercise={item} reviewMode initialProgress={progress} adminMode={adminMode} />
        ) : (
          <QuizViewer key={`${selected}-${version}`} quiz={item} reviewMode initialProgress={progress} adminMode={adminMode} />
        )}
      </div>
    </div>
  );
}
