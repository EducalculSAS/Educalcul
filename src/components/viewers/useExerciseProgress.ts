import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RevealInfo } from "@/components/viewers/ExerciseViewer";
import type { AnswerMap } from "@/types/answers";

/** Aperçu admin, relecture ou démonstration publique : rien n'est enregistré ni chargé pour ces exercices. */
export const isVirtualExercise = (id?: string | null) => !id || id === "preview" || id === "review" || id === "demo";

interface ProgressState {
  answers: AnswerMap;
  submittedBlocks: Set<string>;
  results: Record<string, boolean>;
  aiFeedback: Record<string, string>;
  revealed: Record<string, RevealInfo>;
  score: number;
  exerciseCompleted: boolean;
  blockModes: Record<string, "text" | "draw">;
  currentScreenIndex: number;
}
interface ProgressSetters {
  setAnswers: Dispatch<SetStateAction<AnswerMap>>;
  setSubmittedBlocks: Dispatch<SetStateAction<Set<string>>>;
  setResults: Dispatch<SetStateAction<Record<string, boolean>>>;
  setAiFeedback: Dispatch<SetStateAction<Record<string, string>>>;
  setRevealed: Dispatch<SetStateAction<Record<string, RevealInfo>>>;
  setScore: Dispatch<SetStateAction<number>>;
  setExerciseCompleted: Dispatch<SetStateAction<boolean>>;
  setBlockModes: Dispatch<SetStateAction<Record<string, "text" | "draw">>>;
  setCurrentScreenIndex: Dispatch<SetStateAction<number>>;
  setShowReview: Dispatch<SetStateAction<boolean>>;
}
interface Options {
  exerciseId: string | undefined;
  reviewMode?: boolean;
  forceNewAttempt?: boolean;
  openCorrection?: boolean;
  screenCount: number;
  state: ProgressState;
  restore: ProgressSetters;
}

/**
 * Persistance de l'exercice côté serveur : chargement de la progression au montage (elle survit à une déconnexion ou à un
 * changement d'appareil), sauvegarde différée à chaque changement, et chronomètre de la séance.
 */
export function useExerciseProgress({ exerciseId, reviewMode, forceNewAttempt, openCorrection, screenCount, state, restore }: Options) {
  const { answers, submittedBlocks, results, aiFeedback, revealed, score, exerciseCompleted, blockModes, currentScreenIndex } = state;
  const { setAnswers, setSubmittedBlocks, setResults, setAiFeedback, setRevealed, setScore, setExerciseCompleted, setBlockModes, setCurrentScreenIndex, setShowReview } = restore;
  // Rempli par l'effet de chargement serveur ci-dessous.
  const accumulatedSecondsRef = useRef(0);

  // Charge la progression depuis la base de données (survit à une déconnexion / changement d'appareil)
  const userIdRef = useRef<string | null>(null);
  const progressLoadedFromDbRef = useRef(false);
  useEffect(() => {
    if (reviewMode) return;
    if (isVirtualExercise(exerciseId)) return;
    if (forceNewAttempt) {
      // Nouvelle tentative : on ne restaure pas l'état d'une session précédente
      progressLoadedFromDbRef.current = true;
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      userIdRef.current = session.user.id;

      try {
        const res = await fetch(`/api/child/exercises/${exerciseId}/progress?userId=${session.user.id}`);
        const data = await res.json();
        const p = data?.progress;
        if (p) {
          setAnswers(p.answers || {});
          setSubmittedBlocks(new Set(p.submittedBlocks || []));
          setResults(p.results || {});
          setAiFeedback(p.aiFeedback || {});
          setRevealed(p.revealed || {});
          setScore(p.score || 0);
          setExerciseCompleted(p.exerciseCompleted || data?.status === "completed" || false);
          setBlockModes(p.blockModes || {});
          accumulatedSecondsRef.current = p.timeSpent || 0;
          if (typeof p.currentPageIndex === "number") {
            setCurrentScreenIndex(Math.min(p.currentPageIndex, Math.max(0, screenCount - 1)));
          }
          if (openCorrection) {
            setExerciseCompleted(false);
            setShowReview(true);
            setCurrentScreenIndex(0);
          }
        } else if (data?.status === "completed") {
          // Le statut "completed" a été enregistré (via /api/child/activities) mais le
          // progress_json détaillé n'a jamais été persisté (ex: navigation rapide après
          // la fin de l'exercice). On marque quand même l'exercice comme terminé.
          setExerciseCompleted(true);
        }
      } catch (e) {
        console.error("Failed to load exercise progress from DB:", e);
      } finally {
        progressLoadedFromDbRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  // Sauvegarde la progression en base de données (debounced) — seule
  // persistance désormais (plus d'écriture localStorage en parallèle).
  const saveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reviewMode) return;
    if (isVirtualExercise(exerciseId)) return;
    if (!progressLoadedFromDbRef.current) return; // évite d'écraser avant le chargement initial
    if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);

    const doSave = async () => {
      const userId = userIdRef.current;
      if (!userId) return;
      try {
        await fetch(`/api/child/exercises/${exerciseId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            progress: {
              answers,
              submittedBlocks: Array.from(submittedBlocks),
              results,
              aiFeedback,
              revealed,
              score,
              exerciseCompleted,
              blockModes,
              currentPageIndex: currentScreenIndex,
              timeSpent: accumulatedSecondsRef.current,
            },
          }),
        });
      } catch (e) {
        console.error("Failed to save exercise progress to DB:", e);
      }
    };

    // Sauvegarde immédiate (non debounced) quand l'exercice vient d'être terminé,
    // pour ne pas perdre l'état "terminé" si l'utilisateur quitte la page tout de suite.
    if (exerciseCompleted) {
      doSave();
      return;
    }

    saveProgressTimeoutRef.current = setTimeout(doSave, 1000);
    return () => {
      if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [answers, submittedBlocks, results, aiFeedback, revealed, score, exerciseCompleted, blockModes, currentScreenIndex, exerciseId]);

  // Session timer — accumulé en base via progress_json.timeSpent (voir plus
  // haut), plus de localStorage.
  const sessionStartRef = useRef<number>(0); // posé au montage (voir l'effet plus bas)
  const getAccumulatedSeconds = () => {
    if (isVirtualExercise(exerciseId)) return 0;
    return accumulatedSecondsRef.current;
  };
  const saveTimeSpent = () => {
    if (isVirtualExercise(exerciseId)) return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    accumulatedSecondsRef.current = total;
    sessionStartRef.current = Date.now();
    return total;
  };
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, []);
  // Durée affichée sur l'écran de fin : figée au moment où l'exercice se termine (l'affichage ne lit pas de ref).
  const [timeTotal, setTimeTotal] = useState(0);
  useEffect(() => {
    if (exerciseCompleted) setTimeTotal(getAccumulatedSeconds());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la fin de l'exercice déclenche la mesure
  }, [exerciseCompleted]);


  return { saveTimeSpent, timeTotal };
}
