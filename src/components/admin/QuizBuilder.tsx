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

import AIEditModal from "./AIEditModal";
import ContentInsertToolbar from "./ContentInsertToolbar";

export interface Question {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "text_input";
  points: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
}

interface QuizBuilderProps {
  initialQuestions: Question[];
  onChange: (questions: Question[]) => void;
  onMetadataChange?: (metadata: any) => void;
}

export default function QuizBuilder({
  initialQuestions,
  onChange,
  onMetadataChange,
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
  const [isAiEditModalOpen, setIsAiEditModalOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("cm1");
  const contentRef = useRef<HTMLDivElement>(null);

  // Load KaTeX for Math rendering
  useEffect(() => {
    // Inject KaTeX CSS
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    link.rel = "stylesheet";
    link.integrity =
      "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    // Inject KaTeX JS
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.integrity =
      "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8";
    script.crossOrigin = "anonymous";
    script.defer = true;
    document.head.appendChild(script);

    // Inject Auto-render extension
    const autoRenderScript = document.createElement("script");
    autoRenderScript.src =
      "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
    autoRenderScript.integrity =
      "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05";
    autoRenderScript.crossOrigin = "anonymous";
    autoRenderScript.defer = true;

    autoRenderScript.onload = () => {
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
    };
    document.head.appendChild(autoRenderScript);

    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.head.contains(script)) document.head.removeChild(script);
      if (document.head.contains(autoRenderScript))
        document.head.removeChild(autoRenderScript);
    };
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
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-2 bg-white border border-[rgba(197,161,72,0.25)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="cp">CP</option>
            <option value="ce1">CE1</option>
            <option value="ce2">CE2</option>
            <option value="cm1">CM1</option>
            <option value="cm2">CM2</option>
            <option value="6eme">6ème</option>
            <option value="5eme">5ème</option>
            <option value="4eme">4ème</option>
            <option value="3eme">3ème</option>
            <option value="2nde">2nde</option>
            <option value="1ere">1ère</option>
            <option value="terminale">Terminale</option>
          </select>
          <button
            type="button"
            onClick={() => setIsAiEditModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
          >
            <Sparkles size={16} />
            Modifier avec l'IA
          </button>
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Ajouter une Question
          </button>
        </div>
      </div>

      {isAiEditModalOpen && (
        <AIEditModal
          type="quiz"
          level={selectedLevel}
          content={questions}
          onApply={(updated) => setQuestions(updated)}
          onClose={() => setIsAiEditModalOpen(false)}
        />
      )}

      {questions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
          <p className="text-gray-500 mb-2">Aucune question ajoutée</p>
          <button
            type="button"
            onClick={addQuestion}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Commencer par ajouter une question
          </button>
        </div>
      ) : (
        <div className="space-y-6" ref={contentRef}>
          {questions.map((question, index) => (
            <div
              key={question.id}
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
                    <input
                      type="text"
                      value={question.text}
                      onChange={(e) =>
                        updateQuestion(question.id, { text: e.target.value })
                      }
                      className="flex-1 bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-2 font-medium focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Énoncé de la question..."
                    />

                    <select
                      value={question.type}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          type: e.target.value as any,
                          // Reset options/answers based on type change if needed
                          options:
                            e.target.value === "true_false"
                              ? ["Vrai", "Faux"]
                              : e.target.value === "text_input"
                              ? []
                              : question.options?.length
                              ? question.options
                              : ["Option 1", "Option 2"],
                          correctAnswer:
                            e.target.value === "multiple_choice" ? [] : "",
                        })
                      }
                      className="w-40 border-[rgba(197,161,72,0.25)] rounded-lg text-sm bg-white"
                    >
                      <option value="single_choice">Choix Unique</option>
                      <option value="multiple_choice">Choix Multiple</option>
                      <option value="true_false">Vrai / Faux</option>
                      <option value="text_input">Réponse Libre</option>
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
                  {question.type !== "text_input" && (
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
                            <button
                              type="button"
                              onClick={() =>
                                removeOption(question.id, optIndex)
                              }
                              className="text-gray-300 hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}

                      {question.type !== "true_false" && (
                        <button
                          type="button"
                          onClick={() => addOption(question.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium pl-9 flex items-center gap-1"
                        >
                          <Plus size={14} /> Ajouter une option
                        </button>
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

                  {/* Explanation / Hint */}
                  <div className="pt-2 border-t border-[rgba(197,161,72,0.25)] mt-2">
                    <div className="flex items-start gap-3">
                      <Lightbulb size={18} className="text-yellow-500 mt-2" />
                      <div className="flex-1 space-y-2">
                        <ContentInsertToolbar
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

                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
