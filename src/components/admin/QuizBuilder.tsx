"use client";

import { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDragAutoScroll } from "@/lib/useDragAutoScroll";
import {
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  Circle,
  AlignLeft,
  Type,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Loader2,
} from "lucide-react";

import AISectionEditModal from "./AISectionEditModal";
import AIAddQuizModal from "./AIAddQuizModal";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import ContentInsertToolbar from "./ContentInsertToolbar";
import { ensureKatexAutoRenderLoaded } from "@/lib/katexLoader";

export interface Question {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "text_input" | "impossible_search";
  points: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
  /** "Questions liées" : regroupe des questions consécutives qui partagent un
   * même contexte (affiché une fois via group_intro), sans dépendance
   * mécanique de correction entre elles — chaque question reste notée
   * indépendamment (voir plan : modèle quiz plat, contrairement aux
   * exercices qui ont de vraies pages multi-blocs séquentielles). */
  group_id?: string;
  group_intro?: string;
}

interface QuizBuilderProps {
  initialQuestions: Question[];
  onChange: (questions: Question[]) => void;
  onMetadataChange?: (metadata: any) => void;
  /** Niveau scolaire du quiz, déjà choisi plus haut dans le formulaire. */
  level?: string;
}

export default function QuizBuilder({
  initialQuestions,
  onChange,
  onMetadataChange,
  level,
}: QuizBuilderProps) {
  const confirm = useConfirm();
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions || []
  );
  const [draggedQuestion, setDraggedQuestion] = useState<number | null>(null);
  useDragAutoScroll(draggedQuestion !== null);

  const moveQuestion = (from: number, to: number) => {
    if (from === to || to < 0 || to >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };

  // AI Edit State
  const [isAiAddModalOpen, setIsAiAddModalOpen] = useState(false);
  const [aiEditQuestionId, setAiEditQuestionId] = useState<string | null>(null);
  const effectiveLevel = level || "6eme";
  const contentRef = useRef<HTMLDivElement>(null);

  const addQuestionFromAI = (question: Question, position: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      if (position === "start") copy.unshift(question);
      else if (position === "end") copy.push(question);
      else {
        const i = copy.findIndex((q) => q.id === position);
        if (i >= 0) copy.splice(i + 1, 0, question);
        else copy.push(question);
      }
      return copy;
    });
  };

  // Charge KaTeX une seule fois, partagé entre tous les builders montés
  // (voir ensureKatexAutoRenderLoaded — évite d'accumuler/retirer des
  // scripts globaux à chaque montage/démontage de builder).
  useEffect(() => {
    ensureKatexAutoRenderLoaded()
      .then(() => {
        if (contentRef.current && (window as any).renderMathInElement) {
          (window as any).renderMathInElement(contentRef.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Re-run math rendering when questions change
  useEffect(() => {
    if ((window as any).renderMathInElement && contentRef.current) {
      setTimeout(() => {
        (window as any).renderMathInElement(contentRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      }, 100);
    }
  }, [questions]);

  // Sync state with props when initialQuestions changes
  useEffect(() => {
    if (
      initialQuestions &&
      JSON.stringify(initialQuestions) !== JSON.stringify(questions)
    ) {
      setQuestions(initialQuestions);
    }
  }, [initialQuestions]);

  useEffect(() => {
    onChange(questions);
  }, [questions]);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: "",
      type: "single_choice",
      points: 1,
      options: ["Option 1", "Option 2"],
      correctAnswer: "Option 1",
      explanation: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = async (id: string) => {
    if (await confirm("Supprimer cette question ?")) {
      setQuestions(questions.filter((q) => q.id !== id));
    }
  };

  const addOption = (questionId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options) {
          return {
            ...q,
            options: [...q.options, `Option ${q.options.length + 1}`],
          };
        }
        return q;
      })
    );
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options) {
          const newOptions = [...q.options];
          const oldValue = newOptions[index];
          newOptions[index] = value;

          // Also update correct answer if it matches the old value
          let newCorrectAnswer = q.correctAnswer;
          if (Array.isArray(newCorrectAnswer)) {
            newCorrectAnswer = newCorrectAnswer.map((a) =>
              a === oldValue ? value : a
            );
          } else if (newCorrectAnswer === oldValue) {
            newCorrectAnswer = value;
          }

          return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
        }
        return q;
      })
    );
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options) {
          const newOptions = q.options.filter((_, i) => i !== index);
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const toggleCorrectAnswer = (questionId: string, optionValue: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          if (q.type === "multiple_choice") {
            const currentAnswers = Array.isArray(q.correctAnswer)
              ? q.correctAnswer
              : [];
            const newAnswers = currentAnswers.includes(optionValue)
              ? currentAnswers.filter((a) => a !== optionValue)
              : [...currentAnswers, optionValue];
            return { ...q, correctAnswer: newAnswers };
          } else {
            return { ...q, correctAnswer: optionValue };
          }
        }
        return q;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">
          Questions ({questions.length})
        </h3>
        <div className="flex gap-2">
          <GlassButton size="sm" variant="navy" onClick={() => setIsAiAddModalOpen(true)}>
            <Sparkles size={16} />
            Ajouter avec l'IA
          </GlassButton>
          <GlassButton size="sm" variant="navy" onClick={addQuestion}>
            <Plus size={16} />
            Ajouter une Question
          </GlassButton>
        </div>
      </div>

      {isAiAddModalOpen && (
        <AIAddQuizModal
          level={effectiveLevel}
          questions={questions}
          onAddQuestion={addQuestionFromAI}
          onClose={() => setIsAiAddModalOpen(false)}
        />
      )}

      {aiEditQuestionId && (() => {
        const question = questions.find((q) => q.id === aiEditQuestionId);
        if (!question) return null;
        return (
          <AISectionEditModal
            scope="question"
            level={effectiveLevel}
            section={question}
            onApply={(updated) => updateQuestion(question.id, updated)}
            onClose={() => setAiEditQuestionId(null)}
          />
        );
      })()}

      {questions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
          <p className="text-gray-500 mb-2">Aucune question ajoutée</p>
          <GlassButton size="sm" variant="ghost" onClick={addQuestion}>
            Commencer par ajouter une question
          </GlassButton>
        </div>
      ) : (
        <div className="space-y-6" ref={contentRef}>
          {questions.map((question, index) => (
            <div
              key={question.id || `question-${index}`}
              draggable
              onDragStart={() => setDraggedQuestion(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedQuestion !== null) moveQuestion(draggedQuestion, index);
                setDraggedQuestion(null);
              }}
              onDragEnd={() => setDraggedQuestion(null)}
              className={`border border-[rgba(197,161,72,0.25)] rounded-xl bg-white overflow-hidden shadow-sm transition-opacity ${draggedQuestion === index ? "opacity-40" : ""}`}
            >
              <div className="p-4 bg-gray-50 border-b border-[rgba(197,161,72,0.25)] flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-gray-400 mt-2 cursor-grab active:cursor-grabbing" title="Glisser pour réordonner">
                  <GripVertical size={18} />
                  <span className="font-bold">#{index + 1}</span>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      {question.text.includes("<figure") ? (
                        <textarea
                          value={question.text}
                          onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                          rows={2}
                          className="w-full bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-2 text-xs font-mono"
                          aria-label="Énoncé de la question"
                        />
                      ) : (
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) =>
                            updateQuestion(question.id, { text: e.target.value })
                          }
                          className="w-full bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-2 font-medium focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Énoncé de la question..."
                          aria-label="Énoncé de la question"
                        />
                      )}
                      <ContentInsertToolbar
                        content={question.text}
                        onReplace={(next) => updateQuestion(question.id, { text: next })}
                        onInsert={(html) => updateQuestion(question.id, { text: `${question.text || ""}\n${html}\n` })}
                      />
                    </div>

                    <select
                      value={question.type}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          type: e.target.value as any,
                          // Reset options/answers based on type change if needed
                          options:
                            e.target.value === "true_false"
                              ? ["Vrai", "Faux"]
                              : e.target.value === "text_input" || e.target.value === "impossible_search"
                              ? []
                              : question.options?.length
                              ? question.options
                              : ["Option 1", "Option 2"],
                          correctAnswer:
                            e.target.value === "multiple_choice" ? [] : "",
                        })
                      }
                      className="w-40 border-[rgba(197,161,72,0.25)] rounded-lg text-sm bg-white"
                      aria-label="Type de question"
                    >
                      <option value="single_choice">Choix Unique</option>
                      <option value="multiple_choice">Choix Multiple</option>
                      <option value="true_false">Vrai / Faux</option>
                      <option value="text_input">Réponse Libre</option>
                      <option value="impossible_search">Recherche impossible</option>
                    </select>

                    <div className="flex items-center gap-2 bg-white px-3 border border-[rgba(197,161,72,0.25)] rounded-lg">
                      <span className="text-xs uppercase text-gray-500 font-bold">
                        Pts
                      </span>
                      <input
                        type="number"
                        value={question.points}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            points: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-12 border-none p-0 text-center font-medium focus:ring-0"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Options Editor */}
                  {question.type !== "text_input" && question.type !== "impossible_search" && (
                    <div className="space-y-2 pl-2">
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              toggleCorrectAnswer(question.id, option)
                            }
                            className={`p-1 rounded-full transition-colors ${
                              (
                                Array.isArray(question.correctAnswer)
                                  ? question.correctAnswer.includes(option)
                                  : question.correctAnswer === option
                              )
                                ? "text-green-500 bg-green-50"
                                : "text-gray-300 hover:text-gray-400"
                            }`}
                            title="Marquer comme bonne réponse"
                          >
                            {question.type === "multiple_choice" ? (
                              <CheckCircle2 size={20} />
                            ) : (
                              <Circle size={20} />
                            )}
                          </button>

                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateOption(
                                question.id,
                                optIndex,
                                e.target.value
                              )
                            }
                            readOnly={question.type === "true_false"}
                            className={`flex-1 border-[rgba(197,161,72,0.25)] rounded-lg py-1.5 px-3 text-sm ${
                              question.type === "true_false"
                                ? "bg-gray-50 text-gray-500 cursor-not-allowed"
                                : ""
                            }`}
                          />

                          {question.type !== "true_false" && (
                            <GlassIconButton
                              icon={Trash2}
                              onClick={() => removeOption(question.id, optIndex)}
                              color="red"
                              size="sm"
                              aria-label="Supprimer l'option"
                            />
                          )}
                        </div>
                      ))}

                      {question.type !== "true_false" && (
                        <div className="pl-9">
                          <GlassButton size="sm" variant="ghost" onClick={() => addOption(question.id)}>
                            <Plus size={14} /> Ajouter une option
                          </GlassButton>
                        </div>
                      )}
                    </div>
                  )}

                  {question.type === "text_input" && (
                    <div className="pl-2">
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-medium text-sm">
                          Réponse attendue :
                        </span>
                        <input
                          type="text"
                          value={question.correctAnswer as string}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              correctAnswer: e.target.value,
                            })
                          }
                          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg py-1.5 px-3 text-sm"
                          placeholder="Saisissez la réponse exacte attendue..."
                        />
                      </div>
                    </div>
                  )}

                  {question.type === "impossible_search" && (
                    <div className="pl-2 space-y-1">
                      <p className="text-xs text-gray-400">
                        L&apos;énoncé n&apos;a pas de solution (données insuffisantes/contradictoires) : 
                        l&apos;élève doit le justifier, corrigé par IA.
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-medium text-sm">
                          Justification attendue :
                        </span>
                        <input
                          type="text"
                          value={(question.correctAnswer as string) || ""}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              correctAnswer: e.target.value,
                            })
                          }
                          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg py-1.5 px-3 text-sm"
                          placeholder="Ex : Impossible, la somme des angles d'un triangle ne peut pas dépasser 180°..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Explanation / Hint */}
                  <div className="pt-2 border-t border-[rgba(197,161,72,0.25)] mt-2">
                    <div className="flex items-start gap-3">
                      <Lightbulb size={18} className="text-yellow-500 mt-2" />
                      <div className="flex-1 space-y-2">
                        <ContentInsertToolbar
                          content={question.explanation || ""}
                          onReplace={(next) => updateQuestion(question.id, { explanation: next })}
                          onInsert={(html) =>
                            updateQuestion(question.id, {
                              explanation: `${question.explanation || ""}\n${html}\n`,
                            })
                          }
                        />
                        <textarea
                          value={question.explanation || ""}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              explanation: e.target.value,
                            })
                          }
                          className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm min-h-[60px]"
                          placeholder="Explication / Solution détaillée (affichée après la réponse)..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setAiEditQuestionId(question.id)}
                    className="!px-2.5"
                  >
                    <Sparkles size={14} />
                    <span className="hidden sm:inline">IA</span>
                  </GlassButton>
                  <GlassIconButton
                    icon={Trash2}
                    onClick={() => removeQuestion(question.id)}
                    color="red"
                    size="sm"
                    aria-label="Supprimer la question"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
