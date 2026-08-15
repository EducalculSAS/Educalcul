/** Sépare les classes Tailwind de positionnement (fixed/absolute/sticky,
 * inset/top/right/bottom/left, z-index) du reste d'un className.
 *
 * GlassButton/GlassIconButton animent un <span> englobant (transform), qui
 * doit rester à l'écart de l'élément portant `backdrop-blur` — bug WebKit
 * connu, voir leurs commentaires. Mais poser `fixed top-3 left-4` sur
 * l'élément INTERNE pendant que le <span> externe reçoit un `transform` casse
 * son ancrage : un ancêtre transformé devient le containing block de tout
 * descendant `position: fixed`/`absolute`, donc ce bouton se
 * "téléporte" ailleurs dans le flux de page dès que le survol anime le
 * <span>. Les classes de position doivent vivre sur le <span> lui-même
 * (qui n'a pas de containing block invalidé, transform ou pas) ; l'élément
 * interne n'a plus besoin d'être positionné, il suit son parent normalement.
 */
export function splitPositionClasses(className: string): { position: string; rest: string } {
  const POSITION_RE = /^(fixed|absolute|sticky|relative|static|inset-|inset-x-|inset-y-|top-|right-|bottom-|left-|z-)/;
  const tokens = className.split(/\s+/).filter(Boolean);
  const position: string[] = [];
  const rest: string[] = [];
  for (const token of tokens) {
    // Gère les préfixes responsive/état (lg:hidden, hover:..., etc.) en ne
    // testant que la partie après le dernier ':'.
    const bare = token.slice(token.lastIndexOf(":") + 1);
    (POSITION_RE.test(bare) ? position : rest).push(token);
  }
  return { position: position.join(" "), rest: rest.join(" ") };
}
