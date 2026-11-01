/**
 * Couronne de flammes du cadre « Flamme » : un mur de vraies flammes de dessin animé (orange à contour sombre, cœur jaune, pointe claire)
 * qui entoure TOUT le cadre — hautes et dressées en haut, penchées vers l'extérieur sur les côtés, courtes sous le cadre — sur deux rangs
 * pour qu'il n'y ait aucun trou, avec des braises qui montent. Composant sans état (SVG + classes CSS `rf-*` de globals.css), à placer
 * DERRIÈRE le cadre dans le repère 100 × 100 de l'avatar. `w` = épaisseur du cadre, `r` = rayon du cadre (mêmes unités).
 */
import { pointAt } from "@/lib/ringPath";

function Tongue({ x, y, s, rot, d, hot }: { x: number; y: number; s: number; rot: number; d: number; hot?: boolean }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(3)}) translate(-50 -112)`}>
      <g className="rf-flick" style={{ animationDelay: `${-d}s` }}>
        {/* contour sombre */}
        <path d="M50 4 C58 24 84 40 84 74 C84 98 69 114 50 114 C31 114 16 98 16 74 C16 56 27 45 33 30 C38 43 42 47 45 43 C49 35 46 16 50 4 Z" fill="#b53100" stroke="#8a2400" strokeWidth="6" strokeLinejoin="round" />
        <path d="M50 8 C57 27 80 42 80 74 C80 96 67 110 50 110 C33 110 20 96 20 74 C20 57 30 47 35 34 C39 45 43 49 46 45 C50 37 47 20 50 8 Z" fill="url(#fr-o)" />
        <path d="M50 38 C55 55 70 63 70 84 C70 100 61 109 50 109 C39 109 30 100 30 84 C30 72 37 66 40 56 C43 64 46 66 48 62 C51 56 49 48 50 38 Z" fill="url(#fr-m)" />
        <path d="M50 70 C54 81 61 87 61 97 C61 105 56 109 50 109 C44 109 39 105 39 97 C39 89 44 85 46 79 C48 83 49 83 50 79 C51 76 50 73 50 70 Z" fill={hot ? "#ffffff" : "url(#fr-c)"} />
        <path d="M36 62 C33 70 33 80 38 88" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3.2" strokeLinecap="round" />
      </g>
    </g>
  );
}

export default function FlameRing({ w, r }: { w: number; r: number }) {
  const rOut = r + w / 2;
  // Orientation : dressée vers le haut sur le dessus et les côtés (comme du vrai feu), vers l'extérieur sous le cadre.
  const place = (t: number, i: number, row: number) => {
    const q = pointAt(t, w * 0.5, rOut);
    const up = Math.max(0, -q.ny); // 1 en haut, 0 sur les côtés, <0 en bas
    const bottom = q.ny > 0.35;
    const outward = q.ang + 90; // orientation « vers l'extérieur »
    const upRot = ((q.ang + 90 + 540) % 360) - 180; // écart avec la verticale, ramené dans [-180,180]
    const rot = bottom ? outward : upRot * 0.45 + (i % 2 ? 4 : -4);
    const s = bottom ? 0.16 + row * 0.02 : 0.22 + up * 0.18 - row * 0.04 + (i % 3 === 0 ? 0.03 : 0);
    return { x: q.x + q.nx * (row ? 0 : 1.5), y: q.y + q.ny * (row ? 0 : 1.5), rot, s, d: ((i * 0.37) % 1.2) + row * 0.5 };
  };
  const row1 = Array.from({ length: 22 }, (_, i) => place((i + 0.5) / 22, i, 0));
  const row2 = Array.from({ length: 18 }, (_, i) => place((i + 0.15) / 18, i + 1, 1));
  return (
    <g className="rf-fire">
      <defs>
        <linearGradient id="fr-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9a1a" /><stop offset="1" stopColor="#ff3d00" /></linearGradient>
        <linearGradient id="fr-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe45c" /><stop offset="1" stopColor="#ffa400" /></linearGradient>
        <linearGradient id="fr-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe0" /><stop offset="1" stopColor="#ffe98a" /></linearGradient>
      </defs>
      {row2.map((f, i) => <Tongue key={`b${i}`} {...f} />)}
      {row1.map((f, i) => <Tongue key={`a${i}`} {...f} hot={i % 7 === 0} />)}
      {[18, 38, 62, 82].map((x, i) => <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.5}s` }} cx={x} cy={-6} r={1.1} fill="#ffd23f" />)}
    </g>
  );
}
