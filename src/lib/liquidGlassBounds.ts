/** Empêche l'effet magnétique (translate/scale au survol) des boutons "verre
 * liquide" de pousser le bouton hors de son cadre visuel — par défaut la
 * fenêtre (jamais un bouton à moitié hors écran en rétrécissant la fenêtre,
 * jamais un bouton "qui disparaît" en bord d'écran quand le curseur
 * s'approche), ou un conteneur plus strict (ex. une modale) si l'élément
 * `data-glass-bounds` le plus proche en a un.
 *
 * Le survol pousse le bouton de `tx`/`ty` et l'agrandit de `scale` autour de
 * `originX`/`originY` (0..1, fraction de la largeur/hauteur du bouton) : on
 * calcule la boîte résultante et on réduit tx/ty juste assez pour qu'elle
 * reste entièrement dans les bornes — jamais en resserrant scale (on
 * préfère un bouton moins "tiré" plutôt qu'un bouton qui rétrécit au survol).
 */
export function clampGlassTranslate(
  el: HTMLElement,
  rect: DOMRect,
  tx: number,
  ty: number,
  scaleX: number,
  scaleY: number,
  originXFrac: number,
  originYFrac: number,
): { tx: number; ty: number } {
  const bounds = getGlassBounds(el);
  if (!bounds) return { tx, ty };

  const originX = rect.left + rect.width * originXFrac;
  const originY = rect.top + rect.height * originYFrac;

  // Boîte du bouton après scale autour de l'origine, avant translate.
  const scaledLeft = originX - (originX - rect.left) * scaleX;
  const scaledRight = originX + (rect.right - originX) * scaleX;
  const scaledTop = originY - (originY - rect.top) * scaleY;
  const scaledBottom = originY + (rect.bottom - originY) * scaleY;

  let clampedTx = tx;
  let clampedTy = ty;

  const overflowLeft = bounds.left - (scaledLeft + tx);
  if (overflowLeft > 0) clampedTx += overflowLeft;
  const overflowRight = scaledRight + clampedTx - bounds.right;
  if (overflowRight > 0) clampedTx -= overflowRight;

  const overflowTop = bounds.top - (scaledTop + ty);
  if (overflowTop > 0) clampedTy += overflowTop;
  const overflowBottom = scaledBottom + clampedTy - bounds.bottom;
  if (overflowBottom > 0) clampedTy -= overflowBottom;

  return { tx: clampedTx, ty: clampedTy };
}

function getGlassBounds(el: HTMLElement): { left: number; top: number; right: number; bottom: number } | null {
  const container = el.closest("[data-glass-bounds]");
  if (container) {
    const r = container.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  if (typeof window === "undefined") return null;
  return {
    left: 0,
    top: 0,
    right: document.documentElement.clientWidth,
    bottom: window.innerHeight,
  };
}
