"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Wand2, X, ArrowRight } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";
import { getMyProfile } from "@/lib/updateMyProfile";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { compileCourseBlock } from "@/lib/ai/compiler";
import { CALIA_SCENE_SCRIPT, type SceneBeat } from "./caliaSceneScript";

const HIGHLIGHT_CLASS = "calia-scene-highlight";

function targetElement(root: HTMLElement | null, selector: string, nth = 0): HTMLElement | null {
  if (!root) return null;
  const matches = root.querySelectorAll<HTMLElement>(selector);
  return matches[nth] ?? null;
}

export default function CaliaSceneDemo({
  contentRef,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  // Gate admin-only pour l'instant (P0) — retirer cette condition (et
  // isAdmin) pour ouvrir la démo à tous une fois le ressenti validé.
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [beatIndex, setBeatIndex] = useState(0);
  const [sayText, setSayText] = useState<string | null>(null);
  const [pointerRect, setPointerRect] = useState<DOMRect | null>(null);
  const [boardLines, setBoardLines] = useState<string[]>([]);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [mounted, setMounted] = useState(false);

  const highlightedElRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getMyProfile<{ role?: string }>().then((profile) => {
      if (profile?.role === "admin") setIsAdmin(true);
    });
  }, []);

  const clearHighlight = () => {
    highlightedElRef.current?.classList.remove(HIGHLIGHT_CLASS);
    highlightedElRef.current = null;
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    clearHighlight();
    setIsRunning(false);
    setBeatIndex(0);
    setSayText(null);
    setPointerRect(null);
    setBoardLines([]);
    setWaitingForContinue(false);
  };

  const start = () => {
    setIsRunning(true);
    setBeatIndex(0);
    setBoardLines([]);
  };

  // Runner : joue les beats dans l'ordre. S'arrête sur await_continue jusqu'au
  // clic du bouton "Continuer".
  useEffect(() => {
    if (!isRunning) return;
    if (beatIndex >= CALIA_SCENE_SCRIPT.length) {
      timerRef.current = setTimeout(() => reset(), 1800);
      return;
    }

    const beat: SceneBeat = CALIA_SCENE_SCRIPT[beatIndex];
    const root = contentRef.current;

    const advance = (delay: number) => {
      timerRef.current = setTimeout(() => setBeatIndex((i) => i + 1), delay);
    };

    switch (beat.kind) {
      case "say":
        setSayText(beat.text);
        advance(beat.ms ?? 2000);
        break;

      case "scroll_to": {
        const el = targetElement(root, beat.selector, beat.nth);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        advance(600);
        break;
      }

      case "highlight": {
        clearHighlight();
        const el = targetElement(root, beat.selector, beat.nth);
        if (el) {
          el.classList.add(HIGHLIGHT_CLASS);
          highlightedElRef.current = el;
        }
        advance(200);
        break;
      }

      case "point_at": {
        const el = targetElement(root, beat.selector, beat.nth);
        setPointerRect(el ? el.getBoundingClientRect() : null);
        advance(200);
        break;
      }

      case "board_write": {
        const html = renderLatexInHTML(compileCourseBlock(beat.block, [], new Set()));
        setBoardLines((lines) => [...lines, html]);
        advance(300);
        break;
      }

      case "await_continue":
        setWaitingForContinue(true);
        break;
    }

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, beatIndex]);

  useEffect(() => () => { clearTimeout(timerRef.current); clearHighlight(); }, []);

  const handleContinue = () => {
    setWaitingForContinue(false);
    setBeatIndex((i) => i + 1);
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* Halo de surlignage — scoppé à cette démo, pas une classe globale */}
      <style jsx global>{`
        .${HIGHLIGHT_CLASS} {
          outline: 3px solid var(--greek-gold);
          outline-offset: 4px;
          border-radius: 6px;
          transition: outline-color 0.3s ease;
        }
      `}</style>

      {/* Bouton de lancement — barre d'outils de la leçon */}
      <GlassIconButton
        icon={Wand2}
        color="gold"
        size="sm"
        aria-label={isRunning ? "Arrêter la démo Calia" : "Essayer Calia (démo admin)"}
        onClick={isRunning ? reset : start}
      />

      {isRunning && mounted && createPortal(
        <>
          {/* Rendu via portal directement sur document.body : ce composant est
              monté profondément dans CourseViewer, lui-même à l'intérieur du
              conteneur plein écran `fixed z-50` de CourseDetailClient — un
              `position:fixed` imbriqué reste contraint par le contexte
              d'empilement de cet ancêtre `position:fixed` malgré un z-index
              plus élevé. Le portail sort l'overlay de cette arborescence,
              comme AITutor.tsx qui échappe au même problème en étant monté
              au niveau du layout plutôt que dans la leçon. */}
          {/* Bâton / pointeur */}
          {pointerRect && (
            <div
              className="fixed z-[70] pointer-events-none"
              style={{
                left: pointerRect.left + pointerRect.width / 2 - 8,
                top: pointerRect.top - 10,
                transition: "left 0.5s ease, top 0.5s ease",
              }}
            >
              <div className="w-4 h-4 rounded-full animate-ping absolute" style={{ background: "var(--greek-gold)", opacity: 0.6 }} />
              <div className="w-4 h-4 rounded-full" style={{ background: "var(--greek-gold)" }} />
            </div>
          )}

          {/* Avatar + bulle — bas-gauche pour ne pas empiler avec AITutor (bas-droite) */}
          <div className="fixed bottom-4 left-4 z-[70] flex items-end gap-3 max-w-[calc(100vw-2rem)]">
            <div className="relative shrink-0">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: "var(--greek-blue)", border: "2px solid var(--greek-gold)" }}
              >
                <Image src="/logoAI.png" alt="Calia" width={30} height={30} className="object-contain" />
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Fermer la démo Calia"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--greek-blue)" }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {sayText && (
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-lg text-sm max-w-[18rem]"
                style={{ background: "var(--greek-blue)", color: "#fff" }}
              >
                {sayText}
              </div>
            )}
          </div>

          {waitingForContinue && (
            <div className="fixed bottom-24 left-4 z-[70]">
              <GlassButton onClick={handleContinue} variant="gold" size="sm">
                Continuer <ArrowRight className="w-3.5 h-3.5" />
              </GlassButton>
            </div>
          )}

          {/* Tableau — panneau à droite sur desktop, en haut sur mobile */}
          {boardLines.length > 0 && (
            <div
              className="fixed z-[65] rounded-xl shadow-2xl overflow-hidden top-16 left-2 right-2 md:top-20 md:right-4 md:left-auto md:w-72"
              style={{ background: "#2a323a", border: "1px solid rgba(238,242,236,0.15)" }}
            >
              <div
                className="px-3 py-1.5 text-[10px] uppercase tracking-widest"
                style={{ color: "#dcb85f", borderBottom: "1px solid rgba(238,242,236,0.1)" }}
              >
                Tableau
              </div>
              <div className="px-4 py-3 space-y-1.5" style={{ color: "#eef2ec" }}>
                {boardLines.map((html, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
                ))}
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
