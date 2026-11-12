"use client";
/* eslint-disable @next/next/no-img-element -- images à adresse libre ou data: saisies par l'admin (miniatures, aperçus, énoncés) : next/image ne peut pas les optimiser */

import Emblem3D from "@/components/Emblem3D";
import Image from "next/image";
import { plural } from "@/lib/plural";
import { useState, useEffect, useRef, useMemo } from "react";
import { Play, CheckCircle, ChevronRight, Menu, X, FileText, Video, ChevronLeft, Sparkles, PencilLine, Image as ImageIcon } from "lucide-react";
import { Chapter } from "@/components/admin/CourseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import { enhanceCourseSteps } from "@/lib/courseSteps";
import { enhanceTrigCircles } from "@/lib/trigCircleInteractive";
import { enhanceClocks } from "@/lib/clockInteractive";
import { enhanceCoinPurses } from "@/lib/coinPurseInteractive";
import { enhanceNewPlugins } from "@/lib/newPluginsInteractive";
import { enhanceAlgoSandboxes } from "@/lib/pyodideInteractive";
import { subscribeMathKeyboardVisibility } from "@/components/MathInput";
import GlassButton from "@/components/ui/GlassButton";
import { useCaliaFloor } from "@/lib/caliaFloor";
import GlassIconButton from "@/components/ui/GlassIconButton";
import CaliaSceneDemo from "@/components/child/calia-scene/CaliaSceneDemo";
import ReadAloudButton from "@/components/ReadAloudButton";

import { InlineMiniExercises, renderLessonContentWithInlineExercises } from "./CourseInlineBlocks";
// Helper to extract YouTube ID
const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/** Texte propre d'une sélection contenant du LaTeX rendu par KaTeX. Chaque
 * formule KaTeX contient déjà sa source LaTeX d'origine dans une annotation
 * cachée pour les lecteurs d'écran (<annotation encoding="application/x-tex">) ;
 * on remplace tout l'élément .katex par "$latex$" (ou "$$latex$$" en mode
 * bloc) pour renvoyer à l'IA la même notation que dans le cours plutôt que le
 * texte visuel reconstitué (qui, en plus de dupliquer le rendu visuel et
 * l'annotation d'accessibilité en un texte illisible, perd la structure des
 * formules — une fraction ou un exposant n'a pas de forme textuelle fidèle). */
function getCleanSelectionText(range: Range): string {
  const fragment = range.cloneContents();
  const container = document.createElement("div");
  container.appendChild(fragment);
  container.querySelectorAll(".katex").forEach((katexEl) => {
    const tex = katexEl
      .querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent?.trim();
    if (tex) {
      const isDisplay = !!katexEl.closest(".katex-display");
      katexEl.replaceWith(document.createTextNode(isDisplay ? `$$${tex}$$` : `$${tex}$`));
    } else {
      // Repli (sélection partielle d'une formule, annotation absente) : on
      // retire au moins la copie cachée pour éviter le texte dupliqué.
      katexEl.querySelectorAll(".katex-mathml").forEach((el) => el.remove());
    }
  });
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}

export interface CourseViewerProps {
  course: {
    id?: string | number;
    title: string;
    description?: string;
    content_json: Chapter[] | null;
    level?: string;
    subject?: string | null;
    thumbnail_url?: string | null;
  };
  onComplete?: () => void;
  onChapterComplete?: (chapterIndex: number) => void;
  onBack?: () => void;
  reviewMode?: boolean;
}

