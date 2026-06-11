"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDragAutoScroll } from "@/lib/useDragAutoScroll";
import AIEditModal from "./AIEditModal";
import LessonContentEditor from "./LessonContentEditor";
import SingleBlockEditor from "./SingleBlockEditor";
import { deriveLegacyFields } from "@/lib/lessonBlocks";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Video,
  Link as LinkIcon,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

export interface Exercise {
  id: string;
  question: string;
  type: "short_answer";
  answer: string;
  hint?: string;
  explanation?: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: "text" | "video" | "video_file" | "pdf" | "table" | "graph" | "image" | "exercise" | "quiz";
  content: string; // HTML/Markdown or URL
  image_url?: string; // optional illustration for text lessons
  duration?: number; // minutes
  exercises?: Exercise[];
  blocks?: import("@/lib/lessonBlocks").LessonBlock[]; // ordered content blocks (text lessons)
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseBuilderProps {
  initialContent: Chapter[];
  onChange: (content: Chapter[]) => void;
  level?: string;
}

export default function CourseBuilder({ initialContent, onChange, level }: CourseBuilderProps) {
  const confirm = useConfirm();
  const [chapters, setChapters] = useState<Chapter[]>(initialContent || []);
  const [isAiEditModalOpen, setIsAiEditModalOpen] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [uploadingLesson, setUploadingLesson] = useState<string | null>(null);
  const [draggedChapter, setDraggedChapter] = useState<number | null>(null);
  useDragAutoScroll(draggedChapter !== null);

  const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
    const copy = [...arr];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
  };

  const moveChapter = (from: number, to: number) => {
    if (from === to || to < 0 || to >= chapters.length) return;
    setChapters(reorder(chapters, from, to));
  };

  const moveLesson = (chapterId: string, from: number, to: number) => {
    setChapters(chapters.map(c => {
      if (c.id !== chapterId) return c;
      if (from === to || to < 0 || to >= c.lessons.length) return c;
      return { ...c, lessons: reorder(c.lessons, from, to) };
    }));
  };

