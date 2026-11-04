import { useRef, useState } from "react";

/**
 * État du tableau de Calia : lignes écrites (par elle ou par l'élève), saisie en cours (texte ou dessin) et position
 * du tableau, que l'élève peut déplacer par son bandeau — une fois déplacé, il y reste.
 */
export function useCaliaBoard() {
  const [boardLines, setBoardLines] = useState<string[]>([]);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardWriteOpen, setBoardWriteOpen] = useState(false);
  const [boardInputMode, setBoardInputMode] = useState<"text" | "draw">("text");
  const [boardDraft, setBoardDraft] = useState("");
  const [boardDrawing, setBoardDrawing] = useState<string | null>(null);
  const boardDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  /** Remet le tableau à zéro (fin de séance) : lignes, position, saisie. */
  const resetBoard = () => {
    setBoardLines([]);
    setBoardOffset({ x: 0, y: 0 });
    setBoardWriteOpen(false);
    setBoardDraft("");
    setBoardDrawing(null);
  };

  const onBoardHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    boardDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: boardOffset.x, baseY: boardOffset.y };
  };
  const onBoardHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = boardDragRef.current;
    if (!drag) return;
    setBoardOffset({ x: drag.baseX + (e.clientX - drag.startX), y: drag.baseY + (e.clientY - drag.startY) });
  };
  const onBoardHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    boardDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return {
    boardLines, setBoardLines, boardOffset, boardWriteOpen, setBoardWriteOpen, boardInputMode, setBoardInputMode,
    boardDraft, setBoardDraft, boardDrawing, setBoardDrawing, resetBoard,
    onBoardHeaderPointerDown, onBoardHeaderPointerMove, onBoardHeaderPointerUp,
  };
}
