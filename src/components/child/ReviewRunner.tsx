"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { supabase } from "@/lib/supabaseClient";

interface ReviewExercise {
  id: "review";
  title: string;
  level: string;
  grading_type: "auto";
  content_json: never[];
}

/** Lance la séance « à revoir » : les questions du jour s'ouvrent dans le lecteur d'exercices habituel. */
export default function ReviewRunner({ dueCount }: { dueCount: number }) {
  const router = useRouter();
  const [exercise, setExercise] = useState<ReviewExercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/child/review/session", { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de préparer la séance.");
      if (!data.session) {
        setError("Rien à revoir pour le moment : reviens demain !");
        router.refresh();
        return;
      }
      setExercise(data.session.exercise);
      setRound((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de préparer la séance.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setExercise(null);
    router.refresh();
  };

  return (
    <>
      <GlassButton onClick={start} variant="navy" disabled={loading || dueCount === 0}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
        {dueCount === 0 ? "Rien à revoir aujourd'hui" : `Lancer la révision (${Math.min(dueCount, 8)} question${Math.min(dueCount, 8) > 1 ? "s" : ""})`}
      </GlassButton>
      {error && <p className="text-sm text-[var(--greek-bronze)] mt-2">{error}</p>}

      {exercise && (
        <div className="fixed inset-x-0 bottom-0 top-[calc(var(--nav-h)+var(--imp-banner-h,0px))] z-50 bg-white flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
            <button type="button" onClick={close} aria-label="Retour" className="p-1 rounded-full hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold truncate flex-1">À revoir</h1>
            <GlassCloseButton variant="dark" onClick={close} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ExerciseViewer key={round} exercise={exercise as never} forceNewAttempt onBack={close} />
          </div>
        </div>
      )}
    </>
  );
}
