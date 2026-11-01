/**
 * Décors vectoriels des contours d'avatar : chaque niveau a SON motif, répété TOUT AUTOUR du cadre (mur de flammes, rangée de diamants
 * taillés, couronne de lauriers, chaîne d'argent, engrenage de bronze, arcs électriques, cœurs, pointes de couronne, galaxie, symboles,
 * étoiles arc-en-ciel), dessinés en SVG et animés en CSS
 * (globals.css, classes `rf-*`). Composant sans état ni effet : utilisable dans un Server Component.
 * Le dessin est fait dans un repère 100 × 100 qui recouvre l'avatar ; les motifs débordent volontairement du cadre.
 */
import type { ReactNode } from "react";

/** Flamme en trois couches (mêmes silhouettes que la flamme de série), plantée par sa base en (x, y). */
function Flame({ x, y, s, rot = 0, d = 0, hot = false }: { x: number; y: number; s: number; rot?: number; d?: number; hot?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-50 -114)`}>
      <g className="rf-flick" style={{ animationDelay: `${-d}s` }}>
        <path d="M50 6 C57 26 82 42 82 74 C82 98 68 114 50 114 C32 114 18 98 18 74 C18 56 28 46 34 32 C38 44 42 48 45 44 C49 36 46 18 50 6 Z" fill="url(#rg-fo)" />
        <path d="M50 40 C55 56 70 64 70 84 C70 100 61 110 50 110 C39 110 30 100 30 84 C30 72 37 66 40 56 C43 64 46 66 48 62 C51 56 49 48 50 40 Z" fill="url(#rg-fm)" />
        <path d="M50 72 C53 82 61 88 61 98 C61 106 56 110 50 110 C44 110 39 106 39 98 C39 90 44 86 46 80 C48 84 49 84 50 80 C51 77 50 75 50 72 Z" fill={hot ? "#fff" : "url(#rg-fc)"} />
      </g>
    </g>
  );
}

function Star({ x, y, r = 1, d = 0, fill = "#fff" }: { x: number; y: number; r?: number; d?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${r})`}>
      <path className="rf-twinkle" style={{ animationDelay: `${-d}s` }} d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4Z" fill={fill} />
    </g>
  );
}


const DEFS: ReactNode = (
  <defs>
    <linearGradient id="rg-fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a00" /><stop offset="1" stopColor="#ff3d00" /></linearGradient>
    <linearGradient id="rg-fm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd23f" /><stop offset="1" stopColor="#ff9c00" /></linearGradient>
    <linearGradient id="rg-fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe0" /><stop offset="1" stopColor="#ffe27a" /></linearGradient>
    <linearGradient id="rg-dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0fbff" /><stop offset=".5" stopColor="#22d3ee" /><stop offset="1" stopColor="#0e7490" /></linearGradient>
    <linearGradient id="rg-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3a3" /><stop offset=".5" stopColor="#f5c518" /><stop offset="1" stopColor="#a16207" /></linearGradient>
    <linearGradient id="rg-sv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#c5cedb" /><stop offset="1" stopColor="#7b8798" /></linearGradient>
    <radialGradient id="rg-br" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#f3c9a0" /><stop offset=".55" stopColor="#cd7f32" /><stop offset="1" stopColor="#6b3208" /></radialGradient>
    <linearGradient id="rg-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd700" /><stop offset=".5" stopColor="#ff6b6b" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
  </defs>
);


type P = { x: number; y: number; nx: number; ny: number; ang: number };

/** Point d'abscisse curviligne `t` (0–1) sur le contour (carré aux coins arrondis, sens horaire), avec la normale sortante. */
function pointAt(t: number, inset = 3, r = 28): P {
  const a = inset, b = 100 - inset, side = b - a - 2 * r, arc = (Math.PI / 2) * r, L = 4 * side + 4 * arc;
  let d = (((t % 1) + 1) % 1) * L;
  let x = 0, y = 0, nx = 0, ny = 0;
  const seg = (len: number) => { if (d <= len) return true; d -= len; return false; };
  const arcAt = (cx: number, cy: number, from: number) => { const f = from + (d / arc) * (Math.PI / 2); nx = Math.cos(f); ny = Math.sin(f); x = cx + r * nx; y = cy + r * ny; };
  if (seg(side)) { x = a + r + d; y = a; ny = -1; }
  else if (seg(arc)) arcAt(b - r, a + r, -Math.PI / 2);
  else if (seg(side)) { x = b; y = a + r + d; nx = 1; }
  else if (seg(arc)) arcAt(b - r, b - r, 0);
  else if (seg(side)) { x = b - r - d; y = b; ny = 1; }
  else if (seg(arc)) arcAt(a + r, b - r, Math.PI / 2);
  else if (seg(side)) { x = a; y = b - r - d; nx = -1; }
  else arcAt(a + r, a + r, Math.PI);
  return { x, y, nx, ny, ang: (Math.atan2(ny, nx) * 180) / Math.PI };
}
/** `n` points régulièrement répartis sur le contour. */
function perimeter(n: number, inset = 3, r = 28): P[] {
  return Array.from({ length: n }, (_, i) => pointAt((i + 0.5) / n, inset, r));
}
/**
 * UNE seule grande flamme qui fait tout le tour : `n` langues de feu géantes qui se touchent par la base, penchées dans le sens de la
 * montée, dessinées comme un seul contour fermé (avec un trou au milieu pour l'avatar). `h` = hauteur, `variant` = autre forme (pour l'animation).
 */
