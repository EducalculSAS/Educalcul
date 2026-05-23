"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Video, 
  Link as LinkIcon,
  Image as ImageIcon
} from "lucide-react";

export interface Lesson {
  id: string;
  title: string;
  type: "text" | "video" | "pdf" | "quiz";
  content: string; // HTML/Markdown or URL
  duration?: number; // minutes
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseBuilderProps {
  initialContent: Chapter[];
  onChange: (content: Chapter[]) => void;
}

export default function CourseBuilder({ initialContent, onChange }: CourseBuilderProps) {
  const [chapters, setChapters] = useState<Chapter[]>(initialContent || []);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

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

  const removeChapter = (id: string) => {
    if (confirm("Supprimer ce chapitre et tout son contenu ?")) {
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

  const removeLesson = (chapterId: string, lessonId: string) => {
    if (confirm("Supprimer cette leçon ?")) {
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
        <button
          type="button"
          onClick={addChapter}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Ajouter un Chapitre
        </button>
      </div>

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
            <div key={chapter.id} className="border border-[rgba(197,161,72,0.25)] rounded-xl bg-white overflow-hidden shadow-sm">
              {/* Chapter Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
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
                    <div key={lesson.id} className="flex gap-4 p-4 border border-[rgba(197,161,72,0.25)] rounded-lg hover:border-blue-100 transition-colors group">
                      <div className="mt-2 text-gray-300">
                        <GripVertical size={20} />
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) => updateLesson(chapter.id, lesson.id, { title: e.target.value })}
                              className="w-full font-semibold text-gray-800 focus:outline-none focus:border-b border-[rgba(197,161,72,0.25)] pb-1 mb-2"
                              placeholder="Titre de la leçon"
                            />
                            
                            <div className="flex gap-4">
                              <select
                                value={lesson.type}
                                onChange={(e) => updateLesson(chapter.id, lesson.id, { type: e.target.value as any })}
                                className="text-sm border-[rgba(197,161,72,0.25)] rounded-lg text-gray-600 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="text">Texte / Article</option>
                                <option value="video">Vidéo</option>
                                <option value="pdf">Document PDF</option>
                                <option value="quiz">Quiz</option>
                              </select>
                              
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="text-xs uppercase">Durée (min)</span>
                                <input
                                  type="number"
                                  value={lesson.duration || 0}
                                  onChange={(e) => updateLesson(chapter.id, lesson.id, { duration: parseInt(e.target.value) })}
                                  className="w-16 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeLesson(chapter.id, lesson.id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Content Editor based on Type */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          {lesson.type === "text" && (
                            <textarea
                              value={lesson.content}
                              onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                              className="w-full min-h-[100px] p-3 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="Contenu du cours (Markdown supporté)..."
                            />
                          )}
                          
                          {lesson.type === "video" && (
                            <div className="flex items-center gap-3">
                              <Video size={20} className="text-gray-400" />
                              <input
                                type="url"
                                value={lesson.content}
                                onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                                className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="URL de la vidéo (Youtube, Vimeo...)"
                              />
                            </div>
                          )}

                          {lesson.type === "pdf" && (
                            <div className="flex items-center gap-3">
                              <FileText size={20} className="text-gray-400" />
                              <input
                                type="url"
                                value={lesson.content}
                                onChange={(e) => updateLesson(chapter.id, lesson.id, { content: e.target.value })}
                                className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="URL du fichier PDF..."
                              />
                            </div>
                          )}
                        </div>
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
