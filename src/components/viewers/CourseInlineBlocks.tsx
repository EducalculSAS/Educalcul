"use client";
import { Exercise } from "@/components/admin/CourseBuilder";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders } from "@/lib/mathGraph";
import { useState, useEffect, useRef } from "react";
import { CheckCircle, PencilLine, Lightbulb, Keyboard, Pencil, Loader2 } from "lucide-react";
import { fetchMiniComment } from "@/lib/miniComment";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import DrawingCanvas from "@/components/DrawingCanvas";
import MathInput from "@/components/MathInput";
import AnswerFeedback from "@/components/viewers/AnswerFeedback";


// ─── Inline Mini-Exercises ──────────────────────────────────────────────────
export interface ExerciseState {
  input: string;
  attempts: number;
  status: "idle" | "correct" | "wrong" | "revealed" | "grading" | "unavailable";
  showHint: boolean;
  feedback?: string;
  mode: "text" | "draw";
}


// Découpe le HTML d'une leçon autour des placeholders
// <div class="lesson-exercise" data-exercise-id="ex-1"></div> insérés par l'IA,
// et des checklists <ul class="course-checklist">...</ul> (bilans de thème),
// pour insérer le mini-exercice interactif ou la checklist cochable
// correspondante à cet endroit précis.
export function renderLessonContentWithInlineExercises(
  content: string,
  exercises: Exercise[],
  lessonId: string,
  level?: string,
  onChecklistStatusChange?: (complete: boolean) => void
) {
  const regex = /<div[^>]*class="[^"]*lesson-exercise[^"]*"[^>]*data-exercise-id="([^"]*)"[^>]*>\s*<\/div>|<ul[^>]*class="[^"]*course-checklist[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
  const parts: { html?: string; exerciseId?: string; checklistHtml?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push({ html: content.slice(lastIndex, match.index) });
    if (match[1] !== undefined) parts.push({ exerciseId: match[1] });
    else parts.push({ checklistHtml: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push({ html: content.slice(lastIndex) });
  if (parts.length === 0) parts.push({ html: content });

  let exerciseCount = 0;
  let checklistCount = 0;
  return parts.map((part, idx) => {
    if (part.exerciseId) {
      const ex = exercises.find((e) => e.id === part.exerciseId);
      if (!ex) return null;
      exerciseCount++;
      return (
        <InlineMiniExercises
          key={`ex-${idx}`}
          lessonId={lessonId}
          exercises={[ex]}
          level={level}
          compact
          startNumber={exerciseCount}
        />
      );
    }
    if (part.checklistHtml !== undefined) {
      const items = [...part.checklistHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
      if (items.length === 0) return null;
      checklistCount++;
      return (
        <InteractiveChecklist
          key={`${lessonId}-checklist-${checklistCount}`}
          checklistId={`${lessonId}-checklist-${checklistCount}`}
          items={items}
          onStatusChange={onChecklistStatusChange}
        />
      );
    }
    const html = (part.html || "").trim();
    if (!html) return null;
    return (
      <div
        key={`html-${idx}`}
        dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(part.html || "")) }}
      />
    );
  });
}


// ─── Checklist interactive "Je sais faire" ─────────────────────────────────
// Remplace les puces d'un <ul class="course-checklist"> par de vraies cases
// à cocher. Prévient le parent (via onStatusChange) dès que tout est coché,
// pour débloquer "Terminer le cours" sur la dernière leçon d'un bilan.
export function InteractiveChecklist({
  checklistId,
  items,
  onStatusChange,
}: {
  checklistId: string;
  items: string[];
  onStatusChange?: (complete: boolean) => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    onStatusChange?.(checked.size >= items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, items.length]);

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const allChecked = checked.size >= items.length;

  return (
    <div className="rounded-xl border border-[rgba(197,161,72,0.3)] bg-[var(--greek-cream)]/60 p-4 space-y-2">
      {items.map((item, index) => {
        const isChecked = checked.has(index);
        return (
          <label
            key={`${checklistId}-${index}`}
            className="flex items-start gap-3 cursor-pointer select-none py-1"
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-pressed={isChecked}
              className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-[var(--greek-blue)] border-[var(--greek-blue)]"
                  : "border-[rgba(197,161,72,0.6)] bg-white"
              }`}
            >
              {isChecked && <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
            </button>
            <span
              className={isChecked ? "text-[var(--greek-blue)]/60 line-through" : "text-[var(--greek-blue)]"}
              dangerouslySetInnerHTML={{ __html: renderLatexInHTML(item) }}
            />
          </label>
        );
      })}
      {!allChecked && (
        <p className="text-xs text-[var(--greek-blue)]/60 pt-1">
          Coche chaque ligne une fois que tu sais le faire pour terminer le cours.
        </p>
      )}
    </div>
  );
}


export interface InlineMiniExercisesProps {
  lessonId: string;
  exercises: Exercise[];
  level?: string;
  compact?: boolean;
  title?: string;
  startNumber?: number;
}


export function InlineMiniExercises({ lessonId, exercises, level, compact, title, startNumber }: InlineMiniExercisesProps) {
  const [states, setStates] = useState<Record<string, ExerciseState>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when the lesson changes
  useEffect(() => {
    const initial: Record<string, ExerciseState> = {};
    exercises.forEach((ex) => {
      initial[ex.id] = {
        input: "",
        attempts: 0,
        status: "idle",
        showHint: false,
        feedback: undefined,
        mode: "text",
      };
    });
    setStates(initial);
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render KaTeX inside questions / explanations when content changes
  useEffect(() => {
    if (!containerRef.current) return;
    // renderLatexInHTML is already applied via dangerouslySetInnerHTML below — nothing more to do
  }, [states]);

  const updateState = (id: string, patch: Partial<ExerciseState>) => {
    setStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleVerify = async (ex: Exercise) => {
    const state = states[ex.id];
    if (!state) return;
    updateState(ex.id, { status: "grading", feedback: undefined });
    try {
      const resp = await fetch("/api/child/grade-mini-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: ex.question,
          answer: ex.answer,
          studentAnswer: state.input,
          level: level,
        }),
      });
      const result = await resp.json();
      if (result.unavailable) {
        // Panne d'infra, pas une vraie réponse fausse : ne pas pénaliser
        // l'élève (pas d'incrément d'attempts, réponse conservée).
        updateState(ex.id, { status: "unavailable", feedback: result.feedback });
        return;
      }
      if (result.is_correct) {
        updateState(ex.id, { status: "correct", feedback: result.feedback });
      } else {
        const attempts = state.attempts + 1;
        // 2 échecs d'affilée : on propose directement la réponse plutôt que
        // de laisser l'élève retenter indéfiniment.
        if (attempts >= 2) {
          updateState(ex.id, { status: "revealed", attempts, feedback: result.feedback });
        } else {
          updateState(ex.id, { status: "wrong", attempts, feedback: result.feedback });
        }
        // Verdict et réponse de base déjà affichés : le mini commentaire de l'IA arrive juste après, quand il y en a un.
        void fetchMiniComment(result.comment_token).then((comment) => {
          if (comment) setStates((prev) => (prev[ex.id]?.attempts === attempts && prev[ex.id]?.status !== "idle" ? { ...prev, [ex.id]: { ...prev[ex.id], feedback: comment } } : prev));
        });
      }
    } catch {
      updateState(ex.id, {
        status: "unavailable",
        feedback: "Correction indisponible, réessaie.",
      });
    }
  };

  const handleRetry = (id: string) => {
    updateState(id, { status: "idle", input: "", mode: "text" });
  };

  const handleToggleHint = (id: string) => {
    const s = states[id];
    updateState(id, { showHint: !s?.showHint });
  };

  return (
    <div ref={containerRef} className={compact ? "" : "mt-12 pt-8 border-t border-[rgba(197,161,72,0.25)]"}>
      {!compact && (
        <h2
          className="text-2xl font-bold mb-6 flex items-center gap-3 font-[family-name:var(--font-display)]"
          style={{ color: "var(--greek-blue)" }}
        >
          <PencilLine className="w-7 h-7" style={{ color: "var(--greek-gold)" }} />
          <span>{title || "Mini-exercices"}</span>
        </h2>
      )}

      <div className="space-y-4">
        {exercises.map((ex, idx) => {
          const s = states[ex.id] || {
            input: "",
            attempts: 0,
            status: "idle" as const,
            showHint: false,
            mode: "text" as const,
          };
          const isCorrect = s.status === "correct";
          const isWrong = s.status === "wrong";
          const isRevealed = s.status === "revealed";
          const isGrading = s.status === "grading";
          const isUnavailable = s.status === "unavailable";

          return (
            <div
              key={ex.id}
              data-mini-exercise
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm transition-all"
              style={{
                borderColor: isCorrect
                  ? "var(--greek-gold)"
                  : isWrong
                  ? "#fecaca"
                  : "#e5e7eb",
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: "var(--greek-blue)",
                    color: "#fff",
                  }}
                >
                  {(startNumber ?? 1) + idx}
                </div>
                <div className="flex-1">
                  <div
                    className="text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderLatexInHTML(ex.question),
                    }}
                  />
                </div>
              </div>

              {/* Hint toggle */}
              {ex.hint && !isCorrect && !isRevealed && (
                <div className="mb-3">
                  <GlassButton
                    onClick={() => handleToggleHint(ex.id)}
                    variant="outline"
                    size="sm"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {s.showHint ? "Masquer l'indice" : "Indice"}
                  </GlassButton>
                  {s.showHint && (
                    <div
                      className="mt-2 px-4 py-2.5 rounded-lg text-sm"
                      style={{
                        background: "rgba(197,161,72,0.08)",
                        color: "#7c5e1a",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderLatexInHTML(ex.hint),
                      }}
                    />
                  )}
                </div>
              )}

              {/* Input + verify */}
              {!isCorrect && !isRevealed && (
                <div className="flex flex-col gap-2" data-exercise-answer-block>
                  {/* Mode toggle */}
                  <div className="flex justify-end mb-1">
                    <GlassSegmentedControl
                      size="sm"
                      options={[
                        {
                          id: "text",
                          label: (
                            <span className="flex items-center gap-1">
                              <Keyboard className="w-3 h-3" /> Clavier
                            </span>
                          ),
                        },
                        {
                          id: "draw",
                          label: (
                            <span className="flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Dessin
                            </span>
                          ),
                        },
                      ]}
                      value={s.mode === "draw" ? "draw" : "text"}
                      onChange={(mode) => updateState(ex.id, { mode: mode as "text" | "draw" })}
                    />
                  </div>

                  {s.mode === "draw" ? (
                    <DrawingCanvas
                      disabled={isGrading}
                      initialData={s.input}
                      onChange={(data) => updateState(ex.id, { input: data })}
                    />
                  ) : (
                    <MathInput
                      value={s.input.startsWith("data:image") ? "" : s.input}
                      disabled={isGrading}
                      onChange={(latex) => {
                        updateState(ex.id, { input: latex });
                        // Visibilité live pour "Calia en classe" (CaliaSceneDemo) —
                        // même convention que educalcul:ai-question : un simple
                        // CustomEvent global, pas de store/contexte partagé.
                        window.dispatchEvent(new CustomEvent("educalcul:exercise-input", {
                          detail: { exerciseId: ex.id, question: ex.question, value: latex },
                        }));
                      }}
                      placeholder="Ta réponse..."
                      className="w-full min-h-[48px] px-2 border border-gray-200 bg-gray-50 rounded-xl focus-within:ring-2 focus-within:ring-[var(--greek-blue)]/30 focus-within:border-[var(--greek-blue)] transition-all text-gray-800"
                      level={level}
                    />
                  )}

                  <GlassButton
                    onClick={() => handleVerify(ex)}
                    disabled={!s.input.trim() || isGrading}
                    variant="navy"
                    size="sm"
                    className="self-start min-w-[150px]"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Correction...</span>
                      </>
                    ) : (
                      "Vérifier"
                    )}
                  </GlassButton>
                </div>
              )}

              {/* Retour de correction : même carte que dans les exercices et les quiz */}
              {(isUnavailable || isWrong || isCorrect || isRevealed) && (
                <div className="mt-3 space-y-2">
                  <AnswerFeedback
                    kind={isCorrect ? "correct" : isWrong ? "wrong" : isRevealed ? "revealed" : "unavailable"}
                    feedback={s.feedback}
                    correctAnswer={isRevealed ? ex.answer : undefined}
                    tryAgain={isWrong}
                  />
                  {(isWrong || isRevealed) && (
                    <GlassButton onClick={() => handleRetry(ex.id)} variant={isWrong ? "danger" : "outline"} size="sm">
                      {isWrong ? "Réessayer" : "Réessayer cet exercice"}
                    </GlassButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
