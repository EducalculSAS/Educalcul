import { useEffect } from "react";

function isScrollable(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  return (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    el.scrollHeight > el.clientHeight;
}

/** Finds the innermost scrollable element whose bounding box contains (x, y). */
function findScrollableAt(x: number, y: number): Element | null {
  const candidates = document.querySelectorAll<HTMLElement>("*");
  let best: Element | null = null;
  let bestArea = Infinity;
  candidates.forEach((el) => {
    if (!isScrollable(el)) return;
    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const area = rect.width * rect.height;
      if (area < bestArea) {
        bestArea = area;
        best = el;
      }
    }
  });
  return best;
}

/**
 * Auto-scrolls the relevant scrollable container (or window) when dragging (HTML5 DnD)
 * near the top/bottom edge of that container's viewport.
 * Native drag-and-drop doesn't trigger normal scroll, so we listen to dragover on the document.
 */
export function useDragAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const EDGE = 80;
    const SPEED = 20;
    let frame: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const tick = () => {
      const x = lastX;
      const y = lastY;
      const scrollable = findScrollableAt(x, y);

      if (scrollable) {
        const rect = scrollable.getBoundingClientRect();
        if (y < rect.top + EDGE) {
          scrollable.scrollBy({ top: -SPEED });
        } else if (y > rect.bottom - EDGE) {
          scrollable.scrollBy({ top: SPEED });
        }
      } else {
        if (y < EDGE) {
          window.scrollBy({ top: -SPEED });
        } else if (y > window.innerHeight - EDGE) {
          window.scrollBy({ top: SPEED });
        }
      }

      frame = requestAnimationFrame(tick);
    };

    const onDragOver = (e: DragEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };

    document.addEventListener("dragover", onDragOver);
    frame = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [active]);
}
