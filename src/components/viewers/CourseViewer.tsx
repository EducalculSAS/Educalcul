"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  CheckCircle,
  Circle,
  ChevronRight,
  Menu,
  X,
  FileText,
  Video,
  HelpCircle,
  ChevronLeft,
  Sparkles,
  Lightbulb,
  XCircle as XCircleIcon,
  Eye,
  PencilLine,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Chapter, Lesson, Exercise } from "@/components/admin/CourseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";

// Helper to extract YouTube ID
const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

interface CourseViewerProps {
  course: {
    title: string;
    description?: string;
    content_json: Chapter[] | null;
  };
  onComplete?: () => void;
  onChapterComplete?: (chapterIndex: number) => void;
  onBack?: () => void;
}

export default function CourseViewer({ course, onComplete, onChapterComplete, onBack }: CourseViewerProps) {
  const { setPageContext, pageContext } = useAITutor();
  
  const chapters = course.content_json || [];
  const courseId = (course as any).id;
  const isPreviewCourse = !courseId || courseId === "preview";

  const [currentChapterIndex, setCurrentChapterIndex] = useState(() => {
    if (typeof window === "undefined" || isPreviewCourse) return 0;
    return parseInt(localStorage.getItem(`cv-${courseId}-ch`) || "0");
  });
  const [currentLessonIndex, setCurrentLessonIndex] = useState(() => {
    if (typeof window === "undefined" || isPreviewCourse) return 0;
    return parseInt(localStorage.getItem(`cv-${courseId}-ls`) || "0");
  });
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || isPreviewCourse) return new Set();
    try {
      const raw = localStorage.getItem(`cv-${courseId}-done`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef("");
  const rangeRef = useRef<Range | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Accumulated time from previous sessions + current
  const getAccumulatedSeconds = () => {
    if (isPreviewCourse) return 0;
    return parseInt(localStorage.getItem(`cv-${courseId}-time`) || "0");
  };
  const saveTimeSpent = () => {
    if (isPreviewCourse) return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    localStorage.setItem(`cv-${courseId}-time`, String(total));
    sessionStartRef.current = Date.now(); // reset so we don't double-count
    return total;
  };

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  }, []);

  const currentChapter = chapters[currentChapterIndex];
  const currentLesson = currentChapter?.lessons[currentLessonIndex];

  const [isRendering, setIsRendering] = useState(false);

  // Initialize AI context with course content
  useEffect(() => {
    if (chapters.length === 0) return;

    const currentChapter = chapters[currentChapterIndex];
    const currentLesson = currentChapter?.lessons[currentLessonIndex];
    
    if (!currentLesson) return;

    // Extract ONLY the current lesson content (not the whole course)
    // This keeps the context focused and prevents confusion
    let lessonContent = `${currentLesson.title}`;
    
    if (currentLesson.type === "text" && currentLesson.content) {
      // Limit content to first 2000 chars to keep it focused
      lessonContent += `\n\n${currentLesson.content.slice(0, 2000)}`;
      if (currentLesson.content.length > 2000) {
        lessonContent += "\n\n[Contenu tronqué pour concision]";
      }
    } else if (currentLesson.type === "video" && (currentLesson as any).videoUrl) {
      lessonContent += `\n\n[Vidéo]: ${(currentLesson as any).videoUrl}`;
    }

    // Set the AI context with ONLY current lesson (not full course)
    setPageContext({
      page: "cours_detail",
      courseTitle: course.title,
      courseSubject: (course as any).subject || "Maths",
      courseLevel: (course as any).level || "Collège",
      courseContent: lessonContent, // CURRENT LESSON ONLY, not full course
    });

    console.log("📚 AI Context Updated with Current Lesson:", {
      courseTitle: course.title,
      lessonTitle: currentLesson.title,
      contentLength: lessonContent.length,
    });
  }, [course.title, currentChapterIndex, currentLessonIndex, setPageContext, chapters]);

  // KaTeX pré-rendu via renderLatexInHTML — pas besoin de useLayoutEffect

  // Remove existing highlights
  const clearHighlights = () => {
    if (!contentRef.current) return;
    contentRef.current.querySelectorAll("mark.athena-highlight").forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
    });
  };

  // Detect text selection — apply persistent <mark> highlight
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || !contentRef.current) return;

      const text = selection.toString().trim();
      if (text.length <= 5) return;

      // Check selection is inside course content
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      rangeRef.current = range.cloneRange();
      selectedTextRef.current = text;
      // Show popup imperatively — NO state update = NO re-render = selection preserved
      if (popupRef.current) {
        popupRef.current.style.display = "flex";
        popupRef.current.style.left = `${rect.left + rect.width / 2}px`;
        popupRef.current.style.top = `${rect.top - 10}px`;
      }
    };

    const handleDeselect = () => {
      const sel = window.getSelection();
      if (!sel || sel.toString().trim().length === 0) {
        if (popupRef.current) popupRef.current.style.display = "none";
        selectedTextRef.current = "";
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    document.addEventListener("selectionchange", handleDeselect);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
      document.removeEventListener("selectionchange", handleDeselect);
    };
  }, []);

  // Handle asking AI about selected text
  const hidePopup = () => {
    if (popupRef.current) popupRef.current.style.display = "none";
    selectedTextRef.current = "";
    setSelectedText(""); // keep state in sync for legacy uses
    window.getSelection()?.removeAllRanges();
  };

  const handleAskAI = () => {
    const text = selectedTextRef.current;
    if (!text) return;
    const message = `Explique-moi ce passage:\n\n"${text}"`;
    (window as any).__pendingAIQuestion = { message, timestamp: Date.now() };
    hidePopup();
  };

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', chapterIndex: number, extraCompletedLessons?: Set<string>) => {
    if (isPreviewCourse) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const timeSpent = saveTimeSpent() ?? getAccumulatedSeconds();
    const done = extraCompletedLessons ?? completedLessons;
    const totalLessonsCount = chapters.reduce((a, c) => a + c.lessons.length, 0);
    try {
      await fetch("/api/child/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "course",
          userId: session.user.id,
          itemId: courseId,
          chapterIndex,
          status,
          timeSpent,
          lessonsCompleted: [...done],
          lessonCount: totalLessonsCount,
          lastLessonId: currentLesson?.id ?? null,
          lastChapterIndex: currentChapterIndex,
          lastLessonIndex: currentLessonIndex,
        })
      });
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  };

  // Persist navigation state
  useEffect(() => {
    if (isPreviewCourse) return;
    localStorage.setItem(`cv-${courseId}-ch`, String(currentChapterIndex));
    localStorage.setItem(`cv-${courseId}-ls`, String(currentLessonIndex));
  }, [currentChapterIndex, currentLessonIndex]);

  useEffect(() => {
    if (isPreviewCourse) return;
    localStorage.setItem(`cv-${courseId}-done`, JSON.stringify([...completedLessons]));
  }, [completedLessons]);

  // Track initial start
  useEffect(() => {
    saveProgress('in_progress', 0);
  }, []);

  // Track chapter changes
  useEffect(() => {
    saveProgress('in_progress', currentChapterIndex);
  }, [currentChapterIndex]);


  // Hide popup when lesson changes
  useEffect(() => {
    if (popupRef.current) popupRef.current.style.display = "none";
    selectedTextRef.current = "";
    setSelectedText("");
  }, [currentChapterIndex, currentLessonIndex]);

  // Scroll back to top when changing lesson/chapter
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentChapterIndex, currentLessonIndex]);

  const handleNext = () => {
    if (!currentChapter) return;

    // Mark current as complete
    if (currentLesson) {
      const newCompleted = new Set(completedLessons);
      newCompleted.add(currentLesson.id);
      setCompletedLessons(newCompleted);
    }

    // Move to next lesson
    if (currentLessonIndex < currentChapter.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      if (onChapterComplete) onChapterComplete(currentChapterIndex);
      setCurrentChapterIndex(currentChapterIndex + 1);
      setCurrentLessonIndex(0);
    } else {
      if (onChapterComplete) onChapterComplete(currentChapterIndex);
      const finalCompleted = new Set(completedLessons);
      if (currentLesson) finalCompleted.add(currentLesson.id);
      saveProgress('completed', currentChapterIndex, finalCompleted);
      // Mark completed in localStorage so course list can read it
      if (!isPreviewCourse) localStorage.setItem(`cv-${courseId}-status`, 'completed');
      setCourseCompleted(true);
      if (onComplete) onComplete();
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    } else if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      setCurrentLessonIndex(chapters[currentChapterIndex - 1].lessons.length - 1);
    }
  };

  const selectLesson = (cIndex: number, lIndex: number) => {
    setCurrentChapterIndex(cIndex);
    setCurrentLessonIndex(lIndex);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  if (!chapters.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-8">
        <FileText className="w-12 h-12 mb-4 text-[var(--greek-gold)]/50" />
        <p className="text-[var(--greek-blue)]">Ce cours ne contient aucun contenu pour le moment.</p>
      </div>
    );
  }

  if (courseCompleted) {
    const totalLessons = chapters.reduce((acc, c) => acc + c.lessons.length, 0);
    const timeTotal = getAccumulatedSeconds();
    const mins = Math.floor(timeTotal / 60);
    const courseFull = course as any;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header — same as preview */}
            <div className="relative h-64 md:h-80 bg-gray-100">
              {courseFull.thumbnail_url ? (
                <img src={courseFull.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/10">
                  <img src="/logo.png" alt="Educalcul" className="w-24 h-24 object-contain opacity-20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-8 text-white w-full">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                    <CheckCircle className="w-3.5 h-3.5" /> Cours terminé !
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{course.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Left: description + stats */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-[var(--greek-gold)]" />
                    Félicitations !
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Tu as terminé ce cours avec succès. Maintenant que tu maîtrises ces notions, mets tes connaissances à l'épreuve !
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: `${totalLessons}/${totalLessons}`, sub: "leçons complétées" },
                      { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                      { value: "100%", sub: "progression" },
                    ].map(s => (
                      <div key={s.sub} className="bg-[var(--greek-cream)] rounded-xl p-4 text-center border border-[rgba(197,161,72,0.25)]">
                        <p className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: CTA card — same layout as preview sidebar */}
                <div className="w-full md:w-80 flex-shrink-0">
                  <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                    <Link
                      href="/child/exercises"
                      className="w-full btn-primary-greek py-4 text-base shadow-lg flex items-center justify-center transform hover:scale-105 transition-all"
                    >
                      Faire les exercices
                    </Link>
                    <Link
                      href="/child/quiz"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-blue)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Tenter le quiz
                    </Link>
                    <Link
                      href="/child/cours"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-bronze)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Retour aux cours
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalLessons = chapters.reduce((acc, c) => acc + c.lessons.length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.size / totalLessons) * 100) : 0;
  const r = 17;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (progressPct / 100) * circ;

  return (
    <div className="flex h-full bg-white overflow-hidden border border-[var(--greek-gold)] relative">
      {/* Sidebar - Chapter Navigation */}
      <div
        className={`absolute inset-y-0 left-0 z-30 bg-[var(--greek-cream)] border-r border-[var(--greek-gold)] flex flex-col transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${sidebarOpen ? "translate-x-0 w-72 md:w-72" : "-translate-x-full md:translate-x-0 w-72 md:w-0 md:overflow-hidden md:border-r-0"}`}
      >
        <div className="p-5 border-b border-[var(--greek-gold)] bg-[var(--greek-cream)] flex justify-between items-center shadow-sm z-10">
          <div>
             <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] truncate max-w-[200px]" title={course.title}>
               {course.title}
             </h3>
             <p className="text-xs text-[var(--greek-bronze)] mt-1">
               {chapters.reduce((acc, c) => acc + c.lessons.length, 0)} leçons • {chapters.length} chapitres
             </p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-[var(--greek-bronze)] hover:bg-[var(--greek-gold)]/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {chapters.map((chapter, cIndex) => (
            <div key={chapter.id} className="space-y-1">
              <div className="px-3 py-2 text-xs font-bold text-[var(--greek-bronze)]/70 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] flex items-center justify-center text-[10px]">{cIndex + 1}</span>
                {chapter.title}
              </div>
              <div className="space-y-1">
                {chapter.lessons.map((lesson, lIndex) => {
                  const isActive = cIndex === currentChapterIndex && lIndex === currentLessonIndex;
                  const isCompleted = completedLessons.has(lesson.id);
                  
                  let Icon = FileText;
                  if (lesson.type === "video") Icon = Video;
                  if (lesson.type === "quiz") Icon = HelpCircle;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => selectLesson(cIndex, lIndex)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 text-sm group ${isActive ? "bg-[var(--greek-blue)] text-white shadow-md shadow-[var(--greek-blue)]/20" : "hover:bg-[var(--greek-cream)] hover:shadow-sm text-gray-600 hover:text-[var(--greek-blue)]"}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-[var(--greek-olive)]"}`} />
                      ) : (
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${isActive ? "border-white" : "border-gray-300 group-hover:border-[var(--greek-gold)]"}`} />
                      )}
                      <span className="truncate flex-1 font-medium">{lesson.title}</span>
                      <Icon className={`w-3 h-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
        {/* Header */}
        <div className="h-14 border-b border-[var(--greek-gold)] flex items-center px-4 gap-2 bg-[var(--greek-cream)] shrink-0 z-10">
          {/* Flèche retour */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-[var(--greek-blue)] flex-shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
              title="Retour à l'aperçu"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {/* Menu burger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-[var(--greek-blue)] flex-shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Titre leçon — scrollable horizontalement sur mobile */}
          <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
            <h2 className="text-base font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] whitespace-nowrap">
              {currentLesson?.title}
            </h2>
          </div>

          {/* Cercle progression SVG */}
          <div className="flex-shrink-0">
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(197,161,72,0.2)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r={r} fill="none"
                stroke="var(--greek-gold)" strokeWidth="3"
                strokeDasharray={circ} strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
              <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--greek-blue)">
                {progressPct}%
              </text>
            </svg>
          </div>
        </div>

        {/* Content Viewer */}
        <div ref={mainScrollRef} className={`flex-1 overflow-y-auto bg-white scroll-smooth transition-opacity duration-300 ${isRendering ? 'opacity-0' : 'opacity-100'}`}>
          <div className="max-w-4xl mx-auto px-6 py-10 md:px-12 md:py-16">
            {currentLesson ? (
              <div className="animate-fade-bounce">
                {/* Content Header */}
                <div className="mb-8 pb-6 border-b border-[rgba(197,161,72,0.25)]">
                  <div className="flex items-center gap-2 text-sm text-[var(--greek-bronze)] font-medium mb-2 uppercase tracking-wide">
                    {currentLesson.type === 'video' ? <Video size={16}/> : <FileText size={16}/>}
                    {currentLesson.type === 'video' ? 'Vidéo' : 'Leçon'}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold font-[family-name:var(--font-display)] text-[var(--greek-blue)] leading-tight">
                    {currentLesson.title}
                  </h1>
                </div>

                {/* Content Body */}
                <div className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:font-[family-name:var(--font-display)] prose-headings:text-[var(--greek-blue)] prose-p:text-gray-600 prose-a:text-[var(--greek-blue)] hover:prose-a:text-[var(--greek-gold)] prose-img:rounded-xl prose-img:shadow-lg">
                   {currentLesson.type === 'video' ? (
                     <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-black border border-[rgba(197,161,72,0.25)]">
                       {getYouTubeId(currentLesson.content) ? (
                         <iframe 
                           className="w-full h-full"
                           src={`https://www.youtube.com/embed/${getYouTubeId(currentLesson.content)}`}
                           title={currentLesson.title}
                           frameBorder="0"
                           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                           allowFullScreen
                         />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-white">
                           <div className="text-center">
                             <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                             <p>Vidéo non disponible ou lien invalide</p>
                             <a href={currentLesson.content} target="_blank" rel="noopener noreferrer" className="text-[var(--greek-blue)] hover:underline mt-2 block text-sm">
                                Ouvrir le lien original
                             </a>
                           </div>
                         </div>
                       )}
                     </div>
                   ) : (
                     <div ref={contentRef} dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentLesson.content || "") }} />
                   )}
                </div>

                {/* Interactive mini-exercises */}
                {currentLesson.exercises && currentLesson.exercises.length > 0 && (
                  <InlineMiniExercises
                    lessonId={currentLesson.id}
                    exercises={currentLesson.exercises}
                    level={(course as any).level}
                  />
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-32">
                <div className="w-20 h-20 bg-[var(--greek-cream)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[rgba(197,161,72,0.25)]">
                  <Play className="w-8 h-8 text-[var(--greek-gold)] ml-1" />
                </div>
                <h3 className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">Prêt à commencer ?</h3>
                <p>Sélectionnez une leçon dans le menu de gauche.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="h-20 border-t border-[var(--greek-gold)] bg-[var(--greek-cream)]/95 backdrop-blur-sm flex items-center justify-between px-6 md:px-12 shrink-0 z-10 sticky bottom-0">
          <button
            onClick={handlePrev}
            disabled={currentChapterIndex === 0 && currentLessonIndex === 0}
            className="group flex items-center gap-2 px-4 py-2 text-[var(--greek-bronze)] font-medium disabled:opacity-30 hover:text-[var(--greek-blue)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:inline">Leçon précédente</span>
          </button>
          
          <button
            onClick={handleNext}
            className="btn-primary-greek flex items-center gap-3 px-6 py-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
          >
            {currentChapterIndex === chapters.length - 1 && currentLessonIndex === (currentChapter?.lessons?.length || 0) - 1 ? (
              <>Terminer le cours <CheckCircle className="w-5 h-5" /></>
            ) : (
              <>
                <span className="hidden md:inline">Leçon suivante</span>
                <span className="md:hidden">Suivant</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Text Selection Popup — controlled imperatively via ref, never hidden by React */}
        <div
          ref={popupRef}
          className="fixed bg-[var(--greek-blue)] text-white rounded-xl shadow-2xl px-4 py-2 z-[100] items-center gap-3 border border-[rgba(197,161,72,0.25)] pointer-events-auto"
          style={{ display: "none", transform: "translate(-50%, -100%)" }}
        >
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleAskAI}
            className="flex items-center gap-2 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold text-sm whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Demander à l'IA
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={hidePopup}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Mini-Exercises ──────────────────────────────────────────────────
interface ExerciseState {
  input: string;
  attempts: number;
  status: "idle" | "correct" | "wrong" | "revealed" | "grading";
  showHint: boolean;
  feedback?: string;
}

interface InlineMiniExercisesProps {
  lessonId: string;
  exercises: Exercise[];
  level?: string;
}

function InlineMiniExercises({ lessonId, exercises, level }: InlineMiniExercisesProps) {
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
      if (result.is_correct) {
        updateState(ex.id, { status: "correct", feedback: result.feedback });
      } else {
        updateState(ex.id, {
          status: "wrong",
          attempts: state.attempts + 1,
          feedback: result.feedback,
        });
      }
    } catch {
      updateState(ex.id, {
        status: "wrong",
        attempts: state.attempts + 1,
        feedback: "Impossible de corriger pour l'instant.",
      });
    }
  };

  const handleRetry = (id: string) => {
    updateState(id, { status: "idle", input: "" });
  };

  const handleReveal = (id: string) => {
    updateState(id, { status: "revealed" });
  };

  const handleToggleHint = (id: string) => {
    const s = states[id];
    updateState(id, { showHint: !s?.showHint });
  };

  return (
    <div ref={containerRef} className="mt-12 pt-8 border-t border-[rgba(197,161,72,0.25)]">
      <h2
        className="text-2xl font-bold mb-6 flex items-center gap-3 font-[family-name:var(--font-display)]"
        style={{ color: "var(--greek-blue)" }}
      >
        <PencilLine className="w-7 h-7" style={{ color: "var(--greek-gold)" }} />
        <span>
          <span style={{ color: "var(--greek-gold)" }}>✏️</span> Mini-exercices
        </span>
      </h2>

      <div className="space-y-4">
        {exercises.map((ex, idx) => {
          const s = states[ex.id] || {
            input: "",
            attempts: 0,
            status: "idle" as const,
            showHint: false,
          };
          const isCorrect = s.status === "correct";
          const isWrong = s.status === "wrong";
          const isRevealed = s.status === "revealed";
          const isGrading = s.status === "grading";
          const showCorrection = s.attempts >= 2 && !isCorrect && !isRevealed;

          return (
            <div
              key={ex.id}
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
                  {idx + 1}
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
                  <button
                    type="button"
                    onClick={() => handleToggleHint(ex.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: "var(--greek-gold)",
                      color: "var(--greek-blue)",
                      background: s.showHint
                        ? "rgba(197,161,72,0.1)"
                        : "transparent",
                    }}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {s.showHint ? "Masquer l'indice" : "Indice 💡"}
                  </button>
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={s.input}
                    disabled={isGrading}
                    onChange={(e) =>
                      updateState(ex.id, { input: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!isGrading) handleVerify(ex);
                      }
                    }}
                    placeholder="Ta réponse..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 focus:border-[var(--greek-blue)] transition-all text-gray-800 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerify(ex)}
                    disabled={!s.input.trim() || isGrading}
                    className="px-5 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ background: "var(--greek-blue)" }}
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Correction...</span>
                      </>
                    ) : (
                      "Vérifier"
                    )}
                  </button>
                </div>
              )}

              {/* Wrong feedback */}
              {isWrong && (
                <div
                  className="mt-3 p-3 rounded-xl flex items-start gap-2"
                  style={{ background: "#fef2f2", color: "#991b1b" }}
                >
                  <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Pas tout à fait…</p>
                    {s.feedback && (
                      <div
                        className="text-xs mt-1.5 opacity-90 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: renderLatexInHTML(s.feedback),
                        }}
                      />
                    )}
                    <p className="text-xs mt-0.5 opacity-80">
                      Tentative {s.attempts} {s.attempts >= 2 ? "— tu peux voir la correction" : "— essaie encore"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleRetry(ex.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                        style={{
                          borderColor: "#fecaca",
                          color: "#991b1b",
                          background: "#fff",
                        }}
                      >
                        Réessayer
                      </button>
                      {showCorrection && (
                        <button
                          type="button"
                          onClick={() => handleReveal(ex.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ background: "var(--greek-blue)" }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Voir la correction
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Correct feedback */}
              {isCorrect && (
                <div
                  className="mt-3 p-4 rounded-xl flex items-start gap-2"
                  style={{
                    background: "rgba(197,161,72,0.1)",
                    color: "var(--greek-blue)",
                    borderLeft: "3px solid var(--greek-gold)",
                  }}
                >
                  <CheckCircle
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    style={{ color: "var(--greek-gold)" }}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-sm">Excellent ! ✨</p>
                    {s.feedback && (
                      <div
                        className="text-sm mt-1.5 opacity-90 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: renderLatexInHTML(s.feedback),
                        }}
                      />
                    )}
                    {ex.explanation && (
                      <div
                        className="text-sm mt-1.5 opacity-90 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: renderLatexInHTML(ex.explanation),
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Revealed correction */}
              {isRevealed && (
                <div
                  className="mt-3 p-4 rounded-xl"
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4" style={{ color: "var(--greek-blue)" }} />
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: "var(--greek-blue)" }}
                    >
                      Correction
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-semibold">Réponse :</span>{" "}
                    <span style={{ color: "var(--greek-blue)" }}>{ex.answer}</span>
                  </p>
                  {ex.explanation && (
                    <div
                      className="text-sm text-gray-600 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: renderLatexInHTML(ex.explanation),
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRetry(ex.id)}
                    className="mt-3 text-xs font-semibold underline"
                    style={{ color: "var(--greek-blue)" }}
                  >
                    Réessayer cet exercice
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
