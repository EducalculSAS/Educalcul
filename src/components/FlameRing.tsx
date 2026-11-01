/**
 * Couronne de feu du cadre « Flamme » : UNE grande flamme qui fait le tour du cadre (comme sur l'image de référence), pas une collection
 * de petites flammes. C'est un seul contour fermé à grosses langues arrondies — hautes et dressées en haut, penchées vers le haut sur les
 * côtés, courtes sous le cadre — dessiné en trois couches (rouge-orange à contour sombre, orange-jaune, cœur jaune clair) avec un trou
 * pour l'avatar, plus quelques reflets blancs et des braises. Les langues ondulent doucement (animation SMIL de la forme).
 * Composant sans état, à placer DERRIÈRE le cadre dans le repère 100 × 100 de l'avatar. `w` = épaisseur du cadre, `r` = rayon du cadre.
 */
import { pointAt } from "@/lib/ringPath";

const N = 12; // nombre de grosses langues

/** Contour fermé de la flamme (langues + trou), `k` = amplitude des hauteurs (0–1), `v` = variante de forme pour l'animation. */
function flamePath(w: number, r: number, k: number, v: number): string {
  const f = (n: number) => n.toFixed(1);
  const rOut = r + w / 2;
  const inset = w * 0.35;
  const E = Array.from({ length: N + 1 }, (_, i) => pointAt(i / N, inset, rOut));
  const jit = (i: number, s: number) => 1 + Math.sin(i * 2.3 + v * 1.7 + s) * 0.16;
  let d = `M${f(E[0].x)} ${f(E[0].y)}`;
  for (let i = 0; i < N; i++) {
    const a = E[i], z = E[i + 1], c = pointAt((i + 0.5) / N, inset, rOut);
    const tx = -c.ny, ty = c.nx; // tangente (sens horaire)
    const span = Math.hypot(z.x - a.x, z.y - a.y) * 1.08;
    const upness = Math.max(0, -c.ny); // 1 en haut
    const bottom = c.ny > 0.4;
    const h = (bottom ? 12 : 17 + upness * 24) * k * jit(i, 0);
    const lean = (-ty) * span * (bottom ? 0.05 : 0.34) * jit(i, 1) + (upness > 0.8 ? (i % 2 ? 2.5 : -2.5) : 0);
    const tip = { x: c.x + c.nx * h + tx * lean, y: c.y + c.ny * h + ty * lean };
    // flanc de départ bombé, flanc d'arrivée plus droit : la langue s'enroule vers sa pointe comme une vraie flamme dessinée
    d += ` C${f(a.x + a.nx * h * 0.95 - tx * span * 0.12)} ${f(a.y + a.ny * h * 0.95 - ty * span * 0.12)} ${f(tip.x - tx * span * 0.3 - c.nx * h * 0.1)} ${f(tip.y - ty * span * 0.3 - c.ny * h * 0.1)} ${f(tip.x)} ${f(tip.y)}`;
    d += ` C${f(tip.x + tx * span * 0.08 + c.nx * h * 0.02)} ${f(tip.y + ty * span * 0.08)} ${f(z.x + z.nx * h * 0.45 + tx * span * 0.05)} ${f(z.y + z.ny * h * 0.45 + ty * span * 0.05)} ${f(z.x)} ${f(z.y)}`;
  }
  d += "Z";
  const m = 72;
  for (let j = 0; j <= m; j++) { const q = pointAt(1 - j / m, w * 0.55, rOut - w * 0.2); d += `${j ? "L" : " M"}${f(q.x)} ${f(q.y)}`; }
  return d + "Z";
}

export default function FlameRing({ w, r }: { w: number; r: number }) {
  const anim = (k: number, fill: string, extra?: { stroke: string; sw: number }) => {
    const vals = [0, 1, 2, 0].map((v) => flamePath(w, r, k, v));
    return (
      <path fillRule="evenodd" fill={fill} stroke={extra?.stroke} strokeWidth={extra?.sw} strokeLinejoin="round" d={vals[0]}>
        <animate attributeName="d" dur="1.3s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" values={vals.join(";")} />
      </path>
    );
  };
  return (
    <g className="rf-fire">
      <defs>
        <linearGradient id="fr-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a00" /><stop offset="1" stopColor="#e63a00" /></linearGradient>
        <linearGradient id="fr-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb21a" /><stop offset="1" stopColor="#ff7a00" /></linearGradient>
        <linearGradient id="fr-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff07a" /><stop offset="1" stopColor="#ffc928" /></linearGradient>
      </defs>
      {anim(1, "url(#fr-o)", { stroke: "#9c2a00", sw: 1.6 })}
      {anim(0.72, "url(#fr-m)")}
      {anim(0.42, "url(#fr-c)")}
      {([[50, -6, 1], [22, 0, 0.8], [80, 0, 0.8], [3, 40, 0.7], [97, 38, 0.7]] as const).map(([x, y, s], i) => (
        <path key={i} className="rf-twinkle" style={{ animationDelay: `${-i * 0.35}s` }} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z" fill="#fffbe0" />
      ))}
      {[24, 42, 60, 78].map((x, i) => <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.5}s` }} cx={x} cy={-8} r={1.1} fill="#ffd23f" />)}
    </g>
  );
}
