"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Trophy,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Pencil,
  Keyboard,
  Trash2,
} from "lucide-react";
import { Page, Block } from "@/components/admin/ExerciseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";

interface ExerciseViewerProps {
  exercise: {
    id?: string;
    title: string;
    description?: string | null;
    content_json: Page[] | null;
    grading_type?: "auto" | "ai" | "manual";
    level?: string;
    type?: string;
    difficulty_level?: string;
    courses?: { title?: string; subject?: string; level?: string } | null;
  };
  onComplete?: (score: number, totalPoints: number) => void;
}

function DrawingCanvas({
  onChange,
  disabled,
  initialData,
}: {
  onChange: (data: string) => void;
  disabled: boolean;
  initialData?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    setCtx(context);

    // Fill with white background initially to prevent transparent background
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Load initial data if it's an image
    if (initialData && initialData.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = initialData;
    }
  }, []); // Only run once on mount

  const startDrawing = (e: any) => {
    if (disabled || !ctx || !canvasRef.current) return;
    const { offsetX, offsetY } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing || disabled || !ctx || !canvasRef.current) return;
    // Prevent scrolling on touch devices
    if (e.type.startsWith("touch")) {
      // e.preventDefault(); // React synthetic events might need passive: false elsewhere
    }
    const { offsetX, offsetY } = getCoordinates(e);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || disabled || !ctx || !canvasRef.current) return;
    ctx.closePath();
    setIsDrawing(false);
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const getCoordinates = (e: any) => {
    if (e.nativeEvent instanceof MouseEvent) {
      return {
        offsetX: e.nativeEvent.offsetX,
        offsetY: e.nativeEvent.offsetY,
      };
    }
    // Touch events
    const rect = e.target.getBoundingClientRect();
    const touch = e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0];
    return {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };
  };

  const clearCanvas = () => {
    if (disabled || !ctx || !canvasRef.current) return;
    // Fill with white instead of clearing to transparency
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className="relative border border-[var(--greek-gold)] overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-[300px] touch-none cursor-crosshair bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!disabled && (
        <button
          onClick={clearCanvas}
          className="absolute top-2 right-2 p-2 bg-white/80 rounded-full shadow hover:bg-red-50 text-red-500 border border-red-200"
          title="Effacer tout"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function ExerciseViewer({
  exercise,
  onComplete,
}: ExerciseViewerProps) {
  const pages = exercise.content_json || [];
  const { pageContext, setPageContext } = useAITutor();
  
  // Initialize currentPageIndex from localStorage or default to 0
  const [currentPageIndex, setCurrentPageIndexState] = useState(() => {
    if (typeof window === "undefined") return 0;
    if (!exercise.id) return 0;
    try {
      const saved = localStorage.getItem(`exercise-${exercise.id}-page`);
      const pageCount = (exercise.content_json?.length || 0);
      const index = saved ? Math.min(parseInt(saved, 10), pageCount - 1) : 0;
      console.log(`[ExerciseViewer] Loading page index for ${exercise.id}:`, {
        saved,
        pageCount,
        loadedIndex: index,
      });
      return index;
    } catch (e) {
      console.error("Failed to load page index:", e);
      return 0;
    }
  });

  // Wrapper to save page index to localStorage
  const setCurrentPageIndex = (newIndex: number | ((prev: number) => number)) => {
    setCurrentPageIndexState((prev) => {
      const index = typeof newIndex === "function" ? newIndex(prev) : newIndex;
      if (exercise.id) {
        try {
          localStorage.setItem(`exercise-${exercise.id}-page`, index.toString());
          console.log(`[ExerciseViewer] Saved page index: exercise=${exercise.id}, page=${index}`);
        } catch (e) {
          console.error("Failed to save page index:", e);
        }
      } else {
        console.warn("[ExerciseViewer] No exercise.id available");
      }
      return index;
    });
  };
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submittedBlocks, setSubmittedBlocks] = useState<Set<string>>(
    new Set()
  );
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [blockModes, setBlockModes] = useState<Record<string, "text" | "draw">>(
    {}
  );

  const currentPage = pages[currentPageIndex];

  // Initialize AI Tutor context when viewer mounts
  useEffect(() => {
    if (!exercise.title) return;

    // Extract content from all blocks (same function as in [id]/page.tsx)
    const extractContent = (contentJson: any): string => {
      if (!contentJson || !Array.isArray(contentJson)) {
        return "";
      }

      const allContent: string[] = [];

      contentJson.forEach((page: any) => {
        if (page.blocks && Array.isArray(page.blocks)) {
          page.blocks.forEach((block: any) => {
            if (block.content) allContent.push(block.content);
            if (block.text) allContent.push(block.text);
            if (block.question) allContent.push(block.question);
            if (block.prompt) allContent.push(block.prompt);

            if (block.options && Array.isArray(block.options)) {
              block.options.forEach((opt: any) => {
                if (opt.text) allContent.push(`- ${opt.text}`);
                if (opt.label) allContent.push(`- ${opt.label}`);
              });
            }

            if (block.type === "true_false" && block.statement) {
              allContent.push(block.statement);
            }

            if (block.type === "text_input" && block.label) {
              allContent.push(block.label);
            }

            if (block.type === "image") {
              if (block.alt) allContent.push(`[Image: ${block.alt}]`);
              if (block.caption) allContent.push(block.caption);
            }
          });
        }
      });

      return allContent.filter((c) => c && c.length > 0).join("\n");
    };

    let questionText = extractContent(exercise.content_json);

    // Fallback to description
    if (!questionText && exercise.description) {
      questionText = exercise.description;
    }

    const newContext = {
      page: "exercise_detail",
      exerciseTitle: exercise.title,
      exerciseQuestion: questionText.slice(0, 1000),
      exerciseDifficulty: exercise.difficulty_level || exercise.level || "moyen",
      exerciseType: exercise.type || "standard",
      courseTitle: exercise.courses?.title,
      courseSubject: exercise.courses?.subject || "Mathématiques",
      courseLevel: exercise.courses?.level || exercise.level,
    };

    setPageContext(newContext);

    console.log("✅ AI Tutor context initialized in ExerciseViewer:", {
      title: exercise.title,
      hasQuestion: !!questionText,
      questionLength: questionText?.length || 0,
      type: exercise.type,
      fullContext: newContext,
    });
  }, [exercise.id, exercise.title, setPageContext]);

  // Update AI Tutor context with current student answers
  useEffect(() => {
    const answerSummary = Object.entries(answers)
      .map(([blockId, answer]) => {
        if (typeof answer === "string" && answer.length > 0) {
          return answer;
        } else if (Array.isArray(answer) && answer.length > 0) {
          return answer.join(", ");
        }
        return null;
      })
      .filter((a): a is string => a !== null)
      .join(" | ");

    if (answerSummary) {
      setPageContext((ctx) => ({
        ...ctx,
        userAnswer: answerSummary.slice(0, 500), // Limit to 500 chars for API
      }));
    }
  }, [answers, setPageContext]);

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number) => {
    const isPreview = exercise.id === undefined || exercise.id === "preview";
    if (isPreview) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    let totalPoints = 0;
    pages.forEach((p) => p.blocks.forEach((b) => (totalPoints += b.points || 0)));

    try {
      await fetch("/api/child/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "exercise",
          userId: session.user.id,
          itemId: exercise.id,
          score: currentScore,
          totalPoints,
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

  // Load KaTeX for Math rendering
  // Robust LaTeX rendering with proper state tracking
  useEffect(() => {
    let isKaTeXReady = false;
    let isMounted = true;

    const renderMath = () => {
      if (!isMounted) return;
      
      // Wait a bit for DOM to be ready
      setTimeout(() => {
        if (!isMounted) return;
        
        const container = document.getElementById("exercise-content-container");
        if (!container) return;
        
        // Check if renderMathInElement is available
        if (typeof (window as any).renderMathInElement !== "function") {
          console.warn("KaTeX renderMathInElement not available yet");
          return;
        }

        try {
          (window as any).renderMathInElement(container, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
          isKaTeXReady = true;
        } catch (e) {
          console.error("KaTeX rendering failed:", e);
        }
      }, 100);
    };

    const loadKaTeX = () => {
      // If already loaded globally, render immediately
      if (typeof (window as any).renderMathInElement === "function") {
        renderMath();
        return;
      }
      
      // Load CSS
      if (!document.getElementById("katex-css-exercise")) {
        const link = document.createElement("link");
        link.id = "katex-css-exercise";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }

      // Load main KaTeX script
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.async = true;
      script.onload = () => {
        if (!isMounted) return;
        // Once katex.js is loaded, load auto-render
        const autoRenderScript = document.createElement("script");
        autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
        autoRenderScript.async = true;
        autoRenderScript.onload = () => {
          if (!isMounted) return;
          renderMath();
        };
        autoRenderScript.onerror = () => {
          if (!isMounted) return;
          console.error("Failed to load KaTeX auto-render");
          renderMath(); // Try anyway with what we have
        };
        document.head.appendChild(autoRenderScript);
      };
      script.onerror = () => console.error("Failed to load KaTeX main script");
      document.head.appendChild(script);
    };

    loadKaTeX();

    // Setup MutationObserver for dynamic content changes
    const container = document.getElementById("exercise-content-container");
    if (!container) {
      return () => { isMounted = false; };
    }

    const observer = new MutationObserver(() => {
      // Only try to render math if KaTeX is ready
      if (isKaTeXReady && typeof (window as any).renderMathInElement === "function") {
        renderMath();
      }
    });

    observer.observe(container, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    return () => { 
      isMounted = false;
      observer.disconnect();
    };
  }, [currentPageIndex]);

  // Visibility control to prevent flicker
  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timer);
  }, [currentPageIndex]);

  const handleBlockAnswerChange = (blockId: string, value: any) => {
    if (submittedBlocks.has(blockId)) return;
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
  };

  const validateAllAnswers = async () => {
    setIsValidating(true);
    let totalScore = 0;
    const newResults: Record<string, boolean> = {};
    const newAiFeedback: Record<string, string> = {};
    const newSubmitted = new Set<string>();

    for (const page of pages) {
      for (const block of page.blocks) {
        if (["text", "image"].includes(block.type)) continue;

        const answer = answers[block.id];
        let isCorrect = false;
        let points = block.points || 0;

        if (answer === undefined || answer === null) {
          newResults[block.id] = false;
          newSubmitted.add(block.id);
          continue;
        }

        if (block.type === "text_input" || exercise.grading_type === "ai") {
          try {
            const exerciseId = exercise.id || "preview";
            const res = await fetch(`/api/child/exercises/${exerciseId}/grade`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                block_id: block.id,
                answer: answer,
                question: block.content,
                correctAnswer: block.correctAnswer,
                explanation: block.explanation,
                level: exercise.level || "6eme", // Passing level for tailored feedback
                points: block.points,
              }),
            });
            const data = await res.json();
            isCorrect = data.is_correct;
            if (data.feedback) {
              newAiFeedback[block.id] = data.feedback;
            }
            if (data.score !== undefined) {
              points = data.score;
            }
          } catch (e) {
            console.error(e);
            isCorrect =
              String(answer).toLowerCase().trim() ===
              String(block.correctAnswer).toLowerCase().trim();
          }
        } else {
          if (block.type === "multiple_choice") {
            const correct = Array.isArray(block.correctAnswer)
              ? block.correctAnswer
              : [block.correctAnswer];
            const selected = Array.isArray(answer) ? answer : [answer];
            isCorrect =
              correct.length === selected.length &&
              correct.every((a: any) => selected.includes(a));
          } else if (["single_choice", "true_false"].includes(block.type)) {
            isCorrect = answer === block.correctAnswer;
          }
        }

        newResults[block.id] = isCorrect;
        newSubmitted.add(block.id);
        if (isCorrect) {
          totalScore += points;
        }
      }
    }

    setResults(newResults);
    setAiFeedback(newAiFeedback);
    setSubmittedBlocks(newSubmitted);
    setScore(totalScore);
    setIsValidating(false);
    setExerciseCompleted(true);
    
    // Save completed progress dynamically
    saveProgress('completed', totalScore);
    
    // Legacy onComplete for the parent
    if (onComplete) {
      // Calculate total points
      let totalPoints = 0;
      pages.forEach((p) =>
        p.blocks.forEach((b) => (totalPoints += b.points || 0))
      );
      onComplete(totalScore, totalPoints);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handleRestart = () => {
    setCurrentPageIndex(0);
    setAnswers({});
    setSubmittedBlocks(new Set());
    setScore(0);
    setExerciseCompleted(false);
    setShowReview(false);
  };

  if (!pages.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>Cet exercice ne contient aucun contenu pour le moment.</p>
      </div>
    );
  }

  if (exerciseCompleted) {
    let totalPoints = 0;
    pages.forEach((p) =>
      p.blocks.forEach((b) => (totalPoints += b.points || 0))
    );
    const percentage =
      totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 100;

    const isPreview = exercise.id === undefined || exercise.id === "preview";

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in bg-white">
        <div className="w-24 h-24 bg-[var(--greek-blue)] rounded-full flex items-center justify-center mb-6 shadow-xl">
          <Trophy className="w-12 h-12 text-[var(--greek-gold)]" />
        </div>
        <h2 className="text-4xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">
          Félicitations !
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-md">
          Tu as terminé cet exercice avec un score de{" "}
          <span className="font-bold text-[var(--greek-blue)]">
            {score} / {totalPoints}
          </span>
          .
        </p>
        
        <div className="w-full max-w-md bg-gray-50 border border-[var(--greek-gold)]/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 font-medium">Réussite</span>
            <span className="text-[var(--greek-blue)] font-bold">{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-[var(--greek-gold)] h-full transition-all duration-1000" 
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            onClick={() => {
              setExerciseCompleted(false);
              setShowReview(true);
              setCurrentPageIndex(0);
            }}
            className="py-4 px-8 text-lg flex items-center justify-center gap-2 shadow-md bg-white text-[var(--greek-blue)] border-2 border-[var(--greek-blue)] hover:bg-[var(--greek-cream)] font-bold rounded-xl transition-all"
          >
            <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" />
            Voir la correction
          </button>
          <button
            onClick={() => {
              if (isPreview) {
                window.close();
              } else {
                window.location.href = "/child/exercises";
              }
            }}
            className="btn-primary-greek py-4 px-8 text-lg flex items-center justify-center gap-2 shadow-xl rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" /> 
            {isPreview ? "Fermer l'aperçu" : "Retour aux exercices"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]">
      {/* Header */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] px-6 py-4 flex items-center justify-between shrink-0">
        <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">
          {exercise.title}
        </h3>
        <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
          Page {currentPageIndex + 1} / {pages.length}
        </div>
      </div>

      {/* Content */}
      <div
        id="exercise-content-container"
        className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
          {currentPage.title && (
            <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-6 text-center">
              {currentPage.title}
            </h2>
          )}

          {currentPage.blocks.map((block) => {
            const isSubmitted = submittedBlocks.has(block.id);
            const answer = answers[block.id];

            // Determine correctness for feedback
            const isCorrect = isSubmitted ? results[block.id] ?? false : false;

            return (
              <div
                key={block.id}
                className="bg-[var(--greek-cream)]/30 p-6 border border-[var(--greek-gold)]"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-lg text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                    {block.title}
                  </h4>
                  {block.points && (
                    <span className="text-xs font-bold bg-[var(--greek-gold)]/20 text-[var(--greek-bronze)] border border-[var(--greek-gold)]/30 px-2 py-1 rounded-full">
                      {block.points} pts
                    </span>
                  )}
                </div>

                {block.content && (
                  <div
                    className="prose max-w-none mb-6 text-gray-600 prose-headings:text-[var(--greek-blue)] prose-a:text-[var(--greek-blue)]"
                    dangerouslySetInnerHTML={{ __html: block.content }}
                  />
                )}

                {/* Interactive Elements */}
                <div className="mt-4">
                  {block.type === "text_input" && (
                    <div className="flex flex-col gap-2">
                      {/* Mode Toggle */}
                      <div className="flex justify-end gap-2 mb-1">
                        <button
                          onClick={() =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: "text",
                            }))
                          }
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors ${
                            (blockModes[block.id] || "text") === "text"
                              ? "bg-[var(--greek-blue)] text-white shadow-sm"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title="Mode Clavier"
                        >
                          <Keyboard className="w-3 h-3" /> Clavier
                        </button>
                        <button
                          onClick={() =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: "draw",
                            }))
                          }
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors ${
                            blockModes[block.id] === "draw"
                              ? "bg-[var(--greek-blue)] text-white shadow-sm"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title="Mode Dessin"
                        >
                          <Pencil className="w-3 h-3" /> Dessin
                        </button>
                      </div>

                      {blockModes[block.id] === "draw" ? (
                        <DrawingCanvas
                          disabled={isSubmitted}
                          initialData={answer}
                          onChange={(data) =>
                            handleBlockAnswerChange(block.id, data)
                          }
                        />
                      ) : (
                        <>
                          {!isSubmitted && (
                            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-b-0 border-gray-300 rounded-t-lg">
                              {[
                                { label: "x²", val: "^2" },
                                { label: "√", val: "\\sqrt{}" },
                                { label: "a/b", val: "\\frac{}{}" },
                                { label: "π", val: "\\pi" },
                                { label: "∞", val: "\\infty" },
                                { label: "≤", val: "\\le" },
                                { label: "≥", val: "\\ge" },
                                { label: "≠", val: "\\ne" },
                                { label: "→", val: "\\to" },
                                { label: "∈", val: "\\in" },
                                { label: "ℝ", val: "\\mathbb{R}" },
                              ].map((btn) => (
                                <button
                                  key={btn.label}
                                  onClick={() => {
                                    const el = document.getElementById(
                                      `textarea-${block.id}`
                                    ) as HTMLTextAreaElement;
                                    const current =
                                      answers[block.id] &&
                                      !answers[block.id].startsWith(
                                        "data:image"
                                      )
                                        ? answers[block.id]
                                        : "";
                                    if (el) {
                                      const start = el.selectionStart;
                                      const end = el.selectionEnd;
                                      const newVal =
                                        current.substring(0, start) +
                                        btn.val +
                                        current.substring(end);
                                      handleBlockAnswerChange(block.id, newVal);
                                      setTimeout(() => {
                                        el.focus();
                                        el.setSelectionRange(
                                          start + btn.val.length,
                                          start + btn.val.length
                                        );
                                      }, 0);
                                    } else {
                                      handleBlockAnswerChange(
                                        block.id,
                                        current + btn.val
                                      );
                                    }
                                  }}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-50 text-xs font-mono text-gray-700 shadow-sm"
                                  title={`Insérer ${btn.val}`}
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="relative">
                            <textarea
                              id={`textarea-${block.id}`}
                              disabled={isSubmitted}
                              value={
                                answers[block.id] &&
                                !answers[block.id].startsWith("data:image")
                                  ? answers[block.id]
                                  : ""
                              }
                              onChange={(e) =>
                                handleBlockAnswerChange(
                                  block.id,
                                  e.target.value
                                )
                              }
                              className={`w-full min-h-[120px] p-3 border rounded-b-lg focus:ring-2 focus:ring-[var(--greek-blue)] outline-none font-mono text-sm ${
                                isSubmitted
                                  ? isCorrect
                                    ? "border-green-500 bg-green-50"
                                    : "border-red-500 bg-red-50"
                                  : "border-gray-300 focus:border-[var(--greek-blue)] rounded-t-none"
                              }`}
                              placeholder="Votre réponse... (Utilisez le clavier ci-dessus pour les maths)"
                            />
                            {exercise.grading_type === "ai" && !isSubmitted && (
                              <div
                                className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50"
                                title="Correction par IA"
                              >
                                <Sparkles className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {(block.type === "single_choice" ||
                    block.type === "true_false") && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const isSelected = answer === option;
                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";

                        if (isSubmitted) {
                          if (option === block.correctAnswer)
                            btnClass =
                              "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected)
                            btnClass = "bg-red-50 border-red-500 text-red-700";
                        } else if (isSelected) {
                          btnClass =
                            "bg-[var(--greek-blue)]/10 border-[var(--greek-blue)] text-[var(--greek-blue)] font-medium shadow-sm";
                        }

                        return (
                          <button
                            key={idx}
                            disabled={isSubmitted}
                            onClick={() =>
                              handleBlockAnswerChange(block.id, option)
                            }
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${btnClass}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const currentSelected = Array.isArray(answer)
                          ? answer
                          : [];
                        const isSelected = currentSelected.includes(option);

                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";
                        if (isSubmitted) {
                          const correctArr = Array.isArray(block.correctAnswer)
                            ? block.correctAnswer
                            : [block.correctAnswer];
                          if (correctArr.includes(option))
                            btnClass =
                              "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected)
                            btnClass = "bg-red-50 border-red-500 text-red-700";
                        } else if (isSelected) {
                          btnClass =
                            "bg-[var(--greek-blue)]/10 border-[var(--greek-blue)] text-[var(--greek-blue)] font-medium shadow-sm";
                        }

                        return (
                          <button
                            key={idx}
                            disabled={isSubmitted}
                            onClick={() => {
                              if (isSubmitted) return;
                              const newSelected = isSelected
                                ? currentSelected.filter(
                                    (a: string) => a !== option
                                  )
                                : [...currentSelected, option];
                              handleBlockAnswerChange(block.id, newSelected);
                            }}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${btnClass}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Feedback after global validation */}
                {isSubmitted && (
                  <div className="mt-4 pt-4 border-t border-[var(--greek-gold)]/10 flex flex-col gap-3">
                    <div
                      className={`text-sm font-bold flex items-center gap-2 ${
                        isCorrect ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle className="w-4 h-4" /> Correct ! (+
                          {block.points} pts)
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" /> Incorrect
                        </>
                      )}
                    </div>

                    {aiFeedback[block.id] && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-blue-800 text-sm flex gap-3">
                        <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                        <div>
                          <span className="font-bold text-blue-700 block mb-1">
                            Feedback IA :
                          </span>
                          {aiFeedback[block.id]}
                        </div>
                      </div>
                    )}

                    {block.explanation && (
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-gray-600 text-sm flex gap-3">
                        <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--greek-blue)]" />
                        <div>
                          <span className="font-bold text-[var(--greek-blue)] block mb-1">
                            Explication :
                          </span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: block.explanation,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-[var(--greek-cream)] border-t border-[var(--greek-gold)] p-4 flex justify-between shrink-0">
        <button
          onClick={handlePrevPage}
          disabled={currentPageIndex === 0}
          className="px-4 py-2 text-[var(--greek-bronze)] font-medium disabled:opacity-50 hover:bg-[var(--greek-gold)]/10 rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </button>

        <button
          onClick={
            showReview
              ? currentPageIndex < pages.length - 1
                ? handleNextPage
                : () => {
                    setShowReview(false);
                    setExerciseCompleted(true);
                  }
              : currentPageIndex < pages.length - 1
              ? handleNextPage
              : validateAllAnswers
          }
          disabled={isValidating}
          className="btn-primary-greek px-6 py-2 flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Validation...
            </>
          ) : showReview ? (
            currentPageIndex < pages.length - 1 ? (
              <>
                Suivant <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Terminer l'exercice <CheckCircle className="w-4 h-4" />
              </>
            )
          ) : currentPageIndex < pages.length - 1 ? (
            <>
              Suivant <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Valider et Terminer <CheckCircle className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
