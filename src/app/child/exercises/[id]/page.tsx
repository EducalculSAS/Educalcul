"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  Play,
  Clock,
  Star,
  Brain,
  CheckCircle,
  HelpCircle,
  X,
  AlertCircle,
} from "lucide-react";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const isPreview = exerciseId === "preview";
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchExercise = async () => {
      if (isPreview) {
        // Handle Preview from Admin
        const previewData = localStorage.getItem("exercise_preview_data");
        if (previewData) {
          try {
            setExercise(JSON.parse(previewData));
          } catch (e) {
            console.error("Error parsing preview data", e);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/exercises?id=${exerciseId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch exercise");
        }
        const data = await response.json();
        setExercise(data);
      } catch (error) {
        console.error("Error fetching exercise:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExercise();
  }, [exerciseId, isPreview]);


  // Load KaTeX for Math rendering on the landing page
  useEffect(() => {
    if (loading || !exercise || started) return;

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
  }, [loading, exercise, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">Exercice introuvable</h1>
        <Link href="/child/exercises" className="text-[var(--greek-gold)] hover:underline">
          Retour aux exercices
        </Link>
      </div>
    );
  }

  if (started) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
          <h1 className="text-lg font-bold truncate">{exercise.title}</h1>
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
          <ExerciseViewer 
            exercise={exercise} 
            onComplete={(score: number, total: number) => {
              console.log(`Exercise completed: ${score}/${total}`);
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
        <div className="relative h-64 md:h-80 bg-[var(--greek-cream)] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 pattern-grid-lg"></div>
          <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-90 drop-shadow-lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-8 text-white w-full">
              <div className="inline-block px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                {exercise.courses?.title || "Mathématiques"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2 text-shadow-sm">
                {exercise.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-[var(--greek-gold)]" />
                Objectifs de l'exercice
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed mb-6">
                {exercise.description || "Entraîne-toi sur ce sujet pour maîtriser tes compétences !"}
              </div>
              
              <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4">
                  Ce que tu vas pratiquer :
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Application directe du cours</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Résolution de problèmes concrets</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Auto-correction et feedback immédiat</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Préparation aux évaluations supérieures</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[var(--greek-gold)]/20 sticky top-24">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 text-center">
                  Prêt à t'entraîner ?
                </h3>
                
                <button 
                  onClick={() => setStarted(true)}
                  className="w-full btn-primary-greek py-4 text-lg shadow-lg mb-4 flex items-center justify-center gap-2 transform hover:scale-105 transition-all"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Commencer l'exercice
                </button>
                
                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Durée estimée
                    </span>
                    <span className="font-bold">15 min</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="flex items-center gap-2">
                      <Star className="w-4 h-4" /> Récompense
                    </span>
                    <span className="font-bold text-[var(--greek-gold)]">{exercise.points || 10} XP</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" /> Difficulté
                    </span>
                    <span className="font-bold text-[var(--greek-blue)]">{exercise.difficulty ? exercise.difficulty.toUpperCase() : "NORMAL"}</span>
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
