/**
 * Cadre « Flamme » : un anneau de feu à la place du cadre — une bande de flamme continue autour de l'avatar, dont la bordure
 * extérieure se lève en grandes langues pointues et recourbées (une grande langue au centre du dessus, des langues qui s'enroulent
 * vers le haut sur les côtés, de petites flammes sous l'anneau), dessinée en trois couches comme sur l'image de référence :
 * rouge-orange à fin contour sombre, orange, puis un cœur jaune clair collé à l'avatar avec des reflets blancs qui suivent l'anneau.
 * Les langues ondulent (animation SMIL de la forme). Composant sans état, dans le repère 100 × 100 de l'avatar :
 * `w` = épaisseur du cadre, `r` = rayon du cadre (mêmes unités que le reste du décor).
 */
import { pointAt } from "@/lib/ringPath";

const N = 15; // langues autour de l'anneau

type Pt = { x: number; y: number };

/** Anneau + langues : contour extérieur (avec langues de hauteur `k`·h) puis trou pour l'avatar. `v` = variante de forme (animation). */
function flamePath(w: number, r: number, k: number, v: number, base: number): string {
  const f = (n: number) => n.toFixed(1);
  const rOut = r + w / 2;
  const jit = (i: number, s: number) => 1 + Math.sin(i * 2.7 + v * 1.9 + s) * 0.14;
  const E: Pt[] = Array.from({ length: N + 1 }, (_, i) => { const q = pointAt(i / N, base, rOut); return { x: q.x, y: q.y }; });
  let d = `M${f(E[0].x)} ${f(E[0].y)}`;
  for (let i = 0; i < N; i++) {
    const a = E[i], z = E[i + 1], c = pointAt((i + 0.5) / N, base, rOut);
    const tx = -c.ny, ty = c.nx; // tangente (sens horaire)
    const top = Math.max(0, -c.ny);
    const bottom = c.ny > 0.45;
    // hauteur : grande langue au centre du dessus, belles langues sur les côtés (plus hautes vers le haut), petites en bas
    const centre = Math.exp(-(((c.x - 50) / 14) ** 2)) * (c.y < 40 ? 1 : 0);
    const h = (bottom ? 8 : 15 + (1 - c.y / 100) * 14 + centre * 16 + top * 3) * k * jit(i, 0);
    // direction : le feu monte — mélange de la normale et de la verticale (sauf en bas : vers l'extérieur)
    let dx = c.nx * (bottom ? 1 : 0.55), dy = c.ny * (bottom ? 1 : 0.55) + (bottom ? 0 : -0.85);
    const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    const span = Math.hypot(z.x - a.x, z.y - a.y) * 1.05;
    const curl = (i % 2 ? 1 : -1) * span * 0.3 * jit(i, 2);
    const tip = { x: c.x + dx * h + tx * curl, y: c.y + dy * h + ty * curl };
    // flancs en S : un bombé, un creusé, pointe fine
    d += ` C${f(a.x + dx * h * 0.55 - tx * span * 0.34)} ${f(a.y + dy * h * 0.55 - ty * span * 0.34)} ${f(tip.x - dx * h * 0.35 - tx * span * 0.22)} ${f(tip.y - dy * h * 0.35 - ty * span * 0.22)} ${f(tip.x)} ${f(tip.y)}`;
    d += ` C${f(tip.x - dx * h * 0.2 + tx * span * 0.34)} ${f(tip.y - dy * h * 0.2 + ty * span * 0.34)} ${f(z.x + dx * h * 0.25 + tx * span * 0.02)} ${f(z.y + dy * h * 0.25 + ty * span * 0.02)} ${f(z.x)} ${f(z.y)}`;
  }
  d += "Z";
  const m = 80;
  const hr = Math.max(2, r - w / 2 + 0.5);
  for (let j = 0; j <= m; j++) { const q = pointAt(1 - j / m, w * 0.98, hr); d += `${j ? "L" : " M"}${f(q.x)} ${f(q.y)}`; }
  return d + "Z";
}

/** Reflet blanc-jaune qui suit l'anneau en ondulant. */
function glint(w: number, r: number, phase: number): string {
  const f = (n: number) => n.toFixed(1);
  const m = 120;
  let d = "";
  for (let j = 0; j <= m; j++) {
    const t = j / m, q = pointAt(t, w * 0.62, r + w * 0.05), o = Math.sin(t * 60 + phase) * 1.1;
    d += `${j ? "L" : "M"}${f(q.x + q.nx * o)} ${f(q.y + q.ny * o)}`;
  }
  return d;
}

export default function FlameRing({ w, r }: { w: number; r: number }) {
  const anim = (k: number, base: number, fill: string, stroke?: { c: string; sw: number }) => {
    const vals = [0, 1, 2, 0].map((v) => flamePath(w, r, k, v, base));
    return (
      <path fillRule="evenodd" fill={fill} stroke={stroke?.c} strokeWidth={stroke?.sw} strokeLinejoin="round" d={vals[0]}>
        <animate attributeName="d" dur="1.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" values={vals.join(";")} />
      </path>
    );
  };
  return (
    <g className="rf-fire">
      <defs>
        <linearGradient id="fr-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a14" /><stop offset="1" stopColor="#e32d12" /></linearGradient>
        <linearGradient id="fr-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffa21c" /><stop offset="1" stopColor="#ff6a14" /></linearGradient>
        <linearGradient id="fr-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff27c" /><stop offset="1" stopColor="#ffbe1f" /></linearGradient>
      </defs>
      {anim(1, w * 0.35, "url(#fr-o)", { c: "#b3220a", sw: 1.1 })}
      {anim(0.66, w * 0.5, "url(#fr-m)")}
      {anim(0.3, w * 0.72, "url(#fr-c)")}
      <path d={glint(w, r, 0)} fill="none" stroke="#fffbe6" strokeOpacity=".85" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="14 9" className="rf-flow" />
      <path d={glint(w, r, 2)} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".7" strokeLinecap="round" strokeDasharray="6 16" className="rf-flow rf-flow2" />
      {[24, 42, 60, 78].map((x, i) => <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.5}s` }} cx={x} cy={-12} r={1.1} fill="#ffd23f" />)}
    </g>
  );
}
