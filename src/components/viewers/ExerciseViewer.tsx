"use client";

import AnswerFeedback from "@/components/viewers/AnswerFeedback";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, RotateCcw, Trophy, Brain, Image as ImageIcon, Loader2, Sparkles, Pencil, Keyboard, Eye, AlertTriangle } from "lucide-react";
import { Page, Block } from "@/components/admin/ExerciseBuilder";
import FigureInputs from "@/components/viewers/FigureInputs";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import MathInput, { MathInputHandle, subscribeMathKeyboardVisibility } from "@/components/MathInput";
import DrawingCanvas from "@/components/DrawingCanvas";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import "katex/dist/katex.min.css";
import { passThreshold } from "@/lib/scorePercent";

// Mélange déterministe (seedé par une chaîne) pour que l'ordre affiché aux
// élèves (association / mise en ordre) reste stable entre deux rendus tant
// que l'exercice n'a pas changé, sans avoir à le persister séparément.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Zone commentaire + édition de réponse affichée sous une question, en revue
 * admin uniquement (`adminMode` fourni par le parent). Composant local pour
 * ne pas alourdir l'état déjà volumineux d'ExerciseViewer — gère juste ses
 * deux champs (textarea) et délègue la sauvegarde au parent. */
export function AdminAttemptControls({
  itemKey,
  currentAnswer,
  existingComment,
  existingEditedAnswer,
  adminMode,
}: {
  itemKey: string;
  currentAnswer: any;
  existingComment?: string;
  existingEditedAnswer?: any;
  adminMode: { onComment: (key: string, text: string) => void; onEditAnswer: (key: string, value: any) => void; saving?: boolean };
}) {
  const [comment, setComment] = useState(existingComment || "");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(() =>
    JSON.stringify(existingEditedAnswer !== undefined ? existingEditedAnswer : currentAnswer, null, 2)
  );

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-purple-200 space-y-2">
      <div className="flex items-center gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Laisser un commentaire pour l'élève sur cette question..."
          className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
          rows={2}
        />
        <GlassButton size="sm" variant="outline" onClick={() => adminMode.onComment(itemKey, comment)} disabled={adminMode.saving}>
          Enregistrer
        </GlassButton>
      </div>
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-purple-600 hover:underline">
          Modifier la réponse enregistrée
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full text-xs font-mono border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
            rows={2}
          />
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  adminMode.onEditAnswer(itemKey, JSON.parse(editValue));
                  setEditing(false);
                } catch {
                  // JSON invalide — on laisse le champ ouvert pour correction.
                }
              }}
              disabled={adminMode.saving}
            >
              Enregistrer la correction
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}



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
    course_id?: string | number | null;
    courses?: { title?: string; subject?: string; level?: string } | null;
    min_score_percent?: number | null;
    time_limit_minutes?: number | null;
  };
  onComplete?: (score: number, totalPoints: number) => void;
  onBack?: () => void;
  reviewMode?: boolean;
  /** Force le démarrage d'une nouvelle tentative (ignore la progression précédemment terminée) */
  forceNewAttempt?: boolean;
  /** Meilleur score (%) déjà obtenu lors de tentatives précédentes */
  bestScorePercent?: number;
  /** Ouvre directement la correction (revue détaillée) au lieu de l'écran de fin */
  openCorrection?: boolean;
  initialProgress?: {
    answers?: Record<string, any>;
    submittedBlocks?: string[];
    results?: Record<string, boolean>;
    aiFeedback?: Record<string, string>;
    revealed?: Record<string, any>;
    score?: number;
    blockModes?: Record<string, "text" | "draw">;
    /** Commentaire/réponse corrigée laissés par un admin sur cette tentative
     * (revue admin — voir /admin/users/attempt-review) : affichés en lecture
     * même hors mode admin, pour que l'élève les voie sur SA propre page de
     * correction. */
    adminComments?: Record<string, string>;
    adminEditedAnswers?: Record<string, any>;
  } | null;
  /** Présent uniquement sur l'écran de revue admin (reviewMode est aussi vrai
   * dans ce cas) : ajoute, sous chaque question déjà affichée en lecture
   * seule, un champ de commentaire et un bouton pour corriger la réponse
   * enregistrée de l'élève. Purement additif — sans ce prop, reviewMode se
   * comporte exactement comme avant (écran élève). */
  adminMode?: {
    onComment: (blockId: string, text: string) => void;
    onEditAnswer: (blockId: string, value: any) => void;
    saving?: boolean;
  };
}