function flameRing(n: number, h: number, variant: number, inset = 4): string {
  const f = (x: number) => x.toFixed(1);
  const E = Array.from({ length: n + 1 }, (_, k) => pointAt(k / n, inset));
  let d = `M${f(E[0].x)} ${f(E[0].y)}`;
  for (let i = 0; i < n; i++) {
    const a = E[i], z = E[i + 1], c = pointAt((i + 0.5) / n, inset), tx = -c.ny, ty = c.nx; // tangente (sens horaire)
    const hh = h * (0.7 + 0.6 * rnd(i, 10 + variant)), lean = 10 + rnd(i, 20 + variant) * 6;
    const tip = { x: c.x + c.nx * hh + tx * lean, y: c.y + c.ny * hh + ty * lean };
    const bx = (a.x + z.x) / 2, by = (a.y + z.y) / 2; // milieu de la base
    // flanc avant bombé, flanc arrière creusé : la langue s'enroule dans le sens de la montée, comme une vraie flamme
    d += ` Q${f(a.x + a.nx * hh * 0.85 + tx * lean * 0.1)} ${f(a.y + a.ny * hh * 0.85 + ty * lean * 0.1)} ${f(tip.x)} ${f(tip.y)}`;
    d += ` Q${f(z.x + (tip.x - z.x) * 0.45 + (bx - z.x) * 0.8)} ${f(z.y + (tip.y - z.y) * 0.45 + (by - z.y) * 0.8)} ${f(z.x)} ${f(z.y)}`;
  }
  d += "Z";
  const m = 64;
  for (let j = 0; j <= m; j++) { const q = pointAt(1 - j / m, inset + 1.6); d += `${j ? "L" : " M"}${f(q.x)} ${f(q.y)}`; }
  return d + "Z";
}
const rnd = (i: number, k = 1) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const at = (p: P, out = 0) => `translate(${(p.x + p.nx * out).toFixed(2)} ${(p.y + p.ny * out).toFixed(2)})`;

