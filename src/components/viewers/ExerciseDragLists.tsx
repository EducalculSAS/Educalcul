"use client";
import { useState, useRef, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { renderLatexInHTML } from "@/lib/katexLoader";
import "katex/dist/katex.min.css";

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
export function OrderingDragList({
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
export function MatchingDragList({
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
  const handlePointerUp = (_e: React.PointerEvent<HTMLButtonElement>) => {
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
export function CategorizeDragList({
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
  const handlePointerUp = (_e: React.PointerEvent<HTMLButtonElement>) => {
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
export function NumberLinePoint({
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