interface OrderingToken { id: number; text: string }
interface OrderingDragState {
  bank: number[];
  slots: (number | null)[];
}
interface OrderingPointerDrag {
  tokenId: number;
  from: { type: "bank" } | { type: "slot"; index: number };
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/** Banque d'étiquettes en bas + cases à remplir en haut (comme Duolingo) pour
 * le bloc "ordering" — pas de flèches : cliquer/taper une étiquette la place
 * dans la première case vide (accessible clavier gratuitement via <button>
 * + onClick natif), ET on peut aussi la glisser librement (souris/tactile,
 * Pointer Events, pas de dépendance) vers une case précise ou vers la
 * banque pour l'y renvoyer. */
function OrderingDragList({
  shuffledItems, savedAnswer, disabled, onChange, getItemClass,
}: {
  shuffledItems: string[];
  /** Réponse déjà complète restaurée (rechargement de page) — répartit les
   * étiquettes dans leurs cases d'origine ; sinon tout part de la banque. */
  savedAnswer?: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
  getItemClass: (item: string, index: number) => string;
}) {
  const tokens = useMemo<OrderingToken[]>(
    () => shuffledItems.map((text, id) => ({ id, text })),
    [shuffledItems]
  );

  const [state, setState] = useState<OrderingDragState>(() => {
    if (!savedAnswer) return { bank: tokens.map((t) => t.id), slots: Array(tokens.length).fill(null) };
    const used = new Set<number>();
    const slots = savedAnswer.map((text) => {
      const match = tokens.find((t) => t.text === text && !used.has(t.id));
      if (!match) return null;
      used.add(match.id);
      return match.id;
    });
    return { bank: tokens.filter((t) => !used.has(t.id)).map((t) => t.id), slots };
  });
  const [drag, setDrag] = useState<OrderingPointerDrag | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bankRef = useRef<HTMLDivElement | null>(null);
  // true juste après un vrai drag (mouvement franchi le seuil) : la plupart
  // des navigateurs ne synthétisent déjà pas de "click" après un déplacement
  // significatif du pointeur, mais ce filet de sécurité évite un double
  // placement si jamais un moteur en émet un quand même.
  const justDraggedRef = useRef(false);

  const commit = (next: OrderingDragState) => {
    setState(next);
    onChange(next.slots.map((id) => (id === null ? "" : tokens[id].text)));
  };

  // Pas de functional updater ici : ces fonctions ne sont appelées que
  // depuis des handlers d'événements (jamais depuis un rendu), donc l'état
  // capturé par fermeture au dernier rendu est déjà à jour. Appeler commit
  // (qui fait setState du PARENT) depuis l'intérieur d'un updater setState
  // React déclenchait "Cannot update a component while rendering a
  // different component" (React peut ré-invoquer un updater, ex.
  // StrictMode en dev, ce qui appelait onChange deux fois pour un seul
  // geste) — constaté empiriquement en testant le clic/glisser.
  const placeInSlot = (tokenId: number, slotIndex: number) => {
    const nextSlots = [...state.slots];
    const evicted = nextSlots[slotIndex];
    const fromSlotIndex = nextSlots.indexOf(tokenId);
    if (fromSlotIndex !== -1) nextSlots[fromSlotIndex] = null;
    nextSlots[slotIndex] = tokenId;
    let nextBank = state.bank.filter((id) => id !== tokenId);
    if (evicted !== null && evicted !== tokenId) nextBank = [...nextBank, evicted];
    commit({ bank: nextBank, slots: nextSlots });
  };

  const returnToBank = (tokenId: number) => {
    const nextSlots = [...state.slots];
    const idx = nextSlots.indexOf(tokenId);
    if (idx === -1) return;
    nextSlots[idx] = null;
    commit({ bank: state.bank.includes(tokenId) ? state.bank : [...state.bank, tokenId], slots: nextSlots });
  };

  const hitTestSlot = (x: number, y: number): number | null => {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };
  const hitTestBank = (x: number, y: number): boolean => {
    const el = bankRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    tokenId: number,
    from: OrderingPointerDrag["from"]
  ) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ tokenId, from, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > 6;
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved } : d));
    setHoverSlot(moved ? hitTestSlot(e.clientX, e.clientY) : null);
  };

  const endDrag = (x: number, y: number, moved: boolean, tokenId: number) => {
    setDrag(null);
    setHoverSlot(null);
    if (!moved) return; // pas de mouvement significatif -> laisse le clic natif gérer le placement
    justDraggedRef.current = true;
    const slotIndex = hitTestSlot(x, y);
    if (slotIndex !== null) placeInSlot(tokenId, slotIndex);
    else if (hitTestBank(x, y)) returnToBank(tokenId);
    setTimeout(() => { justDraggedRef.current = false; }, 300);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    endDrag(e.clientX, e.clientY, drag.moved, drag.tokenId);
  };
  const handlePointerCancel = () => {
    setDrag(null);
    setHoverSlot(null);
  };

  const handleClick = (tokenId: number, from: OrderingPointerDrag["from"]) => {
    if (disabled) return;
    if (justDraggedRef.current) return;
    if (from.type === "bank") {
      const target = state.slots.findIndex((s) => s === null);
      if (target !== -1) placeInSlot(tokenId, target);
    } else {
      returnToBank(tokenId);
    }
  };

  const chipClassName =
    "px-3 py-2 rounded-lg border-2 border-[rgba(197,161,72,0.35)] bg-white text-sm font-medium text-gray-700 cursor-grab active:cursor-grabbing hover:border-[var(--greek-blue)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {state.slots.map((tokenId, i) => (
          <div
            key={i}
            ref={(el) => { slotRefs.current[i] = el; }}
            className={`min-w-[72px] min-h-[44px] flex items-center justify-center px-2 rounded-lg border-2 ${
              tokenId === null
                ? `border-dashed ${hoverSlot === i ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-gray-300 bg-gray-50"}`
                : `border-solid ${getItemClass(tokens[tokenId].text, i)}`
            }`}
          >
            {tokenId === null ? (
              <span className="text-xs font-bold text-gray-300">{i + 1}</span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onPointerDown={(e) => handlePointerDown(e, tokenId, { type: "slot", index: i })}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={() => handleClick(tokenId, { type: "slot", index: i })}
                style={{ touchAction: "none" }}
                className={`${chipClassName} border-0 bg-transparent hover:border-0`}
              >
                <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[tokenId].text) }} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div
        ref={bankRef}
        className={`flex flex-wrap gap-2 p-3 rounded-lg border-2 border-dashed min-h-[60px] transition-colors ${
          drag && drag.from.type === "slot" && hoverSlot === null ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]"
        }`}
      >
        {state.bank.length === 0 ? (
          <span className="text-xs text-gray-400 italic self-center">Tout est placé !</span>
        ) : (
          state.bank.map((tokenId) => (
            <button
              key={tokenId}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => handlePointerDown(e, tokenId, { type: "bank" })}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={() => handleClick(tokenId, { type: "bank" })}
              style={{ touchAction: "none" }}
              className={chipClassName}
            >
              <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[tokenId].text) }} />
            </button>
          ))
        )}
      </div>

      {drag && drag.moved && (
        <div
          style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 60 }}
          className="px-3 py-2 rounded-lg border-2 border-[var(--greek-blue)] bg-white shadow-xl text-sm font-medium"
        >
          <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[drag.tokenId].text) }} />
        </div>
      )}
    </div>
  );
}

interface MatchingPointerDrag { tokenId: number; from: { type: "bank" } | { type: "slot"; index: number }; x: number; y: number; startX: number; startY: number; moved: boolean }

/** Bloc "matching" : mêmes briques que OrderingDragList (banque + clic/glisser,
 * remplissage de la première case vide) mais les lignes ("left") restent
 * TOUJOURS à une position fixe — seul le contenu de droite ("right", en
 * banque au départ) se déplace, contrairement à "ordering" où la liste
 * entière est réordonnée. */
function MatchingDragList({
  lefts, shuffledRights, disabled, savedAnswer, onChange, getItemClass,
}: {
  lefts: string[];
  shuffledRights: string[];
  disabled: boolean;
  savedAnswer?: string[];
  onChange: (next: string[]) => void;
  getItemClass: (right: string, index: number) => string;
}) {
  const tokens = useMemo(() => shuffledRights.map((text, id) => ({ id, text })), [shuffledRights]);

  const [state, setState] = useState<{ bank: number[]; slots: (number | null)[] }>(() => {
    if (!savedAnswer) return { bank: tokens.map((t) => t.id), slots: Array(lefts.length).fill(null) };
    const used = new Set<number>();
    const slots = savedAnswer.map((text) => {
      const match = tokens.find((t) => t.text === text && !used.has(t.id));
      if (!match) return null;
      used.add(match.id);
      return match.id;
    });
    return { bank: tokens.filter((t) => !used.has(t.id)).map((t) => t.id), slots };
  });
  const [drag, setDrag] = useState<MatchingPointerDrag | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bankRef = useRef<HTMLDivElement | null>(null);
  const justDraggedRef = useRef(false);

  const commit = (next: { bank: number[]; slots: (number | null)[] }) => {
    setState(next);
    onChange(next.slots.map((id) => (id === null ? "" : tokens[id].text)));
  };
  // Voir le commentaire équivalent dans OrderingDragList : commit (setState
  // du parent) doit toujours être appelé HORS de tout updater fonctionnel
  // setState — ces fonctions ne sont appelées que depuis des handlers
  // d'événements, "state" capturé par fermeture est donc déjà à jour.
  const placeInSlot = (tokenId: number, slotIndex: number) => {
    const nextSlots = [...state.slots];
    const evicted = nextSlots[slotIndex];
    const fromSlotIndex = nextSlots.indexOf(tokenId);
    if (fromSlotIndex !== -1) nextSlots[fromSlotIndex] = null;
    nextSlots[slotIndex] = tokenId;
    let nextBank = state.bank.filter((id) => id !== tokenId);
    if (evicted !== null && evicted !== tokenId) nextBank = [...nextBank, evicted];
    commit({ bank: nextBank, slots: nextSlots });
  };
  const returnToBank = (tokenId: number) => {
    const nextSlots = [...state.slots];
    const idx = nextSlots.indexOf(tokenId);
    if (idx === -1) return;
    nextSlots[idx] = null;
    commit({ bank: state.bank.includes(tokenId) ? state.bank : [...state.bank, tokenId], slots: nextSlots });
  };

  const hitTestSlot = (x: number, y: number): number | null => {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };
  const hitTestBank = (x: number, y: number): boolean => {
    const el = bankRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, tokenId: number, from: MatchingPointerDrag["from"]) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ tokenId, from, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > 6;
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved } : d));
    setHoverSlot(moved ? hitTestSlot(e.clientX, e.clientY) : null);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const { tokenId, moved, x, y } = drag;
    setDrag(null);
    setHoverSlot(null);
    if (!moved) return;
    justDraggedRef.current = true;
    const slotIndex = hitTestSlot(x, y);
    if (slotIndex !== null) placeInSlot(tokenId, slotIndex);
    else if (hitTestBank(x, y)) returnToBank(tokenId);
    setTimeout(() => { justDraggedRef.current = false; }, 300);
  };
  const handlePointerCancel = () => { setDrag(null); setHoverSlot(null); };

  const handleClick = (tokenId: number, from: MatchingPointerDrag["from"]) => {
    if (disabled || justDraggedRef.current) return;
    if (from.type === "bank") {
      const target = state.slots.findIndex((s) => s === null);
      if (target !== -1) placeInSlot(tokenId, target);
    } else {
      returnToBank(tokenId);
    }
  };

  const chipClassName =
    "px-3 py-2 rounded-lg border-2 border-[rgba(197,161,72,0.35)] bg-white text-sm font-medium text-gray-700 cursor-grab active:cursor-grabbing hover:border-[var(--greek-blue)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {lefts.map((left, i) => {
          const tokenId = state.slots[i];
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className="flex-1 text-sm font-medium text-gray-700"
                dangerouslySetInnerHTML={{ __html: renderLatexInHTML(left) }}
              />
              <ArrowRight size={14} className="text-gray-300 shrink-0" />
              <div
                ref={(el) => { slotRefs.current[i] = el; }}
                className={`flex-1 min-h-[44px] flex items-center px-1 rounded-lg border-2 ${
                  tokenId === null
                    ? `border-dashed ${hoverSlot === i ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-gray-300 bg-gray-50"}`
                    : `border-solid ${getItemClass(tokens[tokenId].text, i)}`
                }`}
              >
                {tokenId !== null && (
                  <button
                    type="button"
                    disabled={disabled}
                    onPointerDown={(e) => handlePointerDown(e, tokenId, { type: "slot", index: i })}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={() => handleClick(tokenId, { type: "slot", index: i })}
                    style={{ touchAction: "none" }}
                    className={`${chipClassName} border-0 bg-transparent hover:border-0 w-full text-left`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[tokenId].text) }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={bankRef}
        className={`flex flex-wrap gap-2 p-3 rounded-lg border-2 border-dashed min-h-[60px] transition-colors ${
          drag && drag.from.type === "slot" && hoverSlot === null ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]"
        }`}
      >
        {state.bank.length === 0 ? (
          <span className="text-xs text-gray-400 italic self-center">Tout est associé !</span>
        ) : (
          state.bank.map((tokenId) => (
            <button
              key={tokenId}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => handlePointerDown(e, tokenId, { type: "bank" })}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={() => handleClick(tokenId, { type: "bank" })}
              style={{ touchAction: "none" }}
              className={chipClassName}
            >
              <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[tokenId].text) }} />
            </button>
          ))
        )}
      </div>

      {drag && drag.moved && (
        <div
          style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 60 }}
          className="px-3 py-2 rounded-lg border-2 border-[var(--greek-blue)] bg-white shadow-xl text-sm font-medium"
        >
          <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(tokens[drag.tokenId].text) }} />
        </div>
      )}
    </div>
  );
}

interface CategorizeDisplayItem { originalIndex: number; text: string }
interface CategorizePointerDrag { originalIndex: number; x: number; y: number; startX: number; startY: number; moved: boolean }

/** Bloc "categorize" : mêmes briques que OrderingDragList (Pointer Events,
 * clic + glisser, pas de dépendance) mais avec PLUSIEURS bacs de
 * destination au lieu de cases séquentielles — pas de "première case vide"
 * déterministe possible, donc le clic fonctionne en 2 temps : sélectionner
 * une étiquette, puis cliquer le bac visé (le glisser-déposer direct reste
 * en un seul geste). */
function CategorizeDragList({
  displayItems, categories, disabled, savedAnswer, onChange, getItemClass,
}: {
  displayItems: CategorizeDisplayItem[];
  categories: string[];
  disabled: boolean;
  /** Par originalIndex, la catégorie déjà choisie (reprise de session) */
  savedAnswer?: (string | null)[];
  /** Par originalIndex, la catégorie choisie (ou null si encore en banque) */
  onChange: (next: (string | null)[]) => void;
  getItemClass: (originalIndex: number) => string;
}) {
  const [assignment, setAssignment] = useState<Record<number, number | null>>(() => {
    const map: Record<number, number | null> = {};
    displayItems.forEach(({ originalIndex }) => {
      const savedCat = savedAnswer?.[originalIndex];
      map[originalIndex] = savedCat ? categories.indexOf(savedCat) : null;
    });
    return map;
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<CategorizePointerDrag | null>(null);
  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const binRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bankRef = useRef<HTMLDivElement | null>(null);
  const justDraggedRef = useRef(false);

  const commit = (next: Record<number, number | null>) => {
    setAssignment(next);
    // Le tableau envoyé au serveur doit être indexé par originalIndex (l'ordre
    // de "categoryItems" en base), PAS par l'ordre d'affichage mélangé de
    // "displayItems" — le serveur compare given[i] à categoryItems[i].category
    // positionnellement. Itérer sur displayItems.map(...) construirait le
    // tableau dans l'ordre mélangé et désalignerait chaque réponse dès que le
    // mélange diffère de l'ordre original (donc systématiquement en pratique).
    const out: (string | null)[] = new Array(displayItems.length).fill(null);
    displayItems.forEach(({ originalIndex }) => {
      const catIdx = next[originalIndex];
      out[originalIndex] = catIdx === null || catIdx === undefined ? null : categories[catIdx];
    });
    onChange(out);
  };
  const assignTo = (originalIndex: number, catIndex: number | null) => commit({ ...assignment, [originalIndex]: catIndex });

  const hitTestBin = (x: number, y: number): number | null => {
    for (let i = 0; i < binRefs.current.length; i++) {
      const el = binRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };
  const hitTestBank = (x: number, y: number): boolean => {
    const el = bankRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, originalIndex: number) => {
    if (disabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ originalIndex, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > 6;
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved } : d));
    setHoverBin(moved ? hitTestBin(e.clientX, e.clientY) : null);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const { originalIndex, moved, x, y } = drag;
    setDrag(null);
    setHoverBin(null);
    if (!moved) return;
    justDraggedRef.current = true;
    const binIdx = hitTestBin(x, y);
    if (binIdx !== null) assignTo(originalIndex, binIdx);
    else if (hitTestBank(x, y)) assignTo(originalIndex, null);
    setTimeout(() => { justDraggedRef.current = false; }, 300);
  };
  const handlePointerCancel = () => { setDrag(null); setHoverBin(null); };

  const handleChipClick = (e: React.MouseEvent, originalIndex: number) => {
    e.stopPropagation();
    if (disabled || justDraggedRef.current) return;
    const currentCat = assignment[originalIndex];
    if (currentCat !== null && currentCat !== undefined) {
      assignTo(originalIndex, null);
      setSelected(null);
      return;
    }
    setSelected((s) => (s === originalIndex ? null : originalIndex));
  };
  const handleBinClick = (binIndex: number) => {
    if (disabled || selected === null) return;
    assignTo(selected, binIndex);
    setSelected(null);
  };

  const renderChip = (originalIndex: number, text: string) => (
    <button
      key={originalIndex}
      type="button"
      disabled={disabled}
      onPointerDown={(e) => handlePointerDown(e, originalIndex)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => handleChipClick(e, originalIndex)}
      style={{ touchAction: "none" }}
      className={
        disabled
          ? `px-3 py-2 rounded-lg border-2 text-sm font-medium ${getItemClass(originalIndex)}`
          : `px-3 py-2 rounded-lg border-2 text-sm font-medium cursor-grab active:cursor-grabbing transition-colors ${
              selected === originalIndex
                ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/10"
                : "border-[rgba(197,161,72,0.35)] bg-white hover:border-[var(--greek-blue)]"
            }`
      }
    >
      <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(text) }} />
    </button>
  );

  const bankItems = displayItems.filter(
    ({ originalIndex }) => assignment[originalIndex] === null || assignment[originalIndex] === undefined
  );
  const draggedText = drag ? displayItems.find((d) => d.originalIndex === drag.originalIndex)?.text : undefined;

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${categories.length > 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {categories.map((cat, catIdx) => (
          <div
            key={cat}
            ref={(el) => { binRefs.current[catIdx] = el; }}
            onClick={() => handleBinClick(catIdx)}
            className={`rounded-lg border-2 border-dashed p-3 min-h-[90px] transition-colors ${
              hoverBin === catIdx ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-[rgba(197,161,72,0.3)]"
            }`}
          >
            <div className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-wide text-center mb-2">{cat}</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {displayItems
                .filter(({ originalIndex }) => assignment[originalIndex] === catIdx)
                .map(({ originalIndex, text }) => renderChip(originalIndex, text))}
            </div>
          </div>
        ))}
      </div>

      <div
        ref={bankRef}
        className={`flex flex-wrap gap-2 p-3 rounded-lg border-2 border-dashed min-h-[60px] transition-colors ${
          drag && hoverBin === null ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5" : "border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]"
        }`}
      >
        {bankItems.length === 0 ? (
          <span className="text-xs text-gray-400 italic self-center">Tout est classé !</span>
        ) : (
          bankItems.map(({ originalIndex, text }) => renderChip(originalIndex, text))
        )}
      </div>

      {drag && drag.moved && draggedText !== undefined && (
        <div
          style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 60 }}
          className="px-3 py-2 rounded-lg border-2 border-[var(--greek-blue)] bg-white shadow-xl text-sm font-medium"
        >
          <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(draggedText) }} />
        </div>
      )}
    </div>
  );
}

/** Bloc "number_line_point" : un point à glisser (ou taper directement) le
 * long d'une droite graduée, calé sur le pas fourni. Simple glisser 1D —
 * un seul élément "piste" écoute les Pointer Events. */
function NumberLinePoint({
  min, max, step, disabled, savedValue, onChange, correctness,
}: {
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  savedValue?: number | null;
  onChange: (value: number) => void;
  /** Fourni uniquement après soumission, pour afficher le repère correct. */
  correctness?: { correct: boolean; correctValue: number } | null;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState<number>(savedValue ?? min + (max - min) / 2);

  const clampToStep = (raw: number) => {
    const snapped = Math.round((raw - min) / step) * step + min;
    return Math.min(max, Math.max(min, snapped));
  };
  const valueFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return clampToStep(min + ratio * (max - min));
  };
  const commit = (v: number) => { setValue(v); onChange(v); };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    commit(valueFromClientX(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.buttons === 0) return;
    commit(valueFromClientX(e.clientX));
  };

  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t / step) * step);
  const pct = ((value - min) / (max - min)) * 100;
  const correctPct = correctness ? ((correctness.correctValue - min) / (max - min)) * 100 : null;

  return (
    <div className="py-6 px-2">
      <div
        ref={trackRef}
        className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
      >
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gray-300"
            style={{ left: `${((t - min) / (max - min)) * 100}%` }}
          />
        ))}
        {correctPct !== null && !correctness!.correct && (
          <div
            className="absolute top-1/2 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"
            style={{ left: `${correctPct}%`, transform: "translate(-50%, -50%)" }}
            title="Bonne réponse"
          />
        )}
        <div
          className={`absolute top-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg ${disabled ? "" : "cursor-grab active:cursor-grabbing"} ${
            correctness ? (correctness.correct ? "bg-green-500" : "bg-red-500") : "bg-[var(--greek-blue)]"
          }`}
          style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{min}</span>
        <span className="font-bold text-[var(--greek-blue)]">{value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function ExerciseViewer({
  exercise,
  onComplete,
  onBack,
  reviewMode,
  forceNewAttempt,
  bestScorePercent,
  openCorrection,
  initialProgress,
  adminMode,
}: ExerciseViewerProps) {
  const pages = exercise.content_json || [];
  const { pageContext, setPageContext } = useAITutor();

  // Une page = une question : le contenu est authored/généré avec plusieurs
  // blocs-question regroupés dans une seule Page (voir compiler.ts), donc on
  // aplatit tous les blocs et on les redécoupe côté client en un écran par
  // question, avec la consigne (blocs "text"/"image" en tête) sur son propre
  // écran — sur deux si elle est longue. Purement présentationnel : la
  // correction (validateAllAnswers) continue d'itérer `pages`/blocs bruts.
  const screens = useMemo(() => {
    // Un écran par PAGE authorée, pas par bloc : une page à un seul bloc est
    // une question indépendante (un écran) ; une page à plusieurs blocs est
    // un groupe de "questions liées" sur le même thème, affichées ENSEMBLE
    // sur le même écran (voir contexte du plan — l'ancien comportement
    // aplatissait tous les blocs de toutes les pages et en refaisait un écran
    // par bloc, ce qui séparait les questions liées une par une malgré leur
    // regroupement en base).
    return pages.filter((p) => p.blocks.length > 0).map((p) => ({ blocks: p.blocks }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Affichage mélangé (stable) des blocs "association" (choix de droite) et
  // "mise en ordre" (éléments à réordonner), calculé une fois par exercice.
  // Les valeurs déjà mélangées (matchingOptions/shuffledItems) viennent de
  // l'API quand la réponse correcte a été retirée (élève, avant soumission).
  // pairs/items complets ne sont présents qu'en contexte admin (builder/aperçu).
  const shuffledRightOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "matching") {
          if (b.pairs && b.pairs.every((pr) => pr.right !== undefined)) {
            map[b.id] = seededShuffle(b.pairs.map((pr) => pr.right), b.id);
          } else if (b.matchingOptions) {
            map[b.id] = b.matchingOptions;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const shuffledOrderingItems = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "ordering") {
          if (b.items) {
            map[b.id] = seededShuffle(b.items, b.id);
          } else if (b.shuffledItems) {
            map[b.id] = b.shuffledItems;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const shuffledCategorizeItems = useMemo(() => {
    const map: Record<string, { originalIndex: number; text: string }[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "categorize" && b.categoryItems) {
          const indices = b.categoryItems.map((_, i) => i);
          const shuffledIndices = seededShuffle(indices, b.id);
          map[b.id] = shuffledIndices.map((originalIndex) => ({
            originalIndex,
            text: b.categoryItems![originalIndex].text,
          }));
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Nouvelle tentative : rien à effacer localement (plus de localStorage) —
  // le prochain chargement serveur ne trouvera simplement pas de progression
  // pour cette tentative.
  useEffect(() => {
    if (!forceNewAttempt) return;
    setExerciseCompleted(false);
    setAnswers({});
    setSubmittedBlocks(new Set());
    setResults({});
    setAiFeedback({});
    setRevealed({});
    setScore(0);
    setBlockModes({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position/réponses/score : plus de repli localStorage — tout vient du
  // serveur (effet "Charge la progression..." plus bas), avec un bref flash
  // à l'état vide le temps du premier chargement.
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, any>>(() => (reviewMode ? initialProgress?.answers : undefined) || {});
  const mathfieldRefs = useRef<Record<string, MathInputHandle | null>>({});
  const [submittedBlocks, setSubmittedBlocks] = useState<Set<string>>(
    () => new Set((reviewMode ? initialProgress?.submittedBlocks : undefined) || [])
  );
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, boolean>>(() => (reviewMode ? initialProgress?.results : undefined) || {});
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>(() => (reviewMode ? initialProgress?.aiFeedback : undefined) || {});
  // Réponse correcte, révélée par le serveur uniquement après soumission de
  // chaque bloc — jamais présente dans le contenu initial envoyé à l'élève.
  const [revealed, setRevealed] = useState<Record<string, any>>(() => (reviewMode ? initialProgress?.revealed : undefined) || {});
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : undefined) || 0);
  const [exerciseCompleted, setExerciseCompleted] = useState(() => (reviewMode ? true : false));
  const [showReview, setShowReview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Correction immédiate des blocs "text_input" (même style que les
  // mini-exercices de cours) : vérifier tout de suite, réessayer, et
  // proposer la réponse après 2 échecs plutôt que de laisser retenter à
  // l'infini. Une fois résolu (correct ou révélé), la validation finale de
  // la page réutilise ce verdict au lieu de rappeler l'IA.
  interface InlineTextState {
    attempts: number;
    status: "grading" | "correct" | "wrong" | "revealed" | "unavailable";
    feedback?: string;
    resolvedScore?: number;
    resolvedCorrect?: boolean;
    revealedAnswer?: string;
  }
  const [inlineText, setInlineText] = useState<Record<string, InlineTextState>>({});

  const verifyTextBlock = async (block: any) => {
    const studentAnswer = answers[block.id];
    if (!studentAnswer) return;
    const current = inlineText[block.id];
    const attemptsSoFar = current?.attempts || 0;
    setInlineText((prev) => ({ ...prev, [block.id]: { attempts: attemptsSoFar, status: "grading" } }));
    try {
      const exerciseId = exercise.id || "preview";
      const res = await fetch(`/api/child/exercises/${exerciseId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: block.id,
          answer: studentAnswer,
          question: block.content,
          correctAnswer: block.correctAnswer,
          explanation: block.explanation,
          level: exercise.level || "6eme",
          points: block.points,
        }),
      });
      const data = await res.json();
      if (data.unavailable) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: data.feedback },
        }));
        return;
      }
      if (data.is_correct) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: {
            attempts: attemptsSoFar + 1,
            status: "correct",
            feedback: data.feedback,
            resolvedScore: data.score,
            resolvedCorrect: true,
          },
        }));
      } else {
        const attempts = attemptsSoFar + 1;
        if (attempts >= 2) {
          // 2 échecs d'affilée : on propose directement la réponse plutôt
          // que de laisser l'élève retenter indéfiniment. La bonne réponse
          // vient de data.reveal (le client n'a jamais correctAnswer avant
          // d'avoir soumis — voir le commentaire dans la route de grading).
          setInlineText((prev) => ({
            ...prev,
            [block.id]: {
              attempts,
              status: "revealed",
              feedback: data.feedback,
              resolvedScore: 0,
              resolvedCorrect: false,
              revealedAnswer:
                typeof data.reveal?.correctAnswer === "string" ? data.reveal.correctAnswer : undefined,
            },
          }));
        } else {
          setInlineText((prev) => ({
            ...prev,
            [block.id]: { attempts, status: "wrong", feedback: data.feedback },
          }));
        }
      }
    } catch {
      setInlineText((prev) => ({
        ...prev,
        [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: "Correction indisponible, réessaie." },
      }));
    }
  };
  const [blockModes, setBlockModes] = useState<Record<string, "text" | "draw">>(() => (reviewMode ? initialProgress?.blockModes : undefined) || {});
  const [adminComments] = useState<Record<string, string>>(() => initialProgress?.adminComments || {});
  const [adminEditedAnswers] = useState<Record<string, any>>(() => initialProgress?.adminEditedAnswers || {});
  // Rempli par l'effet de chargement serveur ci-dessous.
  const accumulatedSecondsRef = useRef(0);

  // Charge la progression depuis la base de données (survit à une déconnexion / changement d'appareil)
  const userIdRef = useRef<string | null>(null);
  const progressLoadedFromDbRef = useRef(false);
  useEffect(() => {
    if (reviewMode) return;
    if (!exercise.id || exercise.id === "preview") return;
    if (forceNewAttempt) {
      // Nouvelle tentative : on ne restaure pas l'état d'une session précédente
      progressLoadedFromDbRef.current = true;
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      userIdRef.current = session.user.id;

      try {
        const res = await fetch(`/api/child/exercises/${exercise.id}/progress?userId=${session.user.id}`);
        const data = await res.json();
        const p = data?.progress;
        if (p) {
          setAnswers(p.answers || {});
          setSubmittedBlocks(new Set(p.submittedBlocks || []));
          setResults(p.results || {});
          setAiFeedback(p.aiFeedback || {});
          setRevealed(p.revealed || {});
          setScore(p.score || 0);
          setExerciseCompleted(p.exerciseCompleted || data?.status === "completed" || false);
          setBlockModes(p.blockModes || {});
          accumulatedSecondsRef.current = p.timeSpent || 0;
          if (typeof p.currentPageIndex === "number") {
            setCurrentScreenIndex(Math.min(p.currentPageIndex, Math.max(0, screens.length - 1)));
          }
          if (openCorrection) {
            setExerciseCompleted(false);
            setShowReview(true);
            setCurrentScreenIndex(0);
          }
        } else if (data?.status === "completed") {
          // Le statut "completed" a été enregistré (via /api/child/activities) mais le
          // progress_json détaillé n'a jamais été persisté (ex: navigation rapide après
          // la fin de l'exercice). On marque quand même l'exercice comme terminé.
          setExerciseCompleted(true);
        }
      } catch (e) {
        console.error("Failed to load exercise progress from DB:", e);
      } finally {
        progressLoadedFromDbRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Sauvegarde la progression en base de données (debounced) — seule
  // persistance désormais (plus d'écriture localStorage en parallèle).
  const saveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reviewMode) return;
    if (!exercise.id || exercise.id === "preview") return;
    if (!progressLoadedFromDbRef.current) return; // évite d'écraser avant le chargement initial
    if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);

    const doSave = async () => {
      const userId = userIdRef.current;
      if (!userId) return;
      try {
        await fetch(`/api/child/exercises/${exercise.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            progress: {
              answers,
              submittedBlocks: Array.from(submittedBlocks),
              results,
              aiFeedback,
              revealed,
              score,
              exerciseCompleted,
              blockModes,
              currentPageIndex: currentScreenIndex,
              timeSpent: accumulatedSecondsRef.current,
            },
          }),
        });
      } catch (e) {
        console.error("Failed to save exercise progress to DB:", e);
      }
    };

    // Sauvegarde immédiate (non debounced) quand l'exercice vient d'être terminé,
    // pour ne pas perdre l'état "terminé" si l'utilisateur quitte la page tout de suite.
    if (exerciseCompleted) {
      doSave();
      return;
    }

    saveProgressTimeoutRef.current = setTimeout(doSave, 1000);
    return () => {
      if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    };
  }, [answers, submittedBlocks, results, aiFeedback, revealed, score, exerciseCompleted, blockModes, currentScreenIndex, exercise.id]);

  const currentScreen = screens[currentScreenIndex];
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Session timer — accumulé en base via progress_json.timeSpent (voir plus
  // haut), plus de localStorage.
  const sessionStartRef = useRef<number>(Date.now());
  const getAccumulatedSeconds = () => {
    if (!exercise.id || exercise.id === "preview") return 0;
    return accumulatedSecondsRef.current;
  };
  const saveTimeSpent = () => {
    if (!exercise.id || exercise.id === "preview") return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    accumulatedSecondsRef.current = total;
    sessionStartRef.current = Date.now();
    return total;
  };
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  }, []);

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

    setPageContext(newContext as any);
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
      setPageContext({
        ...pageContext,
        userAnswer: answerSummary.slice(0, 500), // Limit to 500 chars for API
      });
    }
  }, [answers, setPageContext]);

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number, scorePercent?: number, passed?: boolean) => {
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
          scorePercent,
          passed,
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



  // Tant qu'un clavier mathématique est ouvert, on ajoute de la place en bas
  // du contenu défilable — sinon une question tout en bas de la page n'a
  // nulle part où défiler pour dégager son champ de réponse au-dessus du
  // clavier fixe (même fix que CourseViewer, voir son commentaire).
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  useEffect(() => subscribeMathKeyboardVisibility(setMathKeyboardOpen), []);

  // Visibility control to prevent flicker
  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timer);
  }, [currentScreenIndex]);

  // Scroll back to top when changing page
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentScreenIndex]);

  // Rend les graphiques interactifs après affichage de la page
  useEffect(() => {
    const t = setTimeout(() => enhanceMathGraphs(document.body), 200);
    return () => clearTimeout(t);
  }, [currentScreenIndex, contentVisible]);

  const handleBlockAnswerChange = (blockId: string, value: any) => {
    if (submittedBlocks.has(blockId)) return;
    const inlineStatus = inlineText[blockId]?.status;
    if (inlineStatus === "correct" || inlineStatus === "revealed") return;
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
  };

  const validateAllAnswers = async () => {
    setIsValidating(true);
    setGradingError(null);
    let totalScore = 0;
    const newResults: Record<string, boolean> = {};
    const newAiFeedback: Record<string, string> = {};
    const newRevealed: Record<string, any> = {};
    const newSubmitted = new Set<string>();
    const exerciseId = exercise.id || "preview";

    // Toute la copie part en UNE requête (corrigée en parallèle côté
    // serveur) — avant, chaque question attendait la précédente.
    const toGrade: { block: (typeof pages)[number]["blocks"][number]; answer: unknown }[] = [];
    for (const page of pages) {
      for (const block of page.blocks) {
        if (["text", "image"].includes(block.type)) continue;
        const answer = answers[block.id];
        const points = block.points || 0;

        if (answer === undefined || answer === null) {
          newResults[block.id] = false;
          newSubmitted.add(block.id);
          continue;
        }

        // Déjà vérifié en direct via le bouton "Vérifier" du bloc
        // (text_input) : on réutilise ce verdict plutôt que de rappeler
        // l'IA une seconde fois pour la même réponse.
        const inlineResult = inlineText[block.id];
        if (block.type === "text_input" && inlineResult?.resolvedCorrect !== undefined) {
          newResults[block.id] = inlineResult.resolvedCorrect;
          newAiFeedback[block.id] = inlineResult.feedback || "";
          if (inlineResult.revealedAnswer) {
            newRevealed[block.id] = { correctAnswer: inlineResult.revealedAnswer };
          }
          newSubmitted.add(block.id);
          if (inlineResult.resolvedCorrect) totalScore += inlineResult.resolvedScore ?? points;
          continue;
        }
        toGrade.push({ block, answer });
      }
    }

    if (toGrade.length > 0) {
      // La correction se fait toujours côté serveur (à partir des données
      // enregistrées en base) : le client ne connaît jamais la réponse
      // correcte avant d'avoir soumis la sienne.
      try {
        const preview = exerciseId === "preview";
        const results = await Promise.all(
          preview
            // Aperçu admin : l'énoncé part avec chaque question (pas en base).
            ? toGrade.map(({ block, answer }) =>
                fetch(`/api/child/exercises/preview/grade`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ block_id: block.id, answer, question: block.content, correctAnswer: block.correctAnswer, explanation: block.explanation, level: exercise.level || "6eme", points: block.points }),
                }).then((r) => r.json()).then((d) => ({ ...d, block_id: block.id })),
              )
            : [
                fetch(`/api/child/exercises/${exerciseId}/grade`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items: toGrade.map(({ block, answer }) => ({ block_id: block.id, answer })) }),
                }).then(async (r) => {
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error || "Correction indisponible, réessaie.");
                  return d.results as any[];
                }),
              ],
        ).then((out) => (preview ? out : out[0]) as any[]);

        const byBlock = new Map(results.map((r: any) => [r.block_id, r]));
        if (results.some((r: any) => r?.unavailable)) {
          // Panne d'infra, pas une vraie tentative : rien n'est enregistré,
          // l'élève peut resoumettre à l'identique.
          setIsValidating(false);
          setGradingError(results.find((r: any) => r?.unavailable)?.feedback || "Correction indisponible, réessaie.");
          return;
        }
        for (const { block } of toGrade) {
          const data = byBlock.get(block.id) || {};
          const isCorrect = !!data.is_correct;
          if (data.feedback) newAiFeedback[block.id] = data.feedback;
          if (data.reveal) newRevealed[block.id] = data.reveal;
          newResults[block.id] = isCorrect;
          newSubmitted.add(block.id);
          if (isCorrect) totalScore += data.score !== undefined ? data.score : block.points || 0;
        }
      } catch (e) {
        console.error(e);
        setIsValidating(false);
        setGradingError((e as Error).message || "Correction indisponible, réessaie.");
        return;
      }
    }

    setResults(newResults);
    setAiFeedback(newAiFeedback);
    setRevealed(newRevealed);
    setSubmittedBlocks(newSubmitted);
    setScore(totalScore);
    setIsValidating(false);
    setExerciseCompleted(true);
    
    // Save completed progress dynamically (pass threshold computed post-state-set)
    const tp = (() => { let t = 0; pages.forEach(p => p.blocks.forEach(b => (t += b.points || 0))); return t; })();
    let pct: number;
    if (tp > 0) {
      pct = Math.round((totalScore / tp) * 100);
    } else {
      // Aucun block n'a de points définis : se baser sur le ratio de bonnes réponses
      // pour éviter d'afficher 100% par défaut quel que soit le résultat.
      const gradableCount = Object.keys(newResults).length;
      const correctCount = Object.values(newResults).filter(Boolean).length;
      pct = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 100;
    }
    const didPass = pct >= passThreshold(exercise.min_score_percent);
    saveProgress('completed', totalScore, pct, didPass);
    
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
    if (currentScreenIndex < screens.length - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handlePrevPage = () => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex(currentScreenIndex - 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handleRestart = () => {
    setCurrentScreenIndex(0);
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

  if (exerciseCompleted && !reviewMode) {
    let totalPoints = 0;
    pages.forEach((p) => p.blocks.forEach((b) => (totalPoints += b.points || 0)));
    const gradable = Object.keys(results).length;
    const percentage = totalPoints > 0
      ? Math.round((score / totalPoints) * 100)
      : gradable > 0 ? Math.round((Object.values(results).filter(Boolean).length / gradable) * 100) : 100;
    const timeTotal = getAccumulatedSeconds();
    const mins = Math.floor(timeTotal / 60);
    const isPreview = exercise.id === undefined || exercise.id === "preview";
    const threshold = passThreshold(exercise.min_score_percent);
    const passed = percentage >= threshold;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header */}
            <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-cream)]" : "bg-red-50"}`}>
              <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-8 text-white w-full">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                    {passed ? <><Trophy className="w-3.5 h-3.5" /> Exercice réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{exercise.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Left */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-[var(--greek-gold)]" />
                    Félicitations !
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Tu as terminé cet exercice. Consulte ta correction ci-dessous ou enchaîne avec le quiz !
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: `${score}/${totalPoints}`, sub: "points obtenus" },
                      { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                      { value: `${percentage}%`, sub: "réussite" },
                    ].map((s, i) => (
                      <div key={s.sub} className={`rounded-xl p-4 text-center border ${i === 2 ? (passed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300") : "bg-[var(--greek-cream)] border-[rgba(197,161,72,0.25)]"}`}>
                        <p className={`text-xl font-bold font-[family-name:var(--font-display)] ${i === 2 ? (passed ? "text-green-600" : "text-red-600") : "text-[var(--greek-blue)]"}`}>{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                  {typeof bestScorePercent === "number" && bestScorePercent > percentage && (
                    <p className="mt-3 text-sm text-[var(--greek-blue)] font-bold">
                      Ton meilleur score reste {bestScorePercent}%
                    </p>
                  )}
                  {threshold > 0 && (
                    <div className={`mt-4 flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-xl ${passed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {passed ? `Seuil atteint (${threshold}% requis)` : `Seuil non atteint : ${threshold}% requis, tu as eu ${percentage}%`}
                    </div>
                  )}
                </div>

                {/* Right CTA */}
                <div className="w-full md:w-80 flex-shrink-0">
                  <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                    <GlassButton
                      onClick={() => {
                        setExerciseCompleted(false);
                        setShowReview(true);
                        setCurrentScreenIndex(0);
                      }}
                      variant="navy"
                      fullWidth
                      className="font-bold text-base"
                    >
                      Voir la correction
                    </GlassButton>
                    <GlassButton href={exercise.course_id ? `/child/quiz?course=${exercise.course_id}` : "/child/quiz"} variant="navy" fullWidth className="font-bold text-base">
                      Aller aux quiz
                    </GlassButton>
                    <GlassButton href={exercise.course_id ? `/child/exercises?course=${exercise.course_id}` : "/child/exercises"} variant="outline" fullWidth className="font-bold text-base">
                      Retour aux exercices
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

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]">
      {/* Header */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] px-6 py-4 flex items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <GlassIconButton icon={ArrowLeft} onClick={() => { saveTimeSpent(); onBack(); }} color="navy" size="sm" aria-label="Retour" />
          )}
          <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">
            {exercise.title}
          </h3>
        </div>
        <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
          {/* "questions liées" (voir plan) sont les seules à produire plusieurs
              écrans de question, "Étape" communique mieux l'enchaînement que
              "Page" dans ce cas, sans rien changer au fonctionnement. */}
          {screens.length > 1 ? "Étape" : "Page"} {currentScreenIndex + 1} / {screens.length}
        </div>
      </div>

      {/* Content */}
      <div
        id="exercise-content-container"
        ref={mainScrollRef}
        className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className="max-w-3xl mx-auto space-y-8 pb-20 transition-[padding-bottom] duration-200"
          style={mathKeyboardOpen ? { paddingBottom: "380px" } : undefined}
        >
          {currentScreen.blocks.map((block) => {
            const isSubmitted = reviewMode || submittedBlocks.has(block.id);
            const answer = answers[block.id];
            const inline = inlineText[block.id];
            const inlineResolved = inline?.status === "correct" || inline?.status === "revealed";

            // Determine correctness for feedback
            const isCorrect = isSubmitted ? results[block.id] ?? false : false;

            return (
              <div
                key={block.id}
                className="bg-[var(--greek-cream)]/30 rounded-2xl overflow-hidden p-6 border border-[var(--greek-gold)]"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-lg text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                    {block.title}
                  </h4>
                  {block.points && (
                    <span className="text-xs font-bold bg-[var(--greek-gold)]/20 text-[var(--greek-bronze)] border border-[rgba(197,161,72,0.25)] px-2 py-1 rounded-full">
                      {block.points} pts
                    </span>
                  )}
                </div>

                {block.content && block.type === "image" && (
                  <div className="mb-6">
                    {block.mediaType === "video" ? (
                      <video src={block.content} controls className="max-h-96 rounded-lg border bg-black" />
                    ) : block.mediaType === "audio" ? (
                      <audio src={block.content} controls className="w-full max-w-md" />
                    ) : (
                      <img src={block.content} alt={block.title || ""} className="max-h-96 object-contain rounded-lg border bg-gray-50" />
                    )}
                  </div>
                )}

                {block.content && block.type !== "fill_in_the_blank" && block.type !== "image" && (
                  <div
                    className="prose max-w-none mb-6 text-gray-600 prose-headings:text-[var(--greek-blue)] prose-a:text-[var(--greek-blue)]"
                    dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")) }}
                  />
                )}

                {/* Interactive Elements */}
                <div className="mt-4">
                  {block.type === "text_input" && (
                    <div className="flex flex-col gap-2" data-exercise-answer-block>
                      {/* Mode Toggle */}
                      <div className="flex justify-end mb-1">
                        <GlassSegmentedControl
                          size="sm"
                          options={[
                            {
                              id: "text",
                              label: (
                                <span className="flex items-center gap-1">
                                  <Keyboard className="w-3 h-3" /> Clavier
                                </span>
                              ),
                            },
                            {
                              id: "draw",
                              label: (
                                <span className="flex items-center gap-1">
                                  <Pencil className="w-3 h-3" /> Dessin
                                </span>
                              ),
                            },
                          ]}
                          value={blockModes[block.id] || "text"}
                          onChange={(mode) =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: mode as "text" | "draw",
                            }))
                          }
                        />
                      </div>

                      {blockModes[block.id] === "draw" ? (
                        <DrawingCanvas
                          disabled={isSubmitted || inlineResolved}
                          initialData={answer}
                          onChange={(data) =>
                            handleBlockAnswerChange(block.id, data)
                          }
                        />
                      ) : (
                        <>
                          {(() => {
                            const currentVal =
                              answers[block.id] &&
                              !answers[block.id].startsWith("data:image")
                                ? answers[block.id]
                                : "";
                            return (
                              <div className="relative">
                                <MathInput
                                  ref={(el) => {
                                    mathfieldRefs.current[block.id] = el;
                                  }}
                                  value={currentVal}
                                  disabled={isSubmitted || inlineResolved}
                                  onChange={(latex) =>
                                    handleBlockAnswerChange(block.id, latex)
                                  }
                                  className={`w-full min-h-[60px] border rounded-xl focus-within:ring-2 focus-within:ring-[var(--greek-blue)] text-lg ${
                                    isSubmitted
                                      ? isCorrect
                                        ? "border-green-500 bg-green-50"
                                        : "border-red-500 bg-red-50"
                                      : inline?.status === "correct"
                                      ? "border-green-500 bg-green-50"
                                      : inline?.status === "wrong" || inline?.status === "revealed"
                                      ? "border-red-500 bg-red-50"
                                      : "border-gray-300 focus-within:border-[var(--greek-blue)]"
                                  }`}
                                  placeholder="Tapez votre réponse"
                                  ariaLabel={block.title || "Réponse mathématique"}
                                  level={exercise.level}
                                />
                                {exercise.grading_type === "ai" && !isSubmitted && (
                                  <div
                                    className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
                                    title="Correction par IA"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* Correction immédiate, même style que les mini-exercices de cours */}
                      {!isSubmitted && (
                        <>
                          {!inlineResolved && (
                            <GlassButton
                              onClick={() => verifyTextBlock(block)}
                              disabled={!answer || inline?.status === "grading"}
                              variant="navy"
                              size="sm"
                              className="self-start min-w-[150px]"
                            >
                              {inline?.status === "grading" ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Correction...</span>
                                </>
                              ) : (
                                "Vérifier"
                              )}
                            </GlassButton>
                          )}

                          {inline && ["correct", "wrong", "revealed", "unavailable"].includes(inline.status) && (
                            <AnswerFeedback
                              kind={inline.status as "correct" | "wrong" | "revealed" | "unavailable"}
                              feedback={inline.feedback}
                              correctAnswer={inline.status === "revealed" ? inline.revealedAnswer : undefined}
                              tryAgain={inline.status === "wrong"}
                            />
                          )}
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
                          if (option === revealed[block.id]?.correctAnswer)
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
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${btnClass}`}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: renderLatexInHTML(option),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(block.type === "multiple_choice" || block.type === "qcm") && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const currentSelected = Array.isArray(answer)
                          ? answer
                          : [];
                        const isSelected = currentSelected.includes(option);

                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";
                        if (isSubmitted) {
                          const revealedAnswer = revealed[block.id]?.correctAnswer;
                          const correctArr = Array.isArray(revealedAnswer)
                            ? revealedAnswer
                            : revealedAnswer !== undefined
                            ? [revealedAnswer]
                            : [];
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
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${btnClass}`}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: renderLatexInHTML(option),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "fill_in_the_blank" && block.figureSpec && (
                    <div className="text-gray-800">
                      {block.content && (
                        <div className="prose max-w-none mb-2" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(block.content) }} />
                      )}
                      <FigureInputs
                        spec={block.figureSpec}
                        values={Array.isArray(answer) ? answer : []}
                        disabled={!!isSubmitted}
                        expected={revealed[block.id]?.blanks}
                        submitted={!!isSubmitted}
                        onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      />
                    </div>
                  )}

                  {block.type === "fill_in_the_blank" && !block.figureSpec && (
                    <div className="text-lg leading-loose text-gray-800">
                      {(() => {
                        const parts = (block.content || "").split(/(\{\{\d+\}\})/g);
                        const blankAnswers: string[] = Array.isArray(answer) ? answer : [];
                        let blankIdx = -1;
                        return parts.map((part, i) => {
                          const m = part.match(/^\{\{(\d+)\}\}$/);
                          if (m) {
                            blankIdx++;
                            const idx = blankIdx;
                            const val = blankAnswers[idx] || "";
                            const expected = revealed[block.id]?.blanks?.[idx];
                            let cls = "border-gray-300 focus:border-[var(--greek-blue)]";
                            if (isSubmitted && expected !== undefined) {
                              const alts = String(expected).split("|").map((s: string) => s.trim().toLowerCase());
                              const ok = alts.includes(String(val).trim().toLowerCase());
                              cls = ok
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-red-500 bg-red-50 text-red-700";
                            }
                            return (
                              <input
                                key={i}
                                type="text"
                                disabled={isSubmitted}
                                value={val}
                                onChange={(e) => {
                                  const next = [...blankAnswers];
                                  next[idx] = e.target.value;
                                  handleBlockAnswerChange(block.id, next);
                                }}
                                className={`inline-block mx-1 w-28 text-center border-b-2 bg-transparent focus:outline-none px-1 ${cls}`}
                              />
                            );
                          }
                          return (
                            <span
                              key={i}
                              dangerouslySetInnerHTML={{ __html: renderLatexInHTML(part) }}
                            />
                          );
                        });
                      })()}
                    </div>
                  )}

                  {block.type === "matching" && (
                    <MatchingDragList
                      lefts={(block.pairs || []).map((p) => p.left)}
                      shuffledRights={shuffledRightOptions[block.id] || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? answer : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(right, i) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctRight = revealed[block.id]?.pairs?.[i]?.right;
                        return right === correctRight ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "ordering" && (
                    <OrderingDragList
                      shuffledItems={shuffledOrderingItems[block.id] || block.items || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? answer : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(item, i) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctItem = revealed[block.id]?.items?.[i];
                        return item === correctItem ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "categorize" && (
                    <CategorizeDragList
                      displayItems={shuffledCategorizeItems[block.id] || (block.categoryItems || []).map((it, i) => ({ originalIndex: i, text: it.text }))}
                      categories={block.categories || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? answer : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(originalIndex) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctCategory = revealed[block.id]?.categoryItems?.[originalIndex]?.category;
                        const given = Array.isArray(answer) ? answer[originalIndex] : undefined;
                        return given === correctCategory ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "number_line_point" && (
                    <NumberLinePoint
                      min={block.numberLineMin ?? 0}
                      max={block.numberLineMax ?? 10}
                      step={block.numberLineStep || 1}
                      disabled={!!isSubmitted}
                      savedValue={typeof answer === "number" ? answer : undefined}
                      onChange={(v) => handleBlockAnswerChange(block.id, v)}
                      correctness={
                        isSubmitted
                          ? {
                              correct: !!results[block.id],
                              correctValue: parseFloat(String(revealed[block.id]?.correctAnswer ?? answer)),
                            }
                          : null
                      }
                    />
                  )}

                  {block.type === "click_error" && (
                    <div className="space-y-2">
                      {(block.steps || []).map((step, i) => {
                        const selected = answer === i;
                        let cls = selected
                          ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5"
                          : "border-gray-200 bg-white hover:border-[var(--greek-blue)]";
                        if (isSubmitted) {
                          const correctIdx = parseInt(String(revealed[block.id]?.correctAnswer ?? ""), 10);
                          if (i === correctIdx) cls = "border-green-500 bg-green-50";
                          else if (selected) cls = "border-red-500 bg-red-50";
                          else cls = "border-gray-200 bg-white opacity-60";
                        }
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => handleBlockAnswerChange(block.id, i)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border-2 text-sm font-mono transition-colors disabled:cursor-not-allowed ${cls}`}
                          >
                            <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(step) }} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "coding" && (
                    <div className="relative">
                      <textarea
                        disabled={isSubmitted}
                        value={typeof answer === "string" ? answer : ""}
                        onChange={(e) => handleBlockAnswerChange(block.id, e.target.value)}
                        className={`w-full min-h-[140px] font-mono text-sm border rounded-lg p-3 focus:outline-none ${
                          isSubmitted
                            ? isCorrect
                              ? "border-green-500 bg-green-50"
                              : "border-red-500 bg-red-50"
                            : "border-gray-300 focus:border-[var(--greek-blue)]"
                        }`}
                        placeholder="Écris ton algorithme / code ici..."
                        spellCheck={false}
                      />
                      {exercise.grading_type === "ai" && !isSubmitted && (
                        <div
                          className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
                          title="Correction par IA"
                        >
                          <Sparkles className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === "impossible_search" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-2 rounded-lg border border-[rgba(197,161,72,0.4)] bg-[var(--greek-cream)] p-3 text-sm text-[var(--greek-bronze)]">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--greek-gold)]" />
                        <span>
                          Attention : cet énoncé n&apos;a peut-être pas de solution. Justifie ta réponse
                          plutôt que de deviner un résultat.
                        </span>
                      </div>
                      <div className="relative">
                        <textarea
                          disabled={isSubmitted}
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(e) => handleBlockAnswerChange(block.id, e.target.value)}
                          className={`w-full min-h-[100px] text-sm border rounded-lg p-3 focus:outline-none ${
                            isSubmitted
                              ? isCorrect
                                ? "border-green-500 bg-green-50"
                                : "border-red-500 bg-red-50"
                              : "border-gray-300 focus:border-[var(--greek-blue)]"
                          }`}
                          placeholder="Explique pourquoi ce problème n'a pas de solution..."
                        />
                        {exercise.grading_type === "ai" && !isSubmitted && (
                          <div
                            className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
                            title="Correction par IA"
                          >
                            <Sparkles className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback after global validation */}
                {isSubmitted && (
                  <div className="mt-4 pt-4 border-t border-[rgba(197,161,72,0.25)] flex flex-col gap-3">
                    <AnswerFeedback
                      kind={isCorrect ? "correct" : "wrong"}
                      feedback={aiFeedback[block.id]}
                      points={isCorrect ? block.points : undefined}
                      correctAnswer={!isCorrect && typeof revealed[block.id]?.correctAnswer === "string" && ["text_input", "impossible_search"].includes(block.type) ? revealed[block.id].correctAnswer : undefined}
                    />

                    {adminEditedAnswers[block.id] !== undefined && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Réponse corrigée par l'admin :</span>
                        {typeof adminEditedAnswers[block.id] === "string" ? adminEditedAnswers[block.id] : JSON.stringify(adminEditedAnswers[block.id])}
                      </div>
                    )}
                    {adminComments[block.id] && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Commentaire de l'admin :</span>
                        {adminComments[block.id]}
                      </div>
                    )}
                    {adminMode && (
                      <AdminAttemptControls
                        itemKey={block.id}
                        currentAnswer={answer}
                        existingComment={adminComments[block.id]}
                        existingEditedAnswer={adminEditedAnswers[block.id]}
                        adminMode={adminMode}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {gradingError && (
        <div
          className="mx-4 mb-3 p-3 rounded-xl flex items-start gap-2 shrink-0"
          style={{ background: "#fffbeb", color: "#92400e" }}
        >
          <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            <span className="font-semibold">Correction indisponible.</span>{" "}
            {gradingError} Tes réponses sont conservées, tu peux revalider.
          </p>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="bg-[var(--greek-cream)] border-t border-[var(--greek-gold)] p-4 flex justify-between shrink-0">
        <GlassButton
          onClick={handlePrevPage}
          disabled={currentScreenIndex === 0}
          variant="ghost"
          style={currentScreenIndex === 0 ? { opacity: 0 } : undefined}
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </GlassButton>

        {reviewMode ? (
          <GlassButton
            onClick={handleNextPage}
            disabled={currentScreenIndex >= screens.length - 1}
            variant="navy"
          >
            Suivant <ArrowRight className="w-4 h-4" />
          </GlassButton>
        ) : (
        <GlassButton
          onClick={
            showReview
              ? currentScreenIndex < screens.length - 1
                ? handleNextPage
                : openCorrection
                ? onBack || (() => {})
                : () => {
                    setShowReview(false);
                    setExerciseCompleted(true);
                    const tp = (() => { let t = 0; pages.forEach(p => p.blocks.forEach(b => (t += b.points || 0))); return t; })();
                    let pct: number;
                    if (tp > 0) {
                      pct = Math.round((score / tp) * 100);
                    } else {
                      const gradableCount = Object.keys(results).length;
                      const correctCount = Object.values(results).filter(Boolean).length;
                      pct = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 100;
                    }
                    const didPass = pct >= passThreshold(exercise.min_score_percent);
                    saveProgress('completed', score, pct, didPass);
                  }
              : currentScreenIndex < screens.length - 1
              ? handleNextPage
              : validateAllAnswers
          }
          disabled={isValidating}
          variant="navy"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Validation...
            </>
          ) : showReview ? (
            currentScreenIndex < screens.length - 1 ? (
              <>
                Suivant <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                {openCorrection ? "Fermer" : "Terminer l'exercice"} <CheckCircle className="w-4 h-4" />
              </>
            )
          ) : currentScreenIndex < screens.length - 1 ? (
            <>
              Suivant <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Valider et Terminer <CheckCircle className="w-4 h-4" />
            </>
          )}
        </GlassButton>
        )}
      </div>
    </div>
  );
}
