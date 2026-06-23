"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Play, Clock, BookOpen, AlertCircle, X, CheckCircle } from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CourseViewer from "@/components/viewers/CourseViewer";
import { useAITutor } from "@/contexts/AITutorContext";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const { setPageContext, clearContext } = useAITutor();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [resumeInfo, setResumeInfo] = useState<{ pct: number; chapterIndex: number; status: string } | null>(null);
  // Initialize started state from localStorage
  const [started, setStartedState] = useState(() => {
    if (typeof window === "undefined") return false;
    const wasStarted = localStorage.getItem(`course-${courseId}-started`);
    console.log(`[cours-${courseId}] Initial check: wasStarted=${wasStarted}`);
    return wasStarted === "true";
  });
  const [isRendering, setIsRendering] = useState(false);
  const isPreview = courseId === "preview";
  const contentRef = useRef<HTMLDivElement>(null);

  // Wrapper for setStarted that also saves to localStorage
  const setStarted = (value: boolean) => {
    setStartedState(value);
    if (value) {
      localStorage.setItem(`course-${courseId}-started`, "true");
      console.log(`[cours-${courseId}] Saved started=true to localStorage`);
    } else {
      localStorage.removeItem(`course-${courseId}-started`);
      console.log(`[cours-${courseId}] Removed started from localStorage`);
    }
  };

  useEffect(() => {
    const fetchCourse = async () => {
      if (isPreview) {
        // Handle Preview from Admin
        const previewData = localStorage.getItem("course_preview_data");
        if (previewData) {
          try {
            setCourse(JSON.parse(previewData));
          } catch (e) {
            console.error("Error parsing preview data", e);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/courses?id=${courseId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch course");
        }
        const data = await response.json();
        setCourse(data);
        // Load resume info from localStorage
        const status = localStorage.getItem(`cv-${courseId}-status`) || "not_started";
        const chIdx = parseInt(localStorage.getItem(`cv-${courseId}-ch`) || "0");
        const done = (() => { try { return JSON.parse(localStorage.getItem(`cv-${courseId}-done`) || "[]"); } catch { return []; } })();
        const totalL = (data.content_json || []).reduce((a: number, ch: any) => a + (ch.lessons?.length || 0), 0);
        const pct = totalL > 0 ? Math.round((done.length / totalL) * 100) : 0;
        const effectiveStatus = status === "completed" || pct >= 100 ? "completed" : status;
        if (effectiveStatus !== "not_started" || pct > 0) setResumeInfo({ pct, chapterIndex: chIdx, status: effectiveStatus });
        // Inject AI tutor context
        const chaptersSummary = (data.content_json || [])
          .map((ch: any) => `Chapitre: ${ch.title || ""}\n${(ch.blocks || []).map((b: any) => b.content || b.text || "").join(" ")}`)
          .join("\n")
          .slice(0, 2000);
        setPageContext({
          page: "cours_detail",
          courseTitle: data.title,
          courseSubject: data.subject,
          courseLevel: data.level,
          courseContent: chaptersSummary,
        });
      } catch (error) {
        console.error("Error fetching course:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
    return () => clearContext();
  }, [courseId, isPreview]);


  // Load KaTeX for Math rendering on the landing page
  useEffect(() => {
    if (loading || !course || started) return;

    const loadKatex = async () => {
      // 1. Inject KaTeX CSS if not already there
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

      // 2. Load KaTeX JS
      const loadScript = (src: string, integrity: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if ((window as any).katex && src.includes("katex.min.js")) return resolve();
          if ((window as any).renderMathInElement && src.includes("auto-render.min.js")) return resolve();
          
          const script = document.createElement("script");
          script.src = src;
          script.integrity = integrity;
          script.crossOrigin = "anonymous";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
          "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8"
        );
        await loadScript(
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js",
          "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        );
        
        renderMath();
      } catch (err) {
        console.error("KaTeX initialization failed:", err);
      }
    };

    const renderMath = () => {
      if (contentRef.current && (window as any).renderMathInElement) {
        setIsRendering(true);
        try {
          (window as any).renderMathInElement(contentRef.current, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\(', right: '\\)', display: false},
              {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError : false
          });
        } catch (e) {
          console.error("Math rendering error:", e);
        } finally {
          setTimeout(() => setIsRendering(false), 50);
        }
      }
    };

    loadKatex();
  }, [loading, course, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">Cours introuvable</h1>
        <Link href="/child/cours" className="text-[var(--greek-gold)] hover:underline">
          Retour aux cours
        </Link>
      </div>
    );
  }

  if (started) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
          <button
            onClick={() => { if (isPreview) { window.close(); } else { setStarted(false); } }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Retour à l'aperçu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold truncate flex-1">{course.title}</h1>
          <button
            onClick={() => {
              if (isPreview) { window.close(); } else {
                if (course?.id) localStorage.removeItem(`course-${course.id}-page`);
                setStarted(false);
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <CourseViewer
            course={course}
            reviewMode={resumeInfo?.status === "completed"}
            onBack={() => { if (!isPreview) setStarted(false); }}
            onChapterComplete={(chapterIndex) => {
              console.log(`Chapter ${chapterIndex} completed`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <button
        onClick={() => {
          if (isPreview) {
            window.close();
          } else {
            router.back();
          }
        }}
        className="flex items-center text-[var(--greek-blue)] hover:text-[var(--greek-gold)] mb-6 transition-colors font-bold"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Retour
      </button>

      <div 
        ref={contentRef}
        className={`bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden transition-opacity duration-300 ${isRendering ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="relative h-64 md:h-80 bg-gray-100">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/10">
              <img src="/logo.png" alt="Educalcul" className="w-24 h-24 object-contain opacity-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-8 text-white w-full">
              <div className="inline-block px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                {course.subject || "Mathématiques"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2 text-shadow-sm">
                {course.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[var(--greek-gold)]" />
                À propos de ce cours
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed">
                {course.description || "Aucune description disponible."}
              </div>
              
              <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-2">
                  Objectifs pédagogiques
                </h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>Comprendre les concepts clés</li>
                  <li>S'exercer avec des exemples pratiques</li>
                  <li>Valider ses connaissances avec un quiz</li>
                </ul>
              </div>
            </div>

            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 text-center">
                  {resumeInfo?.status === "completed" ? "Cours terminé !" : resumeInfo ? "Reprendre le cours" : "Prêt à commencer ?"}
                </h3>

                {resumeInfo && resumeInfo.status !== "completed" && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progression</span>
                      <span>{resumeInfo.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[rgba(197,161,72,0.25)]">
                      <div className="h-full bg-[var(--greek-gold)] rounded-full" style={{ width: `${resumeInfo.pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Chapitre {resumeInfo.chapterIndex + 1}
                    </p>
                  </div>
                )}

                {resumeInfo?.status === "completed" && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-green-600 font-bold text-sm">
                    <CheckCircle className="w-5 h-5" /> 100% complété
                  </div>
                )}

                <button
                  onClick={() => setStarted(true)}
                  className="w-full btn-primary-greek py-4 text-lg shadow-lg mb-4 flex items-center justify-center gap-2 transform hover:scale-105 transition-all"
                >
                  <Play className="w-6 h-6 fill-current" />
                  {resumeInfo?.status === "completed" ? "Revoir le cours" : resumeInfo ? "Reprendre" : "Démarrer la leçon"}
                </button>

                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Durée estimée
                    </span>
                    <span className="font-bold">{course?.estimated_time || 15} min</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Difficulté
                    </span>
                    <span className="font-bold text-[var(--greek-blue)]">Débutant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


