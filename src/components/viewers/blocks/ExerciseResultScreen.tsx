"use client";
 
import Emblem3D from "@/components/Emblem3D";
import { Brain, CheckCircle, Trophy, XCircle, RotateCcw } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { type Page } from "@/components/admin/ExerciseBuilder";

type ExerciseResultScreenProps = {
  passed: boolean;
  manual: boolean;
  exercise: { id?: string; title: string; description?: string | null; content_json: Page[] | null; grading_type?: 'auto' | 'ai' | 'manual'; level?: string; type?: string; difficulty_level?: string; course_id?: string | number | null; courses?: { title?: string; subject?: string; level?: string; } | null; min_score_percent?: number | null; max_attempts?: number | null; time_limit_minutes?: number | null; };
  onRestart: (() => void) | undefined;
  restartBlocked: boolean | undefined;
  answeredCount: number;
  mins: number;
  score: number;
  totalPoints: number;
  percentage: number;
  bestScorePercent: number | undefined;
  threshold: number;
  setExerciseCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setShowReview: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  isPreview: boolean;
};

export default function ExerciseResultScreen(props: ExerciseResultScreenProps) {
  const { passed, manual, exercise, onRestart, restartBlocked, answeredCount, mins, score, totalPoints, percentage, bestScorePercent, threshold, setExerciseCompleted, setShowReview, setCurrentScreenIndex, isPreview } = props;
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
    <div className="container mx-auto px-3 py-4 md:px-4 md:py-6 max-w-5xl">
      <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
        {/* Thumbnail header */}
        <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-cream)]" : "bg-red-50"}`}>
          <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-5 md:p-8 text-white w-full">
              <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                {manual ? <><CheckCircle className="w-3.5 h-3.5" /> Copie envoyée</> : passed ? <><Trophy className="w-3.5 h-3.5" /> Exercice réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{exercise.title}</h1>
            </div>
          </div>
        </div>
  
        <div className="p-5 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Left */}
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <Emblem3D kind="trophy" size={32} float={false} />
                {manual ? "Merci !" : passed ? "Félicitations !" : "Exercice terminé"}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                {manual
                  ? "Tes réponses sont enregistrées. Ton professeur va les corriger : tu verras ta note dès que ce sera fait."
                  : <>Tu as terminé cet exercice. Consulte ta correction{onRestart && !restartBlocked ? " ou retente-le pour améliorer ton score" : ""} !</>}
              </p>
              <div className={`grid gap-3 ${manual ? "grid-cols-2" : "grid-cols-3"}`}>
                {(manual
                  ? [
                      { value: `${answeredCount}`, sub: "questions envoyées" },
                      { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                    ]
                  : [
                      { value: `${score}/${totalPoints}`, sub: "points obtenus" },
                      { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                      { value: `${percentage}%`, sub: "réussite" },
                    ]
                ).map((s, i) => (
                  <div key={s.sub} className={`rounded-xl p-4 text-center border ${i === 2 ? (passed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300") : "bg-[var(--greek-cream)] border-[rgba(197,161,72,0.25)]"}`}>
                    <p className={`text-xl font-bold font-[family-name:var(--font-display)] ${i === 2 ? (passed ? "text-green-600" : "text-red-600") : "text-[var(--greek-blue)]"}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              {!manual && typeof bestScorePercent === "number" && bestScorePercent > percentage && (
                <p className="mt-3 text-sm text-[var(--greek-blue)] font-bold">
                  Ton meilleur score reste {bestScorePercent}%
                </p>
              )}
              {!manual && threshold > 0 && (
                <div className={`mt-4 flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-xl ${passed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {passed ? `Seuil atteint (${threshold}% requis)` : `Seuil non atteint : ${threshold}% requis, tu as eu ${percentage}%`}
                </div>
              )}
            </div>
  
            {/* Right CTA */}
            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                {!manual && (
                  <GlassButton
                    onClick={() => {
                      setExerciseCompleted(false);
                      setShowReview(true);
                      setCurrentScreenIndex(0);
                    }}
                    variant="navy"
                    fullWidth
                    className="font-bold text-base"
                  >
                    Voir la correction
                  </GlassButton>
                )}
                {onRestart && !isPreview && !restartBlocked && (
                  <>
                    <GlassButton onClick={onRestart} variant="navy" fullWidth className="font-bold text-base">
                      <RotateCcw className="w-4 h-4" /> Refaire l&apos;exercice
                    </GlassButton>
                    {!!exercise.max_attempts && (
                      <p className="text-xs text-gray-500 text-center -mt-1">Un nouvel essai sera compté.</p>
                    )}
                  </>
                )}
                {onRestart && !isPreview && restartBlocked && (
                  <p className="text-xs text-gray-500 text-center">Tu as utilisé tous tes essais pour cet exercice.</p>
                )}
                {exercise.id === "demo" ? (
                  <>
                    {onRestart && (
                      <GlassButton onClick={onRestart} variant="outline" fullWidth className="font-bold text-base">
                        <RotateCcw className="w-4 h-4" /> Recommencer
                      </GlassButton>
                    )}
                    <GlassButton href="/auth/inscription" variant="navy" fullWidth className="font-bold text-base">
                      Essayer gratuitement
                    </GlassButton>
                  </>
                ) : (
                  <GlassButton href={exercise.course_id ? `/child/exercises?course=${exercise.course_id}` : "/child/exercises"} variant="outline" fullWidth className="font-bold text-base">
                    Retour aux exercices
                  </GlassButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