export default function AvatarRingDecor({ ringKey }: { ringKey: string }) {
  let body: ReactNode = null;
  switch (ringKey) {
    case "flamme": {
      const dur = "1.2s", ks = "0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1";
      const anim = (hh: number, v: number) => <animate attributeName="d" dur={dur} repeatCount="indefinite" calcMode="spline" keySplines={ks} values={[0, 1, 2, 0].map((k) => flameRing(9, hh, v * 3 + k)).join(";")} />;
      body = (
        <g className="rf-fire">
          <path fillRule="evenodd" fill="url(#rg-fo)" d={flameRing(9, 34, 0)}>{anim(34, 0)}</path>
          <path fillRule="evenodd" fill="url(#rg-fm)" d={flameRing(9, 23, 1)}>{anim(23, 1)}</path>
          <path fillRule="evenodd" fill="url(#rg-fc)" d={flameRing(9, 12, 2)}>{anim(12, 2)}</path>
        </g>
      );
      break;
    }
    case "diamond":
      body = (
        <>
          {perimeter(8, 4).map((p, i) => (
            <g key={i} transform={`${at(p, 3)} rotate(${p.ang + 90}) scale(0.82) translate(-20 -26)`}>
              <g className="rf-gem" style={{ animationDelay: `${-((i * 0.43) % 3.2)}s` }}>
                <path d="M10 0 H30 L40 10 L20 34 L0 10 Z" fill="url(#rg-dg)" stroke="#0e7490" strokeWidth="1" strokeLinejoin="round" />
                <path d="M0 10 H40 M10 0 L14 10 L20 34 M30 0 L26 10 L20 34 M14 10 L20 0 L26 10" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth=".8" strokeLinejoin="round" />
                <path d="M10 0 L14 10 L20 0Z M30 0 L26 10 L20 0Z" fill="#fff" fillOpacity=".6" />
                <path className="rf-glint" d="M20 0 L24 10 L20 34 L16 10Z" fill="#fff" />
              </g>
            </g>
          ))}
          {perimeter(8, 3).map((p, i) => <Star key={i} x={p.x + p.nx * 5 + p.ny * 14} y={p.y + p.ny * 5 - p.nx * 14} r={0.9 + rnd(i, 1) * 0.5} d={rnd(i, 2) * 1.8} />)}
        </>
      );
      break;
    case "gold":
      body = (
        <>
          {perimeter(52, 3.5).map((p, i) => (
            <ellipse key={i} cx={0} cy={0} rx="2.3" ry="5.2" transform={`${at(p, i % 2 ? 3 : -0.5)} rotate(${p.ang + (i % 2 ? 32 : -32)})`} fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".45" />
          ))}
          {perimeter(4, 3.5).map((p, i) => <g key={i} transform={at(p, 8)}><path className="rf-pulse" d="M0 -6 L1.8 -2 L6 -1.6 L2.9 1.2 L3.7 5.5 L0 3.3 L-3.7 5.5 L-2.9 1.2 L-6 -1.6 L-1.8 -2Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".4" /></g>)}
        </>
      );
      break;
    case "silver":
      body = (
        <>
          {perimeter(34, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 1.2)} rotate(${p.ang + 90})`}>
              <ellipse rx={i % 2 ? 1.5 : 3.8} ry={i % 2 ? 3.8 : 1.9} fill="none" stroke="#6b7686" strokeWidth="1.5" />
              <ellipse rx={i % 2 ? 1.5 : 3.8} ry={i % 2 ? 3.8 : 1.9} fill="none" stroke="url(#rg-sv)" strokeWidth=".8" />
            </g>
          ))}
          {perimeter(7, 3).map((p, i) => <Star key={i} x={p.x + p.nx * 8} y={p.y + p.ny * 8} r={0.7 + rnd(i, 1) * 0.4} d={rnd(i, 2) * 1.8} fill="#fff" />)}
        </>
      );
      break;
    case "bronze":
      body = (
        <>
          {perimeter(30, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 1.2)} rotate(${p.ang + 90})`}>
              <rect x="-2.4" y="-5.2" width="4.8" height="6" rx="1" fill="url(#rg-br)" stroke="#5b2a08" strokeWidth=".55" />
              {i % 3 === 0 && <circle className="rf-ember-pulse" style={{ animationDelay: `${-i * 0.2}s` }} cx="0" cy="-3" r="0.9" fill="#ffe3c2" />}
            </g>
          ))}
        </>
      );
      break;
    case "premium": {
      const pts = perimeter(110, 3);
      const d = pts.map((p, i) => { const o = i % 2 ? 3.2 : -0.6; return `${i ? "L" : "M"}${(p.x + p.nx * o).toFixed(1)} ${(p.y + p.ny * o).toFixed(1)}`; }).join(" ") + "Z";
      body = (
        <>
          <path className="rf-arc" d={d} fill="none" stroke="#f5d0fe" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          <path className="rf-arc" style={{ animationDelay: "-0.7s" }} d={d} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeOpacity=".7" strokeLinejoin="round" />
          {perimeter(14, 3).map((p, i) => {
            const L = 6 + rnd(i, 1) * 6, k = (rnd(i, 2) - 0.5) * 5;
            return <path key={i} className="rf-bolt" style={{ animationDelay: `${-rnd(i, 3) * 1.6}s` }} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} l${(p.nx * L * 0.5 + k).toFixed(1)} ${(p.ny * L * 0.5).toFixed(1)} l${(-k * 1.4).toFixed(1)} ${(p.ny * 1.5).toFixed(1)} l${(p.nx * L * 0.5 + k * 0.4).toFixed(1)} ${(p.ny * L * 0.6).toFixed(1)}`} fill="none" stroke="#fbeaff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </>
      );
      break;
    }
    case "famille":
      body = (
        <>
          {perimeter(24, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 3)} rotate(${p.ang + 90}) scale(.6)`}>
              <path className="rf-beat" style={{ animationDelay: `${-i * 0.12}s` }} d="M0 6 C-9 -1 -6 -9 0 -4 C6 -9 9 -1 0 6Z" fill={["#f9a8d4", "#5eead4", "#fda4af", "#99f6e4"][i % 4]} stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
            </g>
          ))}
        </>
      );
      break;
    case "pro": {
      const feathers = [[-84, 22], [-70, 30], [-56, 36], [-42, 40], [-28, 41], [-14, 38], [0, 33], [14, 26], [28, 19]];
      const wing = (
        <g className="rf-wing">
          {feathers.map(([ang, L], i) => (
            <g key={i} transform={`translate(5 46) rotate(${ang})`}>
              <path d={`M0 0 C${-L * 0.2} ${-7} ${-L * 0.7} ${-7.5} ${-L} -0.6 C${-L * 0.7} 3.4 ${-L * 0.25} 5 0 0Z`} fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".55" strokeLinejoin="round" />
              <path d={`M-3 0 L${-L * 0.92} -0.4`} stroke="#fff7cc" strokeWidth=".6" strokeOpacity=".85" strokeLinecap="round" />
            </g>
          ))}
        </g>
      );
      body = (
        <>
          {wing}
          <g transform="translate(100 0) scale(-1 1)">{wing}</g>
          <g transform="translate(50 4) scale(1.15)">
            <g className="rf-pulse">
              <path d="M-17 6 C-17 -3 -15 -12 -13 -14 L-7 -5 L0 -17 L7 -5 L13 -14 C15 -12 17 -3 17 6Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".7" strokeLinejoin="round" />
              <path d="M-17 6 H17 V11 C10 13 -10 13 -17 11Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".7" />
              <path d="M-12 1 C-5 -4 5 -4 12 1" fill="none" stroke="#fff7cc" strokeWidth=".7" strokeOpacity=".8" />
              <circle cx="-13" cy="-14" r="2" fill="#ef4444" stroke="#fff" strokeWidth=".4" /><circle cx="0" cy="-17" r="2.4" fill="#38bdf8" stroke="#fff" strokeWidth=".4" /><circle cx="13" cy="-14" r="2" fill="#ef4444" stroke="#fff" strokeWidth=".4" />
              <circle cx="0" cy="8.6" r="1.7" fill="#fff" /><circle cx="-8" cy="8.4" r="1.2" fill="#a7f3d0" /><circle cx="8" cy="8.4" r="1.2" fill="#a7f3d0" />
            </g>
          </g>
          <Star x={14} y={2} r={0.9} d={0.2} fill="#fff7cc" />
          <Star x={86} y={2} r={0.9} d={0.9} fill="#fff7cc" />
          <Star x={-30} y={30} r={0.8} d={0.5} fill="#fff7cc" />
          <Star x={130} y={30} r={0.8} d={1.3} fill="#fff7cc" />
          <Star x={-26} y={64} r={0.7} d={1.1} fill="#fff7cc" />
          <Star x={126} y={64} r={0.7} d={0.7} fill="#fff7cc" />
        </>
      );
      break;
    }
    case "elite":
      body = (
        <>
          <g className="rf-orbit">
            <circle cx="50" cy="50" r="58" fill="none" stroke="url(#rg-sh)" strokeWidth=".6" strokeOpacity=".5" strokeDasharray="2 5" />
            <circle cx="50" cy="-8" r="3" fill="#22d3ee" /><circle cx="50" cy="-8" r="5.5" fill="#22d3ee" fillOpacity=".25" />
          </g>
          <g className="rf-orbit rf-orbit-rev"><circle cx="50" cy="50" r="53" fill="none" stroke="#a78bfa" strokeWidth=".5" strokeOpacity=".4" /><circle cx="103" cy="50" r="2.2" fill="#c4b5fd" /></g>
          {perimeter(70, 3).map((p, i) => <Star key={i} x={p.x + p.nx * (1 + rnd(i, 1) * 9)} y={p.y + p.ny * (1 + rnd(i, 1) * 9)} r={0.28 + rnd(i, 2) * 0.55} d={rnd(i, 3) * 1.8} fill={["#fff", "#c4b5fd", "#67e8f9", "#e0e7ff"][i % 4]} />)}
        </>
      );
      break;
    case "mathador":
      body = (
        <>
          {perimeter(20, 3).map((p, i) => (
            <text key={i} className="rf-glyph" style={{ animationDelay: `${-i * 0.18}s` }} x={p.x + p.nx * 6} y={p.y + p.ny * 6 + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill="#818cf8" stroke="#312e81" strokeWidth=".4">{["+", "×", "÷", "−"][i % 4]}</text>
          ))}
        </>
      );
      break;
    case "admin":
      body = (
        <g className="rf-hue">
          {perimeter(30, 3.5).map((p, i) => (
            <g key={i} transform={at(p, 3)}>
              <path className="rf-twinkle" style={{ animationDelay: `${-i * 0.11}s` }} d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z" fill={`hsl(${(i * 360) / 30} 95% 62%)`} stroke="#fff" strokeWidth=".4" />
            </g>
          ))}
        </g>
      );
      break;
    default:
      return null;
  }
  return (
    <svg className="rf-decor" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {DEFS}
      {body}
    </svg>
  );
}
