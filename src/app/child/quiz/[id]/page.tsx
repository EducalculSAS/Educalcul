"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  Play,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle,
  BookOpen,
  X,
} from "lucide-react";
import QuizViewer from "@/components/viewers/QuizViewer";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function QuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const isPreview = quizId === "preview";
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (isPreview) {
        // Handle Preview from Admin
        const previewData = localStorage.getItem("quiz_preview_data");
        if (previewData) {
          try {
            setQuiz(JSON.parse(previewData));
          } catch (e) {
            console.error("Error parsing preview data", e);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/quizzes?id=${quizId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch quiz");
        }
        const data = await response.json();
        setQuiz(data);
      } catch (error) {
        console.error("Error fetching quiz:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, isPreview]);


  // Load KaTeX for Math rendering on the landing page
  useEffect(() => {
    if (loading || !quiz || started) return;

    const loadKatex = async () => {
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

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
  }, [loading, quiz, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">Quiz introuvable</h1>
        <Link href="/child/quiz" className="text-[var(--greek-gold)] hover:underline">
          Retour aux quiz
        </Link>
      </div>
    );
  }

  const difficultyLabel = quiz.difficulty_level 
    ? (quiz.difficulty_level === "easy" ? "FACILE" : 
       quiz.difficulty_level === "medium" ? "MOYEN" : 
       quiz.difficulty_level === "hard" ? "DIFFICILE" : 
       quiz.difficulty_level === "expert" ? "EXPERT" : 
       quiz.difficulty_level.toUpperCase())
    : "NORMAL";

  const questionCount = quiz.content_json?.length || 0;

  if (started) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
          <h1 className="text-lg font-bold truncate">{quiz.title}</h1>
          <button 
            onClick={() => {
              if (isPreview) {
                window.close();
              } else {
                setStarted(false);
              }
            }}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <QuizViewer 
            quiz={quiz} 
            onComplete={async (score, total, timeSpent) => {
              console.log(`Quiz completed: ${score}/${total} in ${timeSpent}s`);
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                try {
                  await fetch("/api/child/activities", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "quiz",
                      userId: session.user.id,
                      itemId: quiz.id,
                      score,
                      totalPoints: total,
                      timeSpent
                    })
                  });
                } catch (e) {
                  console.error("Failed to save quiz activity", e);
                }
              }
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
        className={`bg-white rounded-[20px] shadow-lg border-2 border-[var(--greek-gold)]/30 overflow-hidden transition-opacity duration-300 ${isRendering ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="relative h-64 md:h-80 bg-[var(--greek-blue)] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
          <Trophy className="w-24 h-24 text-[var(--greek-gold)] drop-shadow-lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-8 text-white w-full">
              <div className="inline-block px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                {quiz.courses?.title || "Évaluation"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2 text-shadow-sm">
                {quiz.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[var(--greek-gold)]" />
                Défie tes connaissances
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed mb-6">
                {quiz.description || "Prêt à tester tes connaissances ? Réponds correctement aux questions pour gagner des points !"}
              </div>
              
              <div className="mt-8 p-6 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/20">
                <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4">
                  Règles du quiz :
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Validation globale à la fin</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Score basé sur la précision</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Explications détaillées fournies</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Accumule des points XP</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-white rounded-xl p-6 border-2 border-[var(--greek-blue)]/10 shadow-sm sticky top-24">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 text-center">
                  Prêt pour le défi ?
                </h3>
                
                <button 
                  onClick={() => setStarted(true)}
                  className="w-full btn-primary-greek py-4 text-lg shadow-lg mb-4 flex items-center justify-center gap-2 transform hover:scale-105 transition-all"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Démarrer le quiz
                </button>
                
                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Temps estimé
                    </span>
                    <span className="font-bold">10 min</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Questions
                    </span>
                    <span className="font-bold">{questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Difficulté
                    </span>
                    <span className="font-bold text-[var(--greek-blue)]">{difficultyLabel}</span>
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