export default function CourseViewer({ course, onComplete, onChapterComplete, onBack, reviewMode }: CourseViewerProps) {
  // Calia se pose au-dessus de la barre « Précédent / Suivant » au lieu de la recouvrir.
  const caliaFloorRef = useCaliaFloor();
  const { setPageContext } = useAITutor();
  
  const chapters = useMemo(
    () => (course.content_json || []).map((c) => ({ ...c, lessons: c.lessons || [] })),
    [course.content_json]
  );
  const courseId = course.id;
  const isPreviewCourse = !courseId || courseId === "preview" || courseId === "demo";

  // Position/progression : plus de repli localStorage — la position exacte
  // vient uniquement du serveur (voir l'effet "Charge la progression
  // sauvegardée en base" plus bas), au prix d'un bref flash sur la
  // leçon 1 avant que cet effet ne resitue l'élève où il en était.
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [courseCompleted, setCourseCompleted] = useState(false);
  // true tant qu'aucune checklist interactive n'est présente sur la leçon
  // courante, ou une fois que toutes ses cases sont cochées — sert à
  // bloquer "Terminer le cours" sur la dernière leçon (bilan) tant que
  // l'élève n'a pas coché toute sa checklist "Je sais faire".
  const [checklistComplete, setChecklistComplete] = useState(true);
  const [, setSelectedText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef("");
  const rangeRef = useRef<Range | null>(null);
  const sessionStartRef = useRef<number>(0); // posé au montage (voir l'effet plus bas)
  // Rempli par l'effet de chargement serveur ci-dessous (progress_json.timeSpent).
  const accumulatedSecondsRef = useRef(0);
  // Tant qu'un clavier mathématique est ouvert (mini-exo dans la leçon), on
  // ajoute de la place en bas du contenu défilable : sinon un mini-exo tout
  // en bas de la leçon n'a nulle part où défiler pour dégager son champ de
  // réponse au-dessus du clavier fixe. Revient à la normale à la fermeture.
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  useEffect(() => subscribeMathKeyboardVisibility(setMathKeyboardOpen), []);

  // Accumulated time from previous sessions + current
  const getAccumulatedSeconds = () => {
    if (isPreviewCourse) return 0;
    return accumulatedSecondsRef.current;
  };
  const saveTimeSpent = () => {
    if (isPreviewCourse) return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    accumulatedSecondsRef.current = total;
    sessionStartRef.current = Date.now(); // reset so we don't double-count
    return total;
  };

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, []);
  // Durée affichée sur l'écran de fin : figée au moment où le cours se termine (l'affichage ne lit pas de ref).
  const [timeTotal, setTimeTotal] = useState(0);
  useEffect(() => {
    if (courseCompleted) setTimeTotal(getAccumulatedSeconds());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la fin du cours déclenche la mesure
  }, [courseCompleted]);

  const currentChapter = chapters[currentChapterIndex];
  const currentLesson = currentChapter?.lessons[currentLessonIndex];

  // Contexte complet du cours pour "Calia en classe" (CaliaSceneDemo) : elle
  // ne voit sinon que la leçon actuellement affichée (buildOutline scrute le
  // DOM), donc perd le fil dès qu'on change de leçon/chapitre et ignore les
  // mini-exercices. `chapters` est déjà entièrement en mémoire (content_json
  // chargé en un bloc), donc pas de coût réseau supplémentaire ici.
  const caliaCourseContext = useMemo(() => ({
    courseId: (course as { id?: number | string }).id ?? null,
    courseTitle: course.title,
    level: course.level || null,
    lessons: chapters.flatMap((c, ci) =>
      c.lessons.map((l, li) => ({
        title: l.title,
        current: ci === currentChapterIndex && li === currentLessonIndex,
        // Début du texte de chaque leçon : Calia connaît tout le cours, pas
        // seulement la leçon affichée.
        summary: String((l as { content?: string }).content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
        exercises: (l.exercises || []).map((e) => ({ question: e.question, hint: e.hint, answer: e.answer })),
      }))
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seuls les champs listés comptent ; l'objet entier change d'identité sans que le contenu change
  }), [course.title, course.level, chapters, currentChapterIndex, currentLessonIndex]);

  const [isRendering] = useState(false);

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
    } else if (currentLesson.type === "video" && (currentLesson as { videoUrl?: string }).videoUrl) {
      lessonContent += `\n\n[Vidéo]: ${(currentLesson as { videoUrl?: string }).videoUrl}`;
    }

    // Set the AI context with ONLY current lesson (not full course)
    setPageContext({
      page: "cours_detail",
      courseTitle: course.title,
      courseSubject: course.subject || "Maths",
      courseLevel: course.level || "Collège",
      courseContent: lessonContent, // CURRENT LESSON ONLY, not full course
    });

    console.info("📚 AI Context Updated with Current Lesson:", {
      courseTitle: course.title,
      lessonTitle: currentLesson.title,
      contentLength: lessonContent.length,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seuls les champs listés comptent ; l'objet entier change d'identité sans que le contenu change
  }, [course.title, currentChapterIndex, currentLessonIndex, setPageContext, chapters]);

  // KaTeX pré-rendu via renderLatexInHTML — pas besoin de useLayoutEffect

  // Rend les graphiques interactifs (curseur + coordonnées au survol) et les
  // démonstrations à révélation progressive (étape par étape).
  useEffect(() => {
    const t = setTimeout(() => {
      enhanceMathGraphs(document.body);
      enhanceCourseSteps(document.body);
      enhanceTrigCircles(document.body);
      enhanceClocks(document.body);
      enhanceCoinPurses(document.body);
      enhanceNewPlugins(document.body);
      enhanceAlgoSandboxes(document.body);
    }, 120);
    return () => clearTimeout(t);
  }, [currentChapterIndex, currentLessonIndex]);

  // Detect text selection — apply persistent <mark> highlight
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || !contentRef.current) return;

      // Check selection is inside course content
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) return;

      const text = getCleanSelectionText(range);
      if (text.length <= 5) return;

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
    window.dispatchEvent(new CustomEvent("educalcul:ai-question", { detail: { message } }));
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

  // Charge la progression sauvegardée en base (reprise après déconnexion) —
  // seule source de vérité pour la position/progression, plus de double
  // écriture locale en parallèle.
  const progressLoadedFromDbRef = useRef(false);
  useEffect(() => {
    if (isPreviewCourse || reviewMode) { progressLoadedFromDbRef.current = true; return; }
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const res = await fetch(`/api/child/courses/${courseId}/progress?userId=${session.user.id}`);
        const data = await res.json();
        const p = data?.progress;
        if (p?.lessonsCompleted?.length) {
          setCompletedLessons(new Set(p.lessonsCompleted));
        }
        if (typeof p?.lastChapterIndex === "number") {
          setCurrentChapterIndex(p.lastChapterIndex);
        }
        if (typeof p?.lastLessonIndex === "number") {
          setCurrentLessonIndex(p.lastLessonIndex);
        }
        if (typeof p?.timeSpent === "number") {
          accumulatedSecondsRef.current = p.timeSpent;
        }
        if (data?.status === "completed") {
          setCourseCompleted(true);
        }
      } catch (e) {
        console.error("Failed to load course progress", e);
      } finally {
        progressLoadedFromDbRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track initial start (après chargement de la progression depuis la base)
  useEffect(() => {
    if (isPreviewCourse || reviewMode) return;
    let cancelled = false;
    (async () => {
      while (!progressLoadedFromDbRef.current && !cancelled) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!cancelled) saveProgress('in_progress', currentChapterIndex);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track chapter changes
  useEffect(() => {
    if (!progressLoadedFromDbRef.current || reviewMode) return;
    saveProgress('in_progress', currentChapterIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [currentChapterIndex]);


  // Hide popup when lesson changes
  useEffect(() => {
    if (popupRef.current) popupRef.current.style.display = "none";
    selectedTextRef.current = "";
    setSelectedText("");
    // Recalculé directement depuis le contenu de la leçon (pas un simple
    // "true" par défaut) : les effets des enfants montés dans le même rendu
    // s'exécutent AVANT celui-ci, donc un "true" ici écraserait à tort le
    // "false" déjà posé par une checklist non cochée — c'est exactement le
    // bug remonté (retour à une leçon précédente puis suivante réactivait
    // "Terminer le cours" sans que la checklist soit cochée).
    const hasChecklist = /class="[^"]*course-checklist[^"]*"/.test(currentLesson?.content || "");
    setChecklistComplete(!hasChecklist);
  }, [currentChapterIndex, currentLessonIndex, currentLesson]);

  // Scroll back to top when changing lesson/chapter
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    // Lecteur intégré dans une page (démo de la page Offres) : on ne fait défiler que le lecteur, jamais la page.
    if (String(course.id) !== "demo") window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentChapterIndex, currentLessonIndex, course.id]);

  const handleNext = () => {
    if (!currentChapter) return;

    const isLastLesson = currentChapterIndex === chapters.length - 1 && currentLessonIndex === currentChapter.lessons.length - 1;

    if (reviewMode && isLastLesson) {
      if (onBack) onBack();
      return;
    }

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

  // "Calia en classe" ne peut REELLEMENT faire avancer la lecon que via ce
  // meme chemin que le bouton "Lecon suivante" — meme garde-fou (checklist
  // de la derniere lecon non cochee => on ignore la demande, comme le
  // bouton le ferait en restant desactive).
  const advanceLessonForCalia = () => {
    const isFinalLesson =
      currentChapterIndex === chapters.length - 1 &&
      currentLessonIndex === (currentChapter?.lessons?.length || 0) - 1;
    if (isFinalLesson && !reviewMode && !checklistComplete) return;
    handleNext();
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
        <Emblem3D kind="book" size={80} className="mb-4" />
        <p className="text-[var(--greek-blue)]">Ce cours ne contient aucun contenu pour le moment.</p>
      </div>
    );
  }

  if (courseCompleted) {
    const totalLessons = chapters.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);
    const mins = Math.floor(timeTotal / 60);

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-3 py-4 md:px-4 md:py-6 max-w-5xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header — same as preview */}
            <div className="relative h-64 md:h-80 bg-gray-100">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/10">
                  <Image src="/logo.png" alt="Educalcul" width={96} height={96} className="w-24 h-24 object-contain opacity-20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-5 md:p-8 text-white w-full">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                    <CheckCircle className="w-3.5 h-3.5" /> Cours terminé !
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{course.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Left: description + stats */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-[var(--greek-gold)]" />
                    Félicitations !
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Tu as terminé ce cours avec succès. Maintenant que tu maîtrises ces notions, mets tes connaissances à l&apos;épreuve !
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
                    <GlassButton href={courseId ? `/child/exercises?course=${courseId}` : "/child/exercises"} variant="navy" fullWidth className="font-bold text-base">
                      Faire les exercices
                    </GlassButton>
                    <GlassButton href={courseId ? `/child/quiz?course=${courseId}` : "/child/quiz"} variant="navy" fullWidth className="font-bold text-base">
                      Tenter le quiz
                    </GlassButton>
                    <GlassButton href="/child/cours" variant="outline" fullWidth className="font-bold text-base">
                      Retour aux cours
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalLessons = chapters.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.size / totalLessons) * 100) : 0;
  const r = 17;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (progressPct / 100) * circ;

  return (
    <div className="flex h-full bg-white overflow-hidden border border-[var(--greek-gold)] relative">
      {/* Sidebar - Chapter Navigation */}
      <div
        className={`absolute inset-y-0 left-0 z-30 bg-[var(--greek-cream)] border-r border-[var(--greek-gold)] flex flex-col transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${sidebarOpen ? "translate-x-0 w-[88vw] max-w-sm md:w-80 md:max-w-none lg:w-96" : "-translate-x-full md:translate-x-0 w-[88vw] max-w-sm md:w-0 md:overflow-hidden md:border-r-0"}`}
      >
        <div className="p-5 border-b border-[var(--greek-gold)] bg-[var(--greek-cream)] flex justify-between items-center shadow-sm z-10">
          <div className="min-w-0 flex-1 pr-2">
             <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] leading-snug line-clamp-2" title={course.title}>
               {course.title}
             </h3>
             <p className="text-xs text-[var(--greek-bronze)] mt-1">
               {plural(totalLessons, "leçon")} • {plural(chapters.length, "chapitre")}
             </p>
          </div>
          <div className="md:hidden">
            <GlassIconButton icon={X} onClick={() => setSidebarOpen(false)} color="navy" size="sm" aria-label="Fermer le menu" />
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {chapters.map((chapter, cIndex) => (
            <div key={chapter.id} className="space-y-1">
              <div className="px-3 py-2 text-xs font-bold text-[var(--greek-bronze)]/70 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] flex items-center justify-center text-[10px]">{cIndex + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(chapter.title) }} />
              </div>
              <div className="space-y-1">
                {chapter.lessons.map((lesson, lIndex) => {
                  const isActive = cIndex === currentChapterIndex && lIndex === currentLessonIndex;
                  const isCompleted = completedLessons.has(lesson.id);
                  
                  let Icon = FileText;
                  if (lesson.type === "video" || lesson.type === "video_file") Icon = Video;
                  if (lesson.type === "quiz" || lesson.type === "exercise") Icon = PencilLine;
                  if (lesson.type === "image") Icon = ImageIcon;

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
                      <span
                        className="flex-1 min-w-0 font-medium leading-snug line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: renderLatexInHTML(lesson.title) }}
                      />
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
        <div className="h-14 border-b border-[var(--greek-gold)] flex items-center px-3 md:px-4 gap-1.5 md:gap-2 bg-[var(--greek-cream)] shrink-0 z-10">
          {/* Flèche retour */}
          {onBack && (
            <GlassIconButton icon={ChevronLeft} onClick={onBack} color="navy" size="sm" aria-label="Retour à l'aperçu" />
          )}
          {/* Menu burger */}
          <GlassIconButton icon={Menu} onClick={() => setSidebarOpen(!sidebarOpen)} color="navy" size="sm" aria-label="Menu" />

          {/* Titre leçon — scrollable horizontalement sur mobile */}
          <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
            <h2
              className="text-base font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] whitespace-nowrap"
              dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentLesson?.title || "") }}
            />
          </div>

          {/* Calia en classe — plan Family (verrouillee/upsell sinon, voir CaliaSceneDemo) */}
          {courseId !== "demo" && (<CaliaSceneDemo
            contentRef={contentRef}
            courseContext={caliaCourseContext}
            onAdvanceLesson={advanceLessonForCalia}
            onPrevLesson={handlePrev}
            onGoToLesson={(n) => {
              // n = numéro de la leçon dans tout le cours (1 = première)
              let k = n - 1;
              for (let ci = 0; ci < chapters.length; ci++) {
                const count = chapters[ci].lessons.length;
                if (k < count) return selectLesson(ci, Math.max(0, k));
                k -= count;
              }
            }}
          />)}

          {/* Cercle progression SVG */}
          <div className="flex-shrink-0">
            <svg viewBox="0 0 44 44" className="w-9 h-9 md:w-11 md:h-11">
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
          <div
            className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:px-8 md:py-10 transition-[padding-bottom] duration-200"
            style={mathKeyboardOpen ? { paddingBottom: "380px" } : undefined}
          >
            {currentLesson ? (
              <div className="animate-fade-bounce">
                {/* Content Header */}
                <div className="mb-8 pb-6 border-b border-[rgba(197,161,72,0.25)]">
                  <div className="flex items-center gap-2 text-sm text-[var(--greek-bronze)] font-medium mb-2 uppercase tracking-wide">
                    {currentLesson.type === 'video' || currentLesson.type === 'video_file' ? <Video size={16}/> : <FileText size={16}/>}
                    {currentLesson.type === 'video' || currentLesson.type === 'video_file' ? 'Vidéo' : 'Leçon'}
                  </div>
                  <h1
                    className="text-3xl md:text-4xl font-extrabold font-[family-name:var(--font-display)] text-[var(--greek-blue)] leading-tight"
                    dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentLesson.title) }}
                  />
                  {currentLesson.type !== 'video' && currentLesson.type !== 'video_file' && (
                    <div className="mt-4">
                      <ReadAloudButton
                        label="Écouter la leçon"
                        text={[currentLesson.title, ...(currentLesson.blocks ?? []).filter((b) => b.type === "text").map((b) => b.content || ""), currentLesson.type === "text" ? currentLesson.content || "" : ""].join(". ").slice(0, 8000)}
                      />
                    </div>
                  )}
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
                             <Emblem3D kind="video" size={80} onDark className="mx-auto mb-4" />
                             <p>Vidéo non disponible ou lien invalide</p>
                             <a href={currentLesson.content} target="_blank" rel="noopener noreferrer" className="text-[var(--greek-blue)] hover:underline mt-2 block text-sm">
                                Ouvrir le lien original
                             </a>
                           </div>
                         </div>
                       )}
                     </div>
                   ) : currentLesson.type === 'video_file' ? (
                     <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-black border border-[rgba(197,161,72,0.25)]">
                       {currentLesson.content ? (
                         <video src={currentLesson.content} controls className="w-full h-full" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-white">
                           <div className="text-center">
                             <Emblem3D kind="video" size={80} onDark className="mx-auto mb-4" />
                             <p>Vidéo non disponible</p>
                           </div>
                         </div>
                       )}
                     </div>
                   ) : currentLesson.type === 'pdf' ? (
                     currentLesson.content ? (
                       <div className="w-full rounded-2xl overflow-hidden shadow-xl border border-[rgba(197,161,72,0.25)]" style={{ height: "80vh" }}>
                         <iframe src={currentLesson.content} title={currentLesson.title} className="w-full h-full" />
                       </div>
                     ) : (
                       <div className="text-center text-gray-400 py-12">
                         <Emblem3D kind="book" size={80} className="mx-auto mb-4" />
                         <p>Document PDF non disponible</p>
                       </div>
                     )
                   ) : currentLesson.type === 'table' || currentLesson.type === 'graph' ? (
                     currentLesson.content?.trim() ? (
                       <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(currentLesson.content)) }} />
                     ) : (
                       <p className="text-gray-400 italic">Contenu non disponible.</p>
                     )
                   ) : currentLesson.type === 'image' ? (
                     currentLesson.image_url ? (
                       <img src={currentLesson.image_url} alt={currentLesson.title} className="max-w-full rounded-xl border border-[rgba(197,161,72,0.25)]" />
                     ) : (
                       <p className="text-gray-400 italic">Image non disponible.</p>
                     )
                   ) : (currentLesson.type === 'exercise' || currentLesson.type === 'quiz') ? (
                     currentLesson.exercises && currentLesson.exercises.length > 0 ? (
                       <InlineMiniExercises
                         lessonId={currentLesson.id}
                         exercises={currentLesson.exercises}
                         level={course.level}
                         title={currentLesson.type === 'quiz' ? 'Quiz' : 'Mini-exercices'}
                       />
                     ) : (
                       <p className="text-gray-400 italic">Aucune question pour le moment.</p>
                     )
                   ) : currentLesson.blocks && currentLesson.blocks.length > 0 ? (
                     <div ref={contentRef} className="space-y-6">
                       {(() => { let exerciseCount = 0; return currentLesson.blocks.map((block) => {
                         if (block.type === "text" || block.type === "table" || block.type === "graph") {
                           if (!block.content?.trim()) return null;
                           return (
                             <div
                               key={block.id}
                               dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")) }}
                             />
                           );
                         }
                         if (block.type === "image" && block.image_url) {
                           return (
                             <img
                               key={block.id}
                               src={block.image_url}
                               alt=""
                               className="max-w-full rounded-xl border border-[rgba(197,161,72,0.25)]"
                             />
                           );
                         }
                         if (block.type === "exercise" && block.exercise) {
                           exerciseCount++;
                           return (
                             <InlineMiniExercises
                               key={block.id}
                               lessonId={currentLesson.id}
                               exercises={[block.exercise]}
                               level={course.level}
                               compact
                               startNumber={exerciseCount}
                             />
                           );
                         }
                         return null;
                       }); })()}
                     </div>
                   ) : (
                     <>
                       {/* Espacement général entre les segments d'une leçon
                           (texte, mini-exercices, checklist) : ils étaient
                           empilés sans marge, la checklist collée au dernier
                           mini-exo. */}
                       <div ref={contentRef} className="flex flex-col gap-8">
                         {renderLessonContentWithInlineExercises(
                           currentLesson.content || "",
                           currentLesson.exercises || [],
                           currentLesson.id,
                           course.level,
                           setChecklistComplete
                         )}
                       </div>
                       {currentLesson.image_url && (
                         <img
                           src={currentLesson.image_url}
                           alt=""
                           className="max-w-full rounded-xl border border-[rgba(197,161,72,0.25)] mt-6"
                         />
                       )}
                     </>
                   )}
                </div>

                {/* Interactive mini-exercices restants (non placés en ligne dans le contenu) */}
                {!currentLesson.blocks && currentLesson.exercises && currentLesson.exercises.length > 0 && (() => {
                  const inlineIds = new Set(
                    [...(currentLesson.content || "").matchAll(/data-exercise-id="([^"]+)"/g)].map((m) => m[1])
                  );
                  const remaining = currentLesson.exercises.filter((ex) => !inlineIds.has(ex.id));
                  if (remaining.length === 0) return null;
                  return (
                    <InlineMiniExercises
                      lessonId={currentLesson.id}
                      exercises={remaining}
                      level={course.level}
                      startNumber={inlineIds.size + 1}
                    />
                  );
                })()}
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
        <div ref={caliaFloorRef} className="h-20 border-t border-[var(--greek-gold)] bg-[var(--greek-cream)]/95 backdrop-blur-sm flex items-center justify-between px-4 md:px-8 shrink-0 z-10 sticky bottom-0">
          <GlassButton
            onClick={handlePrev}
            disabled={currentChapterIndex === 0 && currentLessonIndex === 0}
            variant="ghost"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden md:inline">Leçon précédente</span>
          </GlassButton>
          
          <GlassButton
            onClick={handleNext}
            variant="navy"
            disabled={
              currentChapterIndex === chapters.length - 1 &&
              currentLessonIndex === (currentChapter?.lessons?.length || 0) - 1 &&
              !reviewMode &&
              !checklistComplete
            }
          >
            {currentChapterIndex === chapters.length - 1 && currentLessonIndex === (currentChapter?.lessons?.length || 0) - 1 ? (
              reviewMode ? (
                <>Continuer <ChevronRight className="w-5 h-5" /></>
              ) : !checklistComplete ? (
                <>Coche la checklist pour terminer <CheckCircle className="w-5 h-5" /></>
              ) : (
                <>Terminer le cours <CheckCircle className="w-5 h-5" /></>
              )
            ) : (
              <>
                <span className="hidden md:inline">Leçon suivante</span>
                <span className="md:hidden">Suivant</span>
                <ChevronRight className="w-5 h-5 transition-transform" />
              </>
            )}
          </GlassButton>
        </div>

        {/* Bulle « Demander à Calia » sur le texte surligné — pilotée par ref
           (aucun re-rendu, la sélection reste intacte). Le mousedown est
           neutralisé sur toute la bulle : cliquer ne doit pas effacer la
           sélection avant l'envoi. */}
        <div
          ref={popupRef}
          onMouseDownCapture={(e) => e.preventDefault()}
          className="fixed z-[100] items-center gap-1 p-1 rounded-full backdrop-blur-[24px] backdrop-saturate-[1.4] pointer-events-auto"
          style={{
            display: "none",
            transform: "translate(-50%, calc(-100% - 6px))",
            background: "rgba(15,30,58,0.78)",
            border: "1px solid rgba(255,255,255,0.16)",
            boxShadow: "0 10px 30px rgba(15,30,58,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <GlassButton variant="gold" size="sm" onClick={handleAskAI} className="whitespace-nowrap">
            <Sparkles className="w-4 h-4" /> Demander à Calia
          </GlassButton>
          <GlassIconButton icon={X} color="white" size="sm" onClick={hidePopup} aria-label="Fermer" />
        </div>
      </div>
    </div>
  );
}
