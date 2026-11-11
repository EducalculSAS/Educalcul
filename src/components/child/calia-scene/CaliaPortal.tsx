"use client";
 
import { createPortal } from "react-dom";
import { renderLatexInHTML } from "@/lib/katexLoader";
import Image from "next/image";
import { X, Mic, MicOff, Send, GripVertical, Pencil, Keyboard, Brush } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import DrawingCanvas from "@/components/DrawingCanvas";
import GlassButton from "@/components/ui/GlassButton";
import { type RefObject } from "react";

type CaliaPortalProps = {
  pointerRect: DOMRect | null;
  clusterRef: RefObject<HTMLDivElement | null>;
  clusterOffset: { x: number; y: number; };
  sayText: string | null;
  error: string | null;
  shownWords: number | null;
  sayTokens: string[];
  interim: string;
  speaking: boolean;
  loading: boolean;
  stop: (keepHistory?: boolean) => void;
  speechSupported: boolean;
  listening: boolean;
  stopListening: () => void;
  startListening: () => Promise<void>;
  textFallback: string;
  setTextFallback: React.Dispatch<React.SetStateAction<string>>;
  submitTextFallback: () => void;
  boardLines: string[];
  boardWriteOpen: boolean;
  boardOffset: { x: number; y: number; };
  onBoardHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onBoardHeaderPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onBoardHeaderPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  setBoardWriteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  boardInputMode: 'text' | 'draw';
  setBoardInputMode: React.Dispatch<React.SetStateAction<'text' | 'draw'>>;
  boardDraft: string;
  setBoardDraft: React.Dispatch<React.SetStateAction<string>>;
  submitBoardWrite: () => Promise<void>;
  setBoardDrawing: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function CaliaPortal(props: CaliaPortalProps) {
  const { pointerRect, clusterRef, clusterOffset, sayText, error, shownWords, sayTokens, interim, speaking, loading, stop, speechSupported, listening, stopListening, startListening, textFallback, setTextFallback, submitTextFallback, boardLines, boardWriteOpen, boardOffset, onBoardHeaderPointerDown, onBoardHeaderPointerMove, onBoardHeaderPointerUp, setBoardWriteOpen, boardInputMode, setBoardInputMode, boardDraft, setBoardDraft, submitBoardWrite, setBoardDrawing } = props;
  return (
    createPortal(
    <>
      {/* Rendu via portal sur document.body : CourseViewer est monté à
          l'intérieur du conteneur plein écran `fixed z-50` de
          CourseDetailClient, qui contraint la pile d'empilement de tout
          descendant `position:fixed` malgré un z-index plus élevé. */}
      {pointerRect && (
        <div
          className="fixed z-[70] pointer-events-none"
          style={{
            left: pointerRect.left - 22,
            top: pointerRect.top + Math.min(pointerRect.height / 2, 24) - 8,
            transition: "left 0.35s ease, top 0.35s ease",
          }}
        >
          <div className="w-4 h-4 rounded-full animate-ping absolute" style={{ background: "var(--greek-gold)", opacity: 0.6 }} />
          <div className="w-4 h-4 rounded-full" style={{ background: "var(--greek-gold)" }} />
        </div>
      )}
  
      {/* Avatar + bulle — même emplacement que le bouton AITutor
          (bas-droite), masqué pendant cette session (AITutorContext). */}
      <div
        ref={clusterRef}
        className="calia-dock fixed right-4 z-[70] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]"
        style={{ transform: `translate(${clusterOffset.x}px, ${clusterOffset.y}px)`, transition: "transform 0.9s cubic-bezier(0.34, 1.3, 0.64, 1)" }}
      >
        {(sayText || error) && (
          <div
            className={`${error ? "" : "calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4]"} rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-[min(18rem,calc(100vw-2rem))] max-h-[32vh] overflow-y-auto`}
            style={error ? { background: "rgba(254,242,242,0.85)", color: "#b91c1c", border: "1px solid rgba(254,202,202,0.9)", boxShadow: "0 10px 28px rgba(185,28,28,0.15)", backdropFilter: "blur(24px) saturate(1.3)" } : { color: "#fff" }}
          >
            {error ? error : <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(sayText || "") }} style={shownWords === null ? undefined : { display: "none" }} />}
            {!error && shownWords !== null && sayTokens.slice(0, shownWords).map((t, i) => (
              <span key={i} className="calia-word" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(t) }} />
            ))}
          </div>
        )}
        {interim && (
          <div className="calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] rounded-2xl px-4 py-2 text-sm italic max-w-[min(18rem,calc(100vw-2rem))]" style={{ color: "rgba(240,237,232,0.85)" }}>
            {interim}…
          </div>
        )}
  
        <div className="flex items-center gap-2">
          <div
            className="relative shrink-0 calia-alive"
            style={{
              animation: speaking ? "calia-speak-pulse 0.6s ease-in-out infinite" : undefined,
              transition: "transform 0.3s ease",
            }}
          >
            <div
              className="calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center"
            >
              {loading ? (
                <span className="flex gap-1 items-center">
                  {[0, 1, 2].map((j) => (
                    <span key={j} className="w-1.5 h-1.5 rounded-full animate-typing-dot" style={{ background: "var(--greek-gold)", animationDelay: `${j * 150}ms` }} />
                  ))}
                </span>
              ) : (
                <Image src="/logoAI.png" alt="Calia" width={30} height={30} className="object-contain" />
              )}
            </div>
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Fermer Calia en classe"
              className="calia-glass backdrop-blur-xl absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
  
          {speechSupported && (
            <GlassIconButton
              icon={listening ? Mic : MicOff}
              color={listening ? "red" : "gold"}
              aria-label={listening ? "Arrêter d'écouter" : "Parler à Calia"}
              onClick={listening ? stopListening : startListening}
            />
          )}
        </div>
  
        {!speechSupported && (
          <div className="calia-glass-light backdrop-blur-[32px] backdrop-saturate-[1.4] flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 max-w-full">
            <input
              value={textFallback}
              onChange={(e) => setTextFallback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTextFallback()}
              placeholder="Ton navigateur ne supporte pas la voix, écris ici"
              className="text-sm outline-none bg-transparent w-44 sm:w-56 min-w-0"
              disabled={loading}
            />
            <GlassIconButton icon={Send} color="navy" size="sm" aria-label="Envoyer" onClick={submitTextFallback} disabled={loading} />
          </div>
        )}
      </div>
  
      {(boardLines.length > 0 || boardWriteOpen) && (
        <div
          className="fixed z-[65] top-16 left-2 right-2 md:top-20 md:right-4 md:left-auto md:w-80"
          style={{ transform: `translate(${boardOffset.x}px, ${boardOffset.y}px)` }}
        >
        <div className="calia-glass calia-glass-board backdrop-blur-[32px] backdrop-saturate-[1.4] rounded-3xl overflow-hidden">
          <div
            onPointerDown={onBoardHeaderPointerDown}
            onPointerMove={onBoardHeaderPointerMove}
            onPointerUp={onBoardHeaderPointerUp}
            onPointerCancel={onBoardHeaderPointerUp}
            className="flex items-center justify-between px-3 py-1.5 select-none"
            style={{ borderBottom: "1px solid rgba(238,242,236,0.1)", touchAction: "none", cursor: "grab" }}
          >
            <div className="flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5" style={{ color: "rgba(238,242,236,0.35)" }} />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "#dcb85f" }}>Tableau</span>
            </div>
            <button
              type="button"
              onClick={() => setBoardWriteOpen((v) => !v)}
              aria-label={boardWriteOpen ? "Fermer l'écriture" : "Écrire au tableau"}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: boardWriteOpen ? "var(--greek-gold)" : "rgba(238,242,236,0.5)" }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
  
          <div className="px-4 py-3 space-y-1.5 max-h-[40vh] overflow-y-auto" style={{ color: "#eef2ec" }}>
            {boardLines.map((html, i) => (
              <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </div>
  
          {boardWriteOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: "1px solid rgba(238,242,236,0.08)" }}>
              <GlassSegmentedControl
                size="sm"
                value={boardInputMode}
                onChange={(id) => setBoardInputMode(id as "text" | "draw")}
                options={[
                  { id: "text", label: (<span className="flex items-center gap-1"><Keyboard className="w-3 h-3" /> Clavier</span>) },
                  { id: "draw", label: (<span className="flex items-center gap-1"><Brush className="w-3 h-3" /> Dessin</span>) },
                ]}
              />
              {boardInputMode === "text" ? (
                <input
                  value={boardDraft}
                  onChange={(e) => setBoardDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitBoardWrite()}
                  placeholder="ex: x^2+3x-2 ou \frac{1}{2}"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#eef2ec" }}
                />
              ) : (
                <DrawingCanvas onChange={setBoardDrawing} disabled={false} />
              )}
              <GlassButton onClick={submitBoardWrite} variant="gold" size="sm" fullWidth>
                Envoyer au tableau
              </GlassButton>
            </div>
          )}
        </div>
        </div>
      )}
    </>,
    document.body
  )
  );
}