  const handleLessonFileUpload = async (
    chapterId: string,
    lessonId: string,
    e: React.ChangeEvent<HTMLInputElement>,
    folder: string,
    field: "content" | "image_url" = "content"
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingLesson(lessonId);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      updateLesson(chapterId, lessonId, { [field]: result.url });
    } catch (err: any) {
      alert("Erreur upload: " + err.message);
    } finally {
      setUploadingLesson(null);
    }
  };

  const handleBlockImageUpload = async (
    chapterId: string,
    lessonId: string,
    blockId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingLesson(blockId);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "uploads/course_images");
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      const lesson = chapters.find((c) => c.id === chapterId)?.lessons.find((l) => l.id === lessonId);
      const newBlocks = (lesson?.blocks || []).map((b) =>
        b.id === blockId ? { ...b, image_url: result.url } : b
      );
      updateLesson(chapterId, lessonId, {
        blocks: newBlocks,
        ...deriveLegacyFields(newBlocks),
      });
    } catch (err: any) {
      alert("Erreur upload: " + err.message);
    } finally {
      setUploadingLesson(null);
    }
  };

  // Update parent when local state changes
  useEffect(() => {
    onChange(chapters);
  }, [chapters]);

  const addChapter = () => {
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: "Nouveau Chapitre",
      lessons: [],
    };
    setChapters([...chapters, newChapter]);
    setExpandedChapters(new Set([...expandedChapters, newChapter.id]));
  };

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    setChapters(chapters.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeChapter = async (id: string) => {
    if (await confirm("Supprimer ce chapitre et tout son contenu ?")) {
      setChapters(chapters.filter(c => c.id !== id));
    }
  };

  const toggleChapter = (id: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChapters(newExpanded);
  };

  const addLesson = (chapterId: string) => {
    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      title: "Nouvelle Leçon",
      type: "text",
      content: "",
      duration: 5,
    };
    setChapters(chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, lessons: [...c.lessons, newLesson] };
      }
      return c;
    }));
  };

  const updateLesson = (chapterId: string, lessonId: string, updates: Partial<Lesson>) => {
    setChapters(chapters.map(c => {
      if (c.id === chapterId) {
        return {
          ...c,
          lessons: c.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l)
        };
      }
      return c;
    }));
  };

  const addExercise = (chapterId: string, lessonId: string) => {
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      question: "",
      type: "short_answer",
      answer: "",
      hint: "",
    };
    setChapters(chapters.map(c => {
      if (c.id !== chapterId) return c;
      return {
        ...c,
        lessons: c.lessons.map(l => l.id === lessonId
          ? { ...l, exercises: [...(l.exercises || []), newExercise] }
          : l)
      };
    }));
  };

  const updateExercise = (chapterId: string, lessonId: string, exerciseId: string, updates: Partial<Exercise>) => {
    setChapters(chapters.map(c => {
      if (c.id !== chapterId) return c;
      return {
        ...c,
        lessons: c.lessons.map(l => l.id === lessonId
          ? { ...l, exercises: (l.exercises || []).map(ex => ex.id === exerciseId ? { ...ex, ...updates } : ex) }
          : l)
      };
    }));
  };

  const removeExercise = async (chapterId: string, lessonId: string, exerciseId: string) => {
    if (await confirm("Supprimer ce mini-exercice ?")) {
      setChapters(chapters.map(c => {
        if (c.id !== chapterId) return c;
        return {
          ...c,
          lessons: c.lessons.map(l => l.id === lessonId
            ? { ...l, exercises: (l.exercises || []).filter(ex => ex.id !== exerciseId) }
            : l)
        };
      }));
    }
  };

  const removeLesson = async (chapterId: string, lessonId: string) => {
    if (await confirm("Supprimer cette leçon ?")) {
      setChapters(chapters.map(c => {
        if (c.id === chapterId) {
          return { ...c, lessons: c.lessons.filter(l => l.id !== lessonId) };
        }
        return c;
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">Contenu du Cours</h3>
        <div className="flex items-center gap-2">
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
            onClick={addChapter}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Ajouter un Chapitre
          </button>
        </div>
      </div>

      {isAiEditModalOpen && (
        <AIEditModal
          type="course"
          level={level}
          content={chapters}
          onApply={(updated) => setChapters(updated)}
          onClose={() => setIsAiEditModalOpen(false)}
        />
      )}

      {chapters.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
          <p className="text-gray-500 mb-2">Le cours est vide</p>
          <button
            type="button"
            onClick={addChapter}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Commencer par ajouter un chapitre
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              draggable
              onDragStart={() => setDraggedChapter(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedChapter !== null) moveChapter(draggedChapter, index);
                setDraggedChapter(null);
              }}
              onDragEnd={() => setDraggedChapter(null)}
              className={`border border-[rgba(197,161,72,0.25)] rounded-xl bg-white overflow-hidden shadow-sm transition-opacity ${draggedChapter === index ? "opacity-40" : ""}`}
            >
              {/* Chapter Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
                <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" title="Glisser pour réordonner">
                  <GripVertical size={20} />
                </div>
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {expandedChapters.has(chapter.id) ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Chapitre {index + 1}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={chapter.title}
                    onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                    className="w-full bg-transparent font-bold text-gray-800 focus:outline-none focus:ring-0 border-none p-0 text-lg placeholder-gray-400"
                    placeholder="Titre du chapitre"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeChapter(chapter.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Lessons List */}
              {expandedChapters.has(chapter.id) && (
                <div className="p-4 space-y-4 bg-white">
                  {chapter.lessons.map((lesson, lIndex) => (
                    <div
                      key={lesson.id}
                      className="flex flex-col sm:flex-row gap-3 p-4 border border-[rgba(197,161,72,0.25)] rounded-lg hover:border-blue-100 transition-colors group"
                    >
                      <div className="hidden sm:flex flex-col mt-2 text-gray-300 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveLesson(chapter.id, lIndex, lIndex - 1)}
                          disabled={lIndex === 0}
                          className="hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Monter"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLesson(chapter.id, lIndex, lIndex + 1)}
                          disabled={lIndex === chapter.lessons.length - 1}
                          className="hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Descendre"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) => updateLesson(chapter.id, lesson.id, { title: e.target.value })}
                              className="w-full font-semibold text-gray-800 focus:outline-none focus:border-b border-[rgba(197,161,72,0.25)] pb-1 mb-2"
                              placeholder="Titre de la leçon"
                            />

                            <div className="flex flex-wrap gap-3">
                              <select
                                value={lesson.type}
                                onChange={(e) => updateLesson(chapter.id, lesson.id, { type: e.target.value as any })}
                                className="text-sm border border-[rgba(197,161,72,0.25)] rounded-lg text-gray-600 focus:ring-blue-500 focus:border-blue-500 px-2 py-1.5"
                              >
                                <option value="text">Texte / Article</option>
                                <option value="video">Vidéo (lien)</option>
                                <option value="video_file">Vidéo (fichier mp4)</option>
                                <option value="pdf">Document PDF</option>
                                <option value="table">Tableau</option>
                                <option value="graph">Graphique</option>
                                <option value="image">Image</option>
                                <option value="exercise">Mini-exercices</option>
                                <option value="quiz">Quiz</option>
                              </select>

                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="text-xs uppercase whitespace-nowrap">Durée (min)</span>
                                <input
                                  type="number"
                                  value={lesson.duration || 0}
                                  onChange={(e) => updateLesson(chapter.id, lesson.id, { duration: parseInt(e.target.value) })}
                                  className="w-16 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-2 py-1.5"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLesson(chapter.id, lesson.id)}
                            className="text-gray-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Content Editor based on Type */}
                        <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                          {lesson.type === "text" && (
                            <LessonContentEditor
                              lesson={lesson}
                              onUpdate={(updates) => updateLesson(chapter.id, lesson.id, updates)}
                              uploadingLesson={uploadingLesson}
                              onImageUpload={(e, blockId) => handleBlockImageUpload(chapter.id, lesson.id, blockId, e)}
                            />
                          )}

                          {lesson.type === "video" && (
                            <div className="flex items-center gap-3">
                              <Video size={20} className="text-gray-400 flex-shrink-0" />
                              <input
                                type="url"
                                value={lesson.content}
                                onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                                className="flex-1 min-w-0 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
                                placeholder="URL de la vidéo (Youtube, Vimeo...)"
                              />
                            </div>
                          )}

                          {lesson.type === "video_file" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <Video size={20} className="text-gray-400 flex-shrink-0" />
                                <input
                                  type="url"
                                  value={lesson.content}
                                  onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                                  className="flex-1 min-w-0 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
                                  placeholder="URL du fichier vidéo (.mp4)..."
                                />
                              </div>
                              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-[rgba(197,161,72,0.4)] rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                                <Upload size={14} />
                                {uploadingLesson === lesson.id ? "Upload..." : "Téléverser une vidéo mp4"}
                                <input
                                  type="file"
                                  accept="video/mp4,video/*"
                                  className="hidden"
                                  disabled={uploadingLesson === lesson.id}
                                  onChange={(e) => handleLessonFileUpload(chapter.id, lesson.id, e, "uploads/lesson_videos")}
                                />
                              </label>
                              {lesson.content && (
                                <video src={lesson.content} controls className="w-full max-w-md rounded-lg border border-[rgba(197,161,72,0.25)]" />
                              )}
                            </div>
                          )}

                          {lesson.type === "pdf" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <FileText size={20} className="text-gray-400 flex-shrink-0" />
                                <input
                                  type="url"
                                  value={lesson.content}
                                  onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                                  className="flex-1 min-w-0 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
                                  placeholder="URL du fichier PDF..."
                                />
                              </div>
                              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-[rgba(197,161,72,0.4)] rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                                <Upload size={14} />
                                {uploadingLesson === lesson.id ? "Upload..." : "Téléverser un PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  disabled={uploadingLesson === lesson.id}
                                  onChange={(e) => handleLessonFileUpload(chapter.id, lesson.id, e, "uploads/lesson_pdfs")}
                                />
                              </label>
                            </div>
                          )}

                          {(lesson.type === "table" || lesson.type === "graph") && (
                            <SingleBlockEditor
                              type={lesson.type}
                              content={lesson.content}
                              onChange={(html) => updateLesson(chapter.id, lesson.id, { content: html })}
                            />
                          )}

                          {lesson.type === "image" && (
                            <div>
                              {lesson.image_url ? (
                                <div className="relative w-full max-w-xs">
                                  <img
                                    src={lesson.image_url}
                                    alt="Illustration"
                                    className="w-full h-32 object-cover rounded-lg border border-[rgba(197,161,72,0.25)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateLesson(chapter.id, lesson.id, { image_url: "" })}
                                    className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </div>
                              ) : (
                                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-[rgba(197,161,72,0.4)] rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                                  <Upload size={14} />
                                  {uploadingLesson === lesson.id ? "Upload..." : "Ajouter une image"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingLesson === lesson.id}
                                    onChange={(e) => handleLessonFileUpload(chapter.id, lesson.id, e, "uploads/course_images", "image_url")}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Mini-exercises / Quiz questions for this lesson */}
                        {(lesson.type === "exercise" || lesson.type === "quiz") && (
                        <div className="bg-amber-50/50 border border-[rgba(197,161,72,0.25)] p-3 rounded-lg space-y-3">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {lesson.type === "quiz" ? "Questions du quiz" : "Mini-exercices"} ({(lesson.exercises || []).length})
                          </span>
                          {(lesson.exercises || []).map((ex, exIndex) => (
                            <div key={ex.id} className="bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-bold text-gray-400 mt-2">#{exIndex + 1}</span>
                                <textarea
                                  value={ex.question}
                                  onChange={(e) => updateExercise(chapter.id, lesson.id, ex.id, { question: e.target.value })}
                                  className="flex-1 min-h-[50px] p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm resize-y"
                                  placeholder="Énoncé de la question..."
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExercise(chapter.id, lesson.id, ex.id)}
                                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={ex.answer}
                                onChange={(e) => updateExercise(chapter.id, lesson.id, ex.id, { answer: e.target.value })}
                                className="w-full p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="Réponse attendue (utilisée pour la correction par l'IA)"
                              />
                              <input
                                type="text"
                                value={ex.hint || ""}
                                onChange={(e) => updateExercise(chapter.id, lesson.id, ex.id, { hint: e.target.value })}
                                className="w-full p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="Indice (optionnel)"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addExercise(chapter.id, lesson.id)}
                            className="w-full py-1.5 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-lg text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-colors text-xs font-medium flex items-center justify-center gap-2"
                          >
                            <Plus size={14} />
                            Ajouter un mini-exercice
                          </button>
                        </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addLesson(chapter.id)}
                    className="w-full py-2 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-lg text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Ajouter une leçon
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
