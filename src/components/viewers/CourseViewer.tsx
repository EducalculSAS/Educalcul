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
  Sparkles
} from "lucide-react";
import { Chapter, Lesson } from "@/components/admin/CourseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";

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
}

export default function CourseViewer({ course, onComplete, onChapterComplete }: CourseViewerProps) {
  const { setPageContext, pageContext } = useAITutor();
  
  const chapters = course.content_json || [];
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);

  const currentChapter = chapters[currentChapterIndex];
  const currentLesson = currentChapter?.lessons[currentLessonIndex];

  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

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
    } else if (currentLesson.type === "video" && currentLesson.videoUrl) {
      lessonContent += `\n\n[Vidéo]: ${currentLesson.videoUrl}`;
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

  // Load KaTeX on mount
  useEffect(() => {
    const loadKatex = () => {
      if (typeof (window as any).renderMathInElement === "function") {
        return; // Already loaded
      }

      // Load CSS
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }

      // Load KaTeX script
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.async = true;
      script.onload = () => {
        // Load auto-render
        const autoRender = document.createElement("script");
        autoRender.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
        autoRender.async = true;
        autoRender.onload = () => {
          console.log("✅ KaTeX loaded");
        };
        document.head.appendChild(autoRender);
      };
      document.head.appendChild(script);
    };

    loadKatex();
  }, []);

  // Render math when content changes
  useEffect(() => {
    if (!contentRef.current) return;

    // Try to render math
    const renderMath = () => {
      if (typeof (window as any).renderMathInElement === "function") {
        try {
          (window as any).renderMathInElement(contentRef.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        } catch (e) {
          // Ignore errors
        }
      }
    };

    // Render immediately
    renderMath();

    // Also retry after 100ms in case KaTeX was just loaded
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [currentChapterIndex, currentLessonIndex]);

  // Detect text selection for AI explanation
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection) return;

      const selectedText = selection.toString().trim();
      
      // Show popup for meaningful selections (> 5 chars)
      if (selectedText.length > 5) {
        try {
          const range = selection.getRangeAt(0);
          rangeRef.current = range.cloneRange(); // Save the range
          const rect = range.getBoundingClientRect();
          
          setSelectedText(selectedText);
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          });
        } catch (e) {
          // Ignore errors getting range
        }
      } else {
        setSelectedText("");
        rangeRef.current = null;
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, []);

  // Re-apply selection after render
  useEffect(() => {
    if (selectedText && rangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(rangeRef.current.cloneRange());
      }
    }
  }, [selectedText]);

  // Handle asking AI about selected text
  const handleAskAI = () => {
    if (!selectedText) {
      console.log("❌ No selected text to send to AI");
      return;
    }

    console.log("✨ User clicked 'Ask AI' button with text:", selectedText.slice(0, 50));

    // Create message for AI
    const message = `Explique-moi ce passage:\n\n"${selectedText}"`;

    // Store the message in a temp var that AITutor will detect
    (window as any).__pendingAIQuestion = {
      message,
      timestamp: Date.now(),
    };

    console.log("📤 Dispatched AI question, waiting for AITutor to pick it up...");

    // Clear selection
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', chapterIndex: number) => {
    // isPreview might be passed in, or we can check id. Course viewer doesn't receive isPreview explicitly here.
    if ((course as any).id === undefined || (course as any).id === "preview") return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    try {
      await fetch("/api/child/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "course",
          userId: session.user.id,
          itemId: (course as any).id,
          chapterIndex,
          status,
        })
      });
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  };

  // Track initial start
  useEffect(() => {
    saveProgress('in_progress', 0);
  }, []);

  // Track chapter changes
  useEffect(() => {
    saveProgress('in_progress', currentChapterIndex);
  }, [currentChapterIndex]);

  // Load KaTeX for Math rendering - just load, don't render yet
  useEffect(() => {
    const loadKatex = () => {
      // If already loaded, done
      if (typeof (window as any).renderMathInElement === "function") {
        console.log("📦 KaTeX already loaded");
        return;
      }
      
      // Load CSS
      if (!document.getElementById("katex-css-course")) {
        const link = document.createElement("link");
        link.id = "katex-css-course";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

      // Load main KaTeX
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.integrity = "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => {
        console.log("✅ KaTeX loaded");
        // Once katex is loaded, load auto-render
        const autoRenderScript = document.createElement("script");
        autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
        autoRenderScript.integrity = "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05";
        autoRenderScript.crossOrigin = "anonymous";
        autoRenderScript.async = true;
        autoRenderScript.onload = () => {
          console.log("✅ KaTeX auto-render loaded");
        };
        autoRenderScript.onerror = () => {
          console.error("❌ Failed to load KaTeX auto-render");
        };
        document.head.appendChild(autoRenderScript);
      };
      script.onerror = () => console.error("❌ Failed to load KaTeX");
      document.head.appendChild(script);
    };

    loadKatex();
  }, []);

  // Observer for content changes - only watch for mutations, don't re-load KaTeX
  useEffect(() => {
    if (!contentRef.current) return;

    // Render math if KaTeX is available
    const renderMath = () => {
      if (typeof (window as any).renderMathInElement !== "function") {
        return;
      }

      if (!contentRef.current) {
        return;
      }

      try {
        (window as any).renderMathInElement(contentRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (e) {
        // Silently ignore errors
      }
    };

    // Render immediately when content is ready
    renderMath();

    // Create an observer to watch for content changes
    const observer = new MutationObserver(() => {
      if (typeof (window as any).renderMathInElement === "function") {
        renderMath();
      }
    });

    observer.observe(contentRef.current, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    return () => observer.disconnect();
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
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-xl shadow-sm border border-[var(--greek-gold)]/20 p-8">
        <FileText className="w-12 h-12 mb-4 text-[var(--greek-gold)]/50" />
        <p className="text-[var(--greek-blue)]">Ce cours ne contient aucun contenu pour le moment.</p>
      </div>
    );
  }

  if (courseCompleted) {
    const isPreview = (course as any).id === undefined || (course as any).id === "preview";
    const totalLessons = chapters.reduce((acc, c) => acc + c.lessons.length, 0);

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in bg-white border border-[var(--greek-gold)]">
        <div className="w-24 h-24 bg-[var(--greek-blue)] rounded-full flex items-center justify-center mb-6 shadow-xl">
          <Play className="w-12 h-12 text-[var(--greek-gold)] ml-1" />
        </div>
        <h2 className="text-4xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">
          Génial !
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-md">
          Tu as terminé le cours <span className="font-bold text-[var(--greek-blue)]">"{course.title}"</span>.
          Tu as validé les {totalLessons} leçons prévues.
        </p>
        
        <div className="w-full max-w-md bg-gray-50 border border-[var(--greek-gold)]/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 font-medium">Progression totale</span>
            <span className="text-[var(--greek-blue)] font-bold">100%</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
            <div className="bg-[var(--greek-gold)] h-full w-full transition-all duration-1000" />
          </div>
        </div>

        <button
          onClick={() => {
            if (isPreview) {
              window.close();
            } else {
              window.location.href = "/child/cours";
            }
          }}
          className="btn-primary-greek py-4 px-12 text-lg flex items-center gap-2 shadow-xl"
        >
          <ChevronLeft className="w-5 h-5" />
          {isPreview ? "Fermer l'aperçu" : "Retour aux cours"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white overflow-hidden border border-[var(--greek-gold)]">
      {/* Sidebar - Chapter Navigation */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-[var(--greek-cream)] border-r border-[var(--greek-gold)] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-14 md:h-16 px-4 md:px-6 border-b border-[var(--greek-gold)] bg-[var(--greek-cream)] flex justify-between items-center shadow-sm z-10">
          <div>
             <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] truncate max-w-[200px]" title={course.title}>
               {course.title}
             </h3>
             <p className="text-xs text-[var(--greek-bronze)] mt-1">
               {chapters.reduce((acc, c) => acc + c.lessons.length, 0)} leçons • {chapters.length} chapitres
             </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-10 h-10 flex items-center justify-center text-[var(--greek-bronze)] hover:bg-[var(--greek-gold)]/10 rounded-lg"
            aria-label="Fermer le sommaire"
            title="Fermer le sommaire"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 px-3 pt-7 pb-3 space-y-4">
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
        <div className="h-14 md:h-16 border-b border-[var(--greek-gold)] flex items-center px-4 md:px-6 justify-between bg-[var(--greek-cream)] shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 hover:bg-[var(--greek-gold)]/10 rounded-lg md:hidden text-[var(--greek-blue)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] truncate">
              {currentLesson?.title}
            </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-xs text-[var(--greek-bronze)] uppercase font-bold tracking-wider">Progression</span>
               <span className="text-sm font-bold text-[var(--greek-blue)]">
                 {Math.round((completedLessons.size / chapters.reduce((acc, c) => acc + c.lessons.length, 0)) * 100)}%
               </span>
             </div>
             <div className="w-10 h-10 rounded-full bg-[var(--greek-blue)]/10 flex items-center justify-center border-2 border-[var(--greek-gold)]/30">
                <span className="font-bold text-[var(--greek-blue)] text-sm">
                  {Math.round((completedLessons.size / chapters.reduce((acc, c) => acc + c.lessons.length, 0)) * 100)}%
                </span>
             </div>
          </div>
        </div>

        {/* Content Viewer */}
        <div className={`flex-1 overflow-y-auto bg-white scroll-smooth transition-opacity duration-300 ${isRendering ? 'opacity-0' : 'opacity-100'}`}>
          <div className="max-w-4xl mx-auto px-4 py-6 md:px-12 md:py-16">
            {currentLesson ? (
              <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
                {/* Content Header */}
                <div className="mb-6 md:mb-8 pb-4 md:pb-6 border-b border-[var(--greek-gold)]/10">
                  <div className="flex items-center gap-2 text-sm text-[var(--greek-bronze)] font-medium mb-2 uppercase tracking-wide">
                    {currentLesson.type === 'video' ? <Video size={16}/> : <FileText size={16}/>}
                    {currentLesson.type === 'video' ? 'Vidéo' : 'Leçon'}
                  </div>
                  <h1 className="text-2xl md:text-4xl font-extrabold font-[family-name:var(--font-display)] text-[var(--greek-blue)] leading-tight">
                    {currentLesson.title}
                  </h1>
                </div>

                {/* Content Body */}
                <div className="prose prose-sm md:prose-lg max-w-none prose-headings:font-bold prose-headings:font-[family-name:var(--font-display)] prose-headings:text-[var(--greek-blue)] prose-p:text-gray-600 prose-a:text-[var(--greek-blue)] hover:prose-a:text-[var(--greek-gold)] prose-img:rounded-xl prose-img:shadow-lg">
                   {currentLesson.type === 'video' ? (
                     <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-black border border-[var(--greek-gold)]/20">
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
                     <div ref={contentRef} dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                   )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-32">
                <div className="w-20 h-20 bg-[var(--greek-cream)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--greek-gold)]/20">
                  <Play className="w-8 h-8 text-[var(--greek-gold)] ml-1" />
                </div>
                <h3 className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">Prêt à commencer ?</h3>
                <p>Sélectionnez une leçon dans le menu de gauche.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="h-auto md:h-20 border-t border-[var(--greek-gold)] bg-[var(--greek-cream)]/95 backdrop-blur-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0 px-4 md:px-12 py-3 md:py-0 shrink-0 z-10 sticky bottom-0">
          <button
            onClick={handlePrev}
            disabled={currentChapterIndex === 0 && currentLessonIndex === 0}
            className="group flex items-center justify-center md:justify-start gap-2 px-4 py-3 md:py-2 text-[var(--greek-bronze)] font-medium disabled:opacity-30 hover:text-[var(--greek-blue)] transition-colors rounded-xl bg-white/70 md:bg-transparent border border-[var(--greek-gold)]/15 md:border-0"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden md:inline">Leçon précédente</span>
            <span className="md:hidden">Précédent</span>
          </button>
          
          <button
            onClick={handleNext}
            className="btn-primary-greek flex items-center justify-center gap-3 px-6 py-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto"
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

        {/* Text Selection Popup */}
        {selectedText && (
          <div
            className="fixed bg-[var(--greek-blue)] text-white rounded-xl shadow-2xl px-4 py-2 z-[100] flex items-center gap-3 border border-[var(--greek-gold)]/50 animate-fade-in pointer-events-auto"
            style={{
              left: `${selectionPosition.x}px`,
              top: `${selectionPosition.y}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              onClick={handleAskAI}
              className="flex items-center gap-2 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors font-semibold text-sm whitespace-nowrap"
              title="Demander à l'IA d'expliquer ce passage"
            >
              <Sparkles className="w-4 h-4" />
              Demander à l'IA
            </button>
            <button
              onClick={() => setSelectedText("")}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-blue-700 transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Invisible click target to dismiss popup */}
        {selectedText && (
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setSelectedText("")}
          />
        )}
      </div>
    </div>
  );
}
